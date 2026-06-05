// FIXED: Remove mock 1,240 plans and monthly revenue; bind real payment stats API - Phase 2
import React, { useState, useEffect } from 'react';
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
  CartesianGrid
} from 'recharts';
import paymentsService from '../../services/payments.service';
import { useAuth } from '../../context/AuthContext';
import ChartTooltip from '../../components/ui/ChartTooltip';
import AddPaymentModal from './AddPaymentModal';
import ConfirmDeleteModal from '../../components/ui/ConfirmDeleteModal';
import Card from '../../components/ui/Card';
import Table, { TableRow, TableCell, ActionMenu } from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import { PageHeader } from '../../components/ui/PageHeader';
import { SkeletonKPIGrid, SkeletonTable } from '../../components/ui/Skeleton';
import { 
  DollarSign, 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  Plus, 
  Search,
  ChevronRight,
  Download,
  TrendingUp,
  CreditCard,
  History,
  LayoutDashboard
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

const FinanceDashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(user?.role);
  
  const [activeTab, setActiveTab] = useState(isAdmin ? 'OVERVIEW' : 'PAYMENTS');
  const [stats, setStats] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirmPaymentId, setConfirmPaymentId] = useState(null);

  const [filters, setFilters] = useState({
    status: 'ALL',
    type: 'ALL',
    search: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      if (isAdmin) {
        const statsRes = await paymentsService.getStats();
        if (statsRes.success) {
          setStats(statsRes.data);
        }
        
        const params = {};
        if (filters.status !== 'ALL') params.status = filters.status;
        if (filters.type !== 'ALL') params.type = filters.type;
        if (filters.search) params.search = filters.search;
        
        const paymentsRes = await paymentsService.getPayments(params);
        if (paymentsRes.success) {
          setPayments(paymentsRes.data);
        }
      } else {
        const myPaymentsRes = await paymentsService.getMyPayments();
        if (myPaymentsRes.success) {
          setPayments(myPaymentsRes.data);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filters]);

  const handleMarkAsPaid = async () => { 
    if (!confirmPaymentId) return; 
    try { 
      const result = await paymentsService.markAsPaid(confirmPaymentId); 
      if (result.success) { 
        showToast(t('finance.updateSuccess'), 'success'); 
        setConfirmPaymentId(null); 
        fetchData(); 
      } 
    } catch (err) { 
      showToast(t('finance.updateError'), 'error'); 
    } 
  }; 

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const chartData = stats
    ? Object.entries(stats.paymentsByType || {}).map(([name, value]) => ({ name, value }))
    : [];
  const COLORS = ['#8BB83C', '#132231', '#F59E0B', '#10B981'];

  const monthlyData = stats?.monthlyRevenue?.length ? stats.monthlyRevenue : [];
  const hasPayments = (stats?.totalPayments ?? payments.length) > 0;

  const studentStats = !isAdmin ? {
    totalPaid: payments.filter(p => p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0),
    totalPending: payments.filter(p => p.status === 'PENDING').reduce((sum, p) => sum + p.amount, 0),
    totalOverdue: payments.filter(p => p.status === 'OVERDUE').reduce((sum, p) => sum + p.amount, 0),
  } : null;

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
      {toast && (
        <div className={`${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
          {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
          {toast.message}
        </div>
      )}

      <PageHeader 
        title={t('finance.title')}
        subtitle={isAdmin ? t('finance.adminSubtitle') : t('finance.studentSubtitle')}
        action={isAdmin ? {
          label: t('finance.addPayment'),
          onClick: () => setIsModalOpen(true)
        } : null}
      />

      {/* === Tab Bar === */}
      {isAdmin && (
        <div className="flex items-center gap-1 p-1 bg-surface-subtle rounded-2xl w-fit border border-brand-border">
          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`tab-base ${activeTab === 'OVERVIEW' ? 'tab-active' : 'tab-inactive'}`}
          >
            <LayoutDashboard size={14} /> {t('finance.overview')}
          </button>
          <button
            onClick={() => setActiveTab('PAYMENTS')}
            className={`tab-base ${activeTab === 'PAYMENTS' ? 'tab-active' : 'tab-inactive'}`}
          >
            <History size={14} /> {t('finance.allPayments')}
          </button>
        </div>
      )}

      {/* === Overview Section === */}
      {activeTab === 'OVERVIEW' && isAdmin && !loading && !stats && (
        <Card className="p-12 text-center border-dashed">
          <AlertCircle size={40} className="mx-auto text-brand-text-muted mb-4" />
          <h3 className="text-xl font-black text-brand-text-main uppercase">{t('finance.noDataTitle', 'Unable to load finance data')}</h3>
          <p className="text-brand-text-sub font-bold mt-2">{t('finance.noDataDesc', 'Please refresh or try again later.')}</p>
        </Card>
      )}

      {activeTab === 'OVERVIEW' && isAdmin && stats && !hasPayments && (
        <Card className="p-12 text-center border-dashed mb-8">
          <DollarSign size={40} className="mx-auto text-brand-green mb-4" />
          <h3 className="text-xl font-black text-brand-text-main uppercase">{t('finance.noPaymentsYet', 'No payments yet')}</h3>
          <p className="text-brand-text-sub font-bold mt-2 max-w-md mx-auto">{t('finance.noPaymentsDesc', 'Create a payment plan to start tracking tuition and fees.')}</p>
          <Button className="mt-6" onClick={() => setIsModalOpen(true)}>
            <Plus size={18} className="mr-2" /> {t('finance.addPayment')}
          </Button>
        </Card>
      )}

      {activeTab === 'OVERVIEW' && isAdmin && stats && (
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6 gap-5">
            <Card variant="elevated" noPadding className="group overflow-hidden">
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-caption text-brand-text-secondary">{t('finance.totalCollected')}</p>
                  <div className="rounded-xl p-3 bg-brand-primary-50 text-brand-primary-500 group-hover:bg-brand-primary-500 group-hover:text-white transition-all duration-300">
                    <TrendingUp size={24} />
                  </div>
                </div>
                <h3 className="heading-display !text-3xl md:!text-4xl m-0 tracking-tightest">${Number(stats.totalCollected || 0).toLocaleString()}</h3>
              </div>
            </Card>

            <Card variant="elevated" noPadding className="group overflow-hidden">
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-caption text-brand-text-secondary">{t('finance.totalPending')}</p>
                  <div className="rounded-xl p-3 bg-brand-accent-yellow/10 text-brand-accent-yellow group-hover:bg-brand-accent-yellow group-hover:text-white transition-all duration-300">
                    <Clock size={24} />
                  </div>
                </div>
                <h3 className="heading-display !text-3xl md:!text-4xl m-0 tracking-tightest text-brand-accent-yellow">${Number(stats.totalPending || 0).toLocaleString()}</h3>
              </div>
            </Card>

            <Card variant="elevated" noPadding className="group overflow-hidden">
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-caption text-brand-text-secondary">{t('finance.totalOverdue')}</p>
                  <div className="rounded-xl p-3 bg-rose-50 text-error group-hover:bg-error group-hover:text-white transition-all duration-300">
                    <AlertCircle size={24} />
                  </div>
                </div>
                <h3 className="heading-display !text-3xl md:!text-4xl m-0 tracking-tightest text-error">${Number(stats.totalOverdue || 0).toLocaleString()}</h3>
              </div>
            </Card>

            <Card variant="elevated" noPadding className="group overflow-hidden">
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-caption text-brand-text-secondary">{t('finance.activePlans')}</p>
                  <div className="rounded-xl p-3 bg-brand-navy-50 text-brand-navy-500 group-hover:bg-brand-navy-500 group-hover:text-white transition-all duration-300">
                    <CreditCard size={24} />
                  </div>
                </div>
                <h3 className="heading-display !text-3xl md:!text-4xl m-0 tracking-tightest">{(stats.activePlans ?? 0).toLocaleString()}</h3>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-5 xl:gap-6">
            <Card variant="elevated" className="lg:col-span-2 xl:col-span-3" title={t('finance.revenueOverTime')}>
              <div className="h-[350px] mt-6">
                {monthlyData.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8">
                    <p className="text-brand-text-sub font-bold">{t('finance.noRevenueChart', 'No paid transactions yet to chart.')}</p>
                  </div>
                ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fontSize: 10, fontWeight: 900, fill: '#94A3B8'}} 
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fontSize: 10, fontWeight: 900, fill: '#94A3B8'}} 
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{fill: 'var(--surface-subtle)'}} />
                    <Bar dataKey="amount" fill="#8BB83C" radius={[12, 12, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
                )}
              </div>
            </Card>

            <Card variant="elevated" title={t('finance.revenueByType')}>
              <div className="h-[350px] mt-6 flex items-center">
                {chartData.length === 0 ? (
                  <p className="w-full text-center text-brand-text-sub font-bold">{t('finance.noPaymentsYet', 'No payments yet')}</p>
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
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em'}} />
                  </PieChart>
                </ResponsiveContainer>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* === Payments Section === */}
      {(!isAdmin || activeTab === 'PAYMENTS') && (
        <Card variant="default" noPadding>
          <div className="px-6 py-4 border-b border-brand-border flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-surface-subtle/50">
            <div className="flex items-center gap-4 flex-grow">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text-muted" />
                <Input 
                  placeholder={t('finance.searchPayments')} 
                  className="pl-10 h-10 w-full bg-brand-bg-card"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                />
              </div>
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <select
                    className="select-brand h-10"
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  >
                    <option value="ALL">{t('finance.allStatuses')}</option>
                    <option value="PAID">{t('finance.paid')}</option>
                    <option value="PENDING">{t('finance.pending')}</option>
                    <option value="OVERDUE">{t('finance.overdue')}</option>
                  </select>
                  <select
                    className="select-brand h-10"
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
              <div className="flex items-center gap-6">
                <div className="text-end">
                  <p className="text-caption text-brand-text-muted">{t('finance.totalDues')}</p>
                  <p className="text-xl font-black text-error">${(studentStats.totalPending + studentStats.totalOverdue).toLocaleString()}</p>
                </div>
                <div className="h-10 w-px bg-brand-border"></div>
                <div className="text-end">
                  <p className="text-caption text-brand-text-muted">{t('finance.paidSoFar')}</p>
                  <p className="text-xl font-black text-brand-primary-500">${studentStats.totalPaid.toLocaleString()}</p>
                </div>
              </div>
            )}
          </div>

          <div className="min-h-[400px]">
            {payments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="h-16 w-16 rounded-full bg-surface-subtle flex items-center justify-center mb-4 border border-brand-border">
                  <History size={32} className="text-brand-text-muted" />
                </div>
                <p className="text-lg font-bold text-brand-text-main">{t('finance.noPayments')}</p>
                <p className="text-sm text-brand-text-sub max-w-xs mx-auto mt-1">{t('finance.noPaymentsDesc')}</p>
              </div>
            ) : (
              <Table headers={
                isAdmin 
                  ? [t('students.fullName'), t('finance.amount'), t('finance.type'), t('finance.dueDate'), t('profile.status'), t('common.actions')]
                  : [t('finance.type'), t('finance.amount'), t('finance.dueDate'), t('finance.paidAt'), t('profile.status'), t('common.actions')]
              }>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    {isAdmin && (
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-brand-navy/10 flex items-center justify-center text-brand-navy font-bold text-xs border border-brand-navy/10 shrink-0">
                            {payment.student?.firstName?.[0]}{payment.student?.lastName?.[0]}
                          </div>
                          <div>
                            <p className="font-bold text-brand-text-main">{payment.student?.firstName} {payment.student?.lastName}</p>
                            <p className="text-caption text-brand-text-muted">{payment.student?.studentId}</p>
                          </div>
                        </div>
                      </TableCell>
                    )}
                    {!isAdmin && (
                      <TableCell className="font-bold text-brand-text-main">{t(`finance.${payment.type.toLowerCase()}`)}</TableCell>
                    )}
                    <TableCell className="font-black text-brand-text-main">${payment.amount.toLocaleString()}</TableCell>
                    {isAdmin && (
                      <TableCell>
                        <Badge variant="info" className="font-bold">{t(`finance.${payment.type.toLowerCase()}`)}</Badge>
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
                      <Badge variant={
                        payment.status === 'PAID' ? 'success' : 
                        payment.status === 'OVERDUE' ? 'danger' : 'warning'
                      } className="px-3 py-1 font-bold">
                        {t(`finance.${payment.status.toLowerCase()}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <ActionMenu actions={[
                      ...(isAdmin && payment.status !== 'PAID' ? [{ label: t('finance.markPaid'), icon: CheckCircle, variant: 'edit', onClick: () => setConfirmPaymentId(payment.id) }] : []),
                      ...(!isAdmin && payment.status !== 'PAID' ? [{ label: t('finance.payNow'), icon: CreditCard, variant: 'default', onClick: () => {} }] : []),
                      { label: 'Download Receipt', icon: Download, variant: 'default', onClick: () => {} },
                    ]} />
                    </TableCell>
                  </TableRow>
                ))}
              </Table>
            )}
          </div>
        </Card>
      )}

      <AddPaymentModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          setIsModalOpen(false);
          fetchData();
          showToast(t('finance.createSuccess'), 'success');
        }}
      />

      <ConfirmDeleteModal 
        isOpen={!!confirmPaymentId} 
        onClose={() => setConfirmPaymentId(null)} 
        onConfirm={handleMarkAsPaid} 
        title={t('finance.markAsPaidConfirm')} 
        confirmLabel={t('finance.markPaid')} 
      />
    </div>
  );
};

export default FinanceDashboard;
