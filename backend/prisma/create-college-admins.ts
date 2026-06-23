import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();

async function main() {
  const healthHash = await bcrypt.hash('HealthAdmin123!', 10);
  const industryHash = await bcrypt.hash('IndustryAdmin123!', 10);

  // Create health admin with managedCollegeId = 2
  const healthAdmin = await prisma.user.upsert({
    where: { email: 'health.admin@university.com' },
    update: { role: 'COLLEGE_ADMIN', managedCollegeId: 2 },
    create: {
      email: 'health.admin@university.com',
      password: healthHash,
      role: 'COLLEGE_ADMIN',
      managedCollegeId: 2,
    },
  });
  console.log('✅ health.admin@university.com ->', healthAdmin.managedCollegeId);

  // Create industry admin with managedCollegeId = 1
  // Note: college.admin@university.com already manages college 1, so this is an additional one
  const industryAdmin = await prisma.user.upsert({
    where: { email: 'industry.admin@university.com' },
    update: { role: 'COLLEGE_ADMIN', managedCollegeId: 1 },
    create: {
      email: 'industry.admin@university.com',
      password: industryHash,
      role: 'COLLEGE_ADMIN',
      managedCollegeId: 1,
    },
  });
  console.log('✅ industry.admin@university.com ->', industryAdmin.managedCollegeId);

  // Verify all COLLEGE_ADMIN users
  const allAdmins = await prisma.user.findMany({
    where: { role: 'COLLEGE_ADMIN' },
    select: { id: true, email: true, managedCollegeId: true },
  });
  console.log('\n--- All COLLEGE_ADMIN users ---');
  console.log(JSON.stringify(allAdmins, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
