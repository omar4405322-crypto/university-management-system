import request from 'supertest';
import express from 'express';
import { protect, authorize } from '../src/middleware/auth.middleware';
import auditLog from '../src/middleware/audit.middleware';
import { generateAccessToken } from '../src/utils/jwt.utils';
// @ts-ignore
import { redis } from '../src/utils/redis.utils';
import prisma from '../src/utils/prismaClient';
import { createTestUser, cleanupTestData } from './helpers/testUtils';

jest.mock('../src/utils/redis.utils.js', () => ({
  redis: {
    get: jest.fn(),
  }
}));

const app = express();
app.use(express.json());

// Dummy routes for testing middleware
app.get('/api/protect', protect, (req, res) => {
  // @ts-ignore
  res.json({ success: true, user: req.user });
});

app.get('/api/authorize', protect, authorize('SUPER_ADMIN'), (req, res) => {
  res.json({ success: true });
});

app.post('/api/audit', protect, auditLog('TEST_ACTION', 'TestEntity'), (req, res) => {
  res.status(201).json({ success: true, data: { id: 999 } });
});

app.get('/api/audit', protect, auditLog('TEST_ACTION', 'TestEntity'), (req, res) => {
  res.status(200).json({ success: true, data: { id: 999 } });
});

describe('Middleware Tests', () => {
  let studentToken: string;
  let adminToken: string;
  let studentUser: any;
  let adminUser: any;

  beforeAll(async () => {
    await cleanupTestData();
    studentUser = await createTestUser('STUDENT');
    studentToken = generateAccessToken(studentUser.id, studentUser.tokenVersion);
    
    adminUser = await createTestUser('SUPER_ADMIN');
    adminToken = generateAccessToken(adminUser.id, adminUser.tokenVersion);
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('auth.middleware - protect', () => {
    it('valid JWT -> sets req.user correctly', async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .get('/api/protect')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.id).toBe(studentUser.id);
    });

    it('expired/invalid JWT -> 401', async () => {
      const res = await request(app)
        .get('/api/protect')
        .set('Authorization', `Bearer invalid.token.here`);

      expect(res.status).toBe(401);
    });

    it('malformed JWT -> 401', async () => {
      const res = await request(app)
        .get('/api/protect')
        .set('Authorization', `Bearer malformed-token`);

      expect(res.status).toBe(401);
    });

    it('blacklisted token -> 401 "Token has been invalidated"', async () => {
      (redis.get as jest.Mock).mockResolvedValue('1');

      const res = await request(app)
        .get('/api/protect')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/invalidated/i);
    });
  });

  describe('auth.middleware - authorize', () => {
    it("authorize('SUPER_ADMIN') - SUPER_ADMIN passes -> next()", async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .get('/api/authorize')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });

    it("authorize('SUPER_ADMIN') - STUDENT blocked -> 403", async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .get('/api/authorize')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Forbidden/i);
    });
  });

  describe('audit.middleware', () => {
    it('logs request metadata on mutating requests (POST/PUT/DELETE)', async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/audit')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ test: 'data' });

      expect(res.status).toBe(201);

      // Give async audit log a moment to save
      await new Promise(resolve => setTimeout(resolve, 100));

      const log = await prisma.auditLog.findFirst({
        where: { userId: adminUser.id, action: 'TEST_ACTION' }
      });
      
      expect(log).toBeDefined();
      expect(log?.entity).toBe('TestEntity');
      expect(log?.entityId).toBe('999');

      if (log) {
        await prisma.auditLog.delete({ where: { id: log.id } });
      }
    });

    it('skips logging for GET requests', async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .get('/api/audit')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);

      await new Promise(resolve => setTimeout(resolve, 100));

      const log = await prisma.auditLog.findFirst({
        where: { userId: adminUser.id, action: 'TEST_ACTION', details: { path: ['method'], equals: 'GET' } }
      });
      
      expect(log).toBeNull();
    });
  });
});
