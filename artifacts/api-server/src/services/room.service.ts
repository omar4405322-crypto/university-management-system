import { Request } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../utils/prismaClient';
import { ConflictError, NotFoundError, ValidationError } from '../utils/appError';
import { auditLog } from '../utils/audit.utils';

export interface GetRoomsOptions {
  search?: string;
  page?: string | number;
  limit?: string | number;
  includeInactive?: string | boolean;
}

export class RoomService {
  static async getRooms(options: GetRoomsOptions) {
    const { search, page, limit, includeInactive } = options;

    let parsedPage = 1;
    if (page !== undefined && page !== '') {
      const num = Number(page);
      if (!Number.isSafeInteger(num) || num <= 0) {
        throw new ValidationError('Invalid page parameter');
      }
      parsedPage = num;
    }

    let parsedLimit = 10;
    if (limit !== undefined && limit !== '') {
      const num = Number(limit);
      if (!Number.isSafeInteger(num) || num <= 0) {
        throw new ValidationError('Invalid limit parameter');
      }
      parsedLimit = Math.min(num, 100);
    }

    const where: Prisma.RoomWhereInput = {};

    const shouldIncludeInactive = includeInactive === 'true' || includeInactive === true;
    if (!shouldIncludeInactive) {
      where.isActive = true;
    }

    if (search && typeof search === 'string' && search.trim() !== '') {
      where.name = { contains: search.trim(), mode: 'insensitive' };
    }

    const skip = (parsedPage - 1) * parsedLimit;

    const [rooms, total] = await Promise.all([
      prisma.room.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: parsedLimit,
      }),
      prisma.room.count({ where }),
    ]);

    return {
      rooms,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        totalPages: Math.max(1, Math.ceil(total / parsedLimit)),
      },
    };
  }

  static async createRoom(data: { name: string; isActive?: boolean }, req: Request) {
    const trimmedName = data.name.trim();

    const existing = await prisma.room.findFirst({
      where: {
        name: { equals: trimmedName, mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new ConflictError(`Room '${trimmedName}' already exists`);
    }

    const room = await prisma.room.create({
      data: {
        name: trimmedName,
        isActive: data.isActive ?? true,
      },
    });

    await auditLog(
      'CREATE_ROOM',
      'Room',
      room.id,
      req,
      {
        name: room.name,
        isActive: room.isActive,
      }
    );

    return room;
  }

  static async updateRoom(roomId: number, data: { name?: string; isActive?: boolean }, req: Request) {
    const existing = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!existing) {
      throw new NotFoundError('Room not found');
    }

    const updateData: Prisma.RoomUpdateInput = {};

    if (data.name !== undefined) {
      const trimmedName = data.name.trim();
      const duplicate = await prisma.room.findFirst({
        where: {
          name: { equals: trimmedName, mode: 'insensitive' },
          NOT: { id: roomId },
        },
      });

      if (duplicate) {
        throw new ConflictError(`Room '${trimmedName}' already exists`);
      }

      updateData.name = trimmedName;
    }

    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }

    const updated = await prisma.room.update({
      where: { id: roomId },
      data: updateData,
    });

    await auditLog(
      'UPDATE_ROOM',
      'Room',
      roomId,
      req,
      {
        before: { name: existing.name, isActive: existing.isActive },
        after: { name: updated.name, isActive: updated.isActive },
      }
    );

    return updated;
  }
}
