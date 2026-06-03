const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const updated = await prisma.user.updateMany({
    where: { role: 'ADMIN' },
    data: { role: 'SUPER_ADMIN' }
  });
  console.log(`Updated ${updated.count} users from ADMIN to SUPER_ADMIN`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
