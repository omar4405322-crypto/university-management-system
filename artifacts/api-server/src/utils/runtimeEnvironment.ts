const BASE_REQUIRED_ENV_VARS = ['DATABASE_URL', 'JWT_SECRET'] as const;

const PRODUCTION_REQUIRED_ENV_VARS = [
  'ENCRYPTION_KEY',
  'REDIS_URL',
] as const;

type RuntimeEnvironment = Record<string, string | undefined>;

export function getMissingRuntimeEnvVars(env: RuntimeEnvironment): string[] {
  const isProduction = env.NODE_ENV?.trim().toLowerCase() === 'production';
  const required: string[] = isProduction
    ? [...BASE_REQUIRED_ENV_VARS, ...PRODUCTION_REQUIRED_ENV_VARS]
    : [...BASE_REQUIRED_ENV_VARS];

  if (isProduction && env.AI_ASSISTANT_ENABLED?.trim().toLowerCase() === 'true') {
    const provider = env.AI_PROVIDER?.trim().toLowerCase() || 'openai';
    if (provider === 'gemini') required.push('GEMINI_API_KEY', 'GEMINI_MODEL');
    else if (provider === 'openai') required.push('OPENAI_API_KEY');
    else return [...required.filter((key) => !env[key]?.trim()), 'AI_PROVIDER'];

    const fallback = env.AI_FALLBACK_PROVIDER?.trim().toLowerCase();
    if (fallback && fallback !== 'none' && fallback !== 'disabled' && fallback !== 'off') {
      if (fallback === provider) {
        return [...required.filter((key) => !env[key]?.trim()), 'AI_FALLBACK_PROVIDER'];
      }
      if (fallback === 'gemini') required.push('GEMINI_API_KEY', 'GEMINI_MODEL');
      else if (fallback === 'openai') required.push('OPENAI_API_KEY');
      else return [...required.filter((key) => !env[key]?.trim()), 'AI_FALLBACK_PROVIDER'];
    }
  }

  return required.filter((key) => !env[key]?.trim());
}
