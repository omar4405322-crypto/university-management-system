const request = require('supertest');
const app = require('../src/app');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');
const { generateToken } = require('../src/utils/jwt.utils');

describe('Students API & RBAC', () => {
  let superAdminToken, deptAdminToken, studentToken;
  let superAdmin, deptAdmin, studentUser, testDept, testCollege;

  beforeAll(async () => {
    // Clean up
    await prisma.student.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.department.deleteMany({});
    await prisma.college.deleteMany({});

    const hashedPassword = await bcrypt.hash('Password123', 10);

    // Create Hierarchy
    testCollege = await prisma.college.create({ data: { name: 'Test College' } });
    testDept = await prisma.department.create({ 
      data: { 
        name: 'Test Dept', 
        collegeId: testCollege.id 
      } 
    });

    // Create Users
    superAdmin = await prisma.user.create({
      data: {
        email: 'superadmin-rbac@example.com',
        password: hashedPassword,
        role: 'SUPER_ADMIN'
      }
    });
    superAdminToken = generateToken(superAdmin.id);

    deptAdmin = await prisma.user.create({
      data: {
        email: 'deptadmin-rbac@example.com',
        password: hashedPassword,
        role: 'DEPARTMENT_ADMIN',
        departmentId: testDept.id
      }
    });
    deptAdminToken = generateToken(deptAdmin.id);

    studentUser = await prisma.user.create({
      data: {
        email: 'student-rbac@example.com',
        password: hashedPassword,
        role: 'STUDENT'
      }
    });
    studentToken = generateToken(studentUser.id);

    // Create a student in testDept
    await prisma.student.create({
      data: {
        userId: studentUser.id,
        firstName: 'John',
        lastName: 'Doe',
        studentId: 'STU-RBAC-001',
        year: 1,
        departmentId: testDept.id
      }
    });
  });

  afterAll(async () => {
    await prisma.student.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.department.deleteMany({});
    await prisma.college.deleteMany({});
    await prisma.$disconnect();
  });

  describe('GET /api/students', () => {
    it('SUPER_ADMIN should see all students', async () => {
      const res = await request(app)
        .get('/api/students')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.students.length).toBeGreaterThan(0);
    });

    it('DEPARTMENT_ADMIN should only see students in their department', async () => {
      const res = await request(app)
        .get('/api/students')
        .set('Authorization', `Bearer ${deptAdminToken}`);

      expect(res.status).toBe(200);
      res.body.data.students.forEach(s => {
        expect(s.departmentId).toBe(testDept.id);
      });
    });

    it('STUDENT role should get 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/students')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
    });

    it('unauthenticated request should get 401', async () => {
      const res = await request(app).get('/api/students');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/students', () => {
    it('SUPER_ADMIN can create student', async () => {
      const res = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          email: 'newstudent@example.com',
          firstName: 'New',
          lastName: 'Student',
          studentId: 'STU-NEW-001',
          year: 1,
          departmentId: testDept.id
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.temporaryPassword).toBeDefined();
    });

    it('STUDENT role cannot create student', async () => {
      const res = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ email: 'shouldfail@example.com' });

      expect(res.status).toBe(403);
    });
  });

  describe('Filters and Pagination', () => {
    it('search should work correctly', async () => {
      const res = await request(app)
        .get('/api/students?search=John')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.students[0].firstName).toBe('John');
    });

    it('pagination should work', async () => {
      const res = await request(app)
        .get('/api/students?page=1&limit=5')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.pagination.limit).toBe(5);
    });
  });

  describe('Status and Deletion', () => {
    it('should toggle isActive correctly', async () => {
      const student = await prisma.student.findUnique({ where: { studentId: 'STU-RBAC-001' } });
      const res = await request(app)
        .patch(`/api/students/${student.id}/status`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(!student.isActive);
    });

    it('should delete student and cascade correctly', async () => {
      const student = await prisma.student.findUnique({ where: { studentId: 'STU-RBAC-001' } });
      const res = await request(app)
        .delete(`/api/students/${student.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      
      const deletedStudent = await prisma.student.findUnique({ where: { id: student.id } });
      const deletedUser = await prisma.user.findUnique({ where: { id: student.userId } });
      
      expect(deletedStudent).toBeNull();
      expect(deletedUser).toBeNull();
    });
  });
});
