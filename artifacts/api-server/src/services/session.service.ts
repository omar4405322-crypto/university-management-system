import type { Prisma } from '@prisma/client';
import prisma from '../utils/prismaClient';

export const lockUserSessionState = async (
  tx: Prisma.TransactionClient,
  userId: number
): Promise<void> => {
  await tx.$queryRaw<Array<{ id: number }>>`
    SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE
  `;
};

export const revokeAllUserSessions = async (userId: number): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
    await tx.refreshToken.deleteMany({ where: { userId } });
  });
};

export const replacePasswordAndRevokeAllUserSessions = async (
  userId: number,
  hashedPassword: string
): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        tokenVersion: { increment: 1 },
      },
    });
    await tx.refreshToken.deleteMany({ where: { userId } });
  });
};
