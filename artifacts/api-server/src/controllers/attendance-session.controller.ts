import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prismaClient';
import catchAsync from '../utils/catchAsync';
import { AppError, AuthorizationError, NotFoundError } from '../utils/appError';
import { getScopeWhere } from '../utils/scope.utils';
import speakeasy from 'speakeasy';
import bcrypt from 'bcryptjs';

// Haversine formula to calculate distance in meters
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

export const startSession = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { scheduleSlotId, courseId, latitude, longitude, radius } = req.body;

  let slot;
  if (scheduleSlotId) {
    slot = await prisma.scheduleSlot.findUnique({
      where: { id: parseInt(scheduleSlotId) },
      include: { course: true, roomRef: true }
    });
  } else if (courseId) {
    // Find the slot for this doctor/ta and course
    if (req.user!.role === 'DOCTOR') {
      const doctor = await prisma.doctor.findUnique({ where: { userId: req.user!.id } });
      if (doctor) {
        slot = await prisma.scheduleSlot.findFirst({
          where: { courseId: parseInt(courseId), doctorId: doctor.id },
          include: { course: true, roomRef: true }
        });
      }
    } else if (req.user!.role === 'TEACHING_ASSISTANT') {
      const ta = await prisma.teachingAssistant.findUnique({ where: { userId: req.user!.id } });
      if (ta) {
        slot = await prisma.scheduleSlot.findFirst({
          where: { courseId: parseInt(courseId), teachingAssistantId: ta.id },
          include: { course: true, roomRef: true }
        });
      }
    }
  }

  if (!slot && courseId) {
    if (req.user!.role === 'DOCTOR') {
      const doctor = await prisma.doctor.findUnique({ where: { userId: req.user!.id } });
      const courseCheck = await prisma.course.findUnique({ where: { id: parseInt(courseId) } });
      if (doctor && courseCheck && courseCheck.departmentId === doctor.departmentId) {
        const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
        slot = await prisma.scheduleSlot.create({
          data: {
            courseId: courseCheck.id,
            doctorId: doctor.id,
            dayOfWeek: days[new Date().getDay()] as any,
            startTime: '08:00',
            endTime: '22:00',
            slotType: 'LECTURE'
          },
          include: { course: true }
        });
      }
    } else if (req.user!.role === 'TEACHING_ASSISTANT') {
      const ta = await prisma.teachingAssistant.findUnique({ where: { userId: req.user!.id } });
      const courseCheck = await prisma.course.findUnique({ where: { id: parseInt(courseId) } });
      if (ta && courseCheck && courseCheck.departmentId === ta.departmentId) {
        const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
        slot = await prisma.scheduleSlot.create({
          data: {
            courseId: courseCheck.id,
            teachingAssistantId: ta.id,
            dayOfWeek: days[new Date().getDay()] as any,
            startTime: '08:00',
            endTime: '22:00',
            slotType: 'LAB'
          },
          include: { course: true }
        });
      }
    }
  }

  if (!slot) return next(new NotFoundError('Schedule slot not found for this course and user, and you are not authorized to create one ad-hoc.'));

  // Authorization check
  let authorized = false;
  if (['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(req.user!.role)) {
    authorized = true; // For now, admins can start sessions
  } else if (req.user!.role === 'DOCTOR') {
    const doctor = await prisma.doctor.findUnique({ where: { userId: req.user!.id } });
    if (doctor && slot.doctorId === doctor.id) authorized = true;
  } else if (req.user!.role === 'TEACHING_ASSISTANT') {
    const ta = await prisma.teachingAssistant.findUnique({ where: { userId: req.user!.id } });
    if (ta && slot.teachingAssistantId === ta.id) authorized = true;
  }

  if (!authorized) return next(new AuthorizationError('You do not have permission to start a session for this section.'));

  // Parse endTime (e.g., "14:00") to set expiresAt
  const [hours, minutes] = (slot.endTime || '23:59').split(':').map(Number);
  const expiresAt = new Date();
  expiresAt.setHours(hours, minutes, 0, 0);

  if (expiresAt < new Date()) {
    // If it's already past the end time today, maybe the class is ending soon or we just add 2 hours
    expiresAt.setHours(new Date().getHours() + 2);
  }

  // Deactivate any existing active sessions for this slot today
  await prisma.attendanceSession.updateMany({
    where: { scheduleSlotId: slot.id, isActive: true },
    data: { isActive: false }
  });

  const secret = speakeasy.generateSecret({ length: 20 });
  const doctor = req.user!.role === 'DOCTOR' ? await prisma.doctor.findUnique({ where: { userId: req.user!.id } }) : null;

  const session = await prisma.attendanceSession.create({
    data: {
      scheduleSlotId: slot.id,
      doctorId: doctor?.id,
      secretKey: secret.base32,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      radius: radius ? parseFloat(radius) : 100,
      gracePeriodMins: req.body.gracePeriodMins !== undefined && req.body.gracePeriodMins !== null ? parseInt(req.body.gracePeriodMins) : 15,
      codeStepSeconds: 20,
      expiresAt
    }
  });

  res.json({ 
    success: true, 
    data: { 
      sessionId: session.id, 
      expiresAt: session.expiresAt,
      latitude: session.latitude,
      longitude: session.longitude,
      radius: session.radius,
      codeStepSeconds: session.codeStepSeconds
    } 
  });
});

