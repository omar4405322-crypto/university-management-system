import express, { Application, Request, Response, NextFunction } from 'express';
import * as Sentry from '@sentry/node';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import prisma from './utils/prismaClient';

// Error Handling imports
import globalErrorHandler from './middleware/error.middleware';
import { NotFoundError } from './utils/appError';

// Route imports
import authRoutes from './routes/auth.routes';
import studentsRoutes from './routes/students.routes';
import coursesRoutes from './routes/courses.routes';
import doctorsRoutes from './routes/doctors.routes';
import schedulesRoutes from './routes/schedules.routes';
import examsRoutes from './routes/exams.routes';
import paymentsRoutes from './routes/payments.routes';
import dashboardRoutes from './routes/dashboard.routes';
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
import { protect } from './middleware/auth.middleware';
import roomRoutes from './routes/room.routes';

import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './utils/swagger';

const app: Application = express();
app.set('trust proxy', 1);

// If Sentry is configured, attach request & tracing handlers BEFORE routes
if (process.env.SENTRY_DSN) {
  app.use((Sentry as any).Handlers.requestHandler());
  app.use((Sentry as any).Handlers.tracingHandler());
}

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

const envOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : [];

const allowedOrigins = [
  ...envOrigins,
  process.env.FRONTEND_URL,
  process.env.FRONTEND_NETWORK_URL,
  process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : undefined,
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3001',
].filter((v, i, arr) => Boolean(v) && arr.indexOf(v) === i) as string[];

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
      // Allow any localhost port (dev only)
      const isLocalhost = /^https?:\/\/localhost(:\d+)?$/.test(origin);
      // Allow local network IP addresses
      const isLocalNetwork = /^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(origin);
      const isVercelPreview = /https:\/\/university-management-system.*\.vercel\.app$/.test(origin);
      // Match any *.replit.dev, *.replit.app, *.repl.co subdomain
      const isReplitOrigin =
        /https?:\/\/[^/]*\.replit\.app(:\d+)?$/.test(origin) ||
        /https?:\/\/[^/]*\.repl\.co(:\d+)?$/.test(origin) ||
        /https?:\/\/[^/]*\.replit\.dev(:\d+)?$/.test(origin);
      if (allowedOrigins.includes(origin) || isLocalhost || isLocalNetwork || isVercelPreview || isReplitOrigin) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

// 3. RATE LIMITING
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many auth attempts' },
  standardHeaders: true,
  legacyHeaders: false,
});

const enrollmentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
});

// 4. HEALTH CHECK (both /api/health and /api/healthz for deployment compatibility)
const healthHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    await (prisma as any).$queryRaw`SELECT 1`;
    res.status(200).json({
      success: true,
      message: 'Server and Database are healthy',
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: err instanceof Error ? err.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
};
app.get('/api/healthz', healthHandler);
app.get('/api/health', async (req: Request, res: Response): Promise<void> => {
  try {
    await (prisma as any).$queryRaw`SELECT 1`;
    res.status(200).json({
      success: true,
      message: 'Server and Database are healthy',
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: err instanceof Error ? err.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// 5. BODY PARSERS
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// 6. STATIC FILES
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

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

// 8. 404 & Global Error Handler
app.use((req: Request, res: Response, next: NextFunction) => {
  next(new NotFoundError(`Can't find ${req.originalUrl} on this server!`));
});

// Sentry error handler must be before any other error middleware
if (process.env.SENTRY_DSN) {
  // Use the official Express error handler from Sentry
  app.use((Sentry as any).Handlers.errorHandler());
}

app.use(globalErrorHandler);

export default app;
