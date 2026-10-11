import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "../../..");
const composePath = path.join(rootDir, "compose.yaml");
const dockerfilePath = path.join(rootDir, "Dockerfile");
const dockerfileWebPath = path.join(rootDir, "Dockerfile.web");
const nginxConfPath = path.join(rootDir, "nginx.conf");

test("DEVOPS-001A: Dockerfile enforces non-root runtime user", () => {
  const dockerfile = readFileSync(dockerfilePath, "utf-8");
  assert.match(dockerfile, /USER\s+node/i, "API Dockerfile must drop privileges to non-root 'node' user");
});

test("DEVOPS-001B: Database and Redis do not expose public host ports in compose.yaml", () => {
  const compose = readFileSync(composePath, "utf-8");

  // Verify db and redis sections have no host port bindings
  const dbSection = compose.slice(compose.indexOf("  db:"), compose.indexOf("  redis:"));
  const redisSection = compose.slice(compose.indexOf("  redis:"), compose.indexOf("  api:"));

  assert.ok(!dbSection.includes("ports:"), "PostgreSQL must never publish host ports in compose.yaml");
  assert.ok(!redisSection.includes("ports:"), "Redis must never publish host ports in compose.yaml");
});

test("DEVOPS-001C: Compose enforces security options and capability drops", () => {
  const compose = readFileSync(composePath, "utf-8");

  assert.ok(
    compose.includes('no-new-privileges:true'),
    "All compose containers must enforce no-new-privileges:true"
  );
  assert.ok(
    compose.includes("cap_drop:"),
    "Compose services must enforce cap_drop"
  );
  assert.ok(
    compose.includes("- ALL"),
    "Compose services must drop ALL Linux capabilities"
  );
});

test("DEVOPS-001D: Compose enforces read-only root filesystems and explicit tmpfs/volumes", () => {
  const compose = readFileSync(composePath, "utf-8");

  // API and Web services must be read-only
  const apiSection = compose.slice(compose.indexOf("  api:"), compose.indexOf("  web:"));
  const webSection = compose.slice(compose.indexOf("  web:"));

  assert.ok(apiSection.includes("read_only: true"), "API container must use read_only root filesystem");
  assert.ok(apiSection.includes("tmpfs:"), "API container must declare explicit tmpfs mount for /tmp");
  assert.ok(apiSection.includes("/app/uploads"), "API container must declare volume mount for uploads");

  assert.ok(webSection.includes("read_only: true"), "Web container must use read_only root filesystem");
  assert.ok(webSection.includes("tmpfs:"), "Web container must declare tmpfs mounts for /tmp, /var/run, /var/cache/nginx");
});

test("DEVOPS-001E: Log rotation and resource limits are configured across all services", () => {
  const compose = readFileSync(composePath, "utf-8");

  // Verify log rotation
  const occurrencesOfMaxSize = (compose.match(/max-size:\s*"10m"/g) || []).length;
  assert.ok(
    occurrencesOfMaxSize >= 4,
    "Log rotation with max-size 10m must be configured on all 4 services"
  );

  // Verify resource limits
  const occurrencesOfLimits = (compose.match(/limits:/g) || []).length;
  assert.ok(
    occurrencesOfLimits >= 4,
    "CPU/memory resource limits must be configured on all 4 services"
  );
});

test("DEVOPS-001F: Healthchecks are configured on all services", () => {
  const compose = readFileSync(composePath, "utf-8");

  const occurrencesOfHealthcheck = (compose.match(/healthcheck:/g) || []).length;
  assert.equal(
    occurrencesOfHealthcheck,
    3,
    "db, redis, and api services must declare healthcheck probes in compose.yaml"
  );

  const dockerfile = readFileSync(dockerfilePath, "utf-8");
  const dockerfileWeb = readFileSync(dockerfileWebPath, "utf-8");
  assert.ok(
    dockerfileWeb.includes("HEALTHCHECK"),
    "web container Dockerfile must declare HEALTHCHECK instruction"
  );
  assert.ok(
    dockerfile.includes("HEALTHCHECK"),
    "api container Dockerfile must declare HEALTHCHECK instruction"
  );
  assert.match(
    dockerfile,
    /exec\s+node/,
    "api container Dockerfile CMD must use exec node for PID 1 signal forwarding"
  );
});