export const stopSession = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { sessionId } = req.params;

  const session = await prisma.attendanceSession.findUnique({
    where: { id: parseInt(sessionId as string) },
    include: { scheduleSlot: true }
  });

  if (!session) return next(new NotFoundError('Session not found'));

  // Authorization
  let authorized = false;
  if (['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(req.user!.role)) {
    authorized = true;
  } else if (req.user!.role === 'DOCTOR') {
    const doctor = await prisma.doctor.findUnique({ where: { userId: req.user!.id } });
    if (doctor && (session.scheduleSlot.doctorId === doctor.id || session.doctorId === doctor.id)) authorized = true;
  } else if (req.user!.role === 'TEACHING_ASSISTANT') {
    const ta = await prisma.teachingAssistant.findUnique({ where: { userId: req.user!.id } });
    if (ta && session.scheduleSlot.teachingAssistantId === ta.id) authorized = true;
  }

  if (!authorized) return next(new AuthorizationError('Not authorized'));

  await prisma.attendanceSession.update({
    where: { id: session.id },
    data: { isActive: false }
  });

  res.json({ success: true, message: 'Session stopped' });
});

export const getActiveSession = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { courseId, scheduleSlotId } = req.query;

  let where: any = { isActive: true };
  if (scheduleSlotId) {
    where.scheduleSlotId = parseInt(scheduleSlotId as string);
  } else if (courseId) {
    if (req.user!.role === 'DOCTOR') {
      const doctor = await prisma.doctor.findUnique({ where: { userId: req.user!.id } });
      if (doctor) {
        where.scheduleSlot = { courseId: parseInt(courseId as string), doctorId: doctor.id };
      }
    } else if (req.user!.role === 'TEACHING_ASSISTANT') {
      const ta = await prisma.teachingAssistant.findUnique({ where: { userId: req.user!.id } });
      if (ta) {
        where.scheduleSlot = { courseId: parseInt(courseId as string), teachingAssistantId: ta.id };
      }
    } else {
      where.scheduleSlot = { courseId: parseInt(courseId as string) };
    }
  } else {
    return next(new AppError('Must provide courseId or scheduleSlotId', 400));
  }

  const session = await prisma.attendanceSession.findFirst({ where });

  if (!session) return res.json({ success: true, data: null });

  res.json({ 
    success: true, 
    data: { 
      sessionId: session.id, 
      expiresAt: session.expiresAt,
      latitude: session.latitude,
      longitude: session.longitude,
      radius: session.radius,
      codeStepSeconds: session.codeStepSeconds
    } 
  });
});

export const getCurrentCode = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { sessionId } = req.params;

  const session = await prisma.attendanceSession.findUnique({
    where: { id: parseInt(sessionId as string) }
  });

  if (!session || !session.isActive) return next(new AppError('Session not found or inactive', 404));

  // Authorization check (only owner/admin can get code to display)
  let authorized = false;
  if (['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(req.user!.role)) {
    authorized = true;
  } else if (req.user!.role === 'DOCTOR' || req.user!.role === 'TEACHING_ASSISTANT') {
    authorized = true; // For now we assume if they are logged in as faculty they can view the code, but we can restrict further if needed
  }

  if (!authorized) return next(new AuthorizationError('Not authorized'));

  const step = session.codeStepSeconds;

  const token = speakeasy.totp({
    secret: session.secretKey,
    encoding: 'base32',
    step: step
  });

  res.json({ success: true, data: { token } });
});

