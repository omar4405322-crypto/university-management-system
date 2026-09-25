import express, { Application, Request, Response, NextFunction } from 'express';
import * as Sentry from '@sentry/node';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import { enforcePaginationBounds } from './middleware/requestLimits.middleware';
import auditLog from './middleware/audit.middleware';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import prisma from './utils/prismaClient';

// Error Handling imports
import globalErrorHandler from './middleware/error.middleware';
import { NotFoundError } from './utils/appError';
import { getDashboardCacheHealth, getRedisStatus } from './utils/redis.utils';
import logger from './utils/logger';
import { isShuttingDown } from './utils/lifecycleState';
import requestIdMiddleware from './middleware/requestId.middleware';
import httpLoggerMiddleware from './middleware/httpLogger.middleware';
import metricsMiddleware from './middleware/metrics.middleware';
import metricsRouter from './routes/metrics.routes';

// Route imports
import authRoutes from './routes/auth.routes';
import studentsRoutes from './routes/students.routes';
import coursesRoutes from './routes/courses.routes';
import doctorsRoutes from './routes/doctors.routes';
import schedulesRoutes from './routes/schedules.routes';
import examsRoutes from './routes/exams.routes';
import paymentsRoutes from './routes/payments.routes';
import dashboardRoutes from './routes/dashboard.routes';
import { getPublicLandingStats } from './controllers/dashboard.controller';
import enrollmentRoutes from './routes/enrollment.routes';
import transcriptRoutes from './routes/transcript.routes';
import collegeRoutes from './routes/college.routes';
import departmentRoutes from './routes/department.routes';
import quizRoutes from './routes/quiz.routes';
import taskRoutes from './routes/task.routes';

import usersRoutes from './routes/users.routes';
import notificationRoutes from './routes/notification.routes';
import analyticsRoutes from './routes/analytics.routes';
import attendanceRoutes from './routes/attendance.routes';
import timetableRoutes from './routes/timetable.routes';
import searchRoutes from './routes/search.routes';
import teachingAssistantsRoutes from './routes/teaching-assistants.routes';

import studentGroupsRoutes from './routes/studentGroups.routes';
import requestsRoutes from './routes/requests.routes';
import { protect, authorize } from './middleware/auth.middleware';
import roomRoutes from './routes/room.routes';

import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './utils/swagger';

const app: Application = express();
app.set('trust proxy', 1);

// 1. OBSERVABILITY (Correlation ID, HTTP Request Logging, Metrics)
app.use(requestIdMiddleware);
app.use(httpLoggerMiddleware);
app.use(metricsMiddleware);

// 2. SECURITY HEADERS (Enterprise-grade)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    xssFilter: true,
    noSniff: true,
    hidePoweredBy: true,
    frameguard: { action: 'deny' },
  })
);
import { isOriginAllowed } from './utils/corsOrigins';

