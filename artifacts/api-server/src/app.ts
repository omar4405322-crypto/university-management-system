import express, { Application, Request, Response, NextFunction } from 'express';
import * as Sentry from '@sentry/node';
// @ts-ignore
import cors from 'cors';
// @ts-ignore
import helmet from 'helmet';
// @ts-ignore
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
// @ts-ignore
import cookieParser from 'cookie-parser';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import prisma from './utils/prismaClient';

// Error Handling imports
import globalErrorHandler from './middleware/error.middleware';
import { NotFoundError } from './utils/appError';

// Route imports
// @ts-ignore
import authRoutes from './routes/auth.routes';
// @ts-ignore
import studentsRoutes from './routes/students.routes';
// @ts-ignore
import coursesRoutes from './routes/courses.routes';
// @ts-ignore
import doctorsRoutes from './routes/doctors.routes';
// @ts-ignore
import schedulesRoutes from './routes/schedules.routes';
// @ts-ignore
import examsRoutes from './routes/exams.routes';
// @ts-ignore
import paymentsRoutes from './routes/payments.routes';
// @ts-ignore
import dashboardRoutes from './routes/dashboard.routes';
// @ts-ignore
import enrollmentRoutes from './routes/enrollment.routes';
// @ts-ignore
import transcriptRoutes from './routes/transcript.routes';
// @ts-ignore
import collegeRoutes from './routes/college.routes';
// @ts-ignore
import departmentRoutes from './routes/department.routes';
// @ts-ignore
import quizRoutes from './routes/quiz.routes';
// @ts-ignore
import taskRoutes from './routes/task.routes';
import examSessionRoutes from './routes/examSession.routes';
// @ts-ignore
import usersRoutes from './routes/users.routes';
// @ts-ignore
import notificationRoutes from './routes/notification.routes';
// @ts-ignore
import analyticsRoutes from './routes/analytics.routes';
// @ts-ignore
import attendanceRoutes from './routes/attendance.routes';
// @ts-ignore
import timetableRoutes from './routes/timetable.routes';
// @ts-ignore
import searchRoutes from './routes/search.routes';
// @ts-ignore
import teachingAssistantsRoutes from './routes/teaching-assistants.routes';
// @ts-ignore
import { protect } from './middleware/auth.middleware';

// @ts-ignore
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
      const isVercelPreview = /https:\/\/university-management-system.*\.vercel\.app$/.test(origin);
      // Match any *.replit.dev, *.replit.app, *.repl.co subdomain
      const isReplitOrigin =
        /https?:\/\/[^/]*\.replit\.app(:\d+)?$/.test(origin) ||
        /https?:\/\/[^/]*\.repl\.co(:\d+)?$/.test(origin) ||
        /https?:\/\/[^/]*\.replit\.dev(:\d+)?$/.test(origin);
      if (allowedOrigins.includes(origin) || isLocalhost || isVercelPreview || isReplitOrigin) {
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
  max: 5000,
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth', authLimiter);

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
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 7. ROUTES
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/enrollments', enrollmentLimiter, protect, enrollmentRoutes);
app.use('/api/transcripts', protect, transcriptRoutes);

// Fallback limiter for other API routes
app.use('/api', apiLimiter);

app.use('/api/students', protect, studentsRoutes);
app.use('/api/courses', protect, coursesRoutes);
app.use('/api/doctors', protect, doctorsRoutes);
app.use('/api/schedules', protect, schedulesRoutes);
app.use('/api/exams', protect, examsRoutes);
app.use('/api/payments', protect, paymentsRoutes);
app.use('/api/dashboard', protect, dashboardRoutes);
app.use('/api/colleges', protect, collegeRoutes);
app.use('/api/departments', protect, departmentRoutes);
app.use('/api/quizzes', protect, quizRoutes);
app.use('/api/tasks', protect, taskRoutes);
app.use('/api/exam-sessions', examSessionRoutes);
app.use('/api/users', protect, usersRoutes);
app.use('/api/notifications', protect, notificationRoutes);
app.use('/api/analytics', protect, analyticsRoutes);
app.use('/api/attendance', protect, attendanceRoutes);
app.use('/api/timetable', protect, timetableRoutes);
app.use('/api/search', protect, searchRoutes);
app.use('/api/teaching-assistants', protect, teachingAssistantsRoutes);
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
