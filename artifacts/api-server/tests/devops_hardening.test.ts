import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "../../..");
const composePath = path.join(rootDir, "compose.yaml");
const dockerfilePath = path.join(rootDir, "Dockerfile");
const dockerfileWebPath = path.join(rootDir, "Dockerfile.web");
const nginxConfPath = path.join(rootDir, "nginx.conf");

test("DEVOPS-001: Dockerfile enforces non-root runtime user", () => {
  const dockerfile = readFileSync(dockerfilePath, "utf-8");
  assert.match(dockerfile, /USER\s+node/i, "API Dockerfile must drop privileges to non-root 'node' user");
});

test("DEVOPS-001: Database and Redis do not expose public host ports in compose.yaml", () => {
  const compose = readFileSync(composePath, "utf-8");

  // Verify db and redis sections have no host port bindings
  const dbSection = compose.slice(compose.indexOf("  db:"), compose.indexOf("  redis:"));
  const redisSection = compose.slice(compose.indexOf("  redis:"), compose.indexOf("  api:"));

  assert.ok(!dbSection.includes("ports:"), "PostgreSQL must never publish host ports in compose.yaml");
  assert.ok(!redisSection.includes("ports:"), "Redis must never publish host ports in compose.yaml");
});

test("DEVOPS-001: Compose enforces security options and capability drops", () => {
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

test("DEVOPS-001: Compose enforces read-only root filesystems and explicit tmpfs/volumes", () => {
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

test("DEVOPS-001: Log rotation and resource limits are configured across all services", () => {
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

test("DEVOPS-001: Healthchecks are configured on all services", () => {
  const compose = readFileSync(composePath, "utf-8");

  const occurrencesOfHealthcheck = (compose.match(/healthcheck:/g) || []).length;
  assert.equal(
    occurrencesOfHealthcheck,
    3,
    "db, redis, and api services must declare healthcheck probes in compose.yaml"
  );

  const dockerfileWeb = readFileSync(dockerfileWebPath, "utf-8");
  assert.ok(
    dockerfileWeb.includes("HEALTHCHECK"),
    "web container Dockerfile must declare HEALTHCHECK instruction"
  );
});

test("DEVOPS-001: No plaintext credentials or secrets committed in Dockerfiles or Compose", () => {
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