app.use(
  cors({
    origin: function (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ) {
      // Allow server-to-server requests with no origin
      if (!origin) {
        return callback(null, true);
      }

      if (isOriginAllowed(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

// 3. RATE LIMITING
import {
  authLimiter,
  createRedisStore,
  rateLimiterPassOnStoreError,
} from './middleware/rateLimiter.middleware';

const enrollmentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: rateLimiterPassOnStoreError,
  store: createRedisStore('enrollment'),
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: rateLimiterPassOnStoreError,
  store: createRedisStore('api'),
});

const healthLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

// 4. PUBLIC LIVENESS & READINESS (Liveness stays ok during drain; readiness fails during shutdown)
const livenessHandler = (_req: Request, res: Response): void => {
  res.status(200).json({ status: 'ok' });
};
app.get('/api/healthz', healthLimiter, livenessHandler);
app.get('/api/health', healthLimiter, livenessHandler);

export const createPublicReadinessHandler = (
  redisStatusProvider: typeof getRedisStatus = getRedisStatus,
  shutdownStatusProvider: typeof isShuttingDown = isShuttingDown
) => async (_req: Request, res: Response): Promise<void> => {
  if (shutdownStatusProvider()) {
    res.status(503).json({ status: 'shutting_down' });
    return;
  }

  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Database check timeout')), 2000)
    );
    await Promise.race([(prisma as any).$queryRaw`SELECT 1`, timeoutPromise]);

    const redisStatus = redisStatusProvider();
    const redisReady = !redisStatus.configured || redisStatus.connected;

    if (!redisReady) {
      res.status(503).json({
        status: 'not_ready',
        checks: { database: true, redis: false },
      });
      return;
    }

    res.status(200).json({
      status: 'ready',
      checks: { database: true, redis: true },
    });
  } catch (error: unknown) {
    logger.error('[HEALTH] Public readiness check failed', { error });
    res.status(503).json({
      status: 'not_ready',
      checks: { database: false },
    });
  }
};

const publicReadinessHandler = createPublicReadinessHandler();
app.get('/api/ready', healthLimiter, publicReadinessHandler);

export const createReadinessHandler = (
  redisStatusProvider: typeof getRedisStatus = getRedisStatus,
  shutdownStatusProvider: typeof isShuttingDown = isShuttingDown
) => async (_req: Request, res: Response): Promise<void> => {
  if (shutdownStatusProvider()) {
    res.status(503).json({
      status: 'not_ready',
      shuttingDown: true,
      checks: {
        database: false,
        redis: false,
        dashboardCache: { configured: false, operational: false, state: 'degraded' },
      },
    });
    return;
  }

  try {
    await (prisma as any).$queryRaw`SELECT 1`;
    const redisStatus = redisStatusProvider();
    const dashboardCache = getDashboardCacheHealth(redisStatus);
    const redisReady = !redisStatus.configured || redisStatus.connected;
    res.status(redisReady ? 200 : 503).json({
      status: redisReady ? 'ready' : 'not_ready',
      checks: {
        database: true,
        redis: redisReady,
        dashboardCache,
      },
    });
  } catch (error: unknown) {
    logger.error('[HEALTH] Readiness database check failed', { error });
    res.status(503).json({ status: 'not_ready', checks: { database: false } });
  }
};

const readinessHandler = createReadinessHandler();

// 5. BODY PARSERS
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.get(
  '/api/health/readiness',
  healthLimiter,
  protect,
  authorize('SUPER_ADMIN'),
  readinessHandler
);
app.use('/api', enforcePaginationBounds);

// Centralized request audit coverage for the mutation families remediated in
// this security session. Each middleware records only successful non-GET calls.
app.use('/api/courses', auditLog('COURSE_MUTATION', 'Course'));
app.use('/api/enrollments', auditLog('ENROLLMENT_MUTATION', 'Enrollment'));
app.use('/api/quizzes', auditLog('QUIZ_MUTATION', 'Quiz'));
app.use('/api/attendance', auditLog('ATTENDANCE_MUTATION', 'Attendance'));
app.use('/api/schedules', auditLog('SCHEDULE_MUTATION', 'ScheduleSlot'));

// 6. STATIC FILES
// Local profile files are a development fallback only. Production uploads use the
// configured cloud provider and must not expose the local filesystem over HTTP.
// Course materials (/uploads/materials) are private and served exclusively through
// the authenticated GET /api/courses/:id/materials/:materialId/download endpoint (SEC-01).
if (process.env.NODE_ENV !== 'production') {
  app.use('/uploads/profiles', express.static(path.join(process.cwd(), 'uploads/profiles')));
}

// 7. ROUTES
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/enrollments', enrollmentLimiter, protect, enrollmentRoutes);
app.use('/api/transcripts', protect, transcriptRoutes);
app.use('/api/transcript', protect, transcriptRoutes);

// Fallback limiter for other API routes
app.use('/api', apiLimiter);

app.use('/api/students', protect, studentsRoutes);
app.use('/api/courses', protect, coursesRoutes);
app.use('/api/doctors', protect, doctorsRoutes);
app.use('/api/schedules', protect, schedulesRoutes);
app.use('/api/exams', protect, examsRoutes);
app.use('/api/payments', protect, paymentsRoutes);
app.get('/api/dashboard/public-stats', getPublicLandingStats);
app.use('/api/dashboard', protect, dashboardRoutes);
app.use('/api/colleges', collegeRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/quizzes', protect, quizRoutes);
app.use('/api/tasks', protect, taskRoutes);

app.use('/api/users', protect, usersRoutes);
app.use('/api/notifications', protect, notificationRoutes);
app.use('/api/analytics', protect, analyticsRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/timetable', protect, timetableRoutes);
app.use('/api/search', protect, searchRoutes);
app.use('/api/teaching-assistants', protect, teachingAssistantsRoutes);

app.use('/api/student-groups', protect, studentGroupsRoutes);
app.use('/api/requests', protect, requestsRoutes);
app.use('/api/rooms', protect, roomRoutes);
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

// Metrics endpoint (Protected)
app.use(metricsRouter);

// 8. 404 & Global Error Handler
app.use((req: Request, res: Response, next: NextFunction) => {
  next(new NotFoundError(`Can't find ${req.originalUrl} on this server!`));
});

// Sentry error handler must be before any other error middleware
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

app.use(globalErrorHandler);

export default app;
