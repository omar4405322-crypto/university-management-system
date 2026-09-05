import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prismaClient';
import catchAsync from '../utils/catchAsync';
import { NotFoundError, AppError, AuthorizationError } from '../utils/appError';
import { getRoomCoordinateAccessWhere } from '../utils/roomScope.utils';

export const updateRoomCoordinates = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const { latitude, longitude } = req.body;

  const isCoordinateInput = (value: unknown) =>
    (typeof value === 'number' || typeof value === 'string') && String(value).trim().length > 0;

  if (!isCoordinateInput(latitude) || !isCoordinateInput(longitude)) {
    return next(new AppError('Latitude and longitude are required', 400));
  }
  
  const parsedLat = Number(latitude);
  const parsedLng = Number(longitude);
  
  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
    return next(new AppError('Latitude and longitude must be valid numbers', 400));
  }
  if (parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) {
    return next(new AppError('Latitude must be between -90 and 90 and longitude between -180 and 180', 400));
  }

  const rawId = Array.isArray(id) ? id[0] : id;
  const roomId = Number(rawId);
  if (!Number.isSafeInteger(roomId) || roomId <= 0) {
    return next(new AppError('Room ID must be a positive integer', 400));
  }

  const accessWhere = getRoomCoordinateAccessWhere(req.user!, roomId);
  const room = await prisma.room.findFirst({ where: accessWhere });
  if (!room) return next(new AuthorizationError('Room is outside your managed schedule scope'));

  const updateResult = await prisma.room.updateMany({
    where: accessWhere,
    data: {
      latitude: parsedLat,
      longitude: parsedLng
    }
  });
  if (updateResult.count !== 1) {
    return next(new AuthorizationError('Room left your managed schedule scope'));
  }

  const updatedRoom = await prisma.room.findUnique({ where: { id: roomId } });
  if (!updatedRoom) return next(new NotFoundError('Room not found'));

  res.json({
    success: true,
    data: updatedRoom
  });
});
