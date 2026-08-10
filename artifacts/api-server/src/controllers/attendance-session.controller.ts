import { Request, Response, NextFunction } from 'express';
import catchAsync from '../utils/catchAsync';
import { AttendanceSessionService } from '../services/attendance-session.service';

export const startSession = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const data = await AttendanceSessionService.startSession(req.user!, req.body);
    res.json({ success: true, data });
  }
);

export const stopSession = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { sessionId } = req.params;
    const result = await AttendanceSessionService.stopSession(
      req.user!,
      parseInt(sessionId as string)
    );
    res.json({ success: true, message: result.message });
  }
);

export const getActiveSession = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { courseId, scheduleSlotId } = req.query;
    const sessions = await AttendanceSessionService.getActiveSessions(req.user!, {
      courseId: courseId ? parseInt(courseId as string) : undefined,
      scheduleSlotId: scheduleSlotId ? parseInt(scheduleSlotId as string) : undefined,
    });

    if (sessions.length === 0) {
      return res.json({ success: true, data: null });
    }

    return res.json({ success: true, data: sessions[0] });
  }
);

export const getCurrentCode = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { sessionId } = req.params;
    const data = await AttendanceSessionService.getCurrentCode(
      req.user!,
      parseInt(sessionId as string)
    );
    res.json({ success: true, data });
  }
);

export const getFlaggedRecords = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { sessionId } = req.params;
    const data = await AttendanceSessionService.getFlaggedRecords(
      req.user!,
      parseInt(sessionId as string)
    );
    res.json({ success: true, data });
  }
);

export const markStudentAttendance = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { sessionId } = req.params;
    const { studentId, status } = req.body;

    const result = await AttendanceSessionService.markStudentAttendance(
      req.user!,
      parseInt(sessionId as string),
      parseInt(studentId as string),
      status
    );

    res.json({ success: true, data: result.attendance });
  }
);

export const getSlotSessions = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { slotId } = req.params;
    const data = await AttendanceSessionService.getSlotSessions(
      req.user,
      parseInt(slotId as string)
    );
    res.json({ success: true, data });
  }
);

export const getSessionRoster = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { sessionId } = req.params;
    const data = await AttendanceSessionService.getSessionRoster(
      req.user!,
      parseInt(sessionId as string)
    );
    res.json({ success: true, data });
  }
);

export const updateSessionLocation = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { sessionId } = req.params;
    const { latitude, longitude, radius } = req.body;

    const data = await AttendanceSessionService.updateSessionLocation(
      req.user!,
      parseInt(sessionId as string),
      { latitude, longitude, radius }
    );

    res.json({ success: true, data });
  }
);
