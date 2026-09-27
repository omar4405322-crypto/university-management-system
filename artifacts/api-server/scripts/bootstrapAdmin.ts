import 'dotenv/config';
import bcrypt from 'bcryptjs';
import prisma from '../src/utils/prismaClient';
import { isPasswordStrong, PASSWORD_STRENGTH_MESSAGE } from '../src/utils/passwordPolicy';

const REQUIRED_CONFIRM_TOKEN = 'CREATE_INITIAL_SUPER_ADMIN';

export interface BootstrapResult {
  success: boolean;
  message: string;
  user?: {
    id: number;
    email: string;
    role: string;
  };
}

export async function bootstrapInitialSuperAdmin(env: NodeJS.ProcessEnv = process.env): Promise<BootstrapResult> {
  const email = env.BOOTSTRAP_ADMIN_EMAIL?.trim();
  const password = env.BOOTSTRAP_ADMIN_PASSWORD;
  const confirm = env.BOOTSTRAP_ADMIN_CONFIRM?.trim();

  if (!email || !password) {
    throw new Error('BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD environment variables are required.');
  }

  if (confirm !== REQUIRED_CONFIRM_TOKEN) {
    throw new Error(`BOOTSTRAP_ADMIN_CONFIRM must be set exactly to "${REQUIRED_CONFIRM_TOKEN}".`);
  }

  // Basic RFC 5322 regex for email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email format for BOOTSTRAP_ADMIN_EMAIL.');
  }

  if (!isPasswordStrong(password)) {
    throw new Error(`Invalid password: ${PASSWORD_STRENGTH_MESSAGE}`);
  }

  // Check if ANY active or existing SUPER_ADMIN exists
  const existingSuperAdmin = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN' },
    select: { id: true },
  });

  if (existingSuperAdmin) {
    throw new Error('A SUPER_ADMIN already exists. Bootstrap aborted.');
  }

  // Check if user with this email exists under another role
  const existingEmail = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingEmail) {
    throw new Error('A user with the specified email already exists. Bootstrap aborted.');
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const newAdmin = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      role: true,
    },
  });

  return {
    success: true,
    message: 'Initial SUPER_ADMIN account created successfully.',
    user: newAdmin,
  };
}

// Direct execution from CLI
if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  bootstrapInitialSuperAdmin()
    .then((res) => {
      console.log(`[BOOTSTRAP SUCCESS] ${res.message} (User ID: ${res.user?.id})`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(`[BOOTSTRAP FAILED] ${err.message}`);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
