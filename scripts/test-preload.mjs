import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

// 1. Resolve and load dotenv from api-server without printing contents
let dotenv;
try {
  dotenv = require(path.join(rootDir, 'artifacts/api-server/node_modules/dotenv'));
} catch {
  try {
    dotenv = require('dotenv');
  } catch {
    // If dotenv is unavailable, continue with existing process.env
  }
}

if (dotenv) {
  // Load .env.test into process.env if present
  dotenv.config({ path: path.join(rootDir, '.env.test'), quiet: true });
}

// 2. Pre-set dev URL check
const preSetDevUrl = process.env.DATABASE_URL?.trim();
const testDbUrl = process.env.TEST_DATABASE_URL?.trim();

// Strict disallowed database names and test naming pattern
const DISALLOWED_DB_NAMES = new Set([
  'university',
  'neondb',
  'postgres',
  'production',
  'prod',
  'defaultdb',
]);
const TEST_DB_NAME_REGEX = /(_test$|^test_)/i;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function parsePostgresComponents(rawUrl) {
  let parsed;
  try {
    parsed = new URL(
      rawUrl.replace(/^postgresql:\/\//i, 'http://').replace(/^postgres:\/\//i, 'http://')
    );
  } catch {
    throw new Error('Database connection URL format is invalid.');
  }

  const rawPath = parsed.pathname.replace(/^\//, '').split('?')[0];
  const databaseName = decodeURIComponent(rawPath).trim();
  const host = parsed.hostname.toLowerCase().trim();

  return { host, databaseName };
}

export function assertTestDatabasePreload(env = process.env) {
  const currentTestUrl = env.TEST_DATABASE_URL?.trim();
  const currentDevUrl = preSetDevUrl;

  if (!currentTestUrl) {
    throw new Error(
      'Refusing test execution: TEST_DATABASE_URL is not set. Tests must target a dedicated test database, never dev or production.'
    );
  }

  if (currentDevUrl && currentTestUrl === currentDevUrl) {
    const { databaseName: devDbName } = parsePostgresComponents(currentDevUrl);
    if (!TEST_DB_NAME_REGEX.test(devDbName) || DISALLOWED_DB_NAMES.has(devDbName.toLowerCase())) {
      throw new Error(
        'Refusing test execution: TEST_DATABASE_URL matches pre-set development DATABASE_URL. Test and development databases must be separate.'
      );
    }
  }

  const { host, databaseName } = parsePostgresComponents(currentTestUrl);

  if (!databaseName) {
    throw new Error('Refusing test execution: test database name is missing in connection string.');
  }

  if (DISALLOWED_DB_NAMES.has(databaseName.toLowerCase())) {
    throw new Error(
      `Refusing test execution: database name "${databaseName}" is disallowed in test environment.`
    );
  }

  if (!TEST_DB_NAME_REGEX.test(databaseName)) {
    throw new Error(
      `Refusing test execution: database name "${databaseName}" must end with "_test" or start with "test_".`
    );
  }

  const isCI = env.CI === 'true' || env.CI === '1';
  const isLocal = LOCAL_HOSTS.has(host);

  if (!isLocal && !isCI) {
    throw new Error(
      `Refusing test execution: non-local host "${host}" is not permitted for test database unless CI=true.`
    );
  }

  return { host, databaseName, isLocal, isCI };
}

// Enforce test mode and synchronize DATABASE_URL to TEST_DATABASE_URL
process.env.NODE_ENV = 'test';

if (!process.env.TEST_DATABASE_URL?.trim()) {
  throw new Error(
    'Refusing test execution: TEST_DATABASE_URL is not set. Tests must target a dedicated test database, never dev or production.'
  );
}

assertTestDatabasePreload(process.env);
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

