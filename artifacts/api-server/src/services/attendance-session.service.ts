import prisma from '../utils/prismaClient';
import { AppError, AuthorizationError, NotFoundError } from '../utils/appError';
import speakeasy from 'speakeasy';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import attendanceEngine from '../attendance/attendance.engine';

const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) => {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

class AttendanceSessionService {
  static async verifySlotOrSessionOwnership(
    target: {
      doctorId?: number | null;
      teachingAssistantId?: string | null;
      scheduleSlot?: {
        doctorId?: number | null;
        teachingAssistantId?: string | null;
      } | null;
    },
    user: any
  ): Promise<boolean> {
    if (!user || !user.role) return false;

    if (
      ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(
        user.role
      )
    ) {
      return true;
    }

    if (user.role === 'DOCTOR') {
      const doctor = await prisma.doctor.findUnique({
        where: { userId: user.id },
      });
      if (!doctor) return false;
      return (
        target.doctorId === doctor.id ||
        target.scheduleSlot?.doctorId === doctor.id
      );
    }

    if (user.role === 'TEACHING_ASSISTANT') {
      const ta = await prisma.teachingAssistant.findUnique({
        where: { userId: user.id },
      });
      if (!ta) return false;
      return (
        target.teachingAssistantId === ta.id ||
        target.scheduleSlot?.teachingAssistantId === ta.id
      );
    }

    return false;
  }

  static async verifySessionOwnership(session: any, user: any): Promise<boolean> {
    return this.verifySlotOrSessionOwnership(session, user);
  }

  static async startSession(
    user: any,
    params: {
      scheduleSlotId?: number;
      courseId?: number;
      latitude?: number;
      longitude?: number;
      radius?: number;
      gracePeriodMins?: number;
    }
  ) {
    const { scheduleSlotId, courseId, latitude, longitude, radius, gracePeriodMins } = params;

    let slot: any;
    if (scheduleSlotId) {
      slot = await prisma.scheduleSlot.findUnique({
        where: { id: parseInt(scheduleSlotId as any) },
        include: { course: true, roomRef: true },
      });
    } else if (courseId) {
      if (user.role === 'DOCTOR') {
        const doctor = await prisma.doctor.findUnique({
          where: { userId: user.id },
        });
        if (doctor) {
          slot = await prisma.scheduleSlot.findFirst({
            where: {
              courseId: parseInt(courseId as any),
              doctorId: doctor.id,
            },
            include: { course: true, roomRef: true },
          });
        }
      } else if (user.role === 'TEACHING_ASSISTANT') {
        const ta = await prisma.teachingAssistant.findUnique({
          where: { userId: user.id },
        });
        if (ta) {
          slot = await prisma.scheduleSlot.findFirst({
            where: {
              courseId: parseInt(courseId as any),
              teachingAssistantId: ta.id,
            },
            include: { course: true, roomRef: true },
          });
        }
      }
    }

    if (!slot) {
      throw new NotFoundError(
        'لم يتم العثور على موعد محدد في الجدول الدراسي. يرجى التواصل مع الإدارة لإضافة موعد (ScheduleSlot) قبل بدء الجلسة.'
      );
    }

    const authorized = await this.verifySlotOrSessionOwnership(slot, user);

    if (!authorized) {
      throw new AuthorizationError(
        'You do not have permission to start a session for this section.'
      );
    }

    const [hours, minutes] = (slot.endTime || '23:59').split(':').map(Number);

    const timeZone = 'Africa/Cairo';
    const now = new Date();
    const zonedNow = toZonedTime(now, timeZone);

    zonedNow.setHours(hours, minutes, 0, 0);

    let expiresAt = fromZonedTime(zonedNow, timeZone);

    if (expiresAt < now) {
      expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    }

    const secret = speakeasy.generateSecret({ length: 20 });
    const doctor =
      user.role === 'DOCTOR'
        ? await prisma.doctor.findUnique({ where: { userId: user.id } })
        : null;

    let finalLat = null;
    let finalLng = null;
    let finalRadius =
      radius !== undefined && radius !== null ? parseFloat(radius as any) : 100;
    let roomMismatchWarning = false;

    const reqLat =
      latitude !== undefined && latitude !== null
        ? parseFloat(latitude as any)
        : null;
    const reqLng =
      longitude !== undefined && longitude !== null
        ? parseFloat(longitude as any)
        : null;

    if (slot.roomRef && slot.roomRef.latitude != null && slot.roomRef.longitude != null) {
      finalLat = slot.roomRef.latitude;
      finalLng = slot.roomRef.longitude;
      finalRadius =
        radius !== undefined && radius !== null
          ? parseFloat(radius as any)
          : slot.roomRef.radius ?? 100;

      if (reqLat !== null && reqLng !== null) {
        const dist = calculateDistance(finalLat, finalLng, reqLat, reqLng);
        if (dist > 300) {
          roomMismatchWarning = true;
        }
      }
    } else if (reqLat !== null && reqLng !== null) {
      finalLat = reqLat;
      finalLng = reqLng;
    }

    const session = await prisma.$transaction(
      async (tx) => {
        await tx.attendanceSession.updateMany({
          where: { scheduleSlotId: slot.id, isActive: true },
          data: { isActive: false },
        });

        return tx.attendanceSession.create({
          data: {
            scheduleSlotId: slot.id,
            doctorId: doctor?.id,
            secretKey: secret.base32,
            latitude: finalLat,
            longitude: finalLng,
            radius: finalRadius,
            facultyCapturedLatitude: reqLat,
            facultyCapturedLongitude: reqLng,
            roomMismatchWarning,
            gracePeriodMins:
              gracePeriodMins !== undefined && gracePeriodMins !== null
                ? parseInt(gracePeriodMins as any)
                : 15,
            codeStepSeconds: 20,
            expiresAt,
          },
        });
      },
      { isolationLevel: 'Serializable' }
    );

    return {
      sessionId: session.id,
      expiresAt: session.expiresAt,
      latitude: session.latitude,
      longitude: session.longitude,
      radius: session.radius,
      codeStepSeconds: session.codeStepSeconds,
      roomMismatchWarning: session.roomMismatchWarning,
      geoVerificationActive: session.latitude !== null,
      roomId: slot.roomId,
      roomNeedsCoordinates:
        slot.roomId && slot.roomRef?.latitude == null && reqLat !== null,
    };
  }

  static async stopSession(user: any, sessionId: number) {
    const session = await prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      include: { scheduleSlot: true },
    });

    if (!session) {
      throw new NotFoundError('Session not found');
    }

    const authorized = await this.verifySlotOrSessionOwnership(session, user);

    if (!authorized) {
      throw new AuthorizationError('Not authorized');
    }

    await prisma.attendanceSession.update({
      where: { id: session.id },
      data: { isActive: false },
    });

    return { message: 'Session stopped' };
  }

  static async getActiveSessions(
    user: any,
    params: { courseId?: number; scheduleSlotId?: number }
  ) {
    const { courseId, scheduleSlotId } = params;
    let where: any = { isActive: true };

    if (scheduleSlotId) {
      where.scheduleSlotId = parseInt(scheduleSlotId as any);
    } else if (courseId) {
      if (user.role === 'DOCTOR') {
        const doctor = await prisma.doctor.findUnique({
          where: { userId: user.id },
        });
        if (doctor) {
          where.scheduleSlot = {
            courseId: parseInt(courseId as any),
            doctorId: doctor.id,
          };
        }
      } else if (user.role === 'TEACHING_ASSISTANT') {
        const ta = await prisma.teachingAssistant.findUnique({
          where: { userId: user.id },
        });
        if (ta) {
          where.scheduleSlot = {
            courseId: parseInt(courseId as any),
            teachingAssistantId: ta.id,
          };
        }
      } else {
        where.scheduleSlot = { courseId: parseInt(courseId as any) };
      }
    }

    const sessions = await prisma.attendanceSession.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return sessions.map((session: any) => ({
      sessionId: session.id,
      scheduleSlotId: session.scheduleSlotId,
      doctorId: session.doctorId,
      expiresAt: session.expiresAt,
      latitude: session.latitude,
      longitude: session.longitude,
      radius: session.radius,
      codeStepSeconds: session.codeStepSeconds,
      isActive: session.isActive,
      createdAt: session.createdAt,
    }));
  }

  static async getCurrentCode(user: any, sessionId: number) {
    const session = await prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      include: { scheduleSlot: true },
    });

    if (!session || !session.isActive) {
      throw new AppError('Session not found or inactive', 404);
    }

    if (!(await this.verifySessionOwnership(session, user))) {
      throw new AuthorizationError(
        'Not authorized to view this session code'
      );
    }

    const step = session.codeStepSeconds;

    const token = speakeasy.totp({
      secret: session.secretKey,
      encoding: 'base32',
      step,
    });

    return { token };
  }

  static async getFlaggedRecords(user: any, sessionId: number) {
    const session = await prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      include: { scheduleSlot: true },
    });

    if (!session) {
      throw new NotFoundError('Session not found');
    }
    if (!(await this.verifySessionOwnership(session, user))) {
      throw new AuthorizationError('Not authorized to view this session');
    }

    return prisma.attendance.findMany({
      where: { sessionId, locationFlagged: true },
      include: {
        student: {
          select: { id: true, studentId: true, firstName: true, lastName: true },
        },
      },
    });
  }

  static async markStudentAttendance(
    user: any,
    sessionId: number,
    studentId: number,
    status: 'PRESENT' | 'LATE' | 'ABSENT'
  ) {
    if (!['PRESENT', 'LATE', 'ABSENT'].includes(status)) {
      throw new AppError('Invalid status', 400);
    }

    const session = await prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      include: { scheduleSlot: true },
    });

    if (!session) {
      throw new NotFoundError('Session not found');
    }

    if (!(await this.verifySessionOwnership(session, user))) {
      throw new AuthorizationError(
        'Not authorized to modify records for this session'
      );
    }

    if (!session.isActive) {
      throw new AppError('Session is closed', 400);
    }

    return attendanceEngine.recordAttendance({
      method: 'MANUAL',
      payload: { studentId, status, sessionId, recordedById: user.id },
      ctx: { userId: user.id, ipAddress: undefined, sessionId },
    });
  }

  static async getSlotSessions(user: any, slotId: number) {
    const slot = await prisma.scheduleSlot.findUnique({
      where: { id: slotId },
    });
    
    if (!slot) {
      throw new AppError('Schedule slot not found', 404);
    }
    
    const isOwner = await this.verifySlotOrSessionOwnership(slot, user);
    
    if (!isOwner) {
      throw new AppError('Not authorized to view sessions for this slot', 403);
    }
    return prisma.attendanceSession.findMany({
      where: { scheduleSlotId: slotId },
      orderBy: { createdAt: 'desc' },
      include: {
        doctor: { select: { firstName: true, lastName: true } },
        _count: { select: { attendances: true } },
      },
    });
  }

  static async getSessionRoster(user: any, sessionId: number) {
    const session = await prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      include: { scheduleSlot: true },
    });

    if (!session) {
      throw new NotFoundError('Session not found');
    }

    if (!(await this.verifySessionOwnership(session, user))) {
      throw new AuthorizationError(
        'Not authorized to view this session roster'
      );
    }

    const courseId = session.scheduleSlot.courseId;
    const groupId = session.scheduleSlot.groupId;

    const studentsFilter: any = {};
    if (groupId) {
      studentsFilter.groupId = groupId;
    } else {
      const enrollments = await prisma.enrollment.findMany({
        where: { courseId, status: 'ENROLLED' },
        select: { studentId: true },
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
      orderBy: { firstName: 'asc' },
    });

    const attendances = await prisma.attendance.findMany({
      where: { sessionId },
      select: {
        studentId: true,
        status: true,
        method: true,
        remarks: true,
        recordedBy: { select: { email: true, role: true } },
        createdAt: true,
      },
    });

    const attendanceMap = new Map();
    attendances.forEach((a: any) => attendanceMap.set(a.studentId, a));

    return students.map((s: any) => {
      const record = attendanceMap.get(s.id);
      return {
        id: s.id,
        studentId: s.studentId,
        firstName: s.firstName,
        lastName: s.lastName,
        group: s.group?.name || '-',
        existingStatus: record ? record.status : 'ABSENT',
        method: record?.method || 'MANUAL',
        existingRemarks: record?.remarks || '',
        recordedBy: record?.recordedBy,
        recordedAt: record?.createdAt,
      };
    });
  }

  static async updateSessionLocation(
    user: any,
    sessionId: number,
    params: { latitude?: number; longitude?: number; radius?: number }
  ) {
    const { latitude, longitude, radius } = params;

    const session = await prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      include: { scheduleSlot: true },
    });

    if (!session || !session.isActive) {
      throw new AppError('Active session not found', 404);
    }

    if (!(await this.verifySessionOwnership(session, user))) {
      throw new AuthorizationError('Not authorized to modify this session');
    }

    const updatedSession = await prisma.attendanceSession.update({
      where: { id: session.id },
      data: {
        latitude: latitude ? parseFloat(latitude as any) : session.latitude,
        longitude: longitude
          ? parseFloat(longitude as any)
          : session.longitude,
        radius: radius ? parseFloat(radius as any) : session.radius || 100,
      },
    });

    return {
      sessionId: updatedSession.id,
      expiresAt: updatedSession.expiresAt,
      latitude: updatedSession.latitude,
      longitude: updatedSession.longitude,
      radius: updatedSession.radius,
    };
  }
}

export { AttendanceSessionService };
export default AttendanceSessionService;
