import React, { useState, useEffect, useMemo } from 'react';
import Card from '../../components/ui/Card';
import Table, { TableRow, TableCell, ActionMenu } from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import FilterBar from '../../components/ui/FilterBar';
import { ClipboardList, Eye, Check, X, AlertCircle, CheckCircle, Search } from 'lucide-react';
import registrationService from '../../services/registration.service';
import { useTranslation } from 'react-i18next';
import Modal from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { logger } from '../../lib/logger';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const RegistrationRequests = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [allDepartments, setAllDepartments] = useState<any[]>([]);
  const { showToast } = useToast();
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  useEffect(() => {
    fetchRequests();
    fetchDepartments();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const result = await registrationService.getRequests();
      if (result.success) {
        setRequests(result.data);
        console.log('request sample:', result.data[0]);
      }
    } catch (error: any) {
      logger.error('Error fetching requests:', error);
      showToast(t('common.errorFetching'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await api.get('/departments');
      const data = response.data?.data || response.data;
      const allDepts = Array.isArray(data) ? data : [];
      
      console.log('current user:', user);
      console.log('first department:', allDepts[0]);

      // Filter to only show departments in the current user's college
      const filtered = allDepts.filter((dept: any) => {
        if (user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') return true;
        return dept.collegeId === user?.managedCollegeId || 
               dept.collegeId === user?.collegeId;
      });
      
      setAllDepartments(filtered);
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    }
  };

  const handleApprove = async (id) => {
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

  const filteredRequests = requests.filter((req: any) => {
    // 1. Status Filter
    if (statusFilter !== 'ALL' && req.status !== statusFilter) {
      return false;
    }

    // 2. Department Filter
    if (selectedDepartment && req.department?.name !== selectedDepartment) {
      return false;
    }

    // 3. Search Query Filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const fullName = `${req.firstName} ${req.lastName}`.toLowerCase();
      const email = (req.email || '').toLowerCase();
      const reqId = String(req.id).toLowerCase();

      const matchesSearch =
        fullName.includes(query) ||
        email.includes(query) ||
        reqId.includes(query);

      if (!matchesSearch) {
        return false;
      }
    }

    return true;
  });

  return (
    <div className="section-gap">
      {/* Toast Notification */}
      

      <PageHeader title={t('registration.title')} subtitle={t('registration.subtitle')} />

      <Card noPadding className="border-l-0">
        <FilterBar showSearch={false}>
          <span onClick={() => setStatusFilter('ALL')}>
            <Badge variant={statusFilter === 'ALL' ? 'primary' : 'neutral'} className="cursor-pointer">
              {t('common.all')} ({requests.length})
            </Badge>
          </span>
          <span onClick={() => setStatusFilter('PENDING')}>
            <Badge variant={statusFilter === 'PENDING' ? 'primary' : 'warning'} className="cursor-pointer">
              {t('common.pending')} ({requests.filter((r: any) => r.status === 'PENDING').length})
            </Badge>
          </span>
          <span onClick={() => setStatusFilter('APPROVED')}>
            <Badge variant={statusFilter === 'APPROVED' ? 'primary' : 'success'} className="cursor-pointer">
              {t('common.approved')} ({requests.filter((r: any) => r.status === 'APPROVED').length})
            </Badge>
          </span>
          <span onClick={() => setStatusFilter('REJECTED')}>
            <Badge variant={statusFilter === 'REJECTED' ? 'primary' : 'danger'} className="cursor-pointer">
              {t('common.rejected')} ({requests.filter((r: any) => r.status === 'REJECTED').length})
            </Badge>
          </span>
        </FilterBar>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-6 py-4 border-b border-brand-border bg-surface-subtle/30">
          <div className="relative">
            <Search size={16} className="absolute right-3 rtl:right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('البحث بالاسم أو البريد الإلكتروني أو رقم الطلب...')}
              className="w-full pr-10 rtl:pr-10 pl-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary-500 dark:bg-slate-800 dark:border-slate-700"
            />
          </div>
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary-500 dark:bg-slate-800 dark:border-slate-700 w-full"
          >
            <option value="">{t('كل الأقسام')}</option>
            {allDepartments.map((dept: any) => (
              <option key={dept.id} value={dept.name}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>

        <div className="min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand-green-dark/20 border-t-brand-green-dark"></div>
              <p className="text-sm text-brand-text-muted font-medium">{t('common.loading')}</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <EmptyState
              icon={<ClipboardList size={40} />}
              title={t('registration.noRequests')}
              subtitle={t('registration.noRequestsDesc')}
            />
          ) : (
            <Table
              headers={[
                t('registration.requestId'),
                t('registration.fullName'),
                t('registration.collegeDept'),
                t('registration.appliedDate'),
                t('profile.status'),
                t('common.actions'),
              ]}
            >
              {filteredRequests.map((req) => (
                <TableRow key={req.id}>
                  <TableCell className="font-medium text-brand-text-main">#{req.id}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold text-brand-text-main">
                        {req.firstName} {req.lastName}
                      </span>
                      <span className="text-xs text-brand-text-muted">{req.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-brand-text-sub">
                        {req.department?.college?.name || 'N/A'}
                      </span>
                      <span className="text-xs text-brand-text-muted">
                        {req.department?.name || 'N/A'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-brand-text-sub">
                    {new Date(req.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        req.status === 'APPROVED'
                          ? 'success'
                          : req.status === 'REJECTED'
                            ? 'danger'
                            : 'warning'
                      }
                    >
                      {t(`common.${req.status.toLowerCase()}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <ActionMenu
                      actions={[
                        {
                          label: t('common.view'),
                          icon: Eye,
                          variant: 'view',
                          onClick: () => handleView(req),
                        },
                        ...(req.status === 'PENDING'
                          ? [
                              {
                                label: t('common.approve'),
                                icon: Check,
                                variant: 'edit',
                                onClick: () => handleApprove(req.id),
                              },
                              {
                                label: t('common.reject'),
                                icon: X,
                                variant: 'delete',
                                onClick: () => handleReject(req.id),
                              },
                            ]
                          : []),
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </Table>
          )}
        </div>

        <div className="px-6 py-3 border-t border-brand-border flex items-center justify-between bg-brand-bg-card">
          <p className="text-xs font-semibold text-brand-text-muted">
            <span className="text-brand-text-primary">{filteredRequests.length}</span> of{' '}
            <span className="text-brand-text-primary">{requests.length}</span>{' '}
            {t('registration.requests')}
          </p>
        </div>
      </Card>

      {/* Details Modal */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        title={t('registration.requestDetails')}
        subtitle={`${selectedRequest?.firstName} ${selectedRequest?.lastName}`}
      >
        {selectedRequest && (
          <div className="form-section">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <p className="text-xs font-bold text-brand-text-muted uppercase tracking-wider">
                  {t('auth.email')}
                </p>
                <p className="text-sm font-semibold text-brand-text-main">
                  {selectedRequest.email}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-brand-text-muted uppercase tracking-wider">
                  {t('profile.phone')}
                </p>
                <p className="text-sm font-semibold text-brand-text-main">
                  {selectedRequest.phone || t('students.phoneNotSpecified')}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-brand-text-muted uppercase tracking-wider">
                  {t('auth.role')}
                </p>
                <Badge variant="info">{selectedRequest.role}</Badge>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-brand-text-muted uppercase tracking-wider">
                  {t('auth.college')}
                </p>
                <p className="text-sm font-semibold text-brand-text-main">
                  {selectedRequest.department?.college?.name || 'N/A'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-brand-text-muted uppercase tracking-wider">
                  {t('auth.department')}
                </p>
                <p className="text-sm font-semibold text-brand-text-main">
                  {selectedRequest.department?.name || 'N/A'}
                </p>
              </div>
              {selectedRequest.role === 'STUDENT' && (
                <>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-brand-text-muted uppercase tracking-wider">
                      {t('auth.studentId')}
                    </p>
                    <p className="text-sm font-semibold text-brand-text-main">
                      {selectedRequest.studentId || 'N/A'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-brand-text-muted uppercase tracking-wider">
                      {t('auth.year')}
                    </p>
                    <p className="text-sm font-semibold text-brand-text-main">
                      {t(`auth.year${selectedRequest.year}`)}
                    </p>
                  </div>
                </>
              )}
              <div className="space-y-1">
                <p className="text-xs font-bold text-brand-text-muted uppercase tracking-wider">
                  {t('registration.appliedDate')}
                </p>
                <p className="text-sm font-semibold text-brand-text-main">
                  {new Date(selectedRequest.createdAt).toLocaleString()}
                </p>
              </div>
            </div>

            {selectedRequest.status === 'PENDING' && (
              <div className="flex justify-end gap-3 pt-6 border-t border-brand-border">
                <Button
                  variant="outline"
                  onClick={() => {
                    handleReject(selectedRequest.id);
                    setIsDetailsModalOpen(false);
                  }}
                  className="text-rose-600 border-rose-200 hover:bg-rose-50 dark:bg-rose-900/20"
                >
                  {t('common.reject')}
                </Button>
                <Button
                  onClick={() => {
                    handleApprove(selectedRequest.id);
                    setIsDetailsModalOpen(false);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {t('common.approve')}
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default RegistrationRequests;
