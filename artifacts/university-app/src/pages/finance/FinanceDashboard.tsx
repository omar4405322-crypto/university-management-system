// FIXED: Remove mock 1,240 plans and monthly revenue; bind real payment stats API - Phase 2
import React, { useState, useEffect } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import paymentsService from '../../services/payments.service';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import ChartTooltip from '../../components/ui/ChartTooltip';
import AddPaymentModal from './AddPaymentModal';
import ConfirmDeleteModal from '../../components/ui/ConfirmDeleteModal';
import Modal from '../../components/ui/Modal';
import Card from '../../components/ui/Card';
import Table, { TableRow, TableCell, TableHeader, TableHead, TableBody, ActionMenu } from '../../components/ui/Table';
import Button from '../../components/ui/button';
import Input from '../../components/ui/input';
import Badge from '../../components/ui/Badge';
import { PageHeader } from '../../components/ui/PageHeader';
import { SkeletonKPIGrid, SkeletonTable } from '../../components/ui/skeleton';
import {
  DollarSign,
  Clock,
  AlertCircle,
  CheckCircle,
  Plus,
  Search,
  TrendingUp,
  Download,
  CreditCard,
  History,
  LayoutDashboard,
  Edit,
  Trash2,
  Info,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import { logger } from '../../lib/logger';
import { useToast } from '../../context/ToastContext';

export type PaymentStatus = 'PAID' | 'PENDING' | 'OVERDUE' | 'CANCELLED';
export type PaymentType = 'TUITION' | 'REGISTRATION' | 'LIBRARY' | 'OTHER';

export interface PaymentStudent {
  id?: number | string;
  studentId?: string;
  firstName?: string;
  lastName?: string;
  year?: number;
  user?: {
    email?: string;
    profilePicture?: string;
  };
}

export interface PaymentItem {
  id: number | string;
  amount: number;
  type: PaymentType | string;
  status: PaymentStatus | string;
  dueDate?: string;
  paidAt?: string;
  createdAt?: string;
  description?: string;
  studentId?: number | string;
  student?: PaymentStudent;
}

export interface FinanceStats {
  totalCollected: number;
  totalPending: number;
  totalOverdue: number;
  totalPayments?: number;
  activePlans?: number;
  paymentsByType?: Record<string, number>;
  monthlyRevenue?: Array<{
    month: string;
    amount: number;
  }>;
}

export interface StudentPaymentStats {
  totalPaid: number;
  totalPending: number;
  totalOverdue: number;
}

interface PaymentFilters {
  status: string;
  type: string;
  search: string;
}

const FinanceDashboard = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(
    user?.role || ''
  );

  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'PAYMENTS'>(isAdmin ? 'OVERVIEW' : 'PAYMENTS');
  const [stats, setStats] = useState<FinanceStats | null>(null);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { showToast } = useToast();
  const [confirmPaymentId, setConfirmPaymentId] = useState<string | number | null>(null);
  const [editPayment, setEditPayment] = useState<PaymentItem | null>(null);
  const [paymentToDelete, setPaymentToDelete] = useState<string | number | null>(null);
  const [payNoticeModalOpen, setPayNoticeModalOpen] = useState(false);
  const [selectedPaymentForPay, setSelectedPaymentForPay] = useState<PaymentItem | null>(null);

  const [filters, setFilters] = useState<PaymentFilters>({
    status: 'ALL',
    type: 'ALL',
    search: '',
  });
  const debouncedSearch = useDebounce(filters.search, 400);

  const fetchData = async () => {
    try {
      setLoading(true);
      if (isAdmin) {
        const statsRes = await paymentsService.getStats();
        if (statsRes.success) {
          setStats(statsRes.data);
        }

        const params: Record<string, unknown> = {};
        if (filters.status !== 'ALL')
          params.status = filters.status;
        if (filters.type !== 'ALL')
          params.type = filters.type;
        if (debouncedSearch) params.search = debouncedSearch;

        const paymentsRes = await paymentsService.getPayments(params);
        if (paymentsRes.success) {
          setPayments(paymentsRes.data || []);
        }
      } else {
        const myPaymentsRes = await paymentsService.getMyPayments();
        if (myPaymentsRes.success) {
          setPayments(myPaymentsRes.data || []);
        }
      }
    } catch (err: any) {
      logger.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filters.status, filters.type, debouncedSearch]);

  const { isDark } = useTheme();
  const chartColors = {
    grid: isDark ? '#334155' : '#E2E8F0',
    tick: isDark ? '#94A3B8' : '#64748B',
    tooltip: {
      bg: isDark ? '#1E293B' : '#FFFFFF',
      border: isDark ? '#334155' : '#E2E8F0',
      text: isDark ? '#F1F5F9' : '#132231',
    },
    pie: ['#8BB83C', '#132231', '#F59E0B', '#10B981'],
  };

  const handleMarkAsPaid = async () => {
    if (!confirmPaymentId) return;
    try {
      const result = await paymentsService.markAsPaid(String(confirmPaymentId));
      if (result.success) {
        showToast(t('finance.updateSuccess'), 'success');
        setConfirmPaymentId(null);
        fetchData();
      }
    } catch (_err: any) {
      showToast(t('finance.updateError'), 'error');
    }
  };

  const handleDeletePayment = async () => {
    if (!paymentToDelete) return;
    try {
      const result = await paymentsService.deletePayment(String(paymentToDelete));
      if (result.success) {
        showToast(t('finance.deleteSuccess', 'Payment deleted successfully'), 'success');
        setPaymentToDelete(null);
        fetchData();
      }
    } catch (_err: any) {
      showToast(t('finance.deleteError', 'Error deleting payment'), 'error');
    }
  };

  const handleDownloadReceipt = async (paymentId: string | number) => {
    try {
      await paymentsService.downloadReceipt(paymentId);
      showToast(t('finance.receiptDownloadSuccess', 'Receipt downloaded successfully'), 'success');
    } catch (error: any) {
      logger.error('Failed to download receipt', error);
      showToast(
        error?.message ||
          error?.response?.data?.message ||
          t('finance.receiptDownloadError', 'Failed to download receipt'),
        'error'
      );
    }
  };

  const chartData = stats
    ? Object.entries(stats.paymentsByType || {}).map(([name, value]) => ({ name, value }))
    : [];
  const COLORS = chartColors.pie;

  const monthlyData = stats?.monthlyRevenue?.length ? stats.monthlyRevenue : [];
  const hasPayments = (stats?.totalPayments ?? payments.length) > 0;

  const studentStats: StudentPaymentStats | null = !isAdmin
    ? {
      totalPaid: payments
        .filter((p) => p.status === 'PAID')
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
      totalPending: payments
        .filter((p) => p.status === 'PENDING')
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
      totalOverdue: payments
        .filter((p) => p.status === 'OVERDUE')
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    }
    : null;

  if (loading && !stats && payments.length === 0) {
    return (
      <div className="space-y-8 animate-page">
        <SkeletonKPIGrid />
        <SkeletonTable rows={10} />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-page">


      <PageHeader
        title={t('finance.title')}
        subtitle={isAdmin ? t('finance.adminSubtitle') : t('finance.studentSubtitle')}
        action={
          isAdmin
            ? {
              label: t('finance.addPayment'),
              onClick: () => {
                setEditPayment(null);
                setIsModalOpen(true);
              },
            }
            : undefined
        }
      />

      {/* === Tab Bar === */}
      {isAdmin && (
        <div className="flex items-center gap-1 p-1 bg-surface-subtle rounded-2xl w-full md:w-fit border border-brand-border overflow-x-auto scrollbar-hide flex-nowrap">
          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`tab-base flex-shrink-0 ${activeTab === 'OVERVIEW' ? 'tab-active' : 'tab-inactive'}`}
          >
            <LayoutDashboard size={14} /> {t('finance.overview')}
          </button>
          <button
            onClick={() => setActiveTab('PAYMENTS')}
            className={`tab-base flex-shrink-0 ${activeTab === 'PAYMENTS' ? 'tab-active' : 'tab-inactive'}`}
          >
            <History size={14} /> {t('finance.allPayments')}
          </button>
        </div>
      )}

      {/* === Overview Section === */}
      {activeTab === 'OVERVIEW' && isAdmin && !loading && !stats && (
        <Card className="p-12 text-center border-dashed">
          <AlertCircle size={40} className="mx-auto text-brand-text-muted mb-4" />
          <h3 className="text-xl font-black text-brand-text-main uppercase">
            {t('finance.noDataTitle', 'Unable to load finance data')}
          </h3>
          <p className="text-brand-text-sub font-bold mt-2">
            {t('finance.noDataDesc', 'Please refresh or try again later.')}
          </p>
        </Card>
      )}

      {activeTab === 'OVERVIEW' && isAdmin && stats && !hasPayments && (
        <Card className="p-12 text-center border-dashed mb-8">
          <DollarSign size={40} className="mx-auto text-brand-green mb-4" />
          <h3 className="text-xl font-black text-brand-text-main uppercase">
            {t('finance.noPaymentsYet', 'No payments yet')}
          </h3>
          <p className="text-brand-text-sub font-bold mt-2 max-w-md mx-auto">
            {t(
              'finance.noPaymentsDesc',
              'Create a payment plan to start tracking tuition and fees.'
            )}
          </p>
          <Button className="mt-6" onClick={() => {
            setEditPayment(null);
            setIsModalOpen(true);
          }}>
            <Plus size={18} className="mr-2" /> {t('finance.addPayment')}
          </Button>
        </Card>
      )}

      {activeTab === 'OVERVIEW' && isAdmin && stats && (
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6 gap-5">
            <Card noPadding className="group overflow-hidden">
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-caption text-brand-text-secondary">
                    {t('finance.totalCollected')}
                  </p>
                  <div className="rounded-xl p-3 bg-brand-primary-50 text-brand-primary-600 group-hover:bg-brand-primary-600 group-hover:text-white transition-all duration-300">
                    <TrendingUp size={24} />
                  </div>
                </div>
                <h3 className="heading-display !text-3xl md:!text-4xl m-0 tracking-tightest">
                  {isRTL ? 'ج.م ' : 'EGP '}{Number(stats.totalCollected || 0).toLocaleString()}
                </h3>
              </div>
            </Card>

            <Card noPadding className="group overflow-hidden">
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-caption text-brand-text-secondary">
                    {t('finance.totalPending')}
                  </p>
                  <div className="rounded-xl p-3 bg-brand-accent-yellow/10 text-brand-accent-yellow group-hover:bg-brand-accent-yellow group-hover:text-white transition-all duration-300">
                    <Clock size={24} />
                  </div>
                </div>
                <h3 className="heading-display !text-3xl md:!text-4xl m-0 tracking-tightest text-brand-accent-yellow">
                  {isRTL ? 'ج.م ' : 'EGP '}{Number(stats.totalPending || 0).toLocaleString()}
                </h3>
              </div>
            </Card>

            <Card noPadding className="group overflow-hidden">
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-caption text-brand-text-secondary">
                    {t('finance.totalOverdue')}
                  </p>
                  <div className="rounded-xl p-3 bg-rose-50 dark:bg-rose-900/20 text-error group-hover:bg-error group-hover:text-white transition-all duration-300">
                    <AlertCircle size={24} />
                  </div>
                </div>
                <h3 className="heading-display !text-3xl md:!text-4xl m-0 tracking-tightest text-error">
                  {isRTL ? 'ج.م ' : 'EGP '}{Number(stats.totalOverdue || 0).toLocaleString()}
                </h3>
              </div>
            </Card>

            <Card noPadding className="group overflow-hidden">
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-caption text-brand-text-secondary">
                    {t('finance.activePlans')}
                  </p>
                  <div className="rounded-xl p-3 bg-brand-navy-50 text-brand-navy-500 group-hover:bg-brand-navy-500 group-hover:text-white transition-all duration-300">
                    <CreditCard size={24} />
                  </div>
                </div>
                <h3 className="heading-display !text-3xl md:!text-4xl m-0 tracking-tightest">
                  {(stats.activePlans ?? 0).toLocaleString()}
                </h3>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-5 xl:gap-6">
            <Card className="lg:col-span-2 xl:col-span-3 p-6">
              <h3 className="text-lg font-black text-brand-text-main mb-2">{t('finance.revenueOverTime')}</h3>
              <div className="h-[350px] mt-6">
                {monthlyData.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-brand-text-sub font-bold">
                      {t('finance.noMonthlyData', 'No revenue recorded yet')}
                    </p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={monthlyData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke={chartColors.grid}
                      />
                      <XAxis
                        dataKey="month"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fontWeight: 900, fill: chartColors.tick }}
                        dy={10}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fontWeight: 900, fill: chartColors.tick }}
                      />
                      <Tooltip
                        content={<ChartTooltip />}
                        cursor={{ fill: 'var(--surface-subtle)' }}
                      />
                      <Bar dataKey="amount" fill="var(--brand-green)" radius={[12, 12, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-black text-brand-text-main mb-2">{t('finance.revenueByType')}</h3>
              <div className="h-[350px] mt-6 flex items-center">
                {chartData.length === 0 ? (
                  <p className="w-full text-center text-brand-text-sub font-bold">
                    {t('finance.noPaymentsYet', 'No payments yet')}
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={100}
                        paddingAngle={8}
                        dataKey="value"
                      >
                        {chartData.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        iconType="circle"
                        wrapperStyle={{
                          fontSize: '10px',
                          fontWeight: 900,
                          textTransform: 'uppercase',
                          letterSpacing: '0.1em',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* === Payments List Section === */}
      {(activeTab === 'PAYMENTS' || !isAdmin) && (
        <Card noPadding className="border-brand-border">
          <div className="p-6 border-b border-brand-border">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-text-muted"
                />
                <Input
                  placeholder={
                    isAdmin ? t('finance.searchStudent') : t('finance.searchPayments')
                  }
                  className="pl-10 h-10 w-full bg-brand-bg-card"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                />
              </div>
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <select
                    className="px-3 py-2 border border-slate-200 dark:border-slate-700 bg-brand-bg-card rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 outline-none"
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  >
                    <option value="ALL">{t('finance.allStatuses')}</option>
                    <option value="PAID">{t('finance.paid')}</option>
                    <option value="PENDING">{t('finance.pending')}</option>
                    <option value="OVERDUE">{t('finance.overdue')}</option>
                  </select>
                  <select
                    className="px-3 py-2 border border-slate-200 dark:border-slate-700 bg-brand-bg-card rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 outline-none"
                    value={filters.type}
                    onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                  >
                    <option value="ALL">{t('finance.allTypes')}</option>
                    <option value="TUITION">{t('finance.tuition')}</option>
                    <option value="REGISTRATION">{t('finance.registration')}</option>
                    <option value="LIBRARY">{t('finance.library')}</option>
                  </select>
                </div>
              )}
            </div>
            {!isAdmin && studentStats && (
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="p-4 bg-brand-bg-card rounded-xl border border-brand-border">
                  <span className="text-caption text-brand-text-secondary block">
                    {t('finance.totalOutstanding', 'Total Due')}
                  </span>
                  <span className="heading-display !text-2xl mt-1 text-brand-accent-yellow block">
                    {isRTL ? 'ج.م ' : 'EGP '}{(studentStats.totalPending + studentStats.totalOverdue).toLocaleString()}
                  </span>
                </div>
                <div className="p-4 bg-brand-bg-card rounded-xl border border-brand-border">
                  <span className="text-caption text-brand-text-secondary block">
                    {t('finance.totalPaid', 'Total Paid')}
                  </span>
                  <span className="heading-display !text-2xl mt-1 text-brand-primary-600 block">
                    {isRTL ? 'ج.م ' : 'EGP '}{studentStats.totalPaid.toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8">
                <SkeletonTable rows={5} />
              </div>
            ) : payments.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-lg font-bold text-brand-text-main">{t('finance.noPayments')}</p>
                <p className="text-sm text-brand-text-sub max-w-xs mx-auto mt-1">
                  {t('finance.noPaymentsDesc')}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700">
                  <TableRow>
                    {(isAdmin
                      ? [
                        t('students.fullName'),
                        t('finance.amount'),
                        t('finance.type'),
                        t('finance.dueDate'),
                        t('profile.status'),
                        t('common.actions'),
                      ]
                      : [
                        t('finance.type'),
                        t('finance.amount'),
                        t('finance.dueDate'),
                        t('finance.paidAt'),
                        t('profile.status'),
                        t('common.actions'),
                      ]
                    ).map((header, idx) => (
                      <TableHead key={idx} className="font-bold text-xs">
                        {header}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      {isAdmin && (
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-brand-navy-500/10 flex items-center justify-center text-brand-navy-500 font-bold text-xs border border-brand-navy-500/10 shrink-0">
                              {payment.student?.firstName?.[0]}
                              {payment.student?.lastName?.[0]}
                            </div>
                            <div>
                              <p className="font-bold text-brand-text-main">
                                {payment.student?.firstName} {payment.student?.lastName}
                              </p>
                              <p className="text-caption text-brand-text-muted">
                                {payment.student?.studentId}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                      )}
                      {!isAdmin && (
                        <TableCell className="font-bold text-brand-text-main">
                          {t(`finance.${String(payment.type).toLowerCase()}`)}
                        </TableCell>
                      )}
                      <TableCell className="font-black text-brand-text-main">
                        {isRTL ? 'ج.م ' : 'EGP '}{payment.amount.toLocaleString()}
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          <Badge variant="info" className="font-bold">
                            {t(`finance.${String(payment.type).toLowerCase()}`)}
                          </Badge>
                        </TableCell>
                      )}
                      <TableCell className="text-brand-text-sub font-bold">
                        {payment.dueDate ? new Date(payment.dueDate).toLocaleDateString() : 'N/A'}
                      </TableCell>
                      {!isAdmin && (
                        <TableCell className="text-brand-text-sub font-bold">
                          {payment.paidAt ? new Date(payment.paidAt).toLocaleDateString() : '—'}
                        </TableCell>
                      )}
                      <TableCell>
                        <Badge
                          variant={
                            payment.status === 'PAID'
                              ? 'success'
                              : payment.status === 'OVERDUE'
                                ? 'danger'
                                : 'warning'
                          }
                          className="px-3 py-1 font-bold"
                        >
                          {t(`finance.${String(payment.status).toLowerCase()}`)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <ActionMenu
                          actions={[
                            ...(isAdmin && payment.status !== 'PAID'
                              ? [
                                {
                                  label: t('finance.markPaid'),
                                  icon: CheckCircle,
                                  variant: 'edit' as const,
                                  onClick: () => setConfirmPaymentId(payment.id),
                                },
                              ]
                              : []),
                            ...(isAdmin
                              ? [
                                {
                                  label: t('common.edit', 'Edit'),
                                  icon: Edit,
                                  variant: 'default' as const,
                                  onClick: () => {
                                    setEditPayment(payment);
                                    setIsModalOpen(true);
                                  },
                                },
                                {
                                  label: t('common.delete', 'Delete'),
                                  icon: Trash2,
                                  variant: 'danger' as const,
                                  onClick: () => setPaymentToDelete(payment.id),
                                },
                              ]
                              : []),
                            ...(!isAdmin && payment.status !== 'PAID'
                              ? [
                                {
                                  label: t('finance.payNow'),
                                  icon: CreditCard,
                                  variant: 'default' as const,
                                  onClick: () => {
                                    setSelectedPaymentForPay(payment);
                                    setPayNoticeModalOpen(true);
                                  },
                                },
                              ]
                              : []),
                            ...(payment.status === 'PAID'
                              ? [
                                {
                                  label: t('finance.downloadReceipt', 'Download Receipt'),
                                  icon: Download,
                                  variant: 'default' as const,
                                  onClick: () => handleDownloadReceipt(payment.id),
                                },
                              ]
                              : []),
                          ]}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </Card>
      )}

      <AddPaymentModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditPayment(null);
        }}
        onSuccess={() => {
          setIsModalOpen(false);
          setEditPayment(null);
          fetchData();
          showToast(editPayment ? t('finance.updateSuccess', 'Payment updated successfully') : t('finance.createSuccess', 'Payment created successfully'), 'success');
        }}
        payment={editPayment}
      />

      <ConfirmDeleteModal
        isOpen={!!confirmPaymentId}
        onClose={() => setConfirmPaymentId(null)}
        onConfirm={handleMarkAsPaid}
        title={t('finance.markAsPaidConfirm')}
        confirmLabel={t('finance.markPaid')}
      />

      <ConfirmDeleteModal
        isOpen={!!paymentToDelete}
        onClose={() => setPaymentToDelete(null)}
        onConfirm={handleDeletePayment}
        title={t('finance.deleteConfirm', 'Delete Payment')}
        confirmLabel={t('common.delete', 'Delete')}
      />

      <Modal
        isOpen={payNoticeModalOpen}
        onClose={() => {
          setPayNoticeModalOpen(false);
          setSelectedPaymentForPay(null);
        }}
        title={
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-primary-50 dark:bg-brand-primary-900/30 text-brand-primary-600 dark:text-brand-primary-400 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-lg font-black text-slate-800 dark:text-white">
                {t('finance.inPersonPaymentTitle', 'Tuition & Fee Payment')}
              </span>
              <span className="block text-xs font-semibold text-slate-400 dark:text-slate-400 mt-0.5">
                {t('finance.inPersonPaymentSubtitle', 'In-Person University Payment Instructions')}
              </span>
            </div>
          </div>
        }
        size="sm"
      >
        <div className="space-y-5 pt-2">
          {selectedPaymentForPay && (
            <div className="p-4 rounded-2xl bg-surface-subtle border border-brand-border flex items-center justify-between">
              <div>
                <span className="text-xs text-brand-text-sub block font-medium">
                  {t('finance.paymentType', 'Payment Type')}: {t(`finance.${String(selectedPaymentForPay.type).toLowerCase()}`, String(selectedPaymentForPay.type))}
                </span>
                {selectedPaymentForPay.description && (
                  <span className="text-xs text-brand-text-muted block mt-0.5">
                    {selectedPaymentForPay.description}
                  </span>
                )}
              </div>
              <div className="text-end">
                <span className="text-xs text-brand-text-sub block font-medium">
                  {t('finance.amount', 'Amount')}
                </span>
                <span className="text-base font-black text-brand-primary-600 dark:text-brand-primary-400">
                  {isRTL ? 'ج.م ' : 'EGP '}{selectedPaymentForPay.amount?.toLocaleString()}
                </span>
              </div>
            </div>
          )}

          <div className="p-4 rounded-2xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200/80 dark:border-sky-800/50 flex items-start gap-3.5">
            <Info className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed font-semibold text-sky-900 dark:text-sky-200">
              {t(
                'finance.inPersonPaymentNotice',
                "Online payment is not currently available. Please visit the university's Finance Office in person to settle your fees and receive an official receipt."
              )}
            </p>
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              type="button"
              variant="default"
              onClick={() => {
                setPayNoticeModalOpen(false);
                setSelectedPaymentForPay(null);
              }}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs"
            >
              {t('common.close', 'Close')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default FinanceDashboard;
