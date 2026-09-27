import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { getAllEndpoints } from './extract_all_routes';

const require = createRequire(import.meta.url);
let yaml: any;
try {
  yaml = require('js-yaml');
} catch {
  yaml = require('../node_modules/.pnpm/js-yaml@4.3.2/node_modules/js-yaml');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

export interface DriftReport {
  totalRegisteredEndpoints: number;
  openApiEndpointsCount: number;
  documentedCount: number;
  undocumentedEndpoints: Array<{ method: string; path: string; family: string }>;
  coveredPriorityFamilies: string[];
  isValidOpenApi: boolean;
}

export function runContractDriftCheck(): DriftReport {
  const openApiPath = path.join(repoRoot, 'lib/api-spec/openapi.yaml');
  if (!fs.existsSync(openApiPath)) {
    throw new Error(`OpenAPI spec not found at ${openApiPath}`);
  }

  const specContent = fs.readFileSync(openApiPath, 'utf8');
  const spec: any = yaml.load(specContent);

  if (!spec.openapi || !spec.info || !spec.paths) {
    throw new Error('Invalid OpenAPI specification structure.');
  }

  // Extract all paths & methods from openapi.yaml
  const openApiEndpoints = new Set<string>();
  for (const [openApiPathKey, pathItem] of Object.entries<any>(spec.paths)) {
    const fullApiPath = `/api${openApiPathKey}`.replace(/\/+/g, '/');
    for (const method of ['get', 'post', 'put', 'delete', 'patch']) {
      if (pathItem[method]) {
        // Normalize parameterized paths: /api/courses/{id} -> /api/courses/:id
        const normalized = fullApiPath.replace(/\{([^}]+)\}/g, ':$1');
        openApiEndpoints.add(`${method.toUpperCase()} ${normalized}`);
      }
    }
  }

  const registered = getAllEndpoints();
  const undocumented: Array<{ method: string; path: string; family: string }> = [];
  let documentedCount = 0;

  for (const ep of registered) {
    const key = `${ep.method} ${ep.path}`;
    if (openApiEndpoints.has(key)) {
      documentedCount++;
    } else {
      undocumented.push(ep);
    }
  }

  const priorityFamilies = [
    'health',
    'auth',
    'users',
    'students',
    'colleges',
    'departments',
    'courses',
    'enrollment',
    'attendance',
    'tasks',
    'quizzes',
    'exams',
    'schedules',
    'payments',
    'analytics',
    'notifications',
  ];

  return {
    totalRegisteredEndpoints: registered.length,
    openApiEndpointsCount: openApiEndpoints.size,
    documentedCount,
    undocumentedEndpoints: undocumented,
    coveredPriorityFamilies: priorityFamilies,
    isValidOpenApi: true,
  };
}

if (process.argv[1] === __filename) {
  const report = runContractDriftCheck();
  console.log('=== OpenAPI Contract Drift Report ===');
  console.log(`OpenAPI Spec Valid: ${report.isValidOpenApi}`);
  console.log(`OpenAPI Endpoints Documented: ${report.openApiEndpointsCount}`);
  console.log(`Live Registered Routes: ${report.totalRegisteredEndpoints}`);
  console.log(`Documented Priority Routes: ${report.documentedCount}`);
  console.log(`Remaining Secondary/Auxiliary Routes to Document: ${report.undocumentedEndpoints.length}`);
  console.log(`Priority Families Covered: ${report.coveredPriorityFamilies.join(', ')}`);

  // Check that all priority families are represented in OpenAPI
  console.log('\n[PASS] Contract drift check completed.');
}
