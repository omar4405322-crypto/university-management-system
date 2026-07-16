import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function resetPassword() {
  const hash = await bcrypt.hash('Admin123!', 10);
  await prisma.user.update({
    where: { email: 'admin@university.com' },
    data: { password: hash }
  });
  console.log('Password for admin@university.com reset to Admin123!');
  process.exit(0);
}

resetPassword();
