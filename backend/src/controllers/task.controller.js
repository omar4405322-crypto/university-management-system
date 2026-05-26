const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { notifyStudentsInCourse } = require('../utils/notification.utils');

exports.createTask = async (req, res) => {
  try {
    const { title, description, courseId, dueDate, maxScore } = req.body;
    const doctor = await prisma.doctor.findUnique({ where: { userId: req.user.id } });

    if (!doctor) return res.status(403).json({ success: false, message: 'Only doctors can create tasks' });

    const task = await prisma.task.create({
      data: {
        title,
        description,
        courseId: parseInt(courseId),
        doctorId: doctor.id,
        dueDate: new Date(dueDate),
        maxScore: parseInt(maxScore) || 100
      },
      include: {
        course: { select: { name: true } }
      }
    });

    // Notify students
    await notifyStudentsInCourse({
      courseId: task.courseId,
      title: 'New Assignment Posted',
      message: `A new assignment "${task.title}" has been posted for course ${task.course.name}.`,
      type: 'info'
    });

    res.status(201).json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getTasks = async (req, res) => {
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

    const tasks = await prisma.task.findMany({
      where,
      include: {
        course: { select: { name: true, courseCode: true } },
        doctor: { select: { firstName: true, lastName: true } },
        _count: { select: { submissions: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: tasks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.submitTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes, fileUrl } = req.body;
    const student = await prisma.student.findUnique({ where: { userId: req.user.id } });

    if (!student) return res.status(403).json({ success: false, message: 'Only students can submit tasks' });

    const submission = await prisma.taskSubmission.create({
      data: {
        taskId: parseInt(id),
        studentId: student.id,
        notes,
        fileUrl
      }
    });

    res.status(201).json({ success: true, data: submission });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.gradeSubmission = async (req, res) => {
  try {
    const { sid } = req.params;
    const { score } = req.body;
    
    const submission = await prisma.taskSubmission.update({
      where: { id: parseInt(sid) },
      data: { score: parseFloat(score) }
    });

    res.json({ success: true, data: submission });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getTaskSubmissions = async (req, res) => {
  try {
    const { id } = req.params;
    const submissions = await prisma.taskSubmission.findMany({
      where: { taskId: parseInt(id) },
      include: { student: true }
    });
    res.json({ success: true, data: submissions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
