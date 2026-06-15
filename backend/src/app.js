const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const cookieParser = require('cookie-parser');

// Error Handling imports
const globalErrorHandler = require('./middleware/error.middleware');
const { NotFoundError } = require('./utils/appError');

// Route imports
const authRoutes = require('./routes/auth.routes');
const studentsRoutes = require('./routes/students.routes');
const coursesRoutes = require('./routes/courses.routes');
const doctorsRoutes = require('./routes/doctors.routes');
const schedulesRoutes = require('./routes/schedules.routes');
const examsRoutes = require('./routes/exams.routes');
const paymentsRoutes = require('./routes/payments.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const collegeRoutes = require('./routes/college.routes');
const departmentRoutes = require('./routes/department.routes');
const quizRoutes = require('./routes/quiz.routes');
const taskRoutes = require('./routes/task.routes');
const usersRoutes = require('./routes/users.routes');
const notificationRoutes = require('./routes/notification.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const timetableRoutes = require('./routes/timetable.routes');
const searchRoutes = require('./routes/search.routes');
const { protect } = require('./middleware/auth.middleware');

const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./utils/swagger');

const app = express();
app.set('trust proxy', 1);

// 1. SWAGGER DOCUMENTATION
if (process.env.NODE_ENV !== 'production') { 
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs)); 
  console.log('📚 Swagger Docs available at /api-docs (development only)'); 
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
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : [
      'http://localhost:5173', 
      'http://localhost:3000', 
      'http://localhost:3001',
      'https://capable-bienenstitch-1fc9d2.netlify.app'
    ];

app.use(cors({ 
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const isAllowed = allowedOrigins.includes(origin) || 
                     origin.match(/https:\/\/university-management-system.*\.vercel\.app$/);

    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('CORS Policy: Origin not allowed'), false);
    }
  },
  credentials: true, 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'], 
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'] 
}));

// 3. RATE LIMITING
// Global limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 2000 : 500, // 2000 requests in dev, 500 in production
  message: { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', globalLimiter);

// Strict limiter for Auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 100 : 50, // 100 auth requests in dev, 50 in production
  message: { success: false, message: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});
app.use('/api/auth', authLimiter);

// 4. HEALTH CHECK
app.get('/api/health', async (req, res) => {
  try {
    const prisma = require('./utils/prismaClient');
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ 
      success: true, 
      message: 'Server and Database are healthy',
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: 'Database connection failed',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 5. BODY PARSERS
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// 5. STATIC FILES
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 6. ROUTES
app.use('/api/auth', authRoutes);
app.use('/api/students', protect, studentsRoutes);
app.use('/api/courses', protect, coursesRoutes);
app.use('/api/doctors', protect, doctorsRoutes);
app.use('/api/schedules', protect, schedulesRoutes);
app.use('/api/exams', protect, examsRoutes);
app.use('/api/payments', protect, paymentsRoutes);
app.use('/api/dashboard', protect, dashboardRoutes);
app.use('/api/colleges', collegeRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/users', protect, usersRoutes);
app.use('/api/notifications', protect, notificationRoutes);
app.use('/api/analytics', protect, analyticsRoutes);
app.use('/api/attendance', protect, attendanceRoutes);
app.use('/api/timetables', protect, timetableRoutes);
app.use('/api/search', protect, searchRoutes);

// Health check & Root
app.get('/', (req, res) => {
  res.status(200).json({ 
    success: true, 
    message: 'Smart University API is active', 
    version: '1.0.0',
    documentation: '/api-docs'
  });
});

// 404 handler for undefined routes
app.use((req, res, next) => {
  next(new NotFoundError(`Can't find ${req.originalUrl} on this server!`));
});

// 7. GLOBAL ERROR HANDLING
app.use(globalErrorHandler);

module.exports = app;
