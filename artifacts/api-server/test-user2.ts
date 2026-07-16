import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkUser() {
  const users = await prisma.user.findMany({
    select: { email: true, role: true }
  });
  console.log('All users:', users);
  process.exit(0);
}
checkUser();
