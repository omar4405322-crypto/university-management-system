import { Request, Response, NextFunction } from 'express';
import catchAsync from '../utils/catchAsync';
import { AttendanceService } from '../services/attendance.service';
import prisma from '../utils/prismaClient';
import { AppError, AuthorizationError } from '../utils/appError';

export const recordAttendanceManual = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { courseId, date, records, sessionId, semester } = req.body;

    const ctx = {
      userId: req.user!.id,
      ipAddress: req.ip || req.socket.remoteAddress,
      sessionId: sessionId ? parseInt(sessionId) : undefined,
      semester: semester ? parseInt(semester) : undefined,
    };

    if (records && Array.isArray(records)) {
      const createdRecords = await AttendanceService.recordBulkManual(records, {
        ...ctx,
        courseId: courseId ? parseInt(courseId) : undefined,
        semester: semester ? parseInt(semester) : undefined,
      });

      res.status(201).json({ success: true, data: createdRecords });
      return;
    }

    const result = await AttendanceService.recordByMethod(
      'MANUAL',
      req.body,
      ctx
    );

    res.status(201).json({
      success: true,
      data: result.attendance,
      isNew: result.isNew,
      message: result.message,
    });
  }
);

export const recordAttendanceQr = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const student = await prisma.student.findUnique({
      where: { userId: req.user!.id },
    });
    if (!student) {
      return next(
        new AuthorizationError('Only students can record attendance this way')
      );
    }

    const result = await AttendanceService.recordByMethod(
      'QR',
      req.body,
      {
        studentId: student.id,
        userId: req.user!.id,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get('User-Agent'),
      }
    );

    if (result.existingStatus) {
      return res.json({
        success: true,
        message:
          result.existingStatus === 'LATE'
            ? 'تم تسجيل حضورك سابقاً (متأخر)'
            : 'تم تسجيل حضورك سابقاً',
        data: result.attendance,
      });
    }

    res.json({
      success: true,
      data: result.attendance,
      flagged: result.attendance?.locationFlagged,
      message: result.message,
    });
  }
);

export const recordAttendanceRfid = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const result = await AttendanceService.recordByMethod(
      'RFID',
      req.body,
      {
        ipAddress: req.ip || req.socket.remoteAddress,
      }
    );

    res.json({ success: true, data: result.attendance });
  }
);

export const recordAttendanceFace = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const result = await AttendanceService.recordByMethod(
      'FACE',
      req.body,
      {
        userId: req.user?.id,
        ipAddress: req.ip || req.socket.remoteAddress,
      }
    );

    res.json({ success: true, data: result.attendance });
  }
);

export const recordAttendanceGps = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const student = await prisma.student.findUnique({
      where: { userId: req.user!.id },
    });
    if (!student) {
      return next(
        new AuthorizationError('Only students can record attendance this way')
      );
    }

    const result = await AttendanceService.recordByMethod(
      'GPS',
      req.body,
      {
        studentId: student.id,
        userId: req.user!.id,
        ipAddress: req.ip || req.socket.remoteAddress,
      }
    );

    res.json({ success: true, data: result.attendance });
  }
);

export const getCourseAttendance = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { courseId } = req.params;
    const { date } = req.query;

    const data = await AttendanceService.getCourseAttendance(
      req.user!,
      parseInt(courseId as string),
      date as string | undefined
    );

    return res.json({ success: true, data });
  }
);

export const getStudentAttendance = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const studentId = parseInt(req.params.studentId as string);
    const { courseId, page = 1, limit = 20 } = req.query;

    const result = await AttendanceService.getStudentAttendance(
      req.user!,
      studentId,
      courseId ? parseInt(courseId as string) : undefined,
      parseInt(page as string),
      parseInt(limit as string)
    );

    return res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      stats: result.stats,
    });
  }
);

export const getMyCourses = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const courses = await AttendanceService.getMyCourses(req.user!);
    return res.json({ success: true, data: courses });
  }
);

export const getMySlots = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const slots = await AttendanceService.getMySlots(req.user!);
    return res.json({ success: true, data: slots });
  }
);

export const getMyAttendance = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { courseId } = req.query;

    const data = await AttendanceService.getMyAttendance(
      req.user!.id,
      courseId ? parseInt(courseId as string) : undefined
    );

    return res.json({ success: true, data });
  }
);

export const getMyAbsenceWarnings = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const data = await AttendanceService.getMyAbsenceWarnings(req.user!);
    return res.json({ success: true, data });
  }
);

export const getAttendanceSummary = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { courseId } = req.params;
    const data = await AttendanceService.getAttendanceSummary(
      req.user!,
      parseInt(courseId as string)
    );
    return res.json({ success: true, data });
  }
);

export const getAttendanceRecords = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { courseId, date, departmentId, collegeId, page = 1, limit = 50 } =
      req.query;

    const result = await AttendanceService.getAttendanceRecords(req.user!, {
      courseId: courseId ? parseInt(courseId as string) : undefined,
      date: date as string | undefined,
      departmentId: departmentId ? parseInt(departmentId as string) : undefined,
      collegeId: collegeId ? parseInt(collegeId as string) : undefined,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    });

    return res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  }
);

export const unblockEnrollment = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { enrollmentId } = req.params;
    const result = await AttendanceService.unblockEnrollment(
      req.user!,
      parseInt(enrollmentId as string)
    );
    return res.json({ success: true, message: result.message });
  }
);

export const getAuditDuplicateDevices = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const data = await AttendanceService.getAuditDuplicateDevices();
    return res.json({ success: true, data });
  }
);

export const overrideFlaggedRecord = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { attendanceId } = req.params;
    const { note } = req.body;
    const data = await AttendanceService.overrideFlaggedRecord(
      req.user!,
      parseInt(attendanceId as string),
      note
    );
    return res.json({ success: true, data });
  }
);
