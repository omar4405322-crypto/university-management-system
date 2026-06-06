const request = require('supertest');
const app = require('../src/app');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');
const { generateToken } = require('../src/utils/jwt.utils');

describe('Payments API', () => {
  let adminToken, studentToken, studentUser, adminUser, testStudent, testPayment;

  beforeAll(async () => {
    // Clean up
    await prisma.payment.deleteMany({});
    await prisma.student.deleteMany({});
    await prisma.user.deleteMany({});

    const hashedPassword = await bcrypt.hash('Password123', 10);

    // Create Admin
    adminUser = await prisma.user.create({
      data: {
        email: 'admin-payments@example.com',
        password: hashedPassword,
        role: 'SUPER_ADMIN'
      }
    });
    adminToken = generateToken(adminUser.id);

    // Create Student User
    studentUser = await prisma.user.create({
      data: {
        email: 'student-payments@example.com',
        password: hashedPassword,
        role: 'STUDENT'
      }
    });
    studentToken = generateToken(studentUser.id);

    // Create Student Profile
    testStudent = await prisma.student.create({
      data: {
        userId: studentUser.id,
        firstName: 'Test',
        lastName: 'Student',
        studentId: 'STU-PAY-001',
        year: 1
      }
    });

    // Create a Payment
    testPayment = await prisma.payment.create({
      data: {
        studentId: testStudent.id,
        amount: 1000,
        type: 'TUITION',
        status: 'PENDING',
        description: 'Semester 1 Tuition'
      }
    });
  });

  afterAll(async () => {
    await prisma.payment.deleteMany({});
    await prisma.student.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  describe('GET /api/payments', () => {
    it('should return paginated results for admin', async () => {
      const res = await request(app)
        .get('/api/payments')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toBeDefined();
    });

    it('should filter by status correctly', async () => {
      const res = await request(app)
        .get('/api/payments?status=PENDING')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      res.body.data.forEach(p => expect(p.status).toBe('PENDING'));
    });

    it('should deny access to students', async () => {
      const res = await request(app)
        .get('/api/payments')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/payments', () => {
    it('should create payment with valid data', async () => {
      const res = await request(app)
        .post('/api/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          studentId: testStudent.id,
          amount: 500,
          type: 'LIBRARY',
          description: 'Library Fine',
          dueDate: new Date()
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.amount).toBe(500);
    });

    it('should fail with missing required fields', async () => {
      const res = await request(app)
        .post('/api/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: 500
        });

      expect(res.status).toBe(422);
    });
  });

  describe('PUT /api/payments/:id/pay', () => {
    it('should mark payment as paid', async () => {
      const res = await request(app)
        .put(`/api/payments/${testPayment.id}/pay`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('PAID');
      expect(res.body.data.paidAt).not.toBeNull();
    });
  });

  describe('GET /api/payments/my', () => {
    it('should allow student to see their own payments', async () => {
      const res = await request(app)
        .get('/api/payments/my')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.every(p => p.studentId === testStudent.id)).toBe(true);
    });
  });

  describe('DELETE /api/payments/:id', () => {
    it('should allow admin to delete', async () => {
      const newPayment = await prisma.payment.create({
        data: {
          studentId: testStudent.id,
          amount: 100,
          type: 'OTHER'
        }
      });

      const res = await request(app)
        .delete(`/api/payments/${newPayment.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });

    it('should deny student from deleting', async () => {
      const res = await request(app)
        .delete(`/api/payments/${testPayment.id}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
    });
  });
});
