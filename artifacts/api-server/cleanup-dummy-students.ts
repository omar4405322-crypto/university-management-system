import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });
const prisma = new PrismaClient();

const REALISTIC_STUDENTS = [
  { firstName: 'Ahmed',    lastName: 'Al-Rashidi',   studentId: 'IT-2024-001', email: 'ahmed.rashidi@university.edu', year: 2, deptId: 1 },
  { firstName: 'Sara',     lastName: 'Hassan',        studentId: 'IT-2024-002', email: 'sara.hassan@university.edu', year: 2, deptId: 1 },
  { firstName: 'Omar',     lastName: 'Khalid',        studentId: 'IT-2024-003', email: 'omar.khalid@university.edu', year: 2, deptId: 1 },
  { firstName: 'Fatima',   lastName: 'Al-Zahra',      studentId: 'IT-2024-004', email: 'fatima.zahra@university.edu', year: 2, deptId: 1 },
  { firstName: 'Mohammed', lastName: 'Nasser',        studentId: 'IT-2024-005', email: 'mohammed.nasser@university.edu', year: 2, deptId: 1 },
  { firstName: 'Aisha',    lastName: 'Al-Mansouri',   studentId: 'IT-2024-006', email: 'aisha.mansouri@university.edu', year: 2, deptId: 2 },
  { firstName: 'Youssef',  lastName: 'Ibrahim',       studentId: 'IT-2024-007', email: 'youssef.ibrahim@university.edu', year: 2, deptId: 2 },
  { firstName: 'Layla',    lastName: 'Al-Ahmad',      studentId: 'IT-2024-008', email: 'layla.ahmad@university.edu', year: 2, deptId: 2 },
  { firstName: 'Khalid',   lastName: 'Al-Otaibi',     studentId: 'IT-2024-009', email: 'khalid.otaibi@university.edu', year: 2, deptId: 2 }
];

async function main() {
  console.log('Cleaning up dummy test students...');

  // Keep mohamed salama (ms894@gmail.com) if present
  const salamaUser = await prisma.user.findFirst({
    where: { email: { contains: 'ms894@gmail.com', mode: 'insensitive' } },
    include: { student: true }
  });

  // Find dummy user IDs to delete
  const dummyUsers = await prisma.user.findMany({
    where: {
      role: 'STUDENT',
      NOT: {
        email: 'ms894@gmail.com'
      }
    },
    select: { id: true }
  });

  const dummyUserIds = dummyUsers.map(u => u.id);
  console.log(`Found ${dummyUserIds.length} dummy student user accounts to remove.`);

  // Delete dummy students & users
  if (dummyUserIds.length > 0) {
    await prisma.student.deleteMany({
      where: { userId: { in: dummyUserIds } }
    });
    await prisma.user.deleteMany({
      where: { id: { in: dummyUserIds } }
    });
  }

  console.log('Dummy student data purged.');

  // Create clean realistic students up to 10 total
  const commonPassword = await bcrypt.hash('Password123!', 10);
  let count = await prisma.student.count();

  for (const s of REALISTIC_STUDENTS) {
    if (count >= 10) break;

    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: {
        email: s.email,
        password: commonPassword,
        role: 'STUDENT',
        departmentId: s.deptId
      }
    });

    await prisma.student.upsert({
      where: { userId: user.id },
      update: { departmentId: s.deptId },
      create: {
        userId: user.id,
        firstName: s.firstName,
        lastName: s.lastName,
        studentId: s.studentId,
        year: s.year,
        departmentId: s.deptId
      }
    });

    count = await prisma.student.count();
  }

  const finalCount = await prisma.student.count();
  console.log(`\nFinal Clean Student Count in Database: ${finalCount}`);

  const studentsList = await prisma.student.findMany({
    include: { user: { select: { email: true } }, department: { select: { name: true } } }
  });

  console.log('\nFinal 10 Students in Database:');
  studentsList.forEach((st, idx) => {
    console.log(`${idx + 1}. ${st.firstName} ${st.lastName} (${st.user.email}) - Dept: ${st.department?.name || 'N/A'}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
