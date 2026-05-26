const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { notifyStudentsInCourse } = require('../utils/notification.utils');

exports.createQuiz = async (req, res) => {
  try {
    const { title, description, courseId, duration, startTime, endTime, questions } = req.body;
    const doctor = await prisma.doctor.findUnique({ where: { userId: req.user.id } });

    if (!doctor) return res.status(403).json({ success: false, message: 'Only doctors can create quizzes' });

    const quiz = await prisma.quiz.create({
      data: {
        title,
        description,
        courseId: parseInt(courseId),
        doctorId: doctor.id,
        duration: parseInt(duration),
        startTime: startTime ? new Date(startTime) : null,
        endTime: endTime ? new Date(endTime) : null,
        questions: {
          create: questions.map(q => ({
            text: q.text,
            optionA: q.optionA,
            optionB: q.optionB,
            optionC: q.optionC,
            optionD: q.optionD,
            correct: q.correct,
            points: q.points || 1
          }))
        }
      },
      include: { 
        questions: true,
        course: { select: { name: true } }
      }
    });

    // Notify students
    await notifyStudentsInCourse({
      courseId: quiz.courseId,
      title: 'New Quiz Published',
      message: `A new quiz "${quiz.title}" has been published for course ${quiz.course.name}.`,
      type: 'warning'
    });

    res.status(201).json({ success: true, data: quiz });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getQuizzes = async (req, res) => {
  try {
    const { courseId } = req.query;
    let where = {};

    if (courseId) {
      where.courseId = parseInt(courseId);
    }

    // Role-based filtering
    if (req.user.role === 'DOCTOR') {
      const doctor = await prisma.doctor.findUnique({ where: { userId: req.user.id } });
      if (doctor) {
        where.doctorId = doctor.id;
      }
    } else if (req.user.role === 'STUDENT') {
      const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
      if (student) {
        where.course = {
          students: { some: { id: student.id } }
        };
      }
    }

    const quizzes = await prisma.quiz.findMany({
      where,
      include: {
        course: { select: { name: true, courseCode: true } },
        doctor: { select: { firstName: true, lastName: true } },
        _count: { select: { submissions: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: quizzes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getQuizById = async (req, res) => {
  try {
    const quiz = await prisma.quiz.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { 
        questions: req.user.role === 'DOCTOR' || req.user.role === 'SUPER_ADMIN', // Hide correct answers for students? 
        // Actually, we need questions for students to take the quiz, but maybe hide the 'correct' field.
        course: true,
        doctor: true
      }
    });

    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });

    // If student, remove the 'correct' field from questions
    if (req.user.role === 'STUDENT') {
      const studentSubmission = await prisma.quizSubmission.findFirst({
        where: { quizId: quiz.id, studentId: (await prisma.student.findUnique({ where: { userId: req.user.id } })).id }
      });
      
      quiz.questions = quiz.questions.map(q => {
        const { correct, ...rest } = q;
        return studentSubmission ? q : rest; // Show correct answers only if already submitted
      });
      quiz.hasSubmitted = !!studentSubmission;
    }

    res.json({ success: true, data: quiz });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.submitQuiz = async (req, res) => {
  try {
    const { id } = req.params;
    const { answers } = req.body; // { questionId: "A", ... }
    const student = await prisma.student.findUnique({ where: { userId: req.user.id } });

    if (!student) return res.status(403).json({ success: false, message: 'Only students can submit quizzes' });

    const quiz = await prisma.quiz.findUnique({
      where: { id: parseInt(id) },
      include: { questions: true }
    });

    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });

    // Check if already submitted
    const existingSubmission = await prisma.quizSubmission.findFirst({
      where: { quizId: quiz.id, studentId: student.id }
    });
    if (existingSubmission) return res.status(400).json({ success: false, message: 'Already submitted' });

    // Auto-grading
    let score = 0;
    let totalPoints = 0;
    quiz.questions.forEach(q => {
      totalPoints += q.points;
      if (answers[q.id] === q.correct) {
        score += q.points;
      }
    });

    const submission = await prisma.quizSubmission.create({
      data: {
        quizId: quiz.id,
        studentId: student.id,
        answers,
        score: (score / totalPoints) * 100
      }
    });

    res.status(201).json({ success: true, data: submission });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getQuizResults = async (req, res) => {
  try {
    const { id } = req.params;
    const quiz = await prisma.quiz.findUnique({
      where: { id: parseInt(id) },
      include: {
        submissions: {
          include: { student: true }
        }
      }
    });

    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });

    res.json({ success: true, data: quiz.submissions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
