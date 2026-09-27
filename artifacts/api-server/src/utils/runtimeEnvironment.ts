const BASE_REQUIRED_ENV_VARS = ['DATABASE_URL', 'JWT_SECRET'] as const;

const PRODUCTION_REQUIRED_ENV_VARS = [
  'ENCRYPTION_KEY',
  'REDIS_URL',
] as const;

type RuntimeEnvironment = Record<string, string | undefined>;

export function getMissingRuntimeEnvVars(env: RuntimeEnvironment): string[] {
  const isProduction = env.NODE_ENV?.trim().toLowerCase() === 'production';
  const required = isProduction
    ? [...BASE_REQUIRED_ENV_VARS, ...PRODUCTION_REQUIRED_ENV_VARS]
    : BASE_REQUIRED_ENV_VARS;

  return required.filter((key) => !env[key]?.trim());
}