export const scanQr = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { token, latitude, longitude, deviceId, step: clientStep } = req.body;
  let { sessionId } = req.body;
  const ipAddress = req.ip || req.socket.remoteAddress;

  const student = await prisma.student.findUnique({ where: { userId: req.user!.id } });
  if (!student) return next(new AuthorizationError('Only students can record attendance this way'));


  let session: any = null;

  // If sessionId is not provided (manual code entry), find the active session that matches the token
  if (!sessionId) {
    const activeSessions = await prisma.attendanceSession.findMany({
      where: { isActive: true, expiresAt: { gt: new Date() } },
      include: { scheduleSlot: { include: { course: true } } }
    });

    for (const s of activeSessions) {
      const isValid = speakeasy.totp.verify({
        secret: s.secretKey,
        encoding: 'base32',
        token,
        step: s.codeStepSeconds,
        window: 1
      });
      if (isValid) {
        session = s;
        sessionId = s.id;
        break;
      }
    }
    if (!session) return next(new AppError('Invalid or expired code', 400));
  } else {
    session = await prisma.attendanceSession.findUnique({
      where: { id: parseInt(sessionId) },
      include: { scheduleSlot: { include: { course: true } } }
    });

    if (!session || !session.isActive) return next(new AppError('Session is not active', 400));
    if (new Date() > session.expiresAt) return next(new AppError('Session has expired', 400));

    const isValid = speakeasy.totp.verify({
      secret: session.secretKey,
      encoding: 'base32',
      token,
      step: session.codeStepSeconds,
      window: 1
    });
    if (!isValid) return next(new AppError('Invalid or expired QR code', 400));
  }

  let locationFlagged = false;
  if (session.latitude && session.longitude && latitude && longitude) {
    const distance = calculateDistance(session.latitude, session.longitude, latitude, longitude);
    if (distance > (session.radius || 120)) {
      locationFlagged = true;
    }
  } else if (session.latitude && session.longitude) {
    // If session has location but student didn't provide it
    locationFlagged = true;
  }

  // Duplicate prevention check (AND logic)
  if (deviceId && ipAddress) {
    const duplicate = await prisma.attendance.findFirst({
      where: {
        sessionId: session.id,
        ipAddress: ipAddress as string,
        deviceId: deviceId as string,
        studentId: { not: student.id }
      }
    });

    if (duplicate) {
      return next(new AppError('Device and IP have already been used to record attendance for another student in this session.', 403));
    }
  }

  const attendanceDate = new Date();
  attendanceDate.setHours(0, 0, 0, 0);

  // Compute status: If student scans after grace period, mark as LATE fairly
  const now = new Date();
  const sessionStartTime = new Date(session.createdAt).getTime();
  const elapsedMinutes = (now.getTime() - sessionStartTime) / (1000 * 60);
  const gracePeriodMinutes = session.gracePeriodMins ?? 15; // Dynamic fair grace period
  const computedStatus: 'PRESENT' | 'LATE' = elapsedMinutes <= gracePeriodMinutes ? 'PRESENT' : 'LATE';

  // Check if already attended
  const existing = await prisma.attendance.findUnique({
    where: { studentId_sessionId: { studentId: student.id, sessionId: session.id } }
  });

  if (existing && (existing.status === 'PRESENT' || existing.status === 'LATE')) {
    return res.json({ 
      success: true, 
      message: existing.status === 'LATE' ? 'تم تسجيل حضورك سابقاً (متأخر)' : 'تم تسجيل حضورك سابقاً', 
      data: existing 
    });
  }

  const attendance = await prisma.attendance.upsert({
    where: { studentId_sessionId: { studentId: student.id, sessionId: session.id } },
    update: {
      status: computedStatus,
      method: 'QR',
      ipAddress: ipAddress as string,
      deviceId,
      locationData: { lat: latitude, lng: longitude },
      locationFlagged,
    },
    create: {
      studentId: student.id,
      courseId: session.scheduleSlot.courseId,
      scheduleSlotId: session.scheduleSlot.id,
      date: attendanceDate,
      status: computedStatus,
      method: 'QR',
      ipAddress: ipAddress as string,
      deviceId,
      locationData: { lat: latitude, lng: longitude },
      locationFlagged,
      sessionId: session.id
    }
  });

  let message = '';
  if (locationFlagged) {
    message = 'أنت خارج نطاق القاعة الجغرافي. تم تسجيل الطلب وتحويله لقائمة المراجعة لدى الدكتور.';
  } else if (computedStatus === 'LATE') {
    message = `تم تسجيل حضورك بنجاح ولكنك وصلت متأخراً (بعد انقضاء مهلة ${gracePeriodMinutes} دقيقة من بدء المحاضرة).`;
  } else {
    message = 'تم تسجيل حضورك بنجاح تلقائياً في الوقت المحدد.';
  }

  res.json({ success: true, data: attendance, flagged: locationFlagged, message });
});

