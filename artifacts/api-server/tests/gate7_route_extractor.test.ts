import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { getAllEndpoints, parseRouteFile } from '../../../scripts/extract_all_routes';
import { runContractDriftCheck } from '../../../scripts/contract_drift_check';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const require = createRequire(import.meta.url);
let yaml: any;
try {
  yaml = require('js-yaml');
} catch {
  yaml = require('../../../node_modules/.pnpm/js-yaml@4.3.2/node_modules/js-yaml');
}

describe('Gate 7: Authoritative Route Extractor Regression Suite', () => {
  const endpoints = getAllEndpoints();

  it('A. extracts simple top-level routes', () => {
    const healthz = endpoints.find((e) => e.path === '/api/healthz' && e.method === 'GET');
    const health = endpoints.find((e) => e.path === '/api/health' && e.method === 'GET');
    const ready = endpoints.find((e) => e.path === '/api/ready' && e.method === 'GET');

    assert.ok(healthz, 'Must extract GET /api/healthz');
    assert.ok(health, 'Must extract GET /api/health');
    assert.ok(ready, 'Must extract GET /api/ready');
  });

  it('B. extracts parameterized routes preserving parameter names', () => {
    const courseById = endpoints.find((e) => e.path === '/api/courses/:id' && e.method === 'GET');
    const studentById = endpoints.find((e) => e.path === '/api/students/:id' && e.method === 'GET');
    const overrideBySlotId = endpoints.find((e) => e.path.includes('/:slotId/overrides'));

    assert.ok(courseById, 'Must extract GET /api/courses/:id');
    assert.ok(studentById, 'Must extract GET /api/students/:id');
    assert.ok(overrideBySlotId, 'Must extract parameterized sub-router routes');
  });

  it('C. correctly composes nested router prefixes', () => {
    const nestedScheduleOverride = endpoints.find(
      (e) => e.path.startsWith('/api/schedules/:slotId/overrides') || e.path.startsWith('/api/schedules/overrides')
    );
    assert.ok(nestedScheduleOverride, 'Must extract nested router routes mounted via schedules router');
  });

  it('D. extracts all supported HTTP methods (GET, POST, PUT, DELETE, PATCH)', () => {
    const methods = new Set(endpoints.map((e) => e.method));

    assert.ok(methods.has('GET'), 'Must contain GET routes');
    assert.ok(methods.has('POST'), 'Must contain POST routes');
    assert.ok(methods.has('PUT'), 'Must contain PUT routes');
    assert.ok(methods.has('DELETE'), 'Must contain DELETE routes');
    assert.ok(methods.has('PATCH'), 'Must contain PATCH routes');
  });

  it('E. middleware surrounding routes does not hide endpoints', () => {
    const loginRoute = endpoints.find((e) => e.path === '/api/auth/login' && e.method === 'POST');
    const registerRoute = endpoints.find((e) => e.path === '/api/auth/register' && e.method === 'POST');

    assert.ok(loginRoute, 'Must extract POST /api/auth/login despite middleware wrapping');
    assert.ok(registerRoute, 'Must extract POST /api/auth/register despite middleware wrapping');
  });

  it('F. deterministically deduplicates route registrations', () => {
    const keys = endpoints.map((e) => `${e.method} ${e.path}`);
    const uniqueKeys = new Set(keys);

    assert.equal(keys.length, uniqueKeys.size, 'All extracted method+path combinations must be unique');
    assert.ok(endpoints.length > 100, `Total extracted route count (${endpoints.length}) must be > 100`);
  });

  it('G. extracts the same router mounted under two distinct prefixes', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'unicore-route-test-'));
    try {
      const childRouterPath = path.join(tempDir, 'child.routes.ts');
      fs.writeFileSync(
        childRouterPath,
        `
        import { Router } from 'express';
        const router = Router();
        router.get('/items', (req, res) => res.send([]));
        router.post('/items', (req, res) => res.send({}));
        export default router;
        `
      );

      const parentRouterPath = path.join(tempDir, 'parent.routes.ts');
      fs.writeFileSync(
        parentRouterPath,
        `
        import { Router } from 'express';
        import childRouter from './child.routes';
        const app = Router();
        app.use('/api/prefix-one', childRouter);
        app.use('/api/prefix-two', childRouter);
        export default app;
        `
      );

      const extracted = parseRouteFile(parentRouterPath, '');
      const paths = extracted.map((e) => `${e.method} ${e.path}`).sort();

      assert.deepEqual(paths, [
        'GET /api/prefix-one/items',
        'GET /api/prefix-two/items',
        'POST /api/prefix-one/items',
        'POST /api/prefix-two/items',
      ]);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('H. handles cyclic/recursive router imports gracefully without infinite recursion', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'unicore-cycle-test-'));
    try {
      const fileAPath = path.join(tempDir, 'routerA.ts');
      const fileBPath = path.join(tempDir, 'routerB.ts');

      fs.writeFileSync(
        fileAPath,
        `
        import { Router } from 'express';
        import routerB from './routerB';
        const routerA = Router();
        routerA.get('/ping-a', (req, res) => res.send('a'));
        routerA.use('/sub-b', routerB);
        export default routerA;
        `
      );

      fs.writeFileSync(
        fileBPath,
        `
        import { Router } from 'express';
        import routerA from './routerA';
        const routerB = Router();
        routerB.get('/ping-b', (req, res) => res.send('b'));
        routerB.use('/sub-a', routerA);
        export default routerB;
        `
      );

      const extracted = parseRouteFile(fileAPath, '/api');
      assert.ok(extracted.length >= 2, 'Must extract routes from both files without recursion stack overflow');
      const methodsAndPaths = extracted.map((e) => `${e.method} ${e.path}`);
      assert.ok(methodsAndPaths.includes('GET /api/ping-a'));
      assert.ok(methodsAndPaths.includes('GET /api/sub-b/ping-b'));
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('I. verifies syntax coverage: repository route files use supported static registrations', () => {
    const routesDir = path.resolve(__dirname, '../src/routes');
    const routeFiles = fs.readdirSync(routesDir).filter((f) => f.endsWith('.ts'));

    for (const file of routeFiles) {
      const content = fs.readFileSync(path.join(routesDir, file), 'utf8');

      // Ensure no .route( chaining which would hide paths
      assert.equal(
        content.includes('.route('),
        false,
        `${file} must not use unsupported .route() pattern`
      );
    }
  });

  it('J. verifies contract drift check outputs consistent priority coverage metrics', () => {
    const report = runContractDriftCheck();
    assert.equal(report.isValidOpenApi, true);
    assert.equal(report.coveredPriorityFamilies.length, 16);
    assert.ok(report.totalRegisteredEndpoints >= 210);
    assert.equal(report.openApiEndpointsCount, 36);
    assert.equal(report.documentedCount, 36);
  });
});
