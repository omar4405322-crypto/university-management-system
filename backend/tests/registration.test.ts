import request from 'supertest';
import app from '../src/app';
import prisma from '../src/utils/prismaClient';
import { cleanupTestData, createTestDepartment } from './helpers/testUtils';

describe('Registration Role Validation', () => {
  beforeEach(async () => {
    await cleanupTestData();
    // Create a valid department for student registration tests
    await createTestDepartment();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it('rejects registration with DOCTOR role', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'doctor-test@university.test',
        password: 'SecurePass123!',
        role: 'DOCTOR',
        firstName: 'Test',
        lastName: 'Doctor',
      });

    expect(response.status).toBe(422);
    expect(response.body.message).toMatch(/Only student registration/i);
  });

  it('rejects registration with ADMIN role', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'admin-test@university.test',
        password: 'SecurePass123!',
        role: 'ADMIN',
        firstName: 'Test',
        lastName: 'Admin',
      });

    expect(response.status).toBe(422);
    expect(response.body.message).toMatch(/Only student registration/i);
  });

  it('rejects registration with SUPER_ADMIN role', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'superadmin-test@university.test',
        password: 'SecurePass123!',
        role: 'SUPER_ADMIN',
        firstName: 'Test',
        lastName: 'Super',
      });

    expect(response.status).toBe(422);
    expect(response.body.message).toMatch(/Only student registration/i);
  });

  it('allows registration with STUDENT role (default)', async () => {
    const dept = await prisma.department.findFirst();
    
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'student-test@university.test',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'Student',
        studentId: 'STU001',
        year: 1,
        departmentId: dept?.id || 1,
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('PENDING');
  });

  it('allows registration without role field (defaults to STUDENT)', async () => {
    const dept = await prisma.department.findFirst();
    
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'student-test2@university.test',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'Student',
        studentId: 'STU002',
        year: 1,
        departmentId: dept?.id || 1,
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
  });
});