const request = require('supertest');
const app = require('../src/app');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');
const { generateToken } = require('../src/utils/jwt.utils');

describe('Authentication API', () => {
  beforeAll(async () => {
    // Clean up test users
    await prisma.user.deleteMany({
      where: { email: { contains: 'test@example.com' } }
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { contains: 'test@example.com' } }
    });
    await prisma.$disconnect();
  });

  describe('POST /api/auth/register', () => {
    it('should submit a registration request with valid data', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test-student@example.com',
          password: 'Password123',
          role: 'STUDENT',
          firstName: 'Test',
          lastName: 'Student',
          studentId: 'STU-TEST-001',
          year: 1
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/submitted/i);
    });

    it('should fail registration with invalid email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'Password123',
          role: 'STUDENT',
          firstName: 'Test',
          lastName: 'Student'
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('should fail registration with weak password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test-weak@example.com',
          password: 'weak',
          role: 'STUDENT',
          firstName: 'Test',
          lastName: 'Student'
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    let testUser;

    beforeAll(async () => {
      const hashedPassword = await bcrypt.hash('Password123', 10);
      testUser = await prisma.user.create({
        data: {
          email: 'test-login@example.com',
          password: hashedPassword,
          role: 'SUPER_ADMIN'
        }
      });
    });

    it('should login successfully with correct credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test-login@example.com',
          password: 'Password123'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data.user.email).toBe('test-login@example.com');
    });

    it('should fail login with incorrect password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test-login@example.com',
          password: 'wrongpassword'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/auth/me', () => {
    let token;
    let user;

    beforeAll(async () => {
      const hashedPassword = await bcrypt.hash('Password123', 10);
      user = await prisma.user.create({
        data: {
          email: 'test-me@example.com',
          password: hashedPassword,
          role: 'STUDENT'
        }
      });
      token = generateToken(user.id);
    });

    it('should return user profile with valid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('test-me@example.com');
    });

    it('should fail with invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});
