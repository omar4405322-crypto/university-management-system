import { readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import process from "node:process";

const apiDirectory = path.resolve(import.meta.dirname, "../artifacts/api-server");
const testsDirectory = path.join(apiDirectory, "tests");

// List of tests that explicitly execute real database transactions or SQL against PostgreSQL
const INTEGRATION_TEST_NAMES = new Set([
  "deferred_schema_fixes.test.ts",
  "attendance_pending_review_regression.test.ts",
  "p5_01_real_postgres_closure.test.ts",
  "ai_knowledge_rag.test.ts",
  "knowledge_production_hardening.test.ts",
  "ai_cancellation_and_privacy.test.ts",
  "ai_cross_domain_analytics.test.ts",
]);

/**
 * Checks whether PostgreSQL is reachable on host and port specified by DATABASE_URL
 */
async function isDatabaseReachable(databaseUrl = process.env.DATABASE_URL) {
  let host = "localhost";
  let port = 5432;

  if (databaseUrl) {
    try {
      // Clean url to standard URL parser
      const parsed = new URL(databaseUrl.replace("postgresql://", "http://").replace("postgres://", "http://"));
      host = parsed.hostname || "localhost";
      port = parsed.port ? parseInt(parsed.port, 10) : 5432;
    } catch {
      // Default fallback
    }
  }

  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port, timeout: 1500 });
    socket.once("connect", () => {
      socket.destroy();
      resolve({ reachable: true, host, port });
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve({ reachable: false, host, port });
    });
    socket.once("error", () => {
      socket.destroy();
      resolve({ reachable: false, host, port });
    });
  });
}

const args = process.argv.slice(2);
const isUnitOnly = args.includes("--unit");
const isIntegrationOnly = args.includes("--integration");

const allFiles = (await readdir(testsDirectory))
  .filter((file) => file.endsWith(".test.ts"))
  .sort();

if (allFiles.length === 0) {
  throw new Error("No API test files were found.");
}

const unitFiles = allFiles.filter((file) => !INTEGRATION_TEST_NAMES.has(file));
const integrationFiles = allFiles.filter((file) => INTEGRATION_TEST_NAMES.has(file));

let selectedFiles;

if (isUnitOnly) {
  console.log(`[TEST TIER] Running HERMETIC UNIT SUITE (${unitFiles.length} test suites)`);
  selectedFiles = unitFiles;
} else if (isIntegrationOnly) {
  console.log(`[TEST TIER] Running DATABASE INTEGRATION SUITE (${integrationFiles.length} test suites)`);
  const dbStatus = await isDatabaseReachable();
  if (!dbStatus.reachable) {
    console.error(`[ERROR] PostgreSQL database is not reachable at ${dbStatus.host}:${dbStatus.port}.`);
    console.error(`[ERROR] Integration tests require a live database. Please provision PostgreSQL or run unit tests via: pnpm run test:api:unit`);
    process.exit(1);
  }
  selectedFiles = integrationFiles;
} else {
  // Default: smart tiered execution
  const dbStatus = await isDatabaseReachable();
  if (dbStatus.reachable) {
    console.log(`[TEST TIER] PostgreSQL detected at ${dbStatus.host}:${dbStatus.port}. Running FULL SUITE (${allFiles.length} test suites: ${unitFiles.length} unit + ${integrationFiles.length} integration)`);
    selectedFiles = allFiles;
  } else {
    console.log(`[TEST TIER] PostgreSQL is not reachable at ${dbStatus.host}:${dbStatus.port}.`);
    console.log(`[TEST TIER] Running HERMETIC UNIT SUITE (${unitFiles.length} test suites).`);
    console.log(`[INFO] Skipped ${integrationFiles.length} database-dependent integration tests: ${integrationFiles.join(", ")}`);
    console.log(`[INFO] To run integration tests, start PostgreSQL and run: pnpm run test:api:integration\n`);
    selectedFiles = unitFiles;
  }
}

const child = spawn(
  process.execPath,
  ["--import", "tsx", "--test", "--test-concurrency=1", ...selectedFiles.map((file) => path.join("tests", file))],
  {
    cwd: apiDirectory,
    env: process.env,
    stdio: "inherit",
  },
);

child.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`API tests terminated by signal ${signal}.`);
    process.exitCode = 1;
    return;
  }

  process.exitCode = code ?? 1;
});
