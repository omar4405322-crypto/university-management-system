import prisma from '../utils/prismaClient.js';
import { Prisma } from '@prisma/client';

const userProfileInclude = {
  student: true,
  doctor: true,
  managedCollege: {
    select: { id: true, name: true, nameAr: true },
  },
} satisfies Prisma.UserInclude;

class UserService {
  static async findById(id: number) {
    return prisma.user.findUnique({
      where: { id },
      include: userProfileInclude,
    });
  }

  static async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: userProfileInclude,
    });
  }
}

export { userProfileInclude, UserService };
