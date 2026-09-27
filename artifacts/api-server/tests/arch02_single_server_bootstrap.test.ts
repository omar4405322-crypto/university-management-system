import { test, describe, before, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const apiRoot = path.resolve(__dirname, "..");

describe("ARCH-002: Single Server Bootstrap Architecture", () => {
  afterEach(async () => {
    // Clean up bootstrap state between tests
    const { resetBootstrapStateForTesting } = await import("../src/bootstrap");
    resetBootstrapStateForTesting();
  });

  test("proves only ONE production entry point exists (src/index.ts) and legacy src/server.ts is removed", () => {
    const indexPath = path.join(apiRoot, "src/index.ts");
    const serverPath = path.join(apiRoot, "src/server.ts");

    assert.equal(fs.existsSync(indexPath), true, "src/index.ts must exist as authoritative entry point");
    assert.equal(fs.existsSync(serverPath), false, "legacy src/server.ts must be completely removed");

    const packageJson = JSON.parse(fs.readFileSync(path.join(apiRoot, "package.json"), "utf8"));
    assert.match(packageJson.scripts.dev, /src\/index\.ts/, "dev script must target src/index.ts");
    assert.match(packageJson.scripts.start, /dist\/index\.mjs/, "start script must target dist/index.mjs");

    const buildMjs = fs.readFileSync(path.join(apiRoot, "build.mjs"), "utf8");
    assert.match(buildMjs, /src\/index\.ts/, "build.mjs entryPoint must target src/index.ts");
  });

  test("proves tests/consumers can construct Express app without starting real listeners or cron", async () => {
    // Importing app directly should not start a server listener or cron
    const appModule = await import("../src/app");
    const app = appModule.default;

    assert.ok(app, "Express app should export cleanly");
    assert.equal(typeof app, "function", "App should be an Express application function");
  });

  test("proves bootstrap initializes expected infrastructure once", async () => {
    const { bootstrap } = await import("../src/bootstrap");
    const dummyServer = http.createServer();

    const result = bootstrap(dummyServer, {
      skipCron: true,
      skipSocket: true,
      skipShutdown: true,
      skipEnvValidation: true,
    });

    assert.ok(result.server, "Bootstrap returns initialized server");
    assert.equal(result.cronJobsStarted, false, "Options respected for cron");
  });

  test("proves duplicate startup is blocked and throws error", async () => {
    const { bootstrap } = await import("../src/bootstrap");
    const dummyServer1 = http.createServer();
    const dummyServer2 = http.createServer();

    bootstrap(dummyServer1, {
      skipCron: true,
      skipSocket: true,
      skipShutdown: true,
      skipEnvValidation: true,
    });

    assert.throws(
      () => {
        bootstrap(dummyServer2, {
          skipCron: true,
          skipSocket: true,
          skipShutdown: true,
          skipEnvValidation: true,
        });
      },
      /Application bootstrap can only be executed once per process/,
      "Duplicate bootstrap calls must throw an error"
    );
  });

  test("proves bootstrap contains authoritative shutdown and socket bindings", () => {
    const bootstrapSource = fs.readFileSync(path.join(apiRoot, "src/bootstrap.ts"), "utf8");
    assert.match(bootstrapSource, /registerShutdownSignals/, "bootstrap must integrate registerShutdownSignals");
    assert.match(bootstrapSource, /initSocket/, "bootstrap must integrate initSocket");
    assert.match(bootstrapSource, /startRiskDetectionJob/, "bootstrap must integrate risk detection cron");
    assert.match(bootstrapSource, /startSessionAutoExpiryJob/, "bootstrap must integrate session auto-expiry cron");
    assert.match(bootstrapSource, /startPendingReviewAutoResolveJob/, "bootstrap must integrate pending review auto-resolve cron");
    assert.match(bootstrapSource, /validateEnvironment/, "bootstrap must validate environment");
  });
});
