import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");
const apiRoot = path.resolve(__dirname, "..");

describe("ARCH-001: Prisma as Sole Production ORM", () => {
  test("proves lib/db (Drizzle scaffold) is completely removed from repository", () => {
    const libDbPath = path.join(repoRoot, "lib/db");
    assert.equal(fs.existsSync(libDbPath), false, "lib/db directory must not exist");
  });

  test("proves no Drizzle dependencies or references remain in api-server or workspace configs", () => {
    const apiPackage = JSON.parse(fs.readFileSync(path.join(apiRoot, "package.json"), "utf8"));
    assert.equal(apiPackage.dependencies["@workspace/db"], undefined, "@workspace/db must not be in dependencies");
    assert.equal(apiPackage.dependencies["drizzle-orm"], undefined, "drizzle-orm must not be in dependencies");

    const rootTsconfig = JSON.parse(fs.readFileSync(path.join(repoRoot, "tsconfig.json"), "utf8"));
    const hasLibDbRef = rootTsconfig.references?.some((r: any) => r.path?.includes("lib/db"));
    assert.equal(hasLibDbRef, false, "root tsconfig.json must not reference lib/db");

    const apiTsconfig = JSON.parse(fs.readFileSync(path.join(apiRoot, "tsconfig.json"), "utf8"));
    const hasApiLibDbRef = apiTsconfig.references?.some((r: any) => r.path?.includes("lib/db"));
    assert.equal(hasApiLibDbRef, false, "api-server tsconfig.json must not reference lib/db");
  });

  test("proves Prisma is authoritative with schema and client configured", () => {
    const schemaPath = path.join(apiRoot, "prisma/schema.prisma");
    assert.equal(fs.existsSync(schemaPath), true, "prisma/schema.prisma must exist");

    const prismaClientModule = path.join(apiRoot, "src/utils/prismaClient.ts");
    assert.equal(fs.existsSync(prismaClientModule), true, "src/utils/prismaClient.ts must exist");

    const apiPackage = JSON.parse(fs.readFileSync(path.join(apiRoot, "package.json"), "utf8"));
    assert.ok(apiPackage.dependencies["@prisma/client"], "@prisma/client must be present");
  });

  test("proves dangerous drizzle db-push scripts do not exist in package manifests", () => {
    const rootPackage = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
    const apiPackage = JSON.parse(fs.readFileSync(path.join(apiRoot, "package.json"), "utf8"));

    const allScripts = { ...rootPackage.scripts, ...apiPackage.scripts };
    for (const [name, script] of Object.entries(allScripts)) {
      assert.doesNotMatch(
        String(script),
        /drizzle-kit\s+push/i,
        `Script ${name} must not contain dangerous drizzle-kit push command`
      );
    }
  });
});
