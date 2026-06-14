import express, { Application, Request, Response, NextFunction } from 'express';
import * as Sentry from '@sentry/node';
// @ts-ignore
import cors from 'cors';
// @ts-ignore
import helmet from 'helmet';
// @ts-ignore
import rateLimit from 'express-rate-limit';
import path from 'path';
// @ts-ignore
import cookieParser from 'cookie-parser';
import prisma from './utils/prismaClient.js';
import { corsOptions } from './config/cors.js';

// Error Handling imports
import globalErrorHandler from './middleware/error.middleware.js';
import { NotFoundError } from './utils/appError.js';

// Route imports
// @ts-ignore
import authRoutes from './routes/auth.routes.js';
// @ts-ignore
import studentsRoutes from './routes/students.routes.js';
// @ts-ignore
import coursesRoutes from './routes/courses.routes.js';
// @ts-ignore
import doctorsRoutes from './routes/doctors.routes.js';
// @ts-ignore
import schedulesRoutes from './routes/schedules.routes.js';
// @ts-ignore
import examsRoutes from './routes/exams.routes.js';
// @ts-ignore
import paymentsRoutes from './routes/payments.routes.js';
// @ts-ignore
import dashboardRoutes from './routes/dashboard.routes.js';
// @ts-ignore
import enrollmentRoutes from './routes/enrollment.routes.js';
// @ts-ignore
import collegeRoutes from './routes/college.routes.js';
// @ts-ignore
import departmentRoutes from './routes/department.routes.js';
// @ts-ignore
import quizRoutes from './routes/quiz.routes.js';
// @ts-ignore
import taskRoutes from './routes/task.routes.js';
// @ts-ignore
import usersRoutes from './routes/users.routes.js';
// @ts-ignore
import notificationRoutes from './routes/notification.routes.js';
// @ts-ignore
import analyticsRoutes from './routes/analytics.routes.js';
// @ts-ignore
import attendanceRoutes from './routes/attendance.routes.js';
// @ts-ignore
import timetableRoutes from './routes/timetable.routes.js';
// @ts-ignore
import searchRoutes from './routes/search.routes.js';
// @ts-ignore
import facultyRoutes from './routes/faculty.routes.js';
// @ts-ignore
import gradingRoutes from './routes/grading.routes.js';
// @ts-ignore
import degreeAuditRoutes from './routes/degree-audit.routes.js';
// @ts-ignore
import { protect } from './middleware/auth.middleware.js';

// @ts-ignore
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './utils/swagger.js';

const app: Application = express();
app.set('trust proxy', 1);

// If Sentry is configured, attach request & tracing handlers BEFORE routes
if (process.env.SENTRY_DSN) {
app.use((Sentry as any).Handlers.requestHandler());
app.use((Sentry as any).Handlers.tracingHandler());
}

// 2. SECURITY HEADERS (Enterprise-grade)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  xssFilter: true,
  noSniff: true,
  hidePoweredBy: true,
  frameguard: { action: 'deny' }
}));

// 2. CORS CONFIGURATION
app.use(cors(corsOptions));

// 3. RATE LIMITING
const authLimiter = rateLimit({ 
  windowMs: 15 * 60 * 1000, 
  max: 50, 
  message: { success: false, message: 'Too many auth attempts' },
  standardHeaders: true,
  legacyHeaders: false
});

const enrollmentLimiter = rateLimit({ 
  windowMs: 15 * 60 * 1000, 
  max: 5000,
  standardHeaders: true,
  legacyHeaders: false
});

const apiLimiter = rateLimit({ 
  windowMs: 15 * 60 * 1000, 
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/auth', authLimiter);

// 4. HEALTH CHECK
app.get('/api/health', async (req: Request, res: Response): Promise<void> => {
  try {
    await (prisma as any).$queryRaw`SELECT 1`;
    res.status(200).json({ 
      success: true, 
      message: 'Server and Database are healthy',
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV
    });
  } catch (err: any) {
    res.status(500).json({ 
      success: false, 
      message: 'Database connection failed',
      error: err instanceof Error ? err.message : 'Unknown error',
      timestamp: new Date().toISOString()
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
app.use('/api/enrollment', enrollmentLimiter, protect, enrollmentRoutes);

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
app.use('/api/users', protect, usersRoutes);
app.use('/api/notifications', protect, notificationRoutes);
app.use('/api/analytics', protect, analyticsRoutes);
app.use('/api/attendance', protect, attendanceRoutes);
app.use('/api/timetable', protect, timetableRoutes);
app.use('/api/faculty', protect, facultyRoutes);
app.use('/api/grades', protect, gradingRoutes);
app.use('/api/degree-audit', protect, degreeAuditRoutes);
app.use('/api/search', protect, searchRoutes);
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

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

