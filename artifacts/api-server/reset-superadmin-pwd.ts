import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function resetSuperAdminPassword() {
  const hash = await bcrypt.hash('SuperAdmin123!', 10);
  await prisma.user.update({
    where: { email: 'superadmin@university.com' },
    data: { password: hash }
  });
  console.log('Password for superadmin@university.com reset to SuperAdmin123!');
  process.exit(0);
}

resetSuperAdminPassword();