export const rfidScan = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { deviceId, rfidTag, secret } = req.body;

  const device = await prisma.rfidDevice.findUnique({ where: { roomId: deviceId } });
  if (!device || !device.isActive) return next(new AppError('Unauthorized RFID device', 401));

  const validSecret = await bcrypt.compare(secret, device.secretHash);
  if (!validSecret) return next(new AppError('Unauthorized RFID device', 401));

  const student = await prisma.student.findUnique({ where: { rfidTag } });
  if (!student) return next(new AppError('Unknown RFID tag', 404));

  // Find active session for this room
  const session = await prisma.attendanceSession.findFirst({
    where: {
      isActive: true,
      scheduleSlot: {
        room: device.roomId
      }
    },
    include: { scheduleSlot: true }
  });

  if (!session) return next(new AppError('No active session for this room', 400));

  const attendanceDate = new Date();
  attendanceDate.setHours(0, 0, 0, 0);

  const attendance = await prisma.attendance.upsert({
    where: { studentId_sessionId: { studentId: student.id, sessionId: session.id } },
    update: {
      status: 'PRESENT',
      method: 'RFID',
    },
    create: {
      studentId: student.id,
      courseId: session.scheduleSlot.courseId,
      scheduleSlotId: session.scheduleSlot.id,
      date: attendanceDate,
      status: 'PRESENT',
      method: 'RFID',
      sessionId: session.id
    }
  });

  res.json({ success: true, data: attendance });
});

export const getFlaggedRecords = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { sessionId } = req.params;

  const records = await prisma.attendance.findMany({
    where: { sessionId: parseInt(sessionId as string), locationFlagged: true },
    include: { student: { select: { id: true, studentId: true, firstName: true, lastName: true } } }
  });

  res.json({ success: true, data: records });
});

export const overrideFlaggedRecord = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { attendanceId } = req.params;
  const { note } = req.body;

  const attendance = await prisma.attendance.update({
    where: { id: parseInt(attendanceId as string) },
    data: {
      locationFlagged: false,
      overriddenBy: req.user!.email,
      overrideNote: note
    }
  });

  res.json({ success: true, data: attendance });
});

export const getSlotSessions = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { slotId } = req.params;

  const sessions = await prisma.attendanceSession.findMany({
    where: { scheduleSlotId: parseInt(slotId as string) },
    orderBy: { createdAt: 'desc' },
    include: {
      doctor: { select: { firstName: true, lastName: true } },
      _count: { select: { attendances: true } }
    }
  });

  res.json({ success: true, data: sessions });
});

export const getSessionRoster = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { sessionId } = req.params;

  const session = await prisma.attendanceSession.findUnique({
    where: { id: parseInt(sessionId as string) },
    include: { scheduleSlot: true }
  });

  if (!session) return next(new NotFoundError('Session not found'));

  const courseId = session.scheduleSlot.courseId;
  const groupId = session.scheduleSlot.groupId;

  // Find all students in this group or course
  const studentsFilter: any = {};
  if (groupId) {
    studentsFilter.groupId = groupId;
  } else {
    // Everyone enrolled
    const enrollments = await prisma.enrollment.findMany({
      where: { courseId, status: 'ENROLLED' },
      select: { studentId: true }
    });
    studentsFilter.id = { in: enrollments.map((e: any) => e.studentId) };
  }

  const students = await prisma.student.findMany({
    where: studentsFilter,
    select: {
      id: true,
      studentId: true,
      firstName: true,
      lastName: true,
      group: { select: { name: true } },
    },
    orderBy: { firstName: 'asc' }
  });

  const attendances = await prisma.attendance.findMany({
    where: { sessionId: session.id },
    select: {
      studentId: true,
      status: true,
      remarks: true,
      recordedBy: { select: { email: true, role: true } },
      createdAt: true
    }
  });

  const attendanceMap = new Map();
  attendances.forEach((a: any) => attendanceMap.set(a.studentId, a));

  const roster = students.map((s: any) => {
    const record = attendanceMap.get(s.id);
    return {
      id: s.id,
      studentId: s.studentId,
      firstName: s.firstName,
      lastName: s.lastName,
      group: s.group?.name || '-',
      existingStatus: record ? record.status : 'ABSENT',
      existingRemarks: record?.remarks || '',
      recordedBy: record?.recordedBy,
      recordedAt: record?.createdAt
    };
  });

  res.json({ success: true, data: roster });
});

export const updateSessionLocation = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { sessionId } = req.params;
  const { latitude, longitude, radius } = req.body;

  const session = await prisma.attendanceSession.findUnique({
    where: { id: parseInt(sessionId as string) }
  });

  if (!session || !session.isActive) return next(new AppError('Active session not found', 404));

  const updatedSession = await prisma.attendanceSession.update({
    where: { id: session.id },
    data: {
      latitude: latitude ? parseFloat(latitude) : session.latitude,
      longitude: longitude ? parseFloat(longitude) : session.longitude,
      radius: radius ? parseFloat(radius) : session.radius || 100,
    }
  });

  res.json({
    success: true,
    data: {
      sessionId: updatedSession.id,
      expiresAt: updatedSession.expiresAt,
      latitude: updatedSession.latitude,
      longitude: updatedSession.longitude,
      radius: updatedSession.radius
    }
  });
});
