import bcrypt from 'bcryptjs';
// @ts-ignore
import prisma from '../../src/utils/prismaClient';
// @ts-ignore
import { generateAccessToken } from '../../src/utils/jwt.utils';

jest.mock('../../src/utils/redis.utils', () => ({
  redis: {
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue('OK'),
    setEx: jest.fn().mockResolvedValue('OK'),
    quit: jest.fn().mockResolvedValue('OK'),
  }
}));
export async function createTestUser(role: string = 'STUDENT') {
  const user = await prisma.user.create({
    data: {
      email: `test-${Date.now()}-${Math.floor(Math.random() * 100000)}@university.test`,
      password: await bcrypt.hash('TestPass123!', 10),
      role,
      tokenVersion: 0,
      student: role === 'STUDENT' ? {
        create: {
          firstName: 'Test',
          lastName: 'User',
          studentId: `ST${Date.now()}${Math.floor(Math.random() * 100000)}`.substring(0, 15),
          year: 1
        }
      } : undefined
    },
    include: { student: true, doctor: true }
  });
  return user;
}

export async function getAuthToken(role: string = 'STUDENT') {
  const user = await createTestUser(role);
  const token = generateAccessToken(user.id, user.tokenVersion);
  return { user, token };
}

export async function cleanupTestData() {
  await prisma.enrollment.deleteMany({ where: { student: { user: { email: { contains: 'university.test' } } } } });
  await prisma.student.deleteMany({ where: { user: { email: { contains: 'university.test' } } } });
  await prisma.doctor.deleteMany({ where: { user: { email: { contains: 'university.test' } } } });
  await prisma.user.deleteMany({ where: { email: { contains: 'university.test' } } });
}
