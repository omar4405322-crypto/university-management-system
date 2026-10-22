/**
 * Test Database Safety Guard (T-DB-1)
 *
 * Enforces strict isolation guarantees for test execution:
 * 1. Test database URL is mandatory when NODE_ENV=test.
 * 2. Database name must match test pattern: /(_test$|^test_)/i.
 * 3. Disallowed database names (e.g. university, postgres, neondb, production) are strictly rejected.
 * 4. Database host must be a local loopback interface (localhost, 127.0.0.1, ::1) unless CI=true.
 * 5. Error messages NEVER echo database URLs, passwords, or credentials.
 */

export interface TestDatabaseGuardResult {
  databaseUrl: string;
  databaseName: string;
  host: string;
  isLocal: boolean;
  isCI: boolean;
  isTestEnv: boolean;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const DISALLOWED_DB_NAMES = new Set([
  'university',
  'neondb',
  'postgres',
  'production',
  'prod',
  'defaultdb',
]);

const TEST_DB_NAME_REGEX = /(_test$|^test_)/i;

/**
 * Parses connection string into components safely without retaining or echoing credentials on error.
 */
function parsePostgresComponents(rawUrl: string): { host: string; databaseName: string } {
  let parsed: URL;
  try {
    parsed = new URL(
      rawUrl.replace(/^postgresql:\/\//i, 'http://').replace(/^postgres:\/\//i, 'http://')
    );
  } catch {
    throw new Error('Database connection URL format is invalid.');
  }

  const rawPath = parsed.pathname.replace(/^\//, '').split('?')[0];
  const databaseName = decodeURIComponent(rawPath).trim();
  const host = parsed.hostname.toLowerCase().trim();

  return { host, databaseName };
}

/**
 * Pure function to assert that database configuration satisfies test isolation invariants.
 *
 * @param env - Process environment dictionary to evaluate.
 * @returns Guard evaluation details upon successful validation.
 */
export function assertTestDatabase(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): TestDatabaseGuardResult {
  const nodeEnv = env.NODE_ENV?.trim().toLowerCase();
  const isTestEnv = nodeEnv === 'test';

  const testDbUrl = env.TEST_DATABASE_URL?.trim();
  const rawDbUrl = env.DATABASE_URL?.trim();

  // If not running in test mode, return current configuration without enforcing test invariants
  if (!isTestEnv) {
    const activeUrl = rawDbUrl || testDbUrl || '';
    if (!activeUrl) {
      return {
        databaseUrl: '',
        databaseName: '',
        host: '',
        isLocal: true,
        isCI: false,
        isTestEnv: false,
      };
    }
    const { host, databaseName } = parsePostgresComponents(activeUrl);
    return {
      databaseUrl: activeUrl,
      databaseName,
      host,
      isLocal: LOCAL_HOSTS.has(host),
      isCI: env.CI === 'true' || env.CI === '1',
      isTestEnv: false,
    };
  }

  // 1. Mandatory test database URL in test environment
  if (!testDbUrl) {
    throw new Error(
      'Refusing test execution: TEST_DATABASE_URL is not set. Tests must target a dedicated test database, never dev or production.'
    );
  }

  // 2. In test environment, a set DATABASE_URL must not differ from TEST_DATABASE_URL
  if (rawDbUrl && rawDbUrl !== testDbUrl) {
    throw new Error(
      'Refusing test execution: DATABASE_URL is set but differs from TEST_DATABASE_URL. Prisma connects to DATABASE_URL; test runs must synchronize both to the test database.'
    );
  }

  // 3. Prohibit TEST_DATABASE_URL matching a pre-set dev DATABASE_URL
  if (rawDbUrl && testDbUrl === rawDbUrl) {
    const { databaseName: devDbName } = parsePostgresComponents(rawDbUrl);
    if (!TEST_DB_NAME_REGEX.test(devDbName) || DISALLOWED_DB_NAMES.has(devDbName.toLowerCase())) {
      throw new Error(
        'Refusing test execution: TEST_DATABASE_URL matches pre-set development DATABASE_URL. Test and development databases must be separate.'
      );
    }
  }

  // 3. Parse components safely
  const { host, databaseName } = parsePostgresComponents(testDbUrl);

  if (!databaseName) {
    throw new Error('Refusing test execution: test database name is missing in connection string.');
  }

  // 4. Check disallowed database names
  if (DISALLOWED_DB_NAMES.has(databaseName.toLowerCase())) {
    throw new Error(
      `Refusing test execution: database name "${databaseName}" is disallowed in test environment.`
    );
  }

  // 5. Require test naming pattern (_test or test_*)
  if (!TEST_DB_NAME_REGEX.test(databaseName)) {
    throw new Error(
      `Refusing test execution: database name "${databaseName}" must end with "_test" or start with "test_".`
    );
  }

  // 6. Host isolation check (localhost/loopback required unless CI=true)
  const isCI = env.CI === 'true' || env.CI === '1';
  const isLocal = LOCAL_HOSTS.has(host);

  if (!isLocal && !isCI) {
    throw new Error(
      `Refusing test execution: non-local host "${host}" is not permitted for test database unless CI=true.`
    );
  }

  return {
    databaseUrl: testDbUrl,
    databaseName,
    host,
    isLocal,
    isCI,
    isTestEnv: true,
  };
}
