import { pathToFileURL } from 'node:url';
import bcrypt from 'bcryptjs';
import { isPasswordStrong, PASSWORD_STRENGTH_MESSAGE } from '../src/utils/passwordPolicy';

const SUPER_ADMIN_EMAIL = 'superadmin@university.com';
const LOCAL_DATABASE_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export interface RestoreSuperAdminClient {
  user: {
    findUnique?: (args: any) => Promise<any>;
    upsert: (args: any) => Promise<{ id: number; email: string; role: string; [key: string]: any }>;
  };
}

function parseAndValidateHost(rawUrl: string, label: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`${label} is unparsable or invalid (non-local)`);
  }

  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new Error(`${label} has invalid protocol (non-local)`);
  }

  const host = parsed.hostname;
  if (!LOCAL_DATABASE_HOSTS.has(host)) {
    throw new Error(`Refusing non-local database host in ${label}: ${host} (non-local)`);
  }

  return host;
}

export async function restoreSuperAdmin(
  env: Record<string, string | undefined> = process.env,
  client?: RestoreSuperAdminClient
) {
  // 1. Guard production mode FIRST (case-insensitive & whitespace-trimmed)
  if (env?.NODE_ENV?.trim().toLowerCase() === 'production') {
    throw new Error('Refusing to restore SuperAdmin in production mode.');
  }

  // 2. Validate env.DATABASE_URL
  const rawDbUrl = env?.DATABASE_URL;
  if (!rawDbUrl) {
    throw new Error('DATABASE_URL is required and must point to a local database (non-local)');
  }
  parseAndValidateHost(rawDbUrl, 'DATABASE_URL');

  // 3. When no client is injected, validate real connection target (process.env.DATABASE_URL)
  if (!client) {
    const procDbUrl = process.env.DATABASE_URL;
    if (procDbUrl && rawDbUrl !== procDbUrl) {
      throw new Error('env.DATABASE_URL differs from process.env.DATABASE_URL (differ / non-local)');
    }
    if (procDbUrl) {
      parseAndValidateHost(procDbUrl, 'process.env.DATABASE_URL');
    } else {
      process.env.DATABASE_URL = rawDbUrl;
    }
  }

  // 4. Validate password BEFORE any dynamic Prisma loading
  const password = env?.SUPER_ADMIN_PASSWORD;
  if (!password || typeof password !== 'string' || password.length < 12) {
    throw new Error('SUPER_ADMIN_PASSWORD is required and must be at least 12 characters');
  }
  if (!isPasswordStrong(password)) {
    throw new Error(`Invalid password: ${PASSWORD_STRENGTH_MESSAGE}`);
  }

  // 5. Dynamic import of prismaClient ONLY AFTER all guards pass and ONLY if client was not injected
  let dbClient = client;
  if (!dbClient) {
    const { default: defaultPrisma } = await import('../src/utils/prismaClient');
    dbClient = defaultPrisma;
  }

  // 6. Check existing 2FA enrollment when findUnique is available
  let hasValidTwoFactorEnrollment = false;
  let preservedTwoFactorSecret: string | null = null;

  if (typeof dbClient.user.findUnique === 'function') {
    const existing = await dbClient.user.findUnique({
      where: { email: SUPER_ADMIN_EMAIL },
      select: { twoFactorEnabled: true, twoFactorSecret: true },
    });
    if (
      existing?.twoFactorEnabled &&
      typeof existing.twoFactorSecret === 'string' &&
      existing.twoFactorSecret.length > 0
    ) {
      hasValidTwoFactorEnrollment = true;
      preservedTwoFactorSecret = existing.twoFactorSecret;
    }
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await dbClient.user.upsert({
    where: { email: SUPER_ADMIN_EMAIL },
    update: {
      role: 'SUPER_ADMIN',
      adminRole: null,
      isActive: true,
      deactivatedAt: null,
      tokenVersion: { increment: 1 },
      twoFactorEnabled: hasValidTwoFactorEnrollment,
      twoFactorSecret: hasValidTwoFactorEnrollment ? preservedTwoFactorSecret : null,
      password: hashedPassword,
    },
    create: {
      email: SUPER_ADMIN_EMAIL,
      role: 'SUPER_ADMIN',
      adminRole: null,
      isActive: true,
      deactivatedAt: null,
      tokenVersion: 0,
      twoFactorEnabled: false,
      twoFactorSecret: null,
      password: hashedPassword,
    },
  });

  return user;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  let hasPrisma = false;
  restoreSuperAdmin(process.env)
    .then((user) => {
      hasPrisma = true;
      console.log(`id=${user.id} email=${user.email}`);
      process.exitCode = 0;
    })
    .catch((err) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    })
    .finally(async () => {
      if (hasPrisma) {
        try {
          const { default: defaultPrisma } = await import('../src/utils/prismaClient');
          await defaultPrisma.$disconnect();
        } catch {}
      }
      process.exit(process.exitCode ?? 0);
    });
}

