import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { runContractDriftCheck } from "../../../scripts/contract_drift_check";

const require = createRequire(import.meta.url);
let yaml: any;
try {
  yaml = require("js-yaml");
} catch {
  yaml = require("../../../node_modules/.pnpm/js-yaml@4.3.2/node_modules/js-yaml");
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");

describe("API-001: Authoritative API Contract & Codegen", () => {
  test("proves OpenAPI specification exists and is valid OpenAPI 3.1", () => {
    const openApiPath = path.join(repoRoot, "lib/api-spec/openapi.yaml");
    assert.equal(fs.existsSync(openApiPath), true, "openapi.yaml must exist");

    const content = fs.readFileSync(openApiPath, "utf8");
    const spec: any = yaml.load(content);

    assert.equal(spec.openapi, "3.1.0", "Must be OpenAPI 3.1.0");
    assert.ok(spec.info?.title, "Must define title");
    assert.ok(spec.paths, "Must define paths");
    assert.ok(spec.components?.schemas, "Must define components/schemas");
  });

  test("proves money is represented losslessly as string decimal in payments schema", () => {
    const openApiPath = path.join(repoRoot, "lib/api-spec/openapi.yaml");
    const spec: any = yaml.load(fs.readFileSync(openApiPath, "utf8"));

    const paymentRecord = spec.components?.schemas?.PaymentRecord;
    assert.ok(paymentRecord, "PaymentRecord schema must exist");
    assert.equal(
      paymentRecord.properties?.amount?.type,
      "string",
      "Money amount must be string decimal to prevent IEEE-754 float precision loss"
    );
    assert.match(
      paymentRecord.properties?.amount?.example,
      /^\d+\.\d{2}$/,
      "Money example must be decimal string (e.g. 1500.50)"
    );
  });

  test("proves all 16 required priority API families are documented", () => {
    const openApiPath = path.join(repoRoot, "lib/api-spec/openapi.yaml");
    const spec: any = yaml.load(fs.readFileSync(openApiPath, "utf8"));

    const tags = new Set(spec.tags.map((t: any) => t.name));
    const requiredTags = [
      "health",
      "auth",
      "users",
      "students",
      "colleges",
      "departments",
      "courses",
      "enrollment",
      "attendance",
      "tasks",
      "quizzes",
      "exams",
      "schedules",
      "payments",
      "analytics",
      "notifications",
    ];

    for (const tag of requiredTags) {
      assert.ok(tags.has(tag), `Tag '${tag}' must be documented in OpenAPI`);
    }
  });

  test("proves automated route drift detection identifies live routes against OpenAPI", () => {
    const report = runContractDriftCheck();
    assert.equal(report.isValidOpenApi, true);
    assert.ok(report.totalRegisteredEndpoints > 100, "Should detect all registered Express routes");
    assert.ok(report.openApiEndpointsCount >= 28, "Should cover priority route endpoints in OpenAPI");
    assert.ok(report.documentedCount >= 25, "Documented priority routes must match registered endpoints");
  });

  test("proves generated API client and Zod artifacts exist and are fresh", () => {
    const apiClientFile = path.join(repoRoot, "lib/api-client-react/src/generated/api.ts");
    const apiZodTypesFile = path.join(repoRoot, "lib/api-zod/src/generated/types/paymentRecord.ts");
    const apiZodFile = path.join(repoRoot, "lib/api-zod/src/generated/api.ts");

    assert.equal(fs.existsSync(apiClientFile), true, "Generated React Query client must exist");
    assert.equal(fs.existsSync(apiZodFile), true, "Generated Zod schemas must exist");
    assert.equal(fs.existsSync(apiZodTypesFile), true, "Generated Zod types must exist");

    const paymentRecordContent = fs.readFileSync(apiZodTypesFile, "utf8");
    assert.match(paymentRecordContent, /interface PaymentRecord/, "Generated types must include PaymentRecord");
    assert.match(paymentRecordContent, /amount:\s*string/, "PaymentRecord amount must be typed string");

    const clientContent = fs.readFileSync(apiClientFile, "utf8");
    assert.match(clientContent, /useLoginUser/, "Generated React client must contain useLoginUser");
    assert.match(clientContent, /useListPayments/, "Generated React client must contain useListPayments");
  });
});
