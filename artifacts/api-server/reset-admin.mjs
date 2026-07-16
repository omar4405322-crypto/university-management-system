import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();
const prisma = new PrismaClient();

const newPassword = 'Admin@1234';
const hash = await bcrypt.hash(newPassword, 10);

// Reset both admin accounts
await prisma.user.update({ where: { email: 'superadmin@university.com' }, data: { password: hash } });
await prisma.user.update({ where: { email: 'admin@university.com' }, data: { password: hash } });

console.log('='.repeat(50));
console.log('Admin passwords reset successfully!');
console.log('='.repeat(50));
console.log('superadmin@university.com  ->  Admin@1234');
console.log('admin@university.com       ->  Admin@1234');
console.log('='.repeat(50));

await prisma.$disconnect();
