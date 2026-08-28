// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
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
import Table, {
  TableRow,
  TableCell,
  TableHeader,
  TableHead,
  TableBody,
} from '../../components/ui/Table';
import Button from '../../components/ui/button';
import Badge from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { downloadCsv } from '../../utils/exportCsv';
import {
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
  Pencil,
  Trash2,
  Info,
  RotateCw,
  RotateCcw,
  X,
  FileSpreadsheet,
  Wallet,
  Receipt,
  Eye,
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

// Arabic normalization helper
function normalizeArabic(text: string | null | undefined): string {
  if (!text) return '';
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/\s+/g, ' ');
}

export function FinanceDashboard() {
  const { t, i18n } = useTranslation();
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(
    user?.role || ''
  );

  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'PAYMENTS'>(
    isAdmin ? 'OVERVIEW' : 'PAYMENTS'
  );
  const [stats, setStats] = useState<FinanceStats | null>(null);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
  const debouncedSearch = useDebounce(filters.search, 300);

  const fetchData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      if (isAdmin) {
        const statsRes = await paymentsService.getStats();
        if (statsRes.success) {
          setStats(statsRes.data);
        }

        const params: Record<string, unknown> = {};
        if (filters.status !== 'ALL') params.status = filters.status;
        if (filters.type !== 'ALL') params.type = filters.type;
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
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filters.status, filters.type, debouncedSearch]);

  const { isDark } = useTheme();
  const chartColors = {
    grid: isDark ? '#334155' : '#E2E8F0',
    tick: isDark ? '#94A3B8' : '#64748B',
    pie: ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6'],
  };

  const handleMarkAsPaid = async () => {
    if (!confirmPaymentId) return;
    try {
      const result = await paymentsService.markAsPaid(String(confirmPaymentId));
      if (result.success) {
        showToast(t('finance.updateSuccess', 'Payment updated successfully'), 'success');
        setConfirmPaymentId(null);
        fetchData(true);
      }
    } catch (_err: any) {
      showToast(t('finance.updateError', 'Error updating payment'), 'error');
    }
  };

  const handleDeletePayment = async () => {
    if (!paymentToDelete) return;
    try {
      const result = await paymentsService.deletePayment(String(paymentToDelete));
      if (result.success) {
        showToast(t('finance.deleteSuccess', 'finance.deleteSuccess'), 'success');
        setPaymentToDelete(null);
        fetchData(true);
      }
    } catch (_err: any) {
      showToast(t('finance.deleteError', 'finance.deleteError'), 'error');
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

  const handleExportCsv = () => {
    if (payments.length === 0) {
      showToast(t('finance.noPayments', 'No payments found'), 'info');
      return;
    }

    const headers = [
      isRTL ? 'رقم المعاملة' : 'ID',
      isRTL ? 'اسم الطالب' : 'Student Name',
      isRTL ? 'الرقم الجامعي' : 'Student ID',
      isRTL ? 'نوع الدفعة' : 'Payment Type',
      isRTL ? 'المبلغ (ج.م)' : 'Amount (EGP)',
      isRTL ? 'تاريخ الاستحقاق' : 'Due Date',
      isRTL ? 'تاريخ السداد' : 'Paid Date',
      isRTL ? 'الحالة' : 'Status',
    ];

    const rows = payments.map((p) => [
      p.id,
      p.student ? `${p.student.firstName || ''} ${p.student.lastName || ''}`.trim() : '—',
      p.student?.studentId || '—',
      t(`finance.${String(p.type).toLowerCase()}`, String(p.type)),
      p.amount,
      p.dueDate ? new Date(p.dueDate).toLocaleDateString() : '—',
      p.paidAt ? new Date(p.paidAt).toLocaleDateString() : '—',
      t(`finance.${String(p.status).toLowerCase()}`, String(p.status)),
    ]);

    downloadCsv('finance-payments-report.csv', headers, rows);
    showToast(isRTL ? 'تم تصدير ملف السجلات بنجاح' : 'CSV Exported successfully', 'success');
  };

  const chartData = useMemo(() => {
    if (!stats || !stats.paymentsByType) return [];
    return Object.entries(stats.paymentsByType).map(([name, value]) => ({
      name: t(`finance.${name.toLowerCase()}`, name),
      value,
    }));
  }, [stats, t]);

  const monthlyData = stats?.monthlyRevenue?.length ? stats.monthlyRevenue : [];

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

  const hasActiveFilters =
    filters.status !== 'ALL' || filters.type !== 'ALL' || filters.search.trim() !== '';

  const clearFilters = () => {
    setFilters({ status: 'ALL', type: 'ALL', search: '' });
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* ========================================================================= */}
      {/* 1. SLIM EXECUTIVE HEADER                                                  */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            {t('finance.title', 'Finance & Payments')}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isAdmin
              ? t('finance.adminSubtitle', 'Manage payments and university fees')
              : t('finance.studentSubtitle', 'Your personal payment history and dues')}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="h-8.5 px-3 rounded-lg border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 gap-1.5 cursor-pointer shadow-2xs"
          >
            <RotateCw size={13} className={refreshing ? 'animate-spin' : ''} />
            <span>{t('common.refresh', 'Refresh')}</span>
          </Button>

          {isAdmin && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                disabled={payments.length === 0}
                className="h-8.5 px-3 rounded-lg border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 gap-1.5 cursor-pointer shadow-2xs"
              >
                <FileSpreadsheet size={13} className="text-emerald-600 dark:text-emerald-400" />
                <span>{isRTL ? 'تصدير CSV' : 'Export CSV'}</span>
              </Button>

              <Button
                size="sm"
                onClick={() => {
                  setEditPayment(null);
                  setIsModalOpen(true);
                }}
                className="h-8.5 px-3.5 bg-brand-primary-600 hover:bg-brand-primary-700 text-white rounded-lg text-xs font-bold gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus size={14} />
                <span>{t('finance.addPayment', 'Add Payment')}</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. EXECUTIVE FINANCIAL KPI BADGES                                         */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {isAdmin ? (
          <>
            {/* Total Collected */}
            <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/90 dark:border-slate-700 shadow-2xs">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-emerald-700 dark:text-emerald-400">
                  {t('finance.totalCollected', 'Total Collected')}
                </span>
                <TrendingUp size={14} className="text-emerald-500" />
              </div>
              <div className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                {isRTL ? 'ج.م ' : 'EGP '}
                {Number(stats?.totalCollected || 0).toLocaleString()}
              </div>
            </div>

            {/* Total Pending */}
            <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/90 dark:border-slate-700 shadow-2xs">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-amber-700 dark:text-amber-400">
                  {t('finance.totalPending', 'Total Pending')}
                </span>
                <Clock size={14} className="text-amber-500" />
              </div>
              <div className="text-lg sm:text-xl font-black text-amber-600 dark:text-amber-400 font-mono">
                {isRTL ? 'ج.م ' : 'EGP '}
                {Number(stats?.totalPending || 0).toLocaleString()}
              </div>
            </div>

            {/* Total Overdue */}
            <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/90 dark:border-slate-700 shadow-2xs">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-rose-700 dark:text-rose-400">
                  {t('finance.totalOverdue', 'Total Overdue')}
                </span>
                <AlertCircle size={14} className="text-rose-500" />
              </div>
              <div className="text-lg sm:text-xl font-black text-rose-600 dark:text-rose-400 font-mono">
                {isRTL ? 'ج.م ' : 'EGP '}
                {Number(stats?.totalOverdue || 0).toLocaleString()}
              </div>
            </div>

            {/* Active Plans */}
            <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/90 dark:border-slate-700 shadow-2xs">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-blue-700 dark:text-blue-400">
                  {t('finance.activePlans', 'Active Payment Plans')}
                </span>
                <CreditCard size={14} className="text-blue-500" />
              </div>
              <div className="text-lg sm:text-xl font-black text-blue-600 dark:text-blue-400 font-mono">
                {stats?.activePlans ?? stats?.totalPayments ?? payments.length}
              </div>
            </div>
          </>
        ) : (
          /* Student Personal KPIs */
          <>
            <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/90 dark:border-slate-700 shadow-2xs">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-emerald-700 dark:text-emerald-400">
                  {t('finance.totalPaid', 'Total Paid')}
                </span>
                <CheckCircle size={14} className="text-emerald-500" />
              </div>
              <div className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                {isRTL ? 'ج.م ' : 'EGP '}
                {Number(studentStats?.totalPaid || 0).toLocaleString()}
              </div>
            </div>

            <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/90 dark:border-slate-700 shadow-2xs">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-amber-700 dark:text-amber-400">
                  {t('finance.totalPending', 'Total Pending')}
                </span>
                <Clock size={14} className="text-amber-500" />
              </div>
              <div className="text-lg sm:text-xl font-black text-amber-600 dark:text-amber-400 font-mono">
                {isRTL ? 'ج.م ' : 'EGP '}
                {Number(studentStats?.totalPending || 0).toLocaleString()}
              </div>
            </div>

            <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/90 dark:border-slate-700 shadow-2xs">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-rose-700 dark:text-rose-400">
                  {t('finance.totalOverdue', 'Total Overdue')}
                </span>
                <AlertCircle size={14} className="text-rose-500" />
              </div>
              <div className="text-lg sm:text-xl font-black text-rose-600 dark:text-rose-400 font-mono">
                {isRTL ? 'ج.م ' : 'EGP '}
                {Number(studentStats?.totalOverdue || 0).toLocaleString()}
              </div>
            </div>

            <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/90 dark:border-slate-700 shadow-2xs">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-blue-700 dark:text-blue-400">
                  {isRTL ? 'إجمالي المعاملات' : 'Transactions'}
                </span>
                <Receipt size={14} className="text-blue-500" />
              </div>
              <div className="text-lg sm:text-xl font-black text-blue-600 dark:text-blue-400 font-mono">
                {payments.length}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. SEGMENTED TAB SWITCHER (For Admins)                                     */}
      {/* ========================================================================= */}
      {isAdmin && (
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 w-fit">
          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'OVERVIEW'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <LayoutDashboard size={14} />
            <span>{t('finance.overview', 'Overview')}</span>
          </button>
          <button
            onClick={() => setActiveTab('PAYMENTS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'PAYMENTS'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <History size={14} />
            <span>{t('finance.allPayments', 'All Payments')}</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono font-bold">
              {payments.length}
            </span>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. OVERVIEW & ANALYTICS CHARTS TAB                                        */}
      {/* ========================================================================= */}
      {activeTab === 'OVERVIEW' && isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
          {/* Revenue Over Time */}
          <div className="lg:col-span-2 p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {t('finance.revenueOverTime', 'Revenue Over Time')}
              </h3>
              <span className="text-[11px] text-slate-400 font-semibold">
                {isRTL ? 'تقرير الإيرادات المحصلة' : 'Revenue Trend'}
              </span>
            </div>

            <div className="h-[240px] w-full flex items-center justify-center">
              {monthlyData.length === 0 ? (
                <div className="text-center p-6 text-slate-400">
                  <Wallet size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="text-xs font-semibold">
                    {t('finance.noMonthlyData', 'finance.noMonthlyData')}
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors.grid} />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: chartColors.tick }}
                      dy={5}
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartColors.tick }} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                    <Bar dataKey="amount" fill="#10B981" radius={[8, 8, 0, 0]} barSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Revenue By Type */}
          <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {t('finance.revenueByType', 'Revenue by Type')}
              </h3>
            </div>

            <div className="h-[240px] w-full flex items-center justify-center">
              {chartData.length === 0 ? (
                <div className="text-center p-6 text-slate-400">
                  <Receipt size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="text-xs font-semibold">
                    {t('finance.noPaymentsYet', 'No payments yet')}
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="45%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {chartData.map((_entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={chartColors.pie[index % chartColors.pie.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                    <Legend
                      verticalAlign="bottom"
                      height={32}
                      iconType="circle"
                      wrapperStyle={{
                        fontSize: '11px',
                        fontWeight: 600,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. TRANSACTIONS LEDGER & PAYMENTS TABLE                                   */}
      {/* ========================================================================= */}
      {(activeTab === 'PAYMENTS' || !isAdmin) && (
        <div className="space-y-3">
          {/* Unified Compact Filter Toolbar */}
          <div className="bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700/80 p-2.5 shadow-2xs flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search
                className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={14}
              />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder={
                  isAdmin
                    ? t('finance.searchStudentPlaceholder', 'Search by name or ID...')
                    : t('finance.searchPayments', 'Search payments...')
                }
                className="w-full ps-8 pe-7 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500"
              />
              {filters.search && (
                <button
                  onClick={() => setFilters({ ...filters, search: '' })}
                  className="absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {isAdmin && (
              <>
                {/* Status Dropdown */}
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  aria-label={t('finance.allStatuses', 'All Statuses')}
                  className="h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
                >
                  <option value="ALL">{t('finance.allStatuses', 'All Statuses')}</option>
                  <option value="PAID">{t('finance.paid', 'Paid')}</option>
                  <option value="PENDING">{t('finance.pending', 'Pending')}</option>
                  <option value="OVERDUE">{t('finance.overdue', 'Overdue')}</option>
                </select>

                {/* Type Dropdown */}
                <select
                  value={filters.type}
                  onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                  aria-label={t('finance.allTypes', 'All Types')}
                  className="h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
                >
                  <option value="ALL">{t('finance.allTypes', 'All Types')}</option>
                  <option value="TUITION">{t('finance.tuition', 'Tuition')}</option>
                  <option value="REGISTRATION">{t('finance.registration', 'Registration')}</option>
                  <option value="LIBRARY">{t('finance.library', 'Library')}</option>
                  <option value="OTHER">{t('finance.other', 'Other')}</option>
                </select>
              </>
            )}

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="h-9 px-2.5 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 text-xs font-medium flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw size={12} />
                <span>{isRTL ? 'مسح' : 'Reset'}</span>
              </button>
            )}

            <div className="ms-auto text-xs text-slate-400 font-semibold pe-1">
              {isRTL ? `إجمالي: ${payments.length} معاملة` : `Total: ${payments.length} records`}
            </div>
          </div>

          {/* High-Density Data Table */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xs">
            {loading ? (
              <div className="p-8 text-center text-slate-400">
                <RotateCw className="animate-spin mx-auto text-brand-primary-500 mb-2" size={28} />
                <span className="text-xs font-medium">{t('common.loading', 'Loading...')}</span>
              </div>
            ) : payments.length === 0 ? (
              <div className="p-8 text-center">
                <EmptyState
                  icon={<Receipt size={36} className="text-slate-400" />}
                  title={t('finance.noPayments', 'No payments found')}
                  subtitle={
                    isAdmin
                      ? t('finance.noPaymentsDesc', 'No payment records match your current filters.')
                      : t('finance.noPaymentsYet', 'No payments yet')
                  }
                  action={
                    isAdmin
                      ? {
                          label: t('finance.addPayment', 'Add Payment'),
                          onClick: () => {
                            setEditPayment(null);
                            setIsModalOpen(true);
                          },
                        }
                      : hasActiveFilters
                      ? {
                          label: isRTL ? 'إعادة ضبط الفلاتر' : 'Reset Filters',
                          onClick: clearFilters,
                        }
                      : undefined
                  }
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="w-full text-xs">
                  <TableHeader className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700">
                    <TableRow>
                      {isAdmin && (
                        <TableHead className="p-2.5 font-bold text-slate-500">
                          {t('students.fullName', 'Full Name')}
                        </TableHead>
                      )}
                      <TableHead className="p-2.5 font-bold text-slate-500">
                        {t('finance.type', 'Type')}
                      </TableHead>
                      <TableHead className="p-2.5 font-bold text-slate-500 text-center">
                        {t('finance.amount', 'Amount')}
                      </TableHead>
                      <TableHead className="p-2.5 font-bold text-slate-500 text-center">
                        {t('finance.dueDate', 'Due Date')}
                      </TableHead>
                      {!isAdmin && (
                        <TableHead className="p-2.5 font-bold text-slate-500 text-center">
                          {t('finance.paidAt', 'Paid At')}
                        </TableHead>
                      )}
                      <TableHead className="p-2.5 font-bold text-slate-500 text-center">
                        {t('profile.status', 'Status')}
                      </TableHead>
                      <TableHead className="p-2.5 font-bold text-slate-500 text-end pe-4">
                        {t('common.actions', 'Actions')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow
                        key={payment.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-700/20 border-b border-slate-100 dark:border-slate-700/50"
                      >
                        {isAdmin && (
                          <TableCell className="p-2.5">
                            <div className="flex items-center gap-2.5">
                              <div className="h-8 w-8 rounded-full bg-brand-primary-50 dark:bg-brand-primary-950/50 text-brand-primary-700 dark:text-brand-primary-300 font-bold text-xs flex items-center justify-center shrink-0 border border-brand-primary-200/40">
                                {payment.student?.firstName?.[0] || 'ط'}
                                {payment.student?.lastName?.[0] || ''}
                              </div>
                              <div>
                                <div className="font-semibold text-slate-900 dark:text-white">
                                  {payment.student?.firstName} {payment.student?.lastName}
                                </div>
                                <div className="text-[10px] font-mono text-slate-400">
                                  {payment.student?.studentId}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        )}

                        <TableCell className="p-2.5 font-semibold text-slate-700 dark:text-slate-200">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-[11px]">
                            {t(`finance.${String(payment.type).toLowerCase()}`, String(payment.type))}
                          </span>
                          {payment.description && (
                            <span className="block text-[10px] text-slate-400 mt-0.5 truncate max-w-[160px]">
                              {payment.description}
                            </span>
                          )}
                        </TableCell>

                        <TableCell className="p-2.5 text-center font-mono font-black text-slate-900 dark:text-white">
                          {isRTL ? 'ج.م ' : 'EGP '}
                          {Number(payment.amount || 0).toLocaleString()}
                        </TableCell>

                        <TableCell className="p-2.5 text-center text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                          {payment.dueDate ? new Date(payment.dueDate).toLocaleDateString() : '—'}
                        </TableCell>

                        {!isAdmin && (
                          <TableCell className="p-2.5 text-center text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                            {payment.paidAt ? new Date(payment.paidAt).toLocaleDateString() : '—'}
                          </TableCell>
                        )}

                        <TableCell className="p-2.5 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              payment.status === 'PAID'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/40'
                                : payment.status === 'OVERDUE'
                                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200/40'
                                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/40'
                            }`}
                          >
                            {t(`finance.${String(payment.status).toLowerCase()}`, String(payment.status))}
                          </span>
                        </TableCell>

                        <TableCell className="p-2.5 text-end pe-4">
                          <div className="inline-flex items-center gap-1">
                            {isAdmin && payment.status !== 'PAID' && (
                              <Button
                                size="sm"
                                onClick={() => setConfirmPaymentId(payment.id)}
                                className="h-7 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold gap-1 cursor-pointer"
                                title={t('finance.markPaid', 'Mark as Paid')}
                              >
                                <CheckCircle size={12} />
                                <span>{isRTL ? 'تحصيل' : 'Pay'}</span>
                              </Button>
                            )}

                            {payment.status === 'PAID' && (
                              <button
                                onClick={() => handleDownloadReceipt(payment.id)}
                                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                                title={t('finance.downloadReceipt', 'finance.downloadReceipt')}
                              >
                                <Download size={12} />
                              </button>
                            )}

                            {isAdmin && (
                              <>
                                <button
                                  onClick={() => {
                                    setEditPayment(payment);
                                    setIsModalOpen(true);
                                  }}
                                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                                  title={t('common.edit', 'Edit')}
                                >
                                  <Pencil size={12} />
                                </button>

                                <button
                                  onClick={() => setPaymentToDelete(payment.id)}
                                  className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                                  title={t('common.delete', 'Delete')}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </>
                            )}

                            {!isAdmin && payment.status !== 'PAID' && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedPaymentForPay(payment);
                                  setPayNoticeModalOpen(true);
                                }}
                                className="h-7 px-2.5 bg-brand-primary-600 hover:bg-brand-primary-700 text-white rounded-lg text-xs font-bold gap-1 cursor-pointer"
                              >
                                <CreditCard size={12} />
                                <span>{t('finance.payNow', 'Pay Now')}</span>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. MODALS                                                                 */}
      {/* ========================================================================= */}

      {/* Add / Edit Payment Modal */}
      <AddPaymentModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditPayment(null);
        }}
        onSuccess={() => {
          setIsModalOpen(false);
          setEditPayment(null);
          fetchData(true);
          showToast(
            editPayment
              ? t('finance.updateSuccess', 'Payment updated successfully')
              : t('finance.createSuccess', 'Payment created successfully'),
            'success'
          );
        }}
        payment={editPayment}
      />

      {/* Mark As Paid Confirm Modal */}
      <ConfirmDeleteModal
        isOpen={!!confirmPaymentId}
        onClose={() => setConfirmPaymentId(null)}
        onConfirm={handleMarkAsPaid}
        title={t('finance.markAsPaidConfirm', 'Mark this payment as PAID?')}
        confirmLabel={t('finance.markPaid', 'Mark as Paid')}
      />

      {/* Delete Payment Confirm Modal */}
      <ConfirmDeleteModal
        isOpen={!!paymentToDelete}
        onClose={() => setPaymentToDelete(null)}
        onConfirm={handleDeletePayment}
        title={t('finance.deleteConfirm', 'finance.deleteConfirm')}
        confirmLabel={t('common.delete', 'Delete')}
      />

      {/* Student In-Person Payment Instructions Modal */}
      <Modal
        isOpen={payNoticeModalOpen}
        onClose={() => {
          setPayNoticeModalOpen(false);
          setSelectedPaymentForPay(null);
        }}
        title={
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-primary-50 dark:bg-brand-primary-900/30 text-brand-primary-600 dark:text-brand-primary-400 flex items-center justify-center shrink-0">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <span className="block text-sm font-bold text-slate-900 dark:text-white">
                {t('finance.inPersonPaymentTitle', 'Tuition & Fee Payment')}
              </span>
              <span className="block text-[11px] text-slate-400">
                {t('finance.inPersonPaymentSubtitle', 'In-Person University Payment Instructions')}
              </span>
            </div>
          </div>
        }
        size="sm"
      >
        <div className="space-y-4 pt-1">
          {selectedPaymentForPay && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-500 block font-medium">
                  {t('finance.type', 'Type')}:{' '}
                  {t(
                    `finance.${String(selectedPaymentForPay.type).toLowerCase()}`,
                    String(selectedPaymentForPay.type)
                  )}
                </span>
                {selectedPaymentForPay.description && (
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {selectedPaymentForPay.description}
                  </span>
                )}
              </div>
              <div className="text-end font-mono font-bold text-brand-primary-600 dark:text-brand-primary-400 text-sm">
                {isRTL ? 'ج.م ' : 'EGP '}
                {Number(selectedPaymentForPay.amount || 0).toLocaleString()}
              </div>
            </div>
          )}

          <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed text-sky-900 dark:text-sky-200">
              {t('finance.inPersonPaymentNotice', 'Online payment is not currently available. Please visit the university\'s Finance Office in person to settle your fees and receive an official receipt.')}
            </p>
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setPayNoticeModalOpen(false);
                setSelectedPaymentForPay(null);
              }}
              className="text-xs font-semibold"
            >
              {t('common.close', 'Close')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default FinanceDashboard;
