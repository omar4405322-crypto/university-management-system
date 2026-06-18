const request = require('supertest');
const app = require('../src/app').default || require('../src/app');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');
const { generateToken } = require('../src/utils/jwt.utils');

describe('Academic CRUD API', () => {
  let adminToken;
  let studentToken;
  let college;
  let department;

  beforeAll(async () => {
    // Cleanup first to avoid unique constraint issues
    await prisma.attendance.deleteMany({ where: { student: { user: { email: { contains: 'test' } } } } });
    await prisma.student.deleteMany({ where: { user: { email: { contains: 'test' } } } });
    await prisma.course.deleteMany({ where: { name: { contains: 'Test' } } });
    await prisma.user.deleteMany({ where: { email: { contains: 'test' } } });
    await prisma.department.deleteMany({ where: { name: { contains: 'Test' } } });
    await prisma.college.deleteMany({ where: { name: { contains: 'Test' } } });

    // Setup environment
    const hashedPassword = await bcrypt.hash('Password123', 10);
    
    // Create Admin
    const admin = await prisma.user.create({
      data: {
        email: 'test-admin@example.com',
        password: hashedPassword,
        role: 'SUPER_ADMIN'
      }
    });
    adminToken = generateToken(admin.id);

    // Create Student User
    const studentUser = await prisma.user.create({
      data: {
        email: 'test-student-crud@example.com',
        password: hashedPassword,
        role: 'STUDENT'
      }
    });
    studentToken = generateToken(studentUser.id);

    // Create Metadata
    college = await prisma.college.create({
      data: { name: 'Test College' }
    });

    department = await prisma.department.create({
      data: { name: 'Test Dept', collegeId: college.id }
    });
  });

  beforeEach(async () => {
    await prisma.enrollment.deleteMany({});
    await prisma.student.deleteMany({});
    await prisma.course.deleteMany({});
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            'test-john@example.com',
            'test-fetch@example.com',
            'test-update@example.com',
            'test-update-changed@example.com'
          ]
        }
      }
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.attendance.deleteMany({ where: { student: { user: { email: { contains: 'test' } } } } });
    await prisma.student.deleteMany({ where: { user: { email: { contains: 'test' } } } });
    await prisma.course.deleteMany({ where: { name: { contains: 'Test' } } });
    await prisma.user.deleteMany({ where: { email: { contains: 'test' } } });
    await prisma.department.deleteMany({ where: { name: { contains: 'Test' } } });
    await prisma.college.deleteMany({ where: { name: { contains: 'Test' } } });
    await prisma.$disconnect();
  });

  describe('Students CRUD', () => {
    it('should create a new student as Admin', async () => {
      const res = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'John',
          lastName: 'Doe',
          studentId: 'STU-999',
          email: 'test-john@example.com',
          year: 1,
          departmentId: department.id
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should deny student creation by a Student', async () => {
      const res = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          firstName: 'Rogue',
          lastName: 'Student',
          studentId: 'STU-666',
          email: 'rogue@example.com',
          year: 1,
          departmentId: department.id
        });

      expect(res.status).toBe(403);
    });

    it('should fetch all students with pagination', async () => {
      await prisma.user.create({
        data: {
          email: 'test-fetch@example.com',
          password: 'Password123',
          role: 'STUDENT',
          student: {
            create: {
              firstName: 'Fetch',
              lastName: 'Student',
              studentId: 'STU-FETCH',
              year: 1,
              departmentId: department.id
            }
          }
        }
      });

      const res = await request(app)
        .get('/api/students?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('students');
      expect(res.body.data.pagination.total).toBeGreaterThan(0);
    });

    it('should update student details', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test-update@example.com',
          password: 'Password123',
          role: 'STUDENT',
          student: {
            create: {
              firstName: 'Update',
              lastName: 'Student',
              studentId: 'STU-UPDATE',
              year: 1,
              departmentId: department.id
            }
          }
        },
        include: { student: true }
      });

      const res = await request(app)
        .put(`/api/students/${user.student.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'John Updated',
          lastName: 'Doe',
          email: 'test-update-changed@example.com',
          studentId: 'STU-UPDATE-2',
          year: 2,
          departmentId: department.id
        });

      expect(res.status).toBe(200);
      expect(res.body.data.firstName).toBe('John Updated');
    });
  });

  describe('Courses CRUD', () => {
    it('should create a new course', async () => {
      const res = await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Course 101',
          courseCode: 'T101',
          credits: 3,
          departmentId: department.id,
          year: 1,
          semester: 1
        });

      expect(res.status).toBe(201);
    });

    it('should fetch courses with filters', async () => {
      await prisma.course.create({
        data: {
          name: 'Test Course 101',
          courseCode: 'T101',
          credits: 3,
          departmentId: department.id,
          year: 1,
          semester: 1
        }
      });

      const res = await request(app)
        .get(`/api/courses?search=Test&departmentId=${department.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.courses.length).toBeGreaterThan(0);
    });
  });
});
