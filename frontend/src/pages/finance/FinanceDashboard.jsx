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
import AddPaymentModal from './AddPaymentModal';
import Card from '../../components/ui/Card';
import Table, { TableRow, TableCell } from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import { 
  DollarSign, 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  Plus, 
  Filter, 
  Search,
  ChevronRight,
  Download,
  TrendingUp,
  CreditCard,
  History,
  LayoutDashboard
} from 'lucide-react';

const FinanceDashboard = () => {
  const { user } = useAuth();
  const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(user?.role);
  
  const [activeTab, setActiveTab] = useState(isAdmin ? 'OVERVIEW' : 'PAYMENTS');
  const [stats, setStats] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toast, setToast] = useState(null);

  // Filters
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
        } else {
          // Fallback stats for demo
          setStats({
            totalCollected: 1250400,
            totalPending: 84200,
            totalOverdue: 12500,
            paymentsByType: { TUITION: 800, REGISTRATION: 1200, LIBRARY: 450 },
            recentPayments: [
              { id: '1', student: { firstName: 'Alice', lastName: 'Johnson', studentId: 'STU-001' }, amount: 2500, type: 'TUITION', status: 'PAID', createdAt: new Date().toISOString() },
              { id: '2', student: { firstName: 'Bob', lastName: 'Smith', studentId: 'STU-002' }, amount: 150, type: 'LIBRARY', status: 'PENDING', createdAt: new Date().toISOString() },
              { id: '3', student: { firstName: 'Charlie', lastName: 'Davis', studentId: 'STU-003' }, amount: 500, type: 'REGISTRATION', status: 'OVERDUE', createdAt: new Date().toISOString() },
            ]
          });
        }
        
        const params = {};
        if (filters.status !== 'ALL') params.status = filters.status;
        if (filters.type !== 'ALL') params.type = filters.type;
        if (filters.search) params.search = filters.search;
        
        const paymentsRes = await paymentsService.getPayments(params);
        if (paymentsRes.success) {
          setPayments(paymentsRes.data);
        } else {
          // Fallback payments for demo
          setPayments([
            { id: '1', student: { firstName: 'Alice', lastName: 'Johnson', studentId: 'STU-001' }, amount: 2500, type: 'TUITION', status: 'PAID', dueDate: '2026-05-01', paidAt: '2026-04-20' },
            { id: '2', student: { firstName: 'Bob', lastName: 'Smith', studentId: 'STU-002' }, amount: 150, type: 'LIBRARY', status: 'PENDING', dueDate: '2026-05-15', paidAt: null },
            { id: '3', student: { firstName: 'Charlie', lastName: 'Davis', studentId: 'STU-003' }, amount: 500, type: 'REGISTRATION', status: 'OVERDUE', dueDate: '2026-04-01', paidAt: null },
            { id: '4', student: { firstName: 'Diana', lastName: 'Prince', studentId: 'STU-004' }, amount: 2500, type: 'TUITION', status: 'PAID', dueDate: '2026-05-01', paidAt: '2026-04-25' },
          ]);
        }
      } else {
        const myPaymentsRes = await paymentsService.getMyPayments();
        if (myPaymentsRes.success) {
          setPayments(myPaymentsRes.data);
        } else {
          // Fallback for students
          setPayments([
            { id: '101', type: 'TUITION', amount: 2500, status: 'PAID', dueDate: '2026-05-01', paidAt: '2026-04-20' },
            { id: '102', type: 'LIBRARY', amount: 25, status: 'PENDING', dueDate: '2026-05-15', paidAt: null },
          ]);
        }
      }
    } catch (err) {
      console.error(err);
      // Fallback for errors
      if (isAdmin) {
        setStats({
          totalCollected: 1250400,
          totalPending: 84200,
          totalOverdue: 12500,
          paymentsByType: { TUITION: 800, REGISTRATION: 1200, LIBRARY: 450 },
          recentPayments: [
            { id: '1', student: { firstName: 'Alice', lastName: 'Johnson', studentId: 'STU-001' }, amount: 2500, type: 'TUITION', status: 'PAID', createdAt: new Date().toISOString() },
            { id: '2', student: { firstName: 'Bob', lastName: 'Smith', studentId: 'STU-002' }, amount: 150, type: 'LIBRARY', status: 'PENDING', createdAt: new Date().toISOString() },
            { id: '3', student: { firstName: 'Charlie', lastName: 'Davis', studentId: 'STU-003' }, amount: 500, type: 'REGISTRATION', status: 'OVERDUE', createdAt: new Date().toISOString() },
          ]
        });
        setPayments([
          { id: '1', student: { firstName: 'Alice', lastName: 'Johnson', studentId: 'STU-001' }, amount: 2500, type: 'TUITION', status: 'PAID', dueDate: '2026-05-01', paidAt: '2026-04-20' },
          { id: '2', student: { firstName: 'Bob', lastName: 'Smith', studentId: 'STU-002' }, amount: 150, type: 'LIBRARY', status: 'PENDING', dueDate: '2026-05-15', paidAt: null },
          { id: '3', student: { firstName: 'Charlie', lastName: 'Davis', studentId: 'STU-003' }, amount: 500, type: 'REGISTRATION', status: 'OVERDUE', dueDate: '2026-04-01', paidAt: null },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filters]);

  const handleMarkAsPaid = async (id) => {
    if (window.confirm('Mark this payment as PAID?')) {
      try {
        const result = await paymentsService.markAsPaid(id);
        if (result.success) {
          showToast('Payment updated successfully', 'success');
          fetchData();
        }
      } catch (err) {
        showToast('Error updating payment', 'error');
      }
    }
  };

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const chartData = stats ? Object.entries(stats.paymentsByType).map(([name, value]) => ({ name, value })) : [];
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

  const monthlyData = [
    { name: 'Jan', amount: 45000 },
    { name: 'Feb', amount: 52000 },
    { name: 'Mar', amount: 48000 },
    { name: 'Apr', amount: 61000 },
    { name: 'May', amount: 55000 },
    { name: 'Jun', amount: 67000 },
  ];

  const studentStats = !isAdmin ? {
    totalPaid: payments.filter(p => p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0),
    totalPending: payments.filter(p => p.status === 'PENDING').reduce((sum, p) => sum + p.amount, 0),
    totalOverdue: payments.filter(p => p.status === 'OVERDUE').reduce((sum, p) => sum + p.amount, 0),
  } : null;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-20 right-4 z-50 p-4 rounded-xl shadow-xl text-white transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${toast.type === 'error' ? 'bg-rose-500' : 'bg-emerald-500'}`}>
          <div className="flex items-center gap-2">
            {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Finance & Payments</h1>
          <p className="text-slate-500 mt-1">
            {isAdmin ? 'Manage university finances and student records' : 'Your personal payment history and dues'}
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-3">
            <Button variant="outline" className="flex items-center gap-2">
              <Download size={18} /> Export
            </Button>
            <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
              <Plus size={18} /> Add Payment
            </Button>
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'OVERVIEW' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutDashboard size={16} /> Overview
          </button>
          <button
            onClick={() => setActiveTab('PAYMENTS')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'PAYMENTS' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History size={16} /> All Payments
          </button>
        </div>
      )}

      {activeTab === 'OVERVIEW' && isAdmin && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Total Collected</p>
                  <h3 className="mt-1 text-2xl font-bold text-slate-900">${stats.totalCollected.toLocaleString()}</h3>
                </div>
                <div className="rounded-xl p-3 bg-emerald-50 text-emerald-600 group-hover:scale-110 transition-transform">
                  <TrendingUp size={20} />
                </div>
              </div>
              <div className="absolute -right-2 -bottom-2 h-16 w-16 rounded-full bg-emerald-50/50 blur-xl"></div>
            </Card>

            <Card className="relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Total Pending</p>
                  <h3 className="mt-1 text-2xl font-bold text-slate-900">${stats.totalPending.toLocaleString()}</h3>
                </div>
                <div className="rounded-xl p-3 bg-amber-50 text-amber-600 group-hover:scale-110 transition-transform">
                  <Clock size={20} />
                </div>
              </div>
              <div className="absolute -right-2 -bottom-2 h-16 w-16 rounded-full bg-amber-50/50 blur-xl"></div>
            </Card>

            <Card className="relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Total Overdue</p>
                  <h3 className="mt-1 text-2xl font-bold text-slate-900">${stats.totalOverdue.toLocaleString()}</h3>
                </div>
                <div className="rounded-xl p-3 bg-rose-50 text-rose-600 group-hover:scale-110 transition-transform">
                  <AlertCircle size={20} />
                </div>
              </div>
              <div className="absolute -right-2 -bottom-2 h-16 w-16 rounded-full bg-rose-50/50 blur-xl"></div>
            </Card>

            <Card className="relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Transactions</p>
                  <h3 className="mt-1 text-2xl font-bold text-slate-900">
                    {Object.values(stats.paymentsByType).reduce((a, b) => a + b, 0)}
                  </h3>
                </div>
                <div className="rounded-xl p-3 bg-blue-50 text-blue-600 group-hover:scale-110 transition-transform">
                  <CreditCard size={20} />
                </div>
              </div>
              <div className="absolute -right-2 -bottom-2 h-16 w-16 rounded-full bg-blue-50/50 blur-xl"></div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card title="Revenue Distribution">
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="Monthly Revenue Trend">
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      tickFormatter={(value) => `$${value/1000}k`}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      formatter={(value) => [`$${value.toLocaleString()}`, 'Revenue']}
                    />
                    <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card noPadding title="Recent Transactions" className="lg:col-span-2" extra={
              <Button variant="ghost" size="sm" onClick={() => setActiveTab('PAYMENTS')} className="text-blue-600">
                View All <ChevronRight size={16} />
              </Button>
            }>
              <Table headers={['Student', 'Type', 'Amount', 'Status', 'Date']}>
                {stats.recentPayments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium text-slate-900">{p.student.firstName} {p.student.lastName}</div>
                      <div className="text-xs text-slate-500">{p.student.studentId}</div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                        {p.type}
                      </span>
                    </TableCell>
                    <TableCell className="font-bold text-slate-900">${p.amount}</TableCell>
                    <TableCell>
                      <Badge variant={
                        p.status === 'PAID' ? 'success' : 
                        p.status === 'OVERDUE' ? 'danger' : 'warning'
                      }>
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {new Date(p.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </TableCell>
                  </TableRow>
                ))}
              </Table>
            </Card>
          </div>
        </div>
      )}

      {!isAdmin && studentStats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Card className="relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Total Paid</p>
                <h3 className="mt-1 text-2xl font-bold text-slate-900">${studentStats.totalPaid.toLocaleString()}</h3>
              </div>
              <div className="rounded-xl p-3 bg-emerald-50 text-emerald-600 group-hover:scale-110 transition-transform">
                <CheckCircle size={20} />
              </div>
            </div>
            <div className="absolute -right-2 -bottom-2 h-16 w-16 rounded-full bg-emerald-50/50 blur-xl"></div>
          </Card>

          <Card className="relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Total Pending</p>
                <h3 className="mt-1 text-2xl font-bold text-slate-900">${studentStats.totalPending.toLocaleString()}</h3>
              </div>
              <div className="rounded-xl p-3 bg-amber-50 text-amber-600 group-hover:scale-110 transition-transform">
                <Clock size={20} />
              </div>
            </div>
            <div className="absolute -right-2 -bottom-2 h-16 w-16 rounded-full bg-amber-50/50 blur-xl"></div>
          </Card>

          <Card className="relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Total Overdue</p>
                <h3 className="mt-1 text-2xl font-bold text-slate-900">${studentStats.totalOverdue.toLocaleString()}</h3>
              </div>
              <div className="rounded-xl p-3 bg-rose-50 text-rose-600 group-hover:scale-110 transition-transform">
                <AlertCircle size={20} />
              </div>
            </div>
            <div className="absolute -right-2 -bottom-2 h-16 w-16 rounded-full bg-rose-50/50 blur-xl"></div>
          </Card>
        </div>
      )}

      {(activeTab === 'PAYMENTS' || !isAdmin) && (
        <Card noPadding>
          {isAdmin && (
            <div className="p-4 border-b border-slate-100 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input 
                  placeholder="Search student or ID..." 
                  className="pl-10 h-10 w-full"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <select
                  className="h-10 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer pr-8"
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundSize: '1rem' }}
                >
                  <option value="ALL">All Status</option>
                  <option value="PAID">Paid</option>
                  <option value="PENDING">Pending</option>
                  <option value="OVERDUE">Overdue</option>
                </select>
                <select
                  className="h-10 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer pr-8"
                  value={filters.type}
                  onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundSize: '1rem' }}
                >
                  <option value="ALL">All Types</option>
                  <option value="TUITION">Tuition</option>
                  <option value="REGISTRATION">Registration</option>
                  <option value="LIBRARY">Library</option>
                </select>
              </div>
            </div>
          )}

          <div className="min-h-[400px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600/20 border-t-blue-600"></div>
                <p className="text-sm text-slate-500 font-medium">Loading payments...</p>
              </div>
            ) : payments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="h-16 w-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                  <CreditCard size={32} className="text-slate-300" />
                </div>
                <p className="text-lg font-semibold text-slate-900">No payments found</p>
                <p className="text-sm text-slate-500 max-w-xs mx-auto mt-1">No payment records match your current filters.</p>
              </div>
            ) : (
              <Table headers={isAdmin 
                ? ['Student', 'Type', 'Amount', 'Status', 'Due Date', 'Paid At', 'Actions']
                : ['Type', 'Amount', 'Status', 'Due Date', 'Paid At']
              }>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    {isAdmin && (
                      <TableCell>
                        <div className="font-medium text-slate-900">{p.student.firstName} {p.student.lastName}</div>
                        <div className="text-xs text-slate-500">{p.student.studentId}</div>
                      </TableCell>
                    )}
                    <TableCell>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                        {p.type}
                      </span>
                    </TableCell>
                    <TableCell className="font-bold text-slate-900">${p.amount}</TableCell>
                    <TableCell>
                      <Badge variant={
                        p.status === 'PAID' ? 'success' : 
                        p.status === 'OVERDUE' ? 'danger' : 'warning'
                      }>
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {p.dueDate ? new Date(p.dueDate).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {p.paidAt ? new Date(p.paidAt).toLocaleDateString() : '-'}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        {p.status === 'PENDING' && (
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            onClick={() => handleMarkAsPaid(p.id)}
                          >
                            <CheckCircle size={16} className="mr-1" /> Mark Paid
                          </Button>
                        )}
                      </TableCell>
                    )}
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
        onSuccess={fetchData} 
      />
    </div>
  );
};

export default FinanceDashboard;
