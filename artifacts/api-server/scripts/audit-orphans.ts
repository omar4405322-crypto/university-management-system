import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const orphans = await prisma.course.findMany({
    where: { doctorId: null },
    include: { sections: { include: { doctor: true } } }
  });
  
  console.log(`Found ${orphans.length} courses with no doctorId.`);
  for (const c of orphans) {
    console.log(`Course ${c.id}: ${c.name} (Code: ${c.courseCode}, Dept: ${c.departmentId})`);
    for (const s of c.sections) {
      console.log(`  -> Section ${s.id}: ${s.name}, Doctor: ${s.doctor.firstName} ${s.doctor.lastName} (Doc Dept: ${s.doctor.departmentId})`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
