import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const deleted = await prisma.refreshToken.deleteMany({});
  console.log('Deleted tokens:', deleted.count);
}

main().catch(console.error).finally(() => prisma.$disconnect());
