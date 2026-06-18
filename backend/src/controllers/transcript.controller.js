const catchAsync = require('../utils/catchAsync.js');
const { AuthorizationError } = require('../utils/appError.js');
const { EnrollmentService } = require('../services/enrollment.service.js');

exports.getTranscript = catchAsync(async (req, res) => {
  const studentId = parseInt(req.params.studentId);
  
  // Authorization: students can only view own transcript
  if (req.user.role === 'STUDENT' && req.user.student?.id !== studentId) {
    throw new AuthorizationError('You can only view your own transcript');
  }

  const enrollments = await EnrollmentService.getStudentTranscript(studentId);

  // Calculate GPA (4.0 scale)
  const completed = enrollments.filter(e => e.status === 'COMPLETED' && e.finalGrade !== null);
  const totalPoints = completed.reduce((sum, e) => {
    const grade = e.finalGrade;
    const points = grade >= 90 ? 4.0 : grade >= 80 ? 3.0 : grade >= 70 ? 2.0 : grade >= 60 ? 1.0 : 0;
    return sum + (points * (e.course.credits ?? 3));
  }, 0);
  
  const totalHours = completed.reduce((sum, e) => sum + (e.course.credits ?? 3), 0);
  const gpa = totalHours > 0 ? (totalPoints / totalHours).toFixed(2) : '0.00';

  // Group by semester
  const byYear = enrollments.reduce((acc, e) => {
    const key = `${e.academicYear}-${e.semester}`;
    if (!acc[key]) acc[key] = { academicYear: e.academicYear, semester: e.semester, courses: [] };
    acc[key].courses.push(e);
    return acc;
  }, {});

  res.json({
    success: true,
    data: {
      studentId,
      gpa,
      totalCreditHours: totalHours,
      totalEnrollments: enrollments.length,
      semesters: Object.values(byYear)
    }
  });
});
