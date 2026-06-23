// prisma/fix-admin-name.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  // Let's find the user first
  const user = await prisma.user.findUnique({
    where: { email: 'college.admin@university.com' },
  });

  if (!user) {
    console.error('❌ User college.admin@university.com not found');
    return;
  }

  // Update or create the associated Doctor record to set the name
  await prisma.doctor.upsert({
    where: { userId: user.id },
    update: {
      firstName: 'Industry',
      lastName: 'Admin'
    },
    create: {
      userId: user.id,
      firstName: 'Industry',
      lastName: 'Admin',
      doctorId: 'DOC-COLLEGE-ADMIN' // Fallback doctor id if needed
    }
  });

  console.log('✅ Updated college.admin name to Industry Admin (via Doctor record)');
}
main().catch(console.error).finally(() => prisma.$disconnect());
