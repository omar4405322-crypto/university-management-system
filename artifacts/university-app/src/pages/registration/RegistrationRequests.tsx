// @ts-nocheck
import React, { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { ClipboardList, Eye, Check, X, AlertCircle, Search } from 'lucide-react';
import registrationService from '../../services/registration.service';
import { useTranslation } from 'react-i18next';
import Modal from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { logger } from '../../lib/logger';
import { useToast } from '../../context/ToastContext';
import { useNotifications } from '../../context/NotificationContext';

// TEMP MOCK DATA — remove after review
const MOCK_REGISTRATION_REQUESTS = [
  {
    id: 'req_101',
    firstName: 'أحمد',
    lastName: 'محمود',
    email: 'ahmed.mahmoud@university.edu.eg',
    phone: '01012345678',
    role: 'STUDENT',
    year: '1',
    status: 'PENDING',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    department: {
      name: 'هندسة البرمجيات',
      college: {
        name: 'كلية الهندسة'
      }
    }
  },
  {
    id: 'req_102',
    firstName: 'سارة',
    lastName: 'علي',
    email: 'sara.ali@university.edu.eg',
    phone: '01198765432',
    role: 'STUDENT',
    year: '2',
    status: 'APPROVED',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    department: {
      name: 'علوم الحاسب',
      college: {
        name: 'كلية الحاسبات والمعلومات'
      }
    }
  },
  {
    id: 'req_103',
    firstName: 'محمد',
    lastName: 'عمر',
    email: 'mohamed.omar@university.edu.eg',
    phone: '01234567890',
    role: 'STUDENT',
    year: '3',
    status: 'REJECTED',
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    department: {
      name: 'نظم المعلومات',
      college: {
        name: 'كلية الحاسبات والمعلومات'
      }
    }
  },
  {
    id: 'req_104',
    firstName: 'فاطمة',
    lastName: 'حسن',
    email: 'fatma.hasan@university.edu.eg',
    phone: '01511112222',
    role: 'STUDENT',
    year: '1',
    status: 'PENDING',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    department: {
      name: 'الهندسة الطبية',
      college: {
        name: 'كلية الهندسة'
      }
    }
  },
  {
    id: 'req_105',
    firstName: 'محمود',
    lastName: 'سليم',
    email: 'mahmoud.selim@university.edu.eg',
    phone: '01099998888',
    role: 'STUDENT',
    year: '4',
    status: 'APPROVED',
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    department: {
      name: 'إدارة الأعمال',
      college: {
        name: 'كلية التجارة'
      }
    }
  }
];

const RegistrationRequests = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { showToast } = useToast();
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [usingMockData, setUsingMockData] = useState(false);
  const { fetchPendingRequestsCount } = useNotifications();

  useEffect(() => {
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.classList.add('bg-slate-50', 'dark:bg-slate-900');
      return () => {
        mainEl.classList.remove('bg-slate-50', 'dark:bg-slate-900');
      };
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const result = await registrationService.getRequests();
      if (result.success) {
        if (result.data && result.data.length > 0) {
          setRequests(result.data);
          setUsingMockData(false);
        } else {
          setRequests(MOCK_REGISTRATION_REQUESTS);
          setUsingMockData(true);
        }
      } else {
        setRequests(MOCK_REGISTRATION_REQUESTS);
        setUsingMockData(true);
      }
    } catch (error: any) {
      logger.error('Error fetching requests:', error);
      showToast(t('common.errorFetching'), 'error');
      setRequests(MOCK_REGISTRATION_REQUESTS);
      setUsingMockData(true);
    } finally {
      setLoading(false);
      // Synchronize the top header notification badge count
      fetchPendingRequestsCount();
    }
  };

  const handleApprove = async (id) => {
    if (usingMockData) {
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'APPROVED' } : r))
      );
      showToast(t('registration.approveSuccess'), 'success');
      setTimeout(fetchPendingRequestsCount, 0);
      return;
    }

    try {
      const result = await registrationService.approveRequest(id);
      if (result.success) {
        showToast(t('registration.approveSuccess'), 'success');
        fetchRequests();
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || t('registration.approveError'), 'error');
    }
  };

  const handleReject = async (id) => {
    if (window.confirm(t('registration.rejectConfirm'))) {
      if (usingMockData) {
        setRequests((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status: 'REJECTED' } : r))
        );
        showToast(t('registration.rejectSuccess'), 'success');
        setTimeout(fetchPendingRequestsCount, 0);
        return;
      }

      try {
        const result = await registrationService.rejectRequest(id);
        if (result.success) {
          showToast(t('registration.rejectSuccess'), 'success');
          fetchRequests();
        }
      } catch (error: any) {
        showToast(error.response?.data?.message || t('registration.rejectError'), 'error');
      }
    }
  };

  const handleView = (req) => {
    setSelectedRequest(req);
    setIsDetailsModalOpen(true);
  };

  const filteredRequests = requests
    .filter(
      (req) =>
        req.firstName?.toLowerCase().includes(search.toLowerCase()) ||
        req.lastName?.toLowerCase().includes(search.toLowerCase()) ||
        req.email?.toLowerCase().includes(search.toLowerCase())
    )
    .filter(
      (req) => statusFilter === 'ALL' || req.status === statusFilter
    );

  const getStatusBadge = (status) => {
    switch (status) {
      case 'APPROVED':
        return {
          variant: 'outline',
          className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-transparent rounded-full px-3 py-1 text-xs font-semibold'
        };
      case 'PENDING':
        return {
          variant: 'outline',
          className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-transparent rounded-full px-3 py-1 text-xs font-semibold'
        };
      case 'REJECTED':
        return {
          variant: 'outline',
          className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-transparent rounded-full px-3 py-1 text-xs font-semibold'
        };
      default:
        return { variant: 'default', className: '' };
    }
  };

  return (
    <div className="section-gap animate-page pt-6">
      <PageHeader 
        title={
          <div className="flex items-center gap-3">
            <span>{t('registration.title')}</span>
            {requests.filter((r) => r.status === 'PENDING').length > 0 && (
              <span className="inline-flex items-center justify-center bg-red-500 text-white text-base font-extrabold rounded-full px-2.5 py-0.5 animate-pulse shadow-sm">
                {requests.filter((r) => r.status === 'PENDING').length}
              </span>
            )}
          </div>
        } 
        subtitle={<span className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed block mt-1">{t('registration.subtitle')}</span>} 
      />

      {/* Filter and Search Card */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Search Bar */}
        <div className="relative w-full md:max-w-xs group">
          <Search
            className="absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within:text-brand-primary-500 transition-colors"
            size={16}
          />
          <input
            type="text"
            placeholder={t('registration.searchPlaceholder')}
            className="w-full ps-10 pe-4 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute end-3 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-350 transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1 md:pb-0 flex-nowrap [&>*]:flex-shrink-0">
          {/* ALL */}
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`inline-flex items-center gap-2 transition-all select-none cursor-pointer focus:outline-none ${
              statusFilter === 'ALL'
                ? 'bg-brand-primary-500 text-white rounded-full px-4 py-1.5 text-sm font-medium'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 rounded-full px-4 py-1.5 text-sm font-medium hover:bg-slate-200'
            }`}
          >
            <span>{t('common.all')}</span>
            <span
              className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-xs font-bold rounded-full transition-colors ${
                statusFilter === 'ALL'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-200 text-slate-650 dark:bg-slate-650 dark:text-slate-300'
              }`}
            >
              {requests.length}
            </span>
          </button>

          {/* PENDING */}
          <button
            onClick={() => setStatusFilter('PENDING')}
            className={`inline-flex items-center gap-2 transition-all select-none cursor-pointer focus:outline-none ${
              statusFilter === 'PENDING'
                ? 'bg-brand-primary-500 text-white rounded-full px-4 py-1.5 text-sm font-medium'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 rounded-full px-4 py-1.5 text-sm font-medium hover:bg-slate-200'
            }`}
          >
            <span>{t('common.pending')}</span>
            <span
              className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-xs font-bold rounded-full transition-colors ${
                statusFilter === 'PENDING'
                  ? 'bg-red-500 text-white'
                  : 'bg-red-100 text-red-650 dark:bg-red-950/40 dark:text-red-400'
              }`}
            >
              {requests.filter((r) => r.status === 'PENDING').length}
            </span>
          </button>

          {/* APPROVED */}
          <button
            onClick={() => setStatusFilter('APPROVED')}
            className={`inline-flex items-center gap-2 transition-all select-none cursor-pointer focus:outline-none ${
              statusFilter === 'APPROVED'
                ? 'bg-brand-primary-500 text-white rounded-full px-4 py-1.5 text-sm font-medium'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 rounded-full px-4 py-1.5 text-sm font-medium hover:bg-slate-200'
            }`}
          >
            <span>{t('common.approved')}</span>
            <span
              className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-xs font-bold rounded-full transition-colors ${
                statusFilter === 'APPROVED'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-200 text-slate-650 dark:bg-slate-650 dark:text-slate-300'
              }`}
            >
              {requests.filter((r) => r.status === 'APPROVED').length}
            </span>
          </button>

          {/* REJECTED */}
          <button
            onClick={() => setStatusFilter('REJECTED')}
            className={`inline-flex items-center gap-2 transition-all select-none cursor-pointer focus:outline-none ${
              statusFilter === 'REJECTED'
                ? 'bg-brand-primary-500 text-white rounded-full px-4 py-1.5 text-sm font-medium'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 rounded-full px-4 py-1.5 text-sm font-medium hover:bg-slate-200'
            }`}
          >
            <span>{t('common.rejected')}</span>
            <span
              className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-xs font-bold rounded-full transition-colors ${
                statusFilter === 'REJECTED'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-200 text-slate-650 dark:bg-slate-650 dark:text-slate-300'
              }`}
            >
              {requests.filter((r) => r.status === 'REJECTED').length}
            </span>
          </button>
        </div>
      </div>

      {/* Preview Alert Banner */}
      {usingMockData && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-center justify-between text-sm font-medium text-amber-800 dark:text-amber-300 gap-3">
          <span className="flex items-center gap-2">
            <AlertCircle size={18} className="text-amber-500 dark:text-amber-400 shrink-0" />
            <span>{isRTL ? 'عرض بيانات تجريبية للمعاينة وتجربة الإجراءات' : 'Displaying preview data for design review and interactive testing.'}</span>
          </span>
          <button
            onClick={() => {
              setRequests([]);
              setUsingMockData(false);
            }}
            className="underline hover:text-amber-900 dark:hover:text-amber-200 transition-all font-bold cursor-pointer"
          >
            {isRTL ? 'إخفاء المعاينة' : 'Hide Preview'}
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand-primary-600/20 border-t-brand-primary-600"></div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{t('common.loading')}</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm">
            <EmptyState
              icon={<ClipboardList size={40} className="text-slate-400 dark:text-slate-500" />}
              title={t('registration.noRequests')}
              subtitle={t('registration.noRequestsDesc')}
            />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom duration-300">
              {filteredRequests.map((req) => (
                <Card
                  key={req.id}
                  noPadding
                  className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between"
                >
                  {/* Top Row: Request ID & Status Badge */}
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <span className="text-xs text-slate-400 font-mono">#{req.id}</span>
                    <Badge
                      className={getStatusBadge(req.status).className}
                      variant={getStatusBadge(req.status).variant}
                    >
                      {t(`common.${req.status.toLowerCase()}`)}
                    </Badge>
                  </div>

                  {/* Name & Email */}
                  <div className="mb-4 text-start">
                    <h4 className="text-lg font-bold text-slate-800 dark:text-white leading-tight">
                      {req.firstName} {req.lastName}
                    </h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">{req.email}</p>
                  </div>

                  {/* Info Grid (2-column) */}
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-700/60 mb-5 text-start">
                    <div className="min-w-0">
                      <span className="text-xs text-slate-400 uppercase tracking-wide block">
                        {t('auth.college')}
                      </span>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200 block mt-1 truncate" title={req.department?.college?.name || 'N/A'}>
                        {req.department?.college?.name || 'N/A'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs text-slate-400 uppercase tracking-wide block">
                        {t('auth.department')}
                      </span>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200 block mt-1 truncate" title={req.department?.name || 'N/A'}>
                        {req.department?.name || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 uppercase tracking-wide block">
                        {t('registration.appliedDate')}
                      </span>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200 block mt-1">
                        {new Date(req.createdAt).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US')}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 uppercase tracking-wide block mb-1">
                        {t('auth.role')}
                      </span>
                      <Badge
                        variant="outline"
                        className="bg-brand-primary-500/10 text-brand-primary-600 dark:text-brand-primary-400 border-transparent rounded-full px-2 py-0.5 text-xs font-medium"
                      >
                        {req.role}
                      </Badge>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end gap-2 mt-auto pt-4 border-t border-slate-100 dark:border-slate-700/60 w-full">
                    <button
                      onClick={() => handleView(req)}
                      className="flex-1 flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl px-4 py-2 text-sm font-medium transition-all cursor-pointer"
                    >
                      <Eye size={15} />
                      <span>{t('common.view')}</span>
                    </button>

                    {req.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => handleReject(req.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-red-500 hover:bg-red-600 text-white rounded-xl px-4 py-2 text-sm font-medium active:scale-95 transition-all cursor-pointer"
                        >
                          <X size={15} />
                          <span>{t('common.reject')}</span>
                        </button>
                        <button
                          onClick={() => handleApprove(req.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-brand-primary-500 hover:bg-brand-primary-600 text-white rounded-xl px-4 py-2 text-sm font-medium active:scale-95 transition-all cursor-pointer"
                        >
                          <Check size={15} />
                          <span>{t('common.approve')}</span>
                        </button>
                      </>
                    )}
                  </div>
                </Card>
              ))}
            </div>

            {/* Pagination / Count Separator Row */}
            <div className="border-t border-slate-100 dark:border-slate-700 pt-4 mt-4 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {isRTL ? (
                  <>
                    عرض <span className="text-brand-primary-500 font-extrabold">{filteredRequests.length}</span> من{' '}
                    <span className="text-brand-primary-500 font-extrabold">{requests.length}</span> طلبات تسجيل
                  </>
                ) : (
                  <>
                    Showing <span className="text-brand-primary-500 font-extrabold">{filteredRequests.length}</span> of{' '}
                    <span className="text-brand-primary-500 font-extrabold">{requests.length}</span> registration requests
                  </>
                )}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Details Modal */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        title={t('registration.requestDetails')}
      >
        {selectedRequest && (
          <div className="space-y-6">
            {/* Profile Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-700/60">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-brand-primary-500/10 text-brand-primary-600 dark:text-brand-primary-400 font-bold text-xl flex items-center justify-center border border-brand-primary-500/25 shrink-0">
                  {selectedRequest.firstName?.[0] || 'U'}
                </div>
                <div className="text-start">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white leading-tight mb-1">
                    {selectedRequest.firstName} {selectedRequest.lastName}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{selectedRequest.email}</p>
                </div>
              </div>
              <div>
                <Badge
                  className={getStatusBadge(selectedRequest.status).className}
                  variant={getStatusBadge(selectedRequest.status).variant}
                >
                  {t(`common.${selectedRequest.status.toLowerCase()}`)}
                </Badge>
              </div>
            </div>

            {/* Grid Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-start">
              {/* Personal Info */}
              <div className="p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-4">
                <h4 className="text-xs font-bold text-brand-primary-600 dark:text-brand-primary-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700/60 pb-2">
                  {t('profile.personalInfo', 'البيانات الشخصية')}
                </h4>
                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-slate-400 uppercase tracking-wide block">
                      {t('auth.email')}
                    </span>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200 block mt-1 break-all">
                      {selectedRequest.email}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 uppercase tracking-wide block">
                      {t('profile.phone')}
                    </span>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200 block mt-1">
                      {selectedRequest.phone || t('students.phoneNotSpecified')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Academic Info */}
              <div className="p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-4">
                <h4 className="text-xs font-bold text-brand-primary-600 dark:text-brand-primary-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700/60 pb-2">
                  {t('registration.academicInfo', 'البيانات الأكاديمية')}
                </h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <div>
                    <span className="text-xs text-slate-400 uppercase tracking-wide block">
                      {t('auth.role')}
                    </span>
                    <div className="mt-1">
                      <Badge variant="outline" className="bg-brand-primary-500/10 text-brand-primary-600 dark:text-brand-primary-400 border-transparent rounded-full px-2 py-0.5 text-xs font-medium">
                        {selectedRequest.role}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 uppercase tracking-wide block">
                      {t('registration.appliedDate')}
                    </span>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200 block mt-1">
                      {new Date(selectedRequest.createdAt).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US')}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs text-slate-400 uppercase tracking-wide block">
                      {t('auth.college')}
                    </span>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200 block mt-1">
                      {selectedRequest.department?.college?.name || 'N/A'}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs text-slate-400 uppercase tracking-wide block">
                      {t('auth.department')}
                    </span>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200 block mt-1">
                      {selectedRequest.department?.name || 'N/A'}
                    </span>
                  </div>
                  {selectedRequest.role === 'STUDENT' && (
                    <>
                      <div>
                        <span className="text-xs text-slate-400 uppercase tracking-wide block">
                          {t('auth.studentId')}
                        </span>
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200 block mt-1">
                          {selectedRequest.studentId || 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs text-slate-400 uppercase tracking-wide block">
                          {t('auth.year')}
                        </span>
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200 block mt-1">
                          {t(`auth.year${selectedRequest.year}`)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {selectedRequest.status === 'PENDING' && (
              <div className="flex justify-end gap-3 pt-5 border-t border-slate-100 dark:border-slate-700">
                <button
                  onClick={() => {
                    handleReject(selectedRequest.id);
                    setIsDetailsModalOpen(false);
                  }}
                  className="bg-red-500 hover:bg-red-600 text-white font-medium px-6 py-2.5 rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer text-sm"
                >
                  {t('common.reject')}
                </button>
                <button
                  onClick={() => {
                    handleApprove(selectedRequest.id);
                    setIsDetailsModalOpen(false);
                  }}
                  className="bg-brand-primary-500 hover:bg-brand-primary-600 text-white font-medium px-6 py-2.5 rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer text-sm"
                >
                  {t('common.approve')}
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default RegistrationRequests;
