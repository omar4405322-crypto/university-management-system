import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prismaClient';
import { auditLog } from '../utils/audit.utils';
import { getScopeWhere } from '../utils/scope.utils';
import catchAsync from '../utils/catchAsync';
import { NotFoundError, AuthorizationError, AppError } from '../utils/appError';
import { getIO } from '../utils/socket';

async function syncTimetableToSchedules(timetable: any) {
  const slots = (timetable.scheduleData as any)?.slots || [];
  if (!slots.length) return;

  // Delete old schedules for this timetable's scope
  const deptCourses = await prisma.course.findMany({
    where: {
      departmentId: timetable.departmentId,
      year: timetable.academicYear,
      semester: timetable.semester,
    },
    select: { id: true, name: true, nameAr: true, courseCode: true }
  });

  if (!deptCourses.length) return;

  const courseIds = deptCourses.map((c: any) => c.id);

  await prisma.schedule.deleteMany({
    where: { courseId: { in: courseIds } }
  });

  const courseMap = new Map(
    deptCourses.map((c: any) => [c.name.toLowerCase(), c.id])
  );

  const scheduleData = [];
  for (const slot of slots) {
    const courseName = (slot.courseName || '').toLowerCase();
    let courseId = null;
    
    for (const [name, id] of courseMap.entries()) {
      if (name.includes(courseName) || courseName.includes(name)) {
        courseId = id;
        break;
      }
    }

    if (!courseId) continue;

    scheduleData.push({
      courseId,
      departmentId: timetable.departmentId,
      dayOfWeek: slot.day || 0,
      startTime: slot.startTime || '09:00',
      endTime: slot.endTime || '10:30',
      type: slot.type || 'LECTURE',
      location: slot.location || 'TBA',
      doctorName: slot.doctorName || 'TBA',
      academicYear: timetable.academicYear,
      semester: timetable.semester
    });
  }

  if (scheduleData.length) {
    await prisma.schedule.createMany({
      data: scheduleData
    });
  }
}

/**
 * @desc    Get all timetables (Admin) or matching timetable (Student)
 * @route   GET /api/timetables
 * @access  Private
 */
export const getTimetables = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { user } = req;
  const { collegeId, departmentId, academicYear, semester, status } = req.query as Record<
    string,
    string
  >;

  let where: any = {};

  if (user!.role === 'STUDENT') {
    const student = await prisma.student.findUnique({
      where: { userId: user!.id },
      select: {
        departmentId: true,
        year: true,
        department: {
          select: { collegeId: true },
        },
      },
    });

    if (!student) {
      return next(new NotFoundError('Student profile not found'));
    }

    // Automatically match student profile
    where = {
      departmentId: student.departmentId,
      collegeId: student.department?.collegeId,
      academicYear: student.year,
      status: 'PUBLISHED',
    };
  } else {
    // Admins/Doctors
    if (collegeId) where.collegeId = parseInt(collegeId as string);
    if (departmentId) where.departmentId = parseInt(departmentId as string);
    if (academicYear) where.academicYear = parseInt(academicYear as string);
    if (semester) where.semester = parseInt(semester as string);
    if (status) where.status = status;

    // Apply scope (COLLEGE_ADMIN/DEPARTMENT_ADMIN)
    const deptScope: any = getScopeWhere(user!, 'department');
    if (deptScope && Object.keys(deptScope).length) {
      if (deptScope.collegeId) where.collegeId = deptScope.collegeId;
      if (deptScope.id) where.departmentId = deptScope.id;
    }
  }

  const timetables = await prisma.timetable.findMany({
    where,
    include: {
      college: { select: { name: true, nameAr: true } },
      department: { select: { name: true, nameAr: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  res.json({ success: true, data: timetables });
});

/**
 * @desc    Get a single timetable by ID
 * @route   GET /api/timetables/:id
 * @access  Private
 */
export const getTimetableById = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const timetable = await prisma.timetable.findUnique({
      where: { id: parseInt(req.params.id as string) },
      include: {
        college: true,
        department: true,
      },
    });

    if (!timetable) {
      return next(new NotFoundError('Timetable not found'));
    }

    // Enforce scope on read
    const deptScope: any = getScopeWhere(req.user!, 'department');
    if (deptScope && Object.keys(deptScope).length) {
      if (deptScope.collegeId && timetable.collegeId !== deptScope.collegeId)
        return next(new AuthorizationError('Access denied'));
      if (deptScope.id && timetable.departmentId !== deptScope.id)
        return next(new AuthorizationError('Access denied'));
    }

    res.json({ success: true, data: timetable });
  }
);

/**
 * @desc    Create a new timetable
 * @route   POST /api/timetables
 * @access  Private (Admin)
 */
export const createTimetable = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const {
      collegeId,
      departmentId,
      academicYear,
      semester,
      title,
      description,
      scheduleData,
      fileUrl,
      status,
    } = req.body;

    // Validation
    if (!collegeId || !departmentId || !academicYear || !semester || !title) {
      return next(
        new AppError('Faculty, Department, Academic Year, Semester, and Title are required', 400)
      );
    }

    // Enforce scope for creation
    const deptScope: any = getScopeWhere(req.user!, 'department');
    if (deptScope && Object.keys(deptScope).length) {
      if (deptScope.collegeId && parseInt(collegeId as string) !== deptScope.collegeId)
        return next(new AuthorizationError('Access denied'));
      if (deptScope.id && parseInt(departmentId as string) !== deptScope.id)
        return next(new AuthorizationError('Access denied'));
    }

    // Check for duplicates (handled by unique constraint in DB, but better to check)
    const existing = await prisma.timetable.findUnique({
      where: {
        collegeId_departmentId_academicYear_semester: {
          collegeId: parseInt(collegeId as string),
          departmentId: parseInt(departmentId as string),
          academicYear: parseInt(academicYear as string),
          semester: parseInt(semester as string),
        },
      },
    });

    if (existing) {
      return next(
        new AppError(
          'A timetable for this Faculty, Department, Year, and Semester combination already exists.',
          400
        )
      );
    }

    const timetable = await prisma.timetable.create({
      data: {
        collegeId: parseInt(collegeId as string),
        departmentId: parseInt(departmentId as string),
        academicYear: parseInt(academicYear as string),
        semester: parseInt(semester as string),
        title,
        description,
        scheduleData: scheduleData || {},
        fileUrl,
        status: status || 'DRAFT',
      },
    });

    await syncTimetableToSchedules(timetable);

    // Emit real-time update event (only if Socket.io is initialized)
    const io = getIO();
    if (io) {
      io.emit('timetable:updated', {
        departmentId: timetable.departmentId,
        year: timetable.academicYear,
        semester: timetable.semester,
      });
    }

    res.status(201).json({ success: true, data: timetable });
  }
);