test("DEVOPS-001G: No plaintext credentials or secrets committed in Dockerfiles or Compose", () => {
  const compose = readFileSync(composePath, "utf-8");
  const dockerfile = readFileSync(dockerfilePath, "utf-8");
  const dockerfileWeb = readFileSync(dockerfileWebPath, "utf-8");

  // Ensure mandatory variables use ${VAR:?Set ... in deploy.env}
  assert.match(compose, /POSTGRES_PASSWORD:\s*\$\{POSTGRES_PASSWORD:\?Set/);
  assert.match(compose, /JWT_SECRET:\s*\$\{JWT_SECRET:\?Set/);
  assert.match(compose, /ENCRYPTION_KEY:\s*\$\{ENCRYPTION_KEY:\?Set/);

  // Ensure no hardcoded API keys in Dockerfiles
  for (const text of [dockerfile, dockerfileWeb]) {
    assert.doesNotMatch(text, /ENV.*(?:PASSWORD|SECRET|KEY)\s*=\s*[a-zA-Z0-9_-]{16,}/i);
  }
});

test("DEVOPS-002: Dockerfiles use pinned base image digests or pinned minor versions", () => {
  const dockerfile = readFileSync(dockerfilePath, "utf-8");
  const dockerfileWeb = readFileSync(dockerfileWebPath, "utf-8");

  // Pinned node:24-alpine and nginx:1.27-alpine
  assert.match(dockerfile, /FROM\s+node:24(?:\.\d+)?-alpine/i, "API Dockerfile must pin Node alpine version");
  assert.match(dockerfileWeb, /FROM\s+node:24(?:\.\d+)?-alpine/i, "Web Dockerfile must pin Node alpine version");
  assert.match(dockerfileWeb, /FROM\s+nginx:1\.27(?:\.\d+)?-alpine/i, "Web Dockerfile must pin Nginx minor version");
});

test("DEVOPS-003: CI workflow runs all six verification gates in exact order with least privilege", () => {
  const ciPath = path.join(rootDir, ".github/workflows/ci.yml");
  const ci = readFileSync(ciPath, "utf-8");

  // Least-privilege permissions
  assert.match(ci, /permissions:\s*\n\s*contents:\s*read/, "CI must specify contents: read least-privilege permission");

  // Pinned Node 24 and pnpm 10.34.4
  assert.match(ci, /version:\s*10\.34\.4/, "CI must pin pnpm version 10.34.4");
  assert.match(ci, /node-version:\s*24/, "CI must pin node-version 24");
  assert.match(ci, /cache:\s*pnpm/, "CI must enable pnpm cache");

  // Services and environment
  assert.match(ci, /redis:\s*\r?\n\s*image:\s*redis:7-alpine/, "CI must declare redis service");
  assert.match(ci, /REDIS_URL:\s*redis:\/\/localhost:6379/, "CI must declare REDIS_URL in env");

  // All 6 gates present in correct order
  const installIdx = ci.indexOf("pnpm install --frozen-lockfile");
  const auditIdx = ci.indexOf("pnpm audit --prod --audit-level high");
  const lintIdx = ci.indexOf("pnpm run lint");
  const typecheckIdx = ci.indexOf("pnpm run typecheck");
  const buildIdx = ci.indexOf("pnpm run build");
  const testIdx = ci.indexOf("pnpm run test");
  const contractIdx = ci.indexOf("pnpm run test:contract");

  assert.ok(installIdx !== -1, "CI must run pnpm install --frozen-lockfile");
  assert.ok(installIdx < auditIdx, "Install must precede audit in CI pipeline");
  assert.ok(auditIdx !== -1, "CI must run pnpm audit --prod --audit-level high");
  assert.ok(lintIdx !== -1, "CI must run pnpm run lint");
  assert.ok(typecheckIdx !== -1, "CI must run pnpm run typecheck");
  assert.ok(buildIdx !== -1, "CI must run pnpm run build");
  assert.ok(testIdx !== -1, "CI must run pnpm run test");
  assert.ok(contractIdx !== -1, "CI must run pnpm run test:contract");
  assert.ok(auditIdx < lintIdx, "Audit must precede lint in CI pipeline");
  assert.ok(lintIdx < typecheckIdx, "Lint must precede typecheck in CI pipeline");
  assert.ok(typecheckIdx < buildIdx, "Typecheck must precede build in CI pipeline");
  assert.ok(buildIdx < testIdx, "Build must precede test in CI pipeline");
  assert.ok(testIdx < contractIdx, "Test must precede test:contract in CI pipeline");
});

test("DEVOPS-004: Nginx config includes static asset caching, SPA fallback, upload limit, and gzip compression", () => {
  const nginx = readFileSync(nginxConfPath, "utf-8");

  // Gzip compression
  assert.match(nginx, /gzip\s+on;/, "Nginx must enable gzip compression");
  assert.match(nginx, /gzip_types\s+[^;]+text\/css/i, "Nginx must compress CSS and JS");

  // Static assets cache control (immutable or 1y)
  assert.match(nginx, /location\s+(?:\^~\s+)?\/assets\//, "Nginx must define /assets/ block for hashed static files");
  assert.match(nginx, /expires\s+1y;|Cache-Control\s+.*max-age=31536000.*immutable/i, "Nginx must cache static assets for 1 year");

  // SPA fallback
  assert.match(nginx, /try_files\s+\$uri\s+\$uri\/\s+\/index\.html;/, "Nginx must include SPA fallback to index.html");

  // Upload limit
  assert.match(nginx, /client_max_body_size\s+55m;/, "Nginx must permit up to 55m for uploads");

  // Proxy timeouts
  assert.match(nginx, /proxy_connect_timeout\s+\d+s;/, "Nginx must define proxy_connect_timeout");
  assert.match(nginx, /proxy_read_timeout\s+\d+s;/, "Nginx must define proxy_read_timeout");
});

test("DEVOPS-005: Release versioning and rollback procedures are formally documented", () => {
  const rollbackPath = path.join(rootDir, "docs/operations/ROLLBACK.md");
  assert.ok(existsSync(rollbackPath), "docs/operations/ROLLBACK.md must exist");
  const rollbackContent = readFileSync(rollbackPath, "utf-8");
  assert.ok(rollbackContent.includes("Rollback Decision Framework"), "ROLLBACK.md must include Decision Framework");

  const releasePath = path.join(rootDir, "docs/operations/RELEASE-VERSIONING.md");
  assert.ok(existsSync(releasePath), "docs/operations/RELEASE-VERSIONING.md must exist");
  const releaseContent = readFileSync(releasePath, "utf-8");
  assert.ok(releaseContent.includes("Semantic Versioning"), "RELEASE-VERSIONING.md must document SemVer policy");
  assert.ok(releaseContent.includes("Pre-Release Quality Gates"), "RELEASE-VERSIONING.md must document release verification gates");
});
