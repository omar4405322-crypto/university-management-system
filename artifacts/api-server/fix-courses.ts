import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Fetch doctors in Dept 1
  const doctors = await prisma.doctor.findMany({
    where: { departmentId: 1 }
  });

  console.log(`Found ${doctors.length} doctors in Dept 1`);
  doctors.forEach(d => console.log(`- ID: ${d.id}, Name: ${d.firstName} ${d.lastName}, Specialty: ${d.specialty}`));

  // If there are more doctors, assign them.
  // We need to reassign courses: ICT101, ICT102, MATH101, ENG101, PHY101
  const coursesToReassign = ['ICT101', 'ICT102', 'MATH101', 'ENG101', 'PHY101'];

  for (const code of coursesToReassign) {
    const course = await prisma.course.findFirst({ where: { courseCode: code } });
    if (!course) {
      console.log(`Course ${code} not found.`);
      continue;
    }

    const section = await prisma.courseSection.findFirst({
      where: { courseId: course.id }
    });

    if (!section) {
      console.log(`Section for ${code} not found.`);
      continue;
    }

    // Try to find a matching doctor based on specialty
    let targetDocId = 1; // Fallback to 1 (Ahmed Ali)
    if (code.includes('MATH')) {
      const mathDoc = doctors.find(d => d.specialty?.toLowerCase().includes('math') || d.specialty?.toLowerCase().includes('calculus'));
      if (mathDoc) targetDocId = mathDoc.id;
      else {
        // Find another doctor
        targetDocId = doctors[1 % doctors.length].id; 
      }
    } else if (code.includes('ENG')) {
      const engDoc = doctors.find(d => d.specialty?.toLowerCase().includes('english') || d.specialty?.toLowerCase().includes('linguistics'));
      if (engDoc) targetDocId = engDoc.id;
      else {
        targetDocId = doctors[2 % doctors.length].id;
      }
    } else if (code.includes('PHY')) {
      const phyDoc = doctors.find(d => d.specialty?.toLowerCase().includes('physics'));
      if (phyDoc) targetDocId = phyDoc.id;
      else {
        targetDocId = doctors[3 % doctors.length].id;
      }
    } else if (code.includes('ICT102')) {
      targetDocId = doctors[4 % doctors.length].id;
    }

    await prisma.courseSection.update({
      where: { id: section.id },
      data: { doctorId: targetDocId }
    });

    const docAssigned = doctors.find(d => d.id === targetDocId);
    console.log(`Reassigned ${code} to ${docAssigned?.firstName} ${docAssigned?.lastName} (ID: ${docAssigned?.id}, Specialty: ${docAssigned?.specialty})`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
