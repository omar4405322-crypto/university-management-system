import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Check COLLEGE_ADMIN users
  const admins = await prisma.user.findMany({
    where: { role: 'COLLEGE_ADMIN' },
    select: { id: true, email: true, role: true, managedCollegeId: true },
  });
  console.log('COLLEGE_ADMIN users:', admins.length);
  console.log(JSON.stringify(admins, null, 2));

  // Fix: ensure health.admin@university.com has managedCollegeId = 2
  const healthAdmin = admins.find(a => a.email === 'health.admin@university.com');
  if (healthAdmin) {
    if (healthAdmin.managedCollegeId !== 2) {
      await prisma.user.update({
        where: { email: 'health.admin@university.com' },
        data: { managedCollegeId: 2 },
      });
      console.log('✅ Fixed: health.admin@university.com -> managedCollegeId set to 2');
    } else {
      console.log('✅ health.admin@university.com already has managedCollegeId = 2');
    }
  } else {
    console.log('❌ health.admin@university.com not found!');
  }

  // Ensure industry.admin@university.com has managedCollegeId = 1
  const industryAdmin = admins.find(a => a.email === 'industry.admin@university.com');
  if (industryAdmin) {
    if (industryAdmin.managedCollegeId !== 1) {
      await prisma.user.update({
        where: { email: 'industry.admin@university.com' },
        data: { managedCollegeId: 1 },
      });
      console.log('✅ Fixed: industry.admin@university.com -> managedCollegeId set to 1');
    } else {
      console.log('✅ industry.admin@university.com already has managedCollegeId = 1');
    }
  } else {
    console.log('❌ industry.admin@university.com not found!');
  }

  // Verify final state
  console.log('\n--- Final state ---');
  const final = await prisma.user.findMany({
    where: { role: 'COLLEGE_ADMIN' },
    select: { id: true, email: true, managedCollegeId: true },
  });
  console.log(JSON.stringify(final, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
