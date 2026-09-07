import { Request, Response, NextFunction } from 'express';
import catchAsync from '../utils/catchAsync';
import { AttendanceService } from '../services/attendance.service';
import prisma from '../utils/prismaClient';
import { AppError, AuthorizationError } from '../utils/appError';

const getStaffWarningFilters = (query: Request['query']) => {
  const {
    courseId,
    year,
    warningStage,
    search,
    date,
    startDate,
    endDate,
  } = query;

  return {
    courseId: courseId ? parseInt(courseId as string) : undefined,
    year: year ? parseInt(year as string) : undefined,
    warningStage: warningStage as
      | 'BLOCKED'
      | 'FINAL_WARNING'
      | 'FIRST_WARNING'
      | 'SAFE'
      | undefined,
    search: search as string | undefined,
    date: date as string | undefined,
    startDate: startDate as string | undefined,
    endDate: endDate as string | undefined,
  };
};

const csvCell = (value: unknown) => {
  const raw = value === null || value === undefined ? '' : String(value);
  const spreadsheetSafe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${spreadsheetSafe.replace(/"/g, '""')}"`;
};

export const recordAttendanceManual = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { courseId, date, records, sessionId, semester } = req.body;

    const ctx = {
      userId: req.user!.id,
      ipAddress: req.ip || req.socket.remoteAddress,
      sessionId: sessionId ? Number(sessionId) : undefined,
      courseId: courseId ? Number(courseId) : undefined,
      semester: semester ? parseInt(semester) : undefined,
      actor: req.user!,
    };

    if (records && Array.isArray(records)) {
      const createdRecords = await AttendanceService.recordBulkManual(records, {
        ...ctx,
        courseId: courseId ? Number(courseId) : undefined,
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
    if (result.overlapBlocked) {
      return res.json({
        success: true,
        overlapBlocked: true,
        message: 'لديك محاضرة أخرى مسجل حضورها في نفس التوقيت',
        conflictingCourse: result.conflictingCourse,
      });
    }

    if (result.alreadyRecorded) {
      return res.json({
        success: true,
        alreadyRecorded: true,
        message:
          result.existingStatus === 'LATE'
            ? 'تم تسجيل حضورك سابقاً (متأخر)'
            : 'تم تسجيل حضورك سابقاً',
        data: result.attendance,
        existingStatus: result.existingStatus,
        recordedAt: result.recordedAt,
      });
    }

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

    return res.json({
      success: true,
      data: result.attendance,
      flagged: result.attendance?.locationFlagged,
      message: result.message,
    });
  }
);

export const recordAttendanceRfid = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const rawPayload = {
      ...req.body,
      timestamp: req.body.timestamp ?? req.headers['x-timestamp'],
      nonce: req.body.nonce ?? req.headers['x-nonce'],
      signature:
        req.body.signature ??
        req.body.hmac ??
        req.headers['x-signature'] ??
        req.headers['x-hmac'],
    };

    const result = await AttendanceService.recordByMethod(
      'RFID',
      rawPayload,
      {
        ipAddress: req.ip || req.socket.remoteAddress,
      }
    );

    if (result.overlapBlocked) {
      return res.json({
        success: true,
        overlapBlocked: true,
        message: 'لديك محاضرة أخرى مسجل حضورها في نفس التوقيت',
        conflictingCourse: result.conflictingCourse,
      });
    }

    if (result.alreadyRecorded) {
      return res.json({
        success: true,
        alreadyRecorded: true,
        data: result.attendance,
        existingStatus: result.existingStatus,
        recordedAt: result.recordedAt,
      });
    }

    return res.json({ success: true, data: result.attendance });
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
    if (result.overlapBlocked) {
      return res.json({
        success: true,
        overlapBlocked: true,
        message: 'لديك محاضرة أخرى مسجل حضورها في نفس التوقيت',
        conflictingCourse: result.conflictingCourse,
      });
    }

    return res.json({ success: true, data: result.attendance });
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

    if (result.overlapBlocked) {
      return res.json({
        success: true,
        overlapBlocked: true,
        message: 'لديك محاضرة أخرى مسجل حضورها في نفس التوقيت',
        conflictingCourse: result.conflictingCourse,
      });
    }

    if (result.alreadyRecorded) {
      return res.json({
        success: true,
        alreadyRecorded: true,
        data: result.attendance,
        existingStatus: result.existingStatus,
        recordedAt: result.recordedAt,
      });
    }

    return res.json({ success: true, data: result.attendance });
  }
);

export const getCourseAttendance = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { courseId } = req.params;
    const {
      date,
      startDate,
      endDate,
      semester,
      academicYear,
      page,
      limit,
    } = req.query;

    const result = await AttendanceService.getCourseAttendance(
      req.user!,
      parseInt(courseId as string),
      {
        date: date as string | undefined,
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
        semester: semester ? parseInt(semester as string) : undefined,
        academicYear: academicYear
          ? parseInt(academicYear as string)
          : undefined,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      }
    );

    return res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      stats: result.stats,
    });
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
    const {
      courseId,
      date,
      startDate,
      endDate,
      semester,
      academicYear,
      page,
      limit,
    } = req.query;

    const result = await AttendanceService.getMyAttendance(
      req.user!.id,
      {
        courseId: courseId ? parseInt(courseId as string) : undefined,
        date: date as string | undefined,
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
        semester: semester ? parseInt(semester as string) : undefined,
        academicYear: academicYear
          ? parseInt(academicYear as string)
          : undefined,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      }
    );

    return res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      stats: result.stats,
    });
  }
);

export const getMyAbsenceWarnings = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { page, limit } = req.query;
    const data = await AttendanceService.getMyAbsenceWarnings(req.user!, {
      ...getStaffWarningFilters(req.query),
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    return res.json({ success: true, data });
  }
);

export const exportAbsenceWarnings = catchAsync(
  async (req: Request, res: Response) => {
    const result = await AttendanceService.exportStaffAbsenceWarnings(
      req.user!,
      getStaffWarningFilters(req.query)
    );
    const headers = [
      'Student Name',
      'Student ID',
      'Student Email',
      'Course Name',
      'Course Code',
      'Absence %',
      'Max Allowed %',
      'Status',
      'Total Sessions',
      'Present',
      'Absent',
      'Late',
      'Excused',
      'Pending Review',
    ];
    const rows = result.records.map((record) => [
      record.studentName,
      record.studentCode,
      record.studentEmail,
      record.courseName,
      record.courseCode,
      record.absencePercent,
      record.maxAbsencePercent,
      record.warningStage,
      record.totalSessions,
      record.present,
      record.absent,
      record.late,
      record.excused,
      record.pendingReview,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map(csvCell).join(','))
      .join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="absence_warnings_${new Date().toISOString().slice(0, 10)}.csv"`
    );
    res.setHeader('X-Export-Capped', String(result.capped));
    res.setHeader('X-Export-Limit', String(result.limit));
    res.setHeader('X-Export-Total', String(result.total));
    res.setHeader(
      'Access-Control-Expose-Headers',
      'Content-Disposition, X-Export-Capped, X-Export-Limit, X-Export-Total'
    );
    return res.send(`\uFEFF${csv}`);
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
    const data = await AttendanceService.getAuditDuplicateDevices(req.user!);
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

export const rejectFlaggedRecord = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { attendanceId } = req.params;
    const { note } = req.body;
    const data = await AttendanceService.rejectFlaggedRecord(
      req.user!,
      parseInt(attendanceId as string),
      note
    );
    return res.json({ success: true, data });
  }
);

export const provisionRfidDevice = catchAsync(
  async (req: Request, res: Response) => {
    const { roomId, label } = req.body;
    const data = await AttendanceService.provisionRfidDevice({ roomId, label });
    return res.status(201).json({
      success: true,
      message:
        'RFID device provisioned successfully. Flash the signingKey into firmware immediately.',
      data,
    });
  }
);

export const listRfidDevices = catchAsync(
  async (_req: Request, res: Response) => {
    const data = await AttendanceService.listRfidDevices();
    return res.json({ success: true, data });
  }
);
