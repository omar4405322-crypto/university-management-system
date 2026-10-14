import { pathToFileURL } from 'node:url';
import bcrypt from 'bcryptjs';
import { isPasswordStrong, PASSWORD_STRENGTH_MESSAGE } from '../src/utils/passwordPolicy';

const LOCAL_DATABASE_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export interface BootstrapSuperAdminClient {
  user: {
    upsert: (args: any) => Promise<{ id: number; email: string; role: string; [key: string]: any }>;
  };
}

export interface BootstrapSuperAdminResult {
  success: boolean;
  message: string;
  admin?: {
    id: number;
    userId: number;
    email: string;
    role: string;
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

export async function bootstrapSuperAdmin(
  env: Record<string, string | undefined> = process.env,
  client?: BootstrapSuperAdminClient
): Promise<BootstrapSuperAdminResult> {
  // 1. Guard production mode FIRST (case-insensitive & whitespace-trimmed, with process.env fallback)
  const nodeEnv = env?.NODE_ENV ?? process.env.NODE_ENV;
  if (nodeEnv?.trim().toLowerCase() === 'production') {
    throw new Error('Refusing to bootstrap test super admin in production mode.');
  }

  // 2. Validate real connection target BEFORE importing prismaClient
  if (!client) {
    if (!env?.DATABASE_URL && !process.env.DATABASE_URL) {
      const dotenv = await import('dotenv');
      dotenv.config();
    }

    const envDbUrl = env?.DATABASE_URL;
    const procDbUrl = process.env.DATABASE_URL;

    if (envDbUrl && procDbUrl && envDbUrl !== procDbUrl) {
      throw new Error('env.DATABASE_URL differs from process.env.DATABASE_URL (differ / non-local)');
    }

    const effectiveUrl = envDbUrl ?? procDbUrl;
    if (!effectiveUrl) {
      throw new Error('DATABASE_URL is required and must point to a local database (non-local)');
    }

    // Strict URL parsing and local host verification on effective target
    parseAndValidateHost(effectiveUrl, 'DATABASE_URL');
    if (procDbUrl) {
      parseAndValidateHost(procDbUrl, 'process.env.DATABASE_URL');
    } else {
      process.env.DATABASE_URL = effectiveUrl;
    }
  } else if (env?.DATABASE_URL) {
    parseAndValidateHost(env.DATABASE_URL, 'DATABASE_URL');
  }

  // 3. Validate email format BEFORE importing prismaClient
  const email = (env?.TEST_SUPER_ADMIN_EMAIL || 'superadmin.test@university.local').trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email format for TEST_SUPER_ADMIN_EMAIL.');
  }

  // 4. Validate password BEFORE importing prismaClient
  const password = env?.TEST_SUPER_ADMIN_PASSWORD;
  if (!password || typeof password !== 'string' || password.length < 12) {
    throw new Error('TEST_SUPER_ADMIN_PASSWORD is required and must be at least 12 characters');
  }
  if (!isPasswordStrong(password)) {
    throw new Error(`Invalid password: ${PASSWORD_STRENGTH_MESSAGE}`);
  }

  // 5. Dynamic import of prismaClient ONLY AFTER all guards pass and ONLY if not injected
  let dbClient = client;
  if (!dbClient) {
    const { default: prisma } = await import('../src/utils/prismaClient');
    dbClient = prisma;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await dbClient.user.upsert({
    where: { email },
    update: {
      role: 'SUPER_ADMIN',
      adminRole: null,
      isActive: true,
      deactivatedAt: null,
      twoFactorEnabled: false,
      twoFactorSecret: null,
      password: hashedPassword,
    },
    create: {
      email,
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

  return {
    success: true,
    message: 'Test super admin persona bootstrapped successfully.',
    admin: {
      id: user.id,
      userId: user.id,
      email: user.email,
      role: user.role,
    },
  };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  let hasPrisma = false;
  bootstrapSuperAdmin(process.env)
    .then((res) => {
      hasPrisma = true;
      console.log(`id=${res.admin?.id} email=${res.admin?.email}`);
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

