import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { getMissingRuntimeEnvVars } from "../src/utils/runtimeEnvironment";

const baseEnv = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://example.invalid/app",
  JWT_SECRET: "a".repeat(64),
  ENCRYPTION_KEY: "b".repeat(64),
  REDIS_URL: "rediss://example.invalid",
  CLOUDINARY_CLOUD_NAME: "cloud",
  CLOUDINARY_API_KEY: "key",
  CLOUDINARY_API_SECRET: "secret",
};

assert.deepEqual(getMissingRuntimeEnvVars(baseEnv), []);

assert.deepEqual(
  getMissingRuntimeEnvVars({
    ...baseEnv,
    REDIS_URL: " ",
    CLOUDINARY_API_SECRET: undefined,
  }),
  ["REDIS_URL"],
  "Production must require shared Redis but allow optional Cloudinary profile storage",
);

assert.deepEqual(
  getMissingRuntimeEnvVars({
    ...baseEnv,
    CLOUDINARY_CLOUD_NAME: undefined,
    CLOUDINARY_API_KEY: undefined,
    CLOUDINARY_API_SECRET: undefined,
  }),
  [],
  "Production boot must succeed without optional Cloudinary credentials",
);

assert.deepEqual(
  getMissingRuntimeEnvVars({
    NODE_ENV: "development",
    DATABASE_URL: baseEnv.DATABASE_URL,
    JWT_SECRET: baseEnv.JWT_SECRET,
  }),
  [],
  "Development must not require external Redis or Cloudinary services",
);

const testDir = path.dirname(fileURLToPath(import.meta.url));
const rateLimiterUrl = pathToFileURL(
  path.resolve(testDir, "../src/middleware/rateLimiter.middleware.ts"),
).href;
const require = createRequire(import.meta.url);
const tsxLoaderUrl = pathToFileURL(require.resolve("tsx")).href;
const tempDirectory = mkdtempSync(path.join(tmpdir(), "ums-production-env-"));
const childEnv = { ...process.env };
delete childEnv.NODE_ENV;
delete childEnv.REDIS_URL;
delete childEnv.DOTENV_CONFIG_PATH;

try {
  writeFileSync(path.join(tempDirectory, ".env"), "NODE_ENV= Production \n");
  const child = spawnSync(
    process.execPath,
    [
      "--import",
      tsxLoaderUrl,
      "--input-type=module",
      "--eval",
      `const module = await import(${JSON.stringify(rateLimiterUrl)}); console.log('__POLICY__' + module.rateLimiterPassOnStoreError);`,
    ],
    {
      cwd: tempDirectory,
      env: childEnv,
      encoding: "utf8",
      timeout: 15_000,
    },
  );

  assert.equal(child.status, 0, child.stderr);
  assert.match(
    child.stdout,
    /__POLICY__false/,
    "Production fail-closed policy must be initialized from .env before middleware evaluation",
  );
} finally {
  rmSync(tempDirectory, { recursive: true, force: true });
}

console.log("Production environment security checks passed");
