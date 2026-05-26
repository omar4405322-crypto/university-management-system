const express = require('express');
const cors = require('cors');
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
const { protect } = require('./middleware/auth.middleware');

const app = express();
const path = require('path');

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Middleware
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3001'
];

app.use(cors({ 
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true, 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], 
  allowedHeaders: ['Content-Type', 'Authorization'] 
}));
app.use(express.json());

// Routes
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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

module.exports = app;
