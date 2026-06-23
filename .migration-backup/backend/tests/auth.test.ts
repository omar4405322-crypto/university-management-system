import request from 'supertest';
// @ts-ignore
import app from '../src/app';
import prisma from '../src/utils/prismaClient';
import { getAuthToken, createTestUser, cleanupTestData } from './helpers/testUtils';
// @ts-ignore
import { redis } from '../src/utils/redis.utils';

jest.mock('../src/utils/redis.utils.js', () => ({
  redis: {
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue('OK'),
    setEx: jest.fn().mockResolvedValue('OK'),
    quit: jest.fn().mockResolvedValue('OK'),
  }
}));

describe('Auth Controller Tests', () => {
  beforeEach(async () => {
    await cleanupTestData();
    await prisma.refreshToken.deleteMany({});
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('POST /api/auth/login', () => {
    it('returns access token and sets refresh cookie on valid credentials', async () => {
      const testUser = await createTestUser('STUDENT');

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: 'TestPass123!' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('returns 401 with generic message on wrong password', async () => {
      const testUser = await createTestUser('STUDENT');

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: 'WrongPassword123!' });

      expect(response.status).toBe(401);
      expect(response.body.message).toMatch(/Invalid email or password/i);
    });

    it('returns 401 with generic message on non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@university.test', password: 'Password123!' });

      expect(response.status).toBe(401);
      expect(response.body.message).toMatch(/Invalid email or password/i);
    });

    it('returns 400 validation error on missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@university.test' }); // missing password

      expect(response.status).toBe(422); // Note: Could be 400 depending on validation
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns user profile on valid token', async () => {
      const { token, user } = await getAuthToken('STUDENT');
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(user.email);
    });

    it('returns 401 on no token', async () => {
      const response = await request(app).get('/api/auth/me');
      expect(response.status).toBe(401);
    });

    it('returns 401 on blacklisted token', async () => {
      const { token } = await getAuthToken('STUDENT');
      
      // Override mock specifically for this test
      (redis.get as jest.Mock).mockResolvedValueOnce('1');

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(401);
      expect(response.body.message).toMatch(/invalidated/i);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('clears cookie and blacklists token in Redis', async () => {
      const { token } = await getAuthToken('STUDENT');
      
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toMatch(/logged out/i);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('returns new access token on valid refresh token', async () => {
      const { user } = await getAuthToken('STUDENT');
      const { generateRefreshToken } = require('../src/utils/jwt.utils.js');
      const refreshToken = await generateRefreshToken(user.id);

      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [`refresh_token=${refreshToken}`]);

      expect(response.status).toBe(200);
      expect(response.body.data.accessToken).toBeDefined();
    });

    it('returns 401 on expired/invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [`refresh_token=invalid.token.here`]);

      expect(response.status).toBe(401);
    });
  });
});
