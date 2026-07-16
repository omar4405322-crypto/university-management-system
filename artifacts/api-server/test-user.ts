import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkUser() {
  const user = await prisma.user.findUnique({
    where: { email: 'admin@university.com' }
  });
  console.log('Admin user:', user);
  process.exit(0);
}
checkUser();
