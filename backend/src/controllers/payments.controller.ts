import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prismaClient.js';
import { auditLog } from '../utils/audit.utils.js';
import catchAsync from '../utils/catchAsync.js';
import { NotFoundError } from '../utils/appError.js';
import { invalidateCache } from '../utils/redis.utils.js';

export const getAllPayments = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { 
    status, 
    type, 
    studentId, 
    search, 
    page = '1', 
    limit = '20', 
    sortBy = 'createdAt', 
    sortOrder = 'desc' 
  } = req.query as Record<string, string>;

  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  const take = parseInt(limit as string);

  // Sorting whitelist
  const PAYMENT_SORT_FIELDS = ['createdAt', 'amount', 'status', 'type', 'paidAt']; 
  const safeSortBy = PAYMENT_SORT_FIELDS.includes(sortBy as string) ? (sortBy as string) : 'createdAt'; 
  const safeSortOrder = ['asc', 'desc'].includes(sortOrder as string) ? (sortOrder as string) : 'desc'; 

  const where: any = {};
  if (status) where.status = status;
  if (type) where.type = type;
  if (studentId) where.studentId = parseInt(studentId as string);
  if (search) {
    where.student = {
      OR: [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ],
    };
  }

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        student: {
          select: {
            firstName: true,
            lastName: true,
            studentId: true,
          },
        },
      },
      skip,
      take,
      orderBy: { [safeSortBy]: safeSortOrder },
    }),
    prisma.payment.count({ where })
  ]);

  res.json({ 
    success: true, 
    data: payments,
    pagination: {
      total,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      totalPages: Math.ceil(total / parseInt(limit as string))
    }
  });
});

export const getMyPayments = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const student = await prisma.student.findUnique({
    where: { userId: req.user!.id },
  });

  if (!student) {
    return next(new NotFoundError('Student record not found'));
  }

  const payments = await prisma.payment.findMany({
    where: { studentId: student.id },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ success: true, data: payments });
});

// FIXED: Finance stats include activePlans count and monthly revenue from real payments - Phase 2
export const getStats = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const [paidSum, pendingSum, overdueSum, byType, recentPayments, activePlans, totalPayments] = await Promise.all([
    prisma.payment.aggregate({ where: { status: 'PAID' }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: 'PENDING' }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: 'OVERDUE' }, _sum: { amount: true } }),
    prisma.payment.groupBy({ by: ['type'], _count: { _all: true } }),
    prisma.payment.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { student: { select: { firstName: true, lastName: true } } },
    }),
    prisma.payment.count({ where: { status: { in: ['PENDING', 'OVERDUE'] } } }),
    prisma.payment.count(),
  ]);

  const paidWithDates = await prisma.payment.findMany({
    where: { status: 'PAID', paidAt: { not: null } },
    select: { amount: true, paidAt: true },
  });

  const monthlyMap: Record<string, number> = {};
  paidWithDates.forEach((p: any) => {
    const d = new Date(p.paidAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyMap[key] = (monthlyMap[key] || 0) + Number(p.amount || 0);
  });

  const monthlyRevenue = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([key, amount]) => {
      const [, month] = key.split('-');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return { name: monthNames[parseInt(month, 10) - 1] || key, amount };
    });

  const stats = {
    totalCollected: Number(paidSum._sum.amount || 0),
    totalPending: Number(pendingSum._sum.amount || 0),
    totalOverdue: Number(overdueSum._sum.amount || 0),
    activePlans,
    totalPayments,
    paymentsByType: byType.reduce((acc: any, curr: any) => {
      acc[curr.type] = curr._count._all;
      return acc;
    }, {}),
    recentPayments,
    monthlyRevenue,
  };

  res.json({ success: true, data: stats });
});

export const getPaymentById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const payment = await prisma.payment.findUnique({
    where: { id: parseInt(req.params.id as string) },
    include: {
      student: {
        select: { firstName: true, lastName: true, studentId: true },
      },
    },
  });

  if (!payment) {
    return next(new NotFoundError('Payment not found'));
  }

  res.json({ success: true, data: payment });
});

export const createPayment = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { studentId, amount, type, description, dueDate } = req.body;
  const payment = await prisma.payment.create({
    data: {
      studentId: parseInt(studentId as string),
      amount: parseFloat(amount as string),
      type,
      description,
      dueDate: dueDate ? new Date(dueDate as string) : null,
      status: 'PENDING',
    },
  });

  await invalidateCache('dashboard:*');

  res.status(201).json({ success: true, data: payment });
});

export const updatePayment = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { amount, type, description, dueDate, status } = req.body;
  const payment = await prisma.payment.update({
    where: { id: parseInt(req.params.id as string) },
    data: {
      amount: amount !== undefined ? parseFloat(amount as string) : undefined,
      type,
      description,
      dueDate: dueDate ? new Date(dueDate as string) : undefined,
      status,
    },
  });

  auditLog('UPDATE_PAYMENT', 'Payment', req.params.id as string, req);
  res.json({ success: true, data: payment });
});

export const markAsPaid = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const payment = await prisma.payment.update({
    where: { id: parseInt(req.params.id as string) },
    data: {
      status: 'PAID',
      paidAt: new Date(),
    },
  });

  auditLog('MARK_PAYMENT_PAID', 'Payment', req.params.id as string, req);
  res.json({ success: true, data: payment });
});

export const deletePayment = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  await prisma.payment.delete({
    where: { id: parseInt(req.params.id as string) },
  });
  
  await invalidateCache('dashboard:*');
  
  auditLog('DELETE_PAYMENT', 'Payment', req.params.id as string, req);
  res.json({ success: true, message: 'Payment deleted' });
});
