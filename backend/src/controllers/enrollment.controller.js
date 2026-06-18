const catchAsync = require('../utils/catchAsync.js');
const { ValidationError, AppError, AuthorizationError } = require('../utils/appError.js');
const prisma = require('../utils/prismaClient.js');
const { auditLog } = require('../utils/audit.utils.js');
const { EnrollmentService } = require('../services/enrollment.service.js');

exports.enrollStudent = catchAsync(async (req, res) => {
  const { studentId, courseId, semester, academicYear } = req.body;
  const enrollment = await EnrollmentService.enrollStudent(
    parseInt(studentId),
    parseInt(courseId),
    parseInt(semester),
    parseInt(academicYear)
  );
  res.status(201).json({ success: true, data: enrollment });
});

exports.withdrawStudent = catchAsync(async (req, res) => {
  // DELETE /api/enrollments/:id
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: parseInt(req.params.id) },
  });

  if (!enrollment) {
    throw new ValidationError('Enrollment not found');
  }

  if (req.user.role === 'STUDENT' && req.user.student?.id !== enrollment.studentId) {
    throw new AuthorizationError('You can only withdraw from your own enrollments');
  }

  const withdrawn = await EnrollmentService.withdrawStudent(enrollment.studentId, enrollment.courseId);
  res.json({ success: true, data: withdrawn });
});

exports.getEnrollments = catchAsync(async (req, res) => {
  const { studentId, courseId, semester } = req.query;
  const where = {};
  if (studentId) where.studentId = parseInt(studentId);
  if (courseId) where.courseId = parseInt(courseId);
  if (semester) where.semester = parseInt(semester);

  const enrollments = await prisma.enrollment.findMany({ where });
  res.json({ success: true, data: enrollments });
});

exports.updateGrade = catchAsync(async (req, res) => {
  const { finalGrade } = req.body;
  
  if (finalGrade < 0 || finalGrade > 100) {
    throw new ValidationError('Grade must be between 0 and 100');
  }

  const enrollment = await prisma.enrollment.update({
    where: { id: parseInt(req.params.id) },
    data: { 
      finalGrade,
      status: finalGrade >= 60 ? 'COMPLETED' : 'FAILED'
    }
  });

  auditLog('UPDATE_GRADE', 'Enrollment', enrollment.id, req, {
    finalGrade: { from: null, to: finalGrade }
  });

  res.json({ success: true, data: enrollment });
});
