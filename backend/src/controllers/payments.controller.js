const prisma = require('../utils/prismaClient');
const catchAsync = require('../utils/catchAsync');
const { NotFoundError } = require('../utils/appError');
const { invalidateCache } = require('../utils/redis.utils');

exports.getAllPayments = catchAsync(async (req, res, next) => {
  const { 
    status, 
    type, 
    studentId, 
    search, 
    page = 1, 
    limit = 20, 
    sortBy = 'createdAt', 
    sortOrder = 'desc' 
  } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  const where = {};
  if (status) where.status = status;
  if (type) where.type = type;
  if (studentId) where.studentId = parseInt(studentId);
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
      orderBy: { [sortBy]: sortOrder },
    }),
    prisma.payment.count({ where })
  ]);

  res.json({ 
    success: true, 
    data: payments,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    }
  });
});

exports.getMyPayments = catchAsync(async (req, res, next) => {
  const student = await prisma.student.findUnique({
    where: { userId: req.user.id },
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
exports.getStats = catchAsync(async (req, res, next) => {
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

  const monthlyMap = {};
  paidWithDates.forEach((p) => {
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
    paymentsByType: byType.reduce((acc, curr) => {
      acc[curr.type] = curr._count._all;
      return acc;
    }, {}),
    recentPayments,
    monthlyRevenue,
  };

  res.json({ success: true, data: stats });
});

exports.getPaymentById = catchAsync(async (req, res, next) => {
  const payment = await prisma.payment.findUnique({
    where: { id: parseInt(req.params.id) },
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

exports.createPayment = catchAsync(async (req, res, next) => {
  const { studentId, amount, type, description, dueDate } = req.body;
  const payment = await prisma.payment.create({
    data: {
      studentId: parseInt(studentId),
      amount: parseFloat(amount),
      type,
      description,
      dueDate: dueDate ? new Date(dueDate) : null,
      status: 'PENDING',
    },
  });

  await invalidateCache('dashboard:*');

  res.status(201).json({ success: true, data: payment });
});

exports.updatePayment = catchAsync(async (req, res, next) => {
  const { amount, type, description, dueDate, status } = req.body;
  const payment = await prisma.payment.update({
    where: { id: parseInt(req.params.id) },
    data: {
      amount: amount ? parseFloat(amount) : undefined,
      type,
      description,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      status,
    },
  });

  res.json({ success: true, data: payment });
});

exports.markAsPaid = catchAsync(async (req, res, next) => {
  const payment = await prisma.payment.update({
    where: { id: parseInt(req.params.id) },
    data: {
      status: 'PAID',
      paidAt: new Date(),
    },
  });

  res.json({ success: true, data: payment });
});

exports.deletePayment = catchAsync(async (req, res, next) => {
  await prisma.payment.delete({
    where: { id: parseInt(req.params.id) },
  });
  
  await invalidateCache('dashboard:*');
  
  res.json({ success: true, message: 'Payment deleted' });
});
