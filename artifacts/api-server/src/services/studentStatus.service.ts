import prisma from '../utils/prismaClient';

export async function deactivateUserAndRevokeSessions(
  userId: number,
  deactivatedAt: Date
): Promise<void> {
  await prisma.$transaction(async tx => {
    await tx.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        deactivatedAt,
        tokenVersion: { increment: 1 },
      },
    });
    await tx.refreshToken.deleteMany({ where: { userId } });
  });
}

export async function setStudentAndUserActiveState(
  studentId: number,
  userId: number,
  isActive: boolean
) {
  return prisma.$transaction(async tx => {
    const updatedStudent = await tx.student.update({
      where: { id: studentId },
      data: { isActive },
      include: {
        user: { select: { email: true, profilePicture: true } },
        department: {
          select: { name: true, college: { select: { name: true } } },
        },
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        isActive,
        ...(!isActive && { tokenVersion: { increment: 1 } }),
      },
    });

    if (!isActive) {
      await tx.refreshToken.deleteMany({ where: { userId } });
    }

    return updatedStudent;
  });
}
