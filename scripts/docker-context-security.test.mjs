import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dockerignorePath = resolve(repositoryRoot, '.dockerignore');
const dockerfilePath = resolve(repositoryRoot, 'Dockerfile');
const npmrcPath = resolve(repositoryRoot, '.npmrc');

function parseRules(contents) {
  return contents
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

function globToRegExp(pattern) {
  let expression = '';

  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];

    if (character === '*' && pattern[index + 1] === '*') {
      if (pattern[index + 2] === '/') {
        expression += '(?:.*/)?';
        index += 2;
      } else {
        expression += '.*';
        index += 1;
      }
    } else if (character === '*') {
      expression += '[^/]*';
    } else if (character === '?') {
      expression += '[^/]';
    } else {
      expression += character.replace(/[\\^$+?.()|{}[\]]/gu, '\\$&');
    }
  }

  const prefix = pattern.includes('/') ? '^' : '(?:^|.*/)';
  return new RegExp(`${prefix}${expression}$`, 'u');
}

function isIgnored(path, rules) {
  const normalizedPath = path.replaceAll('\\', '/').replace(/^\.\//u, '');
  let ignored = false;

  for (const rawRule of rules) {
    const negated = rawRule.startsWith('!');
    const directoryOnly = rawRule.endsWith('/');
    if (negated && directoryOnly) continue;

    const rule = (negated ? rawRule.slice(1) : rawRule).replace(/^\//u, '').replace(/\/$/u, '');
    if (globToRegExp(rule).test(normalizedPath)) ignored = !negated;
  }

  return ignored;
}

const dockerignore = readFileSync(dockerignorePath, 'utf8');
const rules = parseRules(dockerignore);
const dockerfile = readFileSync(dockerfilePath, 'utf8');
const npmrc = readFileSync(npmrcPath, 'utf8');

const sensitiveCanaries = [
  '.env',
  'artifacts/api-server/.env',
  'artifacts/api-server/.env.production',
  'artifacts/api-server/private.env',
  'artifacts/api-server/src/client-secret.json',
  'lib/db/src/secrets.yaml',
  'artifacts/api-server/prisma/migrations/999_canary/.env',
  'artifacts/api-server/prisma/migrations/999_canary/private.key',
  'artifacts/api-server/server_err.log',
  'artifacts/api-server/private.pem',
  'artifacts/api-server/private.key',
  'artifacts/api-server/private.p12',
  'artifacts/api-server/private.pfx',
  'artifacts/api-server/id_rsa_prod',
  'artifacts/api-server/id_ed25519_prod',
  'artifacts/api-server/credentials.json',
  'artifacts/api-server/service-account-prod.json',
  'artifacts/api-server/.npmrc',
  'lib/db/.npmrc',
  'artifacts/api-server/.yarnrc.yml',
  'artifacts/api-server/backups/production.dump',
  'artifacts/api-server/backups/production.bak',
  'artifacts/api-server/backup/production.sql',
  'artifacts/api-server/local.sqlite3',
  'artifacts/api-server/local.db-wal',
  'artifacts/api-server/local.db-shm',
  'artifacts/api-server/local.sqlite-wal',
  'artifacts/api-server/local.sqlite-shm',
  'artifacts/api-server/uploads/profiles/student.jpg',
  'artifacts/api-server/node_modules/package/index.js',
  'artifacts/api-server/dist/index.mjs',
  'lib/db/tsconfig.tsbuildinfo',
  '.git/config',
  'artifacts/api-server/.DS_Store',
  'lib/db/Thumbs.db',
  'artifacts/api-server/.cache/tool-state.json',
  'artifacts/api-server/.local/runtime-state.json',
  'artifacts/api-server/.expo/settings.json',
];

for (const path of sensitiveCanaries) {
  assert.equal(isIgnored(path, rules), true, `Docker build context must exclude ${path}`);
}

const requiredBuildInputs = [
  'package.json',
  'pnpm-workspace.yaml',
  'pnpm-lock.yaml',
  'lib/db/src/index.ts',
  'lib/api-zod/src/index.ts',
  'artifacts/api-server/src/index.ts',
  'artifacts/api-server/src/attendance/drivers/QrDriver.ts',
  'artifacts/api-server/build.mjs',
  'artifacts/api-server/package.json',
  'artifacts/api-server/prisma/schema.prisma',
  'artifacts/api-server/prisma/migrations/0000_baseline_existing_database/migration.sql',
  'artifacts/api-server/prisma/migrations/migration_lock.toml',
];

for (const path of requiredBuildInputs) {
  assert.equal(isIgnored(path, rules), false, `Docker build context must retain ${path}`);
}

assert.doesNotMatch(
  npmrc,
  /^\s*(?:\/\/[^\s=]+:)?(?:_authToken|_auth|_password|password|token|secret|username)\s*=/gimu,
  'Registry credentials must use a build secret rather than the .npmrc copied by Dockerfile'
);

function getDockerInstructions(contents) {
  return contents
    .replace(/\\\r?\n\s*/gu, ' ')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => /^(?:COPY|ADD)\s+/iu.test(line));
}

function getCopyDetails(instruction) {
  const [, operation, rawArguments] = instruction.match(/^(COPY|ADD)\s+(.+)$/iu) ?? [];
  if (!operation || !rawArguments) return { copiesFromEarlierStage: false, destination: '', sources: [] };

  let argumentsText = rawArguments.trim();
  let copiesFromEarlierStage = false;
  while (argumentsText.startsWith('--')) {
    const separator = argumentsText.search(/\s/u);
    if (separator === -1) return { copiesFromEarlierStage, destination: '', sources: [] };
    const flag = argumentsText.slice(0, separator);
    if (flag.toLowerCase().startsWith('--from=')) copiesFromEarlierStage = true;
    argumentsText = argumentsText.slice(separator).trim();
  }

  if (argumentsText.startsWith('[')) {
    const values = JSON.parse(argumentsText);
    return {
      copiesFromEarlierStage,
      destination: values.at(-1) ?? '',
      sources: values.slice(0, -1),
    };
  }

  const values = argumentsText.match(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\S+/gu) ?? [];
  const normalizedValues = values.map((value) => value.replace(/^(?:"|')|(?:"|')$/gu, ''));
  return {
    copiesFromEarlierStage,
    destination: normalizedValues.at(-1) ?? '',
    sources: normalizedValues.slice(0, -1),
  };
}

function normalizeCopyPath(path) {
  return path.replaceAll('\\', '/').replace(/\/\.$/u, '').replace(/\/+$/u, '');
}

function getHostSources(instruction) {
  const details = getCopyDetails(instruction);
  return details.copiesFromEarlierStage ? [] : details.sources;
}

for (const instruction of getDockerInstructions(dockerfile)) {
  for (const source of getHostSources(instruction)) {
    const normalizedSource = source.replaceAll('\\', '/').replace(/\/+$/u, '');
    assert.equal(
      ['.', '.npmrc', 'lib', 'artifacts/api-server'].includes(normalizedSource),
      false,
      `Dockerfile must copy only explicit build inputs from the host: ${instruction}`
    );
  }
}

for (const instruction of getDockerInstructions(dockerfile)) {
  const { copiesFromEarlierStage, destination, sources } = getCopyDetails(instruction);
  const copiesWholeBuilder =
    copiesFromEarlierStage &&
    normalizeCopyPath(destination) === '/app' &&
    sources.some((source) => normalizeCopyPath(source) === '/app');
  assert.equal(copiesWholeBuilder, false, `The runtime image must not copy the entire builder filesystem: ${instruction}`);
}

assert.equal(rules[0], '**', 'Docker build context must be default-deny');

const requiredDockerCopies = [
  /COPY\s+artifacts\/api-server\/package\.json\s+\.\/artifacts\/api-server\//u,
  /COPY\s+artifacts\/api-server\/src\/\s+\.\/artifacts\/api-server\/src\//u,
  /COPY\s+artifacts\/api-server\/prisma\/schema\.prisma\s+\.\/artifacts\/api-server\/prisma\//u,
  /COPY\s+artifacts\/api-server\/prisma\/migrations\/\s+\.\/artifacts\/api-server\/prisma\/migrations\//u,
  /COPY\s+lib\/api-zod\/src\/\s+\.\/lib\/api-zod\/src\//u,
  /COPY\s+--from=builder\s+\/app\/artifacts\/api-server\/dist\/\s+\.\/artifacts\/api-server\/dist\//u,
  /COPY\s+--from=builder\s+\/app\/node_modules\/\s+\.\/node_modules\//u,
];

for (const pattern of requiredDockerCopies) {
  assert.match(dockerfile, pattern, `Dockerfile is missing required narrow copy ${pattern}`);
}

assert.match(
  dockerfile,
  /^RUN pnpm install --frozen-lockfile(?:\s|$)/mu,
  'Container dependencies must be installed from the committed lockfile'
);
assert.doesNotMatch(
  dockerfile,
  /pnpm install[^\r\n]*--no-frozen-lockfile/u,
  'Container builds must not permit lockfile drift'
);

const runnerStage = dockerfile.slice(dockerfile.indexOf('FROM node:20-alpine AS runner'));
assert.match(runnerStage, /^RUN mkdir -p \/app\/uploads && chown node:node \/app\/uploads$/mu);
assert.match(runnerStage, /^USER node$/mu, 'The runtime image must drop root privileges');
assert(
  runnerStage.indexOf('USER node') < runnerStage.indexOf('CMD '),
  'The production command must execute as the non-root user'
);
console.log('✓ Docker build-context secret exclusions passed');
