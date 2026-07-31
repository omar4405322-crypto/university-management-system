import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prismaClient';
import catchAsync from '../utils/catchAsync';
import { NotFoundError, AppError, AuthorizationError } from '../utils/appError';

export const updateRoomCoordinates = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const { latitude, longitude } = req.body;

  if (latitude === undefined || latitude === null || longitude === undefined || longitude === null) {
    return next(new AppError('Latitude and longitude are required', 400));
  }
  
  const parsedLat = parseFloat(latitude);
  const parsedLng = parseFloat(longitude);
  
  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
    return next(new AppError('Latitude and longitude must be valid numbers', 400));
  }

  const roomId = parseInt(id);

  // Ownership check for doctors
  if (req.user!.role === 'DOCTOR') {
    const doctor = await prisma.doctor.findUnique({ where: { userId: req.user!.id } });
    if (!doctor) return next(new AuthorizationError('Doctor profile not found'));
    
    const slots = await prisma.scheduleSlot.findMany({
      where: { doctorId: doctor.id, roomId: roomId }
    });
    
    if (slots.length === 0) {
      return next(new AuthorizationError('You do not teach any schedule slots in this room'));
    }
  }

  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) return next(new NotFoundError('Room not found'));

  const updatedRoom = await prisma.room.update({
    where: { id: roomId },
    data: {
      latitude: parsedLat,
      longitude: parsedLng
    }
  });

  res.json({
    success: true,
    data: updatedRoom
  });
});