/**
 * @desc    Update a timetable
 * @route   PUT /api/timetables/:id
 * @access  Private (Admin)
 */
export const updateTimetable = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { title, description, scheduleData, fileUrl, status, academicYear, semester } = req.body;
    const id = parseInt(req.params.id as string);

    // Enforce scope on update
    const deptScope: any = getScopeWhere(req.user!, 'department');
    const existing = await prisma.timetable.findUnique({ where: { id } });
    if (!existing) return next(new NotFoundError('Timetable not found'));
    if (deptScope && Object.keys(deptScope).length) {
      if (deptScope.collegeId && existing.collegeId !== deptScope.collegeId)
        return next(new AuthorizationError('Access denied'));
      if (deptScope.id && existing.departmentId !== deptScope.id)
        return next(new AuthorizationError('Access denied'));
    }

    const timetable = await prisma.timetable.update({
      where: { id },
      data: {
        title,
        description,
        scheduleData,
        fileUrl,
        status,
        academicYear: academicYear !== undefined ? parseInt(academicYear as string) : undefined,
        semester: semester !== undefined ? parseInt(semester as string) : undefined,
      },
    });

    await syncTimetableToSchedules(timetable);

    // Emit real-time update event (only if Socket.io is initialized)
    const io = getIO();
    if (io) {
      io.emit('timetable:updated', {
        departmentId: timetable.departmentId,
        year: timetable.academicYear,
        semester: timetable.semester,
      });
    }

    res.json({ success: true, data: timetable });
  }
);

/**
 * @desc    Delete a timetable
 * @route   DELETE /api/timetables/:id
 * @access  Private (Admin)
 */
export const deleteTimetable = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const existing = await prisma.timetable.findUnique({
      where: { id: parseInt(req.params.id as string) },
    });
    if (!existing) return next(new NotFoundError('Timetable not found'));
    const deptScope: any = getScopeWhere(req.user!, 'department');
    if (deptScope && Object.keys(deptScope).length) {
      if (deptScope.collegeId && existing.collegeId !== deptScope.collegeId)
        return next(new AuthorizationError('Access denied'));
      if (deptScope.id && existing.departmentId !== deptScope.id)
        return next(new AuthorizationError('Access denied'));
    }

    await prisma.timetable.delete({
      where: { id: parseInt(req.params.id as string) },
    });
    auditLog('DELETE_TIMETABLE', 'Timetable', req.params.id as string, req);
    res.json({ success: true, message: 'Timetable deleted successfully' });
  }
);

export const publishTimetable = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseInt(req.params.id as string);

    // Fetch the timetable first
    const timetable = await prisma.timetable.findUnique({ where: { id } });
    if (!timetable) throw new NotFoundError('Timetable not found');

    // Scope check for non-super admins
    if (req.user!.role !== 'SUPER_ADMIN' && req.user!.role !== 'ADMIN') {
      const scopeWhere = getScopeWhere(req.user!, 'timetable');
      const allowed = await prisma.timetable.findFirst({
        where: { id, ...scopeWhere }
      });
      if (!allowed) throw new AuthorizationError('Access denied: outside your scope');
    }

    const updated = await prisma.timetable.update({
      where: { id },
      data: { status: 'PUBLISHED' },
    });
    res.json({ success: true, data: updated });
  }
);

export const unpublishTimetable = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseInt(req.params.id as string);

    // Fetch the timetable first
    const timetable = await prisma.timetable.findUnique({ where: { id } });
    if (!timetable) throw new NotFoundError('Timetable not found');

    // Scope check for non-super admins
    if (req.user!.role !== 'SUPER_ADMIN' && req.user!.role !== 'ADMIN') {
      const scopeWhere = getScopeWhere(req.user!, 'timetable');
      const allowed = await prisma.timetable.findFirst({
        where: { id, ...scopeWhere }
      });
      if (!allowed) throw new AuthorizationError('Access denied: outside your scope');
    }

    const updated = await prisma.timetable.update({
      where: { id },
      data: { status: 'DRAFT' },
    });
    res.json({ success: true, data: updated });
  }
);
