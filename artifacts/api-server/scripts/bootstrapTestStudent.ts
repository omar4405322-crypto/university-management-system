import 'dotenv/config';
import bcrypt from 'bcryptjs';
import prisma from '../src/utils/prismaClient';
import { isPasswordStrong, PASSWORD_STRENGTH_MESSAGE } from '../src/utils/passwordPolicy';

export interface BootstrapStudentResult {
  success: boolean;
  message: string;
  student?: {
    id: number;
    userId: number;
    email: string;
    studentId: string;
    role: string;
  };
}

export async function bootstrapTestStudent(env: NodeJS.ProcessEnv = process.env): Promise<BootstrapStudentResult> {
  // STRICT SAFEGUARD: Refuse execution in production
  if (env.NODE_ENV?.trim().toLowerCase() === 'production') {
    throw new Error('Refusing to bootstrap test student in production mode.');
  }

  const email = (env.TEST_STUDENT_EMAIL || 'student.test@university.local').trim();
  const password = env.TEST_STUDENT_PASSWORD || 'StudentTest123!';

  // Basic RFC 5322 regex for email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email format for TEST_STUDENT_EMAIL.');
  }

  if (!isPasswordStrong(password)) {
    throw new Error(`Invalid password: ${PASSWORD_STRENGTH_MESSAGE}`);
  }

  // Find or create default department to attach student
  let dept = await prisma.department.findFirst({ select: { id: true } });
  if (!dept) {
    let college = await prisma.college.findFirst({ select: { id: true } });
    if (!college) {
      college = await prisma.college.create({
        data: { name: 'Test College' },
        select: { id: true },
      });
    }
    dept = await prisma.department.create({
      data: { name: 'Test Department', collegeId: college.id },
      select: { id: true },
    });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  // Upsert user deterministically
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password: hashedPassword,
      role: 'STUDENT',
      isActive: true,
    },
    create: {
      email,
      password: hashedPassword,
      role: 'STUDENT',
      isActive: true,
    },
  });

  // Upsert student record
  const student = await prisma.student.upsert({
    where: { userId: user.id },
    update: {
      firstName: 'Test',
      lastName: 'Student',
      year: 2,
      departmentId: dept.id,
      isActive: true,
    },
    create: {
      userId: user.id,
      firstName: 'Test',
      lastName: 'Student',
      studentId: 'STU-TEST-001',
      year: 2,
      departmentId: dept.id,
      isActive: true,
    },
  });

  return {
    success: true,
    message: 'Test student persona bootstrapped successfully.',
    student: {
      id: student.id,
      userId: user.id,
      email: user.email,
      studentId: student.studentId,
      role: user.role,
    },
  };
}

// Direct execution from CLI
if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  bootstrapTestStudent()
    .then((res) => {
      console.log(`[BOOTSTRAP SUCCESS] ${res.message} (Student ID: ${res.student?.studentId})`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(`[BOOTSTRAP FAILED] ${err.message}`);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
