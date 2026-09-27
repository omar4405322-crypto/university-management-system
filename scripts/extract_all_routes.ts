import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const apiServerRoot = path.join(repoRoot, 'artifacts/api-server/src');

export interface ExtractedEndpoint {
  method: string;
  path: string;
  family: string;
}

const HTTP_METHODS = new Set(['get', 'post', 'put', 'delete', 'patch', 'all']);

/**
 * Maps a file path or route path to its primary OpenAPI family.
 */
function deriveFamily(routePath: string): string {
  const parts = routePath.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  const rawFamily = parts[0] || 'health';

  const familyMap: Record<string, string> = {
    auth: 'auth',
    users: 'users',
    students: 'students',
    colleges: 'colleges',
    departments: 'departments',
    courses: 'courses',
    enrollments: 'enrollment',
    enrollment: 'enrollment',
    attendance: 'attendance',
    tasks: 'tasks',
    quizzes: 'quizzes',
    exams: 'exams',
    schedules: 'schedules',
    timetable: 'schedules',
    payments: 'payments',
    analytics: 'analytics',
    notifications: 'notifications',
    healthz: 'health',
    health: 'health',
    ready: 'health',
    search: 'students',
    requests: 'auth',
    'student-groups': 'students',
    'teaching-assistants': 'departments',
    rooms: 'departments',
    dashboard: 'analytics',
    transcripts: 'students',
    transcript: 'students',
  };

  return familyMap[rawFamily] || rawFamily;
}

/**
 * Normalizes combined route path.
 */
function normalizePath(prefix: string, route: string): string {
  let combined = `${prefix}/${route}`.replace(/\/+/g, '/');
  if (combined.endsWith('/') && combined.length > 1) {
    combined = combined.slice(0, -1);
  }
  return combined;
}

/**
 * Resolves imported router variable name to relative router file path.
 */
function extractRouterImports(sourceFile: ts.SourceFile, currentFilePath: string): Map<string, string> {
  const importMap = new Map<string, string>();

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = (node.moduleSpecifier as ts.StringLiteral).text;
      if (node.importClause?.name) {
        // import foo from './routes/foo'
        const resolved = path.resolve(path.dirname(currentFilePath), moduleSpecifier);
        importMap.set(node.importClause.name.text, resolved);
      } else if (node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
        for (const element of node.importClause.namedBindings.elements) {
          const resolved = path.resolve(path.dirname(currentFilePath), moduleSpecifier);
          importMap.set(element.name.text, resolved);
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return importMap;
}

/**
 * Recursively parses a TypeScript route file / AST and returns all mounted endpoints.
 * Uses a recursion call-stack to prevent cycles while permitting the same router
 * to be mounted under multiple distinct prefixes.
 */
export function parseRouteFile(
  filePath: string,
  currentPrefix: string,
  callStack = new Set<string>()
): ExtractedEndpoint[] {
  let candidatePath = filePath;
  if (!candidatePath.endsWith('.ts')) {
    if (fs.existsSync(`${candidatePath}.ts`)) {
      candidatePath = `${candidatePath}.ts`;
    } else if (fs.existsSync(path.join(candidatePath, 'index.ts'))) {
      candidatePath = path.join(candidatePath, 'index.ts');
    } else if (fs.existsSync(`${candidatePath}.routes.ts`)) {
      candidatePath = `${candidatePath}.routes.ts`;
    }
  }

  if (!fs.existsSync(candidatePath)) {
    return [];
  }

  const normalizedKey = path.resolve(candidatePath);
  if (callStack.has(normalizedKey)) {
    // Cycle detected in import graph; break infinite loop
    return [];
  }

  const nextStack = new Set(callStack);
  nextStack.add(normalizedKey);

  const fileContent = fs.readFileSync(candidatePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    candidatePath,
    fileContent,
    ts.ScriptTarget.Latest,
    true
  );

  const importMap = extractRouterImports(sourceFile, candidatePath);
  const endpoints: ExtractedEndpoint[] = [];

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const propName = node.expression.name.text.toLowerCase();
      const firstArg = node.arguments[0];

      // Route handler: router.get('/foo', ...) or app.get('/foo', ...)
      if (HTTP_METHODS.has(propName) && firstArg && ts.isStringLiteral(firstArg)) {
        const routePath = firstArg.text;
        const fullPath = normalizePath(currentPrefix, routePath);
        const method = propName === 'all' ? 'ALL' : propName.toUpperCase();
        endpoints.push({
          method,
          path: fullPath,
          family: deriveFamily(fullPath),
        });
      }

      // Sub-router mount: router.use('/sub', subRouter) or app.use('/api/sub', subRouter)
      if (propName === 'use') {
        let mountPath = '';
        let routerArgIndex = 0;

        if (firstArg && ts.isStringLiteral(firstArg)) {
          mountPath = firstArg.text;
          routerArgIndex = 1;
        }

        // Check if any argument is a known imported router identifier
        for (let i = routerArgIndex; i < node.arguments.length; i++) {
          const arg = node.arguments[i];
          if (ts.isIdentifier(arg)) {
            const targetImport = importMap.get(arg.text);
            if (targetImport) {
              const nestedPrefix = normalizePath(currentPrefix, mountPath);
              const subEndpoints = parseRouteFile(targetImport, nestedPrefix, nextStack);
              endpoints.push(...subEndpoints);
            }
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return endpoints;
}

/**
 * Extracts all active Express route endpoints from the codebase.
 */
export function getAllEndpoints(): ExtractedEndpoint[] {
  const appPath = path.join(apiServerRoot, 'app.ts');
  if (!fs.existsSync(appPath)) {
    throw new Error(`Authoritative app.ts not found at ${appPath}`);
  }

  const rawEndpoints = parseRouteFile(appPath, '');

  // Deduplicate endpoints by METHOD + PATH
  const seen = new Set<string>();
  const uniqueEndpoints: ExtractedEndpoint[] = [];

  for (const ep of rawEndpoints) {
    // Exclude static docs or internal middleware
    if (ep.path.startsWith('/api/docs') || ep.path === '/api' || ep.path === '') {
      continue;
    }

    const key = `${ep.method} ${ep.path}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueEndpoints.push(ep);
    }
  }

  return uniqueEndpoints.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}

if (process.argv[1] === __filename) {
  const endpoints = getAllEndpoints();
  console.log(`[ROUTE EXTRACTOR] Successfully extracted ${endpoints.length} unique routes.`);
  endpoints.slice(0, 10).forEach(e => console.log(`  ${e.method.padEnd(7)} ${e.path}`));
}
