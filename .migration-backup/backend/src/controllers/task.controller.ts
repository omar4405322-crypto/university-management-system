import { Request, Response } from 'express';
import prisma from '../utils/prismaClient';
import { auditLog } from '../utils/audit.utils';
import { notifyStudentsInCourse } from '../utils/notification.utils';
import { getScopeWhere } from '../utils/scope.utils';

export const createTask = async (req: Request, res: Response) => {
  try {
    const { title, description, courseId, dueDate, maxScore } = req.body;
    const doctor = await prisma.doctor.findUnique({ where: { userId: req.user!.id } });

    if (!doctor)
      return res.status(403).json({ success: false, message: 'Only doctors can create tasks' });

    // Ensure course is within doctor's/admin's scope
    const course = await prisma.course.findUnique({
      where: { id: parseInt(courseId as string) },
      include: { department: true },
    });
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
    const courseScope: any = getScopeWhere(req.user!, 'course');
    if (courseScope && Object.keys(courseScope).length) {
      if (
        courseScope.department &&
        course.department?.collegeId !== courseScope.department.collegeId
      )
        return res.status(403).json({ success: false, message: 'Access denied' });
      if (courseScope.departmentId && course.departmentId !== courseScope.departmentId)
        return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const task = await prisma.task.create({
      data: {
        title,
        description,
        courseId: parseInt(courseId as string),
        doctorId: doctor.id,
        dueDate: new Date(dueDate as string),
        maxScore: parseInt(maxScore as string) || 100,
      },
      include: {
        course: { select: { name: true } },
      },
    });

    // Notify students
    await notifyStudentsInCourse({
      courseId: task.courseId,
      title: 'New Assignment Posted',
      message: `A new assignment "${task.title}" has been posted for course ${task.course.name}.`,
      type: 'info',
    });

    res.status(201).json({ success: true, data: task });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getTasks = async (req: Request, res: Response) => {
  try {
    const { courseId } = req.query;
    const where: any = {};

    if (courseId) {
      where.courseId = parseInt(courseId as string);
    }

    // Role-based filtering
    if (req.user!.role === 'DOCTOR') {
      const doctor = await prisma.doctor.findUnique({ where: { userId: req.user!.id } });
      if (doctor) {
        where.doctorId = doctor.id;
      }
    } else if (req.user!.role === 'STUDENT') {
      const student = await prisma.student.findUnique({ where: { userId: req.user!.id } });
      if (student) {
        where.course = {
          enrollments: { some: { studentId: student.id, status: 'ENROLLED' } },
        };
      }
    }

    // Apply admin scope (COLLEGE_ADMIN / DEPARTMENT_ADMIN)
    const courseScope: any = getScopeWhere(req.user!, 'course');
    if (courseScope && Object.keys(courseScope).length) {
      if (courseScope.department) where.course = courseScope.department;
      else if (courseScope.departmentId) where.course = { departmentId: courseScope.departmentId };
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        course: { select: { name: true, courseCode: true } },
        doctor: { select: { firstName: true, lastName: true } },
        _count: { select: { submissions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: tasks });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const submitTask = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { notes, fileUrl } = req.body;
    const student = await prisma.student.findUnique({ where: { userId: req.user!.id } });

    if (!student)
      return res.status(403).json({ success: false, message: 'Only students can submit tasks' });

    // Ensure student/course within scope (students submit own work; doctor/admin may accept)
    const taskObj = await prisma.task.findUnique({
      where: { id: parseInt(id as string) },
      include: { course: { include: { department: true } } },
    });
    if (!taskObj) return res.status(404).json({ success: false, message: 'Task not found' });
    const courseScope2: any = getScopeWhere(req.user!, 'course');
    if (courseScope2 && Object.keys(courseScope2).length) {
      if (
        courseScope2.department &&
        taskObj.course?.department?.collegeId !== courseScope2.department.collegeId
      )
        return res.status(403).json({ success: false, message: 'Access denied' });
      if (courseScope2.departmentId && taskObj.course?.departmentId !== courseScope2.departmentId)
        return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const submission = await prisma.taskSubmission.create({
      data: {
        taskId: parseInt(id as string),
        studentId: student.id,
        notes,
        fileUrl,
      },
    });

    res.status(201).json({ success: true, data: submission });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const gradeSubmission = async (req: Request, res: Response) => {
  try {
    const { sid } = req.params;
    const { score } = req.body;

    // Ensure grader has access to the task's course
    const existingSubmission = await prisma.taskSubmission.findUnique({
      where: { id: parseInt(sid as string) },
      include: { task: { include: { course: { include: { department: true } } } } },
    });
    if (!existingSubmission)
      return res.status(404).json({ success: false, message: 'Submission not found' });
    const courseScope3: any = getScopeWhere(req.user!, 'course');
    if (courseScope3 && Object.keys(courseScope3).length) {
      if (
        courseScope3.department &&
        existingSubmission.task.course?.department?.collegeId !== courseScope3.department.collegeId
      )
        return res.status(403).json({ success: false, message: 'Access denied' });
      if (
        courseScope3.departmentId &&
        existingSubmission.task.course?.departmentId !== courseScope3.departmentId
      )
        return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const submission = await prisma.taskSubmission.update({
      where: { id: parseInt(sid as string) },
      data: { score: parseFloat(score as string) },
    });

    auditLog('UPDATE_GRADE', 'TaskSubmission', req.params.id as string, req);
    res.json({ success: true, data: submission });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getTaskSubmissions = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // Ensure task within scope
    const taskObj = await prisma.task.findUnique({
      where: { id: parseInt(id as string) },
      include: { course: { include: { department: true } } },
    });
    if (!taskObj) return res.status(404).json({ success: false, message: 'Task not found' });
    const courseScope4: any = getScopeWhere(req.user!, 'course');
    if (courseScope4 && Object.keys(courseScope4).length) {
      if (
        courseScope4.department &&
        taskObj.course?.department?.collegeId !== courseScope4.department.collegeId
      )
        return res.status(403).json({ success: false, message: 'Access denied' });
      if (courseScope4.departmentId && taskObj.course?.departmentId !== courseScope4.departmentId)
        return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const submissions = await prisma.taskSubmission.findMany({
      where: { taskId: parseInt(id as string) },
      include: { student: true },
    });
    res.json({ success: true, data: submissions });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
