const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getAllPayments = async (req, res) => {
  try {
    const { status, type, studentId, search } = req.query;

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

    const payments = await prisma.payment.findMany({
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
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: payments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMyPayments = async (req, res) => {
  try {
    const student = await prisma.student.findUnique({
      where: { userId: req.user.id },
    });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student record not found' });
    }

    const payments = await prisma.payment.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: payments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getStats = async (req, res) => {
  try {
    const paidSum = await prisma.payment.aggregate({
      where: { status: 'PAID' },
      _sum: { amount: true },
    });

    const pendingSum = await prisma.payment.aggregate({
      where: { status: 'PENDING' },
      _sum: { amount: true },
    });

    const overdueSum = await prisma.payment.aggregate({
      where: { status: 'OVERDUE' },
      _sum: { amount: true },
    });

    const byType = await prisma.payment.groupBy({
      by: ['type'],
      _count: { _all: true },
    });

    const recentPayments = await prisma.payment.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        student: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    const stats = {
      totalCollected: paidSum._sum.amount || 0,
      totalPending: pendingSum._sum.amount || 0,
      totalOverdue: overdueSum._sum.amount || 0,
      paymentsByType: byType.reduce((acc, curr) => {
        acc[curr.type] = curr._count._all;
        return acc;
      }, {}),
      recentPayments,
    };

    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getPaymentById = async (req, res) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        student: {
          select: { firstName: true, lastName: true, studentId: true },
        },
      },
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    res.json({ success: true, data: payment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createPayment = async (req, res) => {
  const { studentId, amount, type, description, dueDate } = req.body;
  try {
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

    res.status(201).json({ success: true, data: payment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updatePayment = async (req, res) => {
  const { amount, type, description, dueDate, status } = req.body;
  try {
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
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.markAsPaid = async (req, res) => {
  try {
    const payment = await prisma.payment.update({
      where: { id: parseInt(req.params.id) },
      data: {
        status: 'PAID',
        paidAt: new Date(),
      },
    });

    res.json({ success: true, data: payment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deletePayment = async (req, res) => {
  try {
    await prisma.payment.delete({
      where: { id: parseInt(req.params.id) },
    });
    res.json({ success: true, message: 'Payment deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
