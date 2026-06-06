const request = require('supertest');
const app = require('../src/app');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');
const { generateToken } = require('../src/utils/jwt.utils');
const jwt = require('jsonwebtoken');

describe('Authentication API', () => {
  beforeAll(async () => {
    // Clean up test users
    await prisma.registrationRequest.deleteMany({
      where: { email: { contains: 'test' } }
    });
    await prisma.student.deleteMany({
      where: { user: { email: { contains: 'test' } } }
    });
    await prisma.user.deleteMany({
      where: { email: { contains: 'test' } }
    });
  });

  afterAll(async () => {
    await prisma.registrationRequest.deleteMany({
      where: { email: { contains: 'test' } }
    });
    await prisma.student.deleteMany({
      where: { user: { email: { contains: 'test' } } }
    });
    await prisma.user.deleteMany({
      where: { email: { contains: 'test' } }
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
      expect(res.body.message).toMatch(/under review/i);
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

  describe('Token Security', () => {
    let user, validToken;

    beforeAll(async () => {
      const hashedPassword = await bcrypt.hash('Password123', 10);
      user = await prisma.user.create({
        data: {
          email: 'token-security@example.com',
          password: hashedPassword,
          role: 'STUDENT',
          tokenVersion: 1
        }
      });
      validToken = generateToken(user.id, user.tokenVersion);
    });

    it('should fail with expired token', async () => {
      const expiredToken = jwt.sign(
        { id: user.id, version: user.tokenVersion }, 
        process.env.JWT_SECRET, 
        { expiresIn: '0s' }
      );
      
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/session expired/i);
    });

    it('should fail after password change (tokenVersion mismatch)', async () => {
      // Simulate password change incrementing tokenVersion
      await prisma.user.update({
        where: { id: user.id },
        data: { tokenVersion: 2 }
      });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/session invalidated/i);
    });

    it('should fail with tampered token', async () => {
      const tamperedToken = validToken.substring(0, validToken.length - 5) + 'abcde';
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tamperedToken}`);

      expect(res.status).toBe(401);
    });

    it('should fail with missing Authorization header', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/no security token provided/i);
    });
  });
});
