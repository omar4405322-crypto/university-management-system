const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const courseId = 1;
  const sectionIdQuery = 3;

  console.log('[ROSTER] courseId:', courseId, 'sectionId:', sectionIdQuery);

  const sections = await prisma.courseSection.findMany({
    where: {
      courseId,
      ...(sectionIdQuery ? { id: sectionIdQuery } : {})
    }
  });

  if (sections.length > 0) {
    const sectionIds = sections.map((s) => s.id);
    const mappings = await prisma.sectionGroupMapping.findMany({
      where: { courseSectionId: { in: sectionIds } },
      select: { studentGroupId: true }
    });

    const groupIds = Array.from(new Set(mappings.map((m) => m.studentGroupId)));

    const groupStudents = await prisma.student.findMany({
        where: { studentGroupId: { in: groupIds }, isActive: true },
        select: { id: true, firstName: true, lastName: true, studentId: true },
    });
    console.log('[ROSTER] students before excludes:', groupStudents.map(s => s.id));

    const otherSectionOverrides = await prisma.studentSectionOverride.findMany({
      where: {
        courseId,
        ...(sectionIdQuery ? { NOT: { courseSectionId: sectionIdQuery } } : { id: -1 })
      },
      select: { studentId: true }
    });
    console.log('[ROSTER] otherSectionOverrides:', otherSectionOverrides);
    const excludedStudentIds = new Set(otherSectionOverrides.map((o) => o.studentId));
    console.log('[ROSTER] excludedStudentIds:', Array.from(excludedStudentIds));
    
    const rosterMap = new Map();
    groupStudents.forEach((s) => {
      if (!excludedStudentIds.has(s.id)) {
        rosterMap.set(s.id, s);
      } else {
        console.log('[ROSTER] student excluded:', s.id);
      }
    });

    console.log('[ROSTER] final roster before extra overrides:', Array.from(rosterMap.keys()));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
