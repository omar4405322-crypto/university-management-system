import prisma from '../utils/prismaClient';

export async function deactivateUserAndRevokeSessions(
  userId: number,
  deactivatedAt: Date
): Promise<void> {
  await setUserAndRoleActiveState(userId, false, deactivatedAt);
}

export async function setUserAndRoleActiveState(
  userId: number,
  isActive: boolean,
  changedAt: Date = new Date()
): Promise<void> {
  await prisma.$transaction(async tx => {
    await tx.user.update({
      where: { id: userId },
      data: {
        isActive,
        deactivatedAt: isActive ? null : changedAt,
        ...(!isActive && { tokenVersion: { increment: 1 } }),
      },
    });
    await tx.student.updateMany({
      where: { userId },
      data: { isActive },
    });
    await tx.teachingAssistant.updateMany({
      where: { userId },
      data: { status: isActive ? 'ACTIVE' : 'INACTIVE' },
    });
    if (!isActive) {
      await tx.refreshToken.deleteMany({ where: { userId } });
    }
  });
}

export async function setStudentAndUserActiveState(
  studentId: number,
  userId: number,
  isActive: boolean,
  withinTransaction?: (tx: any, updatedStudent: any) => Promise<void>
) {
  return prisma.$transaction(async tx => {
    await tx.user.update({
      where: { id: userId },
      data: {
        isActive,
        deactivatedAt: isActive ? null : new Date(),
        ...(!isActive && { tokenVersion: { increment: 1 } }),
      },
    });

    const updatedStudent = await tx.student.update({
      where: { id: studentId },
      data: { isActive },
      include: {
        user: { select: { email: true, profilePicture: true, isActive: true } },
        department: {
          select: { name: true, college: { select: { name: true } } },
        },
      },
    });

    if (!isActive) {
      await tx.refreshToken.deleteMany({ where: { userId } });
    }

    if (withinTransaction) {
      await withinTransaction(tx, updatedStudent);
    }

    return updatedStudent;
  });
}
