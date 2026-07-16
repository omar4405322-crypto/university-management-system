import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();
const prisma = new PrismaClient();
const users = await prisma.user.findMany({
  where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } },
  select: { email: true, role: true },
  take: 3
});
console.log(JSON.stringify(users));
await prisma.$disconnect();
