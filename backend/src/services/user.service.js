const prisma = require('../utils/prismaClient.js');

const userProfileInclude = {
  student: true,
  doctor: true,
  managedCollege: {
    select: { id: true, name: true, nameAr: true },
  },
};

class UserService {
  static async findById(id) {
    return prisma.user.findUnique({
      where: { id },
      include: userProfileInclude,
    });
  }

  static async findByEmail(email) {
    return prisma.user.findUnique({
      where: { email },
      include: userProfileInclude,
    });
  }
}

module.exports = { userProfileInclude, UserService };
