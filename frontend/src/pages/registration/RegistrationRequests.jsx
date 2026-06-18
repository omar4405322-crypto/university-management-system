// FIXED: Proper empty state icon (no stray imagery); show phone in details - Phase 6
import React, { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import Table, { TableRow, TableCell, ActionMenu } from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import FilterBar from '../../components/ui/FilterBar';
import { ClipboardList, Eye, Check, X, AlertCircle, CheckCircle } from 'lucide-react';
import registrationService from '../../services/registration.service';
import { useTranslation } from 'react-i18next';
import Modal from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';

const RegistrationRequests = () => {
  const { t } = useTranslation();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const result = await registrationService.getRequests();
      if (result.success) {
        setRequests(result.data);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
      showToast(t('common.errorFetching'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      const result = await registrationService.approveRequest(id);
      if (result.success) {
        showToast(t('registration.approveSuccess'), 'success');
        fetchRequests();
      }
    } catch (error) {
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
      } catch (error) {
        showToast(error.response?.data?.message || t('registration.rejectError'), 'error');
      }
    }
  };

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleView = (req) => {
    setSelectedRequest(req);
    setIsDetailsModalOpen(true);
  };

  const filteredRequests = requests.filter(req => 
    req.firstName.toLowerCase().includes(search.toLowerCase()) ||
    req.lastName.toLowerCase().includes(search.toLowerCase()) ||
    req.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="section-gap">
      {/* Toast Notification */}
      {toast && (
        <div className={`${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
          <div className="flex items-center gap-2">
            {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}

      <PageHeader 
        title={t('registration.title')}
        subtitle={t('registration.subtitle')}
      />

      <Card noPadding className="border-l-0">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={t('registration.searchPlaceholder')}
        >
          <Badge variant="neutral" className="cursor-pointer">{t('common.all')} ({requests.length})</Badge>
          <Badge variant="warning" className="cursor-pointer">{t('common.pending')} ({requests.filter(r => r.status === 'PENDING').length})</Badge>
          <Badge variant="success" className="cursor-pointer">{t('common.approved')} ({requests.filter(r => r.status === 'APPROVED').length})</Badge>
          <Badge variant="danger" className="cursor-pointer">{t('common.rejected')} ({requests.filter(r => r.status === 'REJECTED').length})</Badge>
        </FilterBar>

        <div className="min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand-primary-500/20 border-t-brand-primary-500"></div>
              <p className="text-sm text-brand-text-muted font-medium">{t('common.loading')}</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <EmptyState
              icon={<ClipboardList size={40} />}
              title={t('registration.noRequests')}
              subtitle={t('registration.noRequestsDesc')}
            />
          ) : (
            <Table headers={[t('registration.requestId'), t('registration.fullName'), t('registration.collegeDept'), t('registration.appliedDate'), t('profile.status'), t('common.actions')]}>
              {filteredRequests.map((req) => (
                <TableRow key={req.id}>
                  <TableCell className="font-medium text-brand-text-main">#{req.id}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold text-brand-text-main">{req.firstName} {req.lastName}</span>
                      <span className="text-xs text-brand-text-muted">{req.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-brand-text-sub">{req.department?.college?.name || 'N/A'}</span>
                      <span className="text-xs text-brand-text-muted">{req.department?.name || 'N/A'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-brand-text-sub">
                    {new Date(req.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      req.status === 'APPROVED' ? 'success' : 
                      req.status === 'REJECTED' ? 'danger' : 'warning'
                    }>
                      {t(`common.${req.status.toLowerCase()}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <ActionMenu actions={[
                      { label: t('common.view'), icon: Eye, variant: 'view', onClick: () => handleView(req) },
                      ...(req.status === 'PENDING' ? [
                        { label: t('common.approve'), icon: Check, variant: 'edit', onClick: () => handleApprove(req.id) },
                        { label: t('common.reject'), icon: X, variant: 'delete', onClick: () => handleReject(req.id) },
                      ] : []),
                    ]} />
                  </TableCell>
                </TableRow>
              ))}
            </Table>
          )}
        </div>

        <div className="px-6 py-3 border-t border-brand-border flex items-center justify-between bg-brand-bg-card">
          <p className="text-xs font-semibold text-brand-text-muted">
            <span className="text-brand-text-primary">{filteredRequests.length}</span> of <span className="text-brand-text-primary">{requests.length}</span> {t('registration.requests')}
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
                  <p className="text-xs font-bold text-brand-text-muted uppercase tracking-wider">{t('auth.email')}</p>
                  <p className="text-sm font-semibold text-brand-text-main">{selectedRequest.email}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-brand-text-muted uppercase tracking-wider">{t('profile.phone')}</p>
                  <p className="text-sm font-semibold text-brand-text-main">
                    {selectedRequest.phone || t('students.phoneNotSpecified')}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-brand-text-muted uppercase tracking-wider">{t('auth.role')}</p>
                  <Badge variant="info">{selectedRequest.role}</Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-brand-text-muted uppercase tracking-wider">{t('auth.college')}</p>
                  <p className="text-sm font-semibold text-brand-text-main">{selectedRequest.department?.college?.name || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-brand-text-muted uppercase tracking-wider">{t('auth.department')}</p>
                  <p className="text-sm font-semibold text-brand-text-main">{selectedRequest.department?.name || 'N/A'}</p>
                </div>
                {selectedRequest.role === 'STUDENT' && (
                  <>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-brand-text-muted uppercase tracking-wider">{t('auth.studentId')}</p>
                      <p className="text-sm font-semibold text-brand-text-main">{selectedRequest.studentId || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-brand-text-muted uppercase tracking-wider">{t('auth.year')}</p>
                      <p className="text-sm font-semibold text-brand-text-main">{t(`auth.year${selectedRequest.year}`)}</p>
                    </div>
                  </>
                )}
                <div className="space-y-1">
                  <p className="text-xs font-bold text-brand-text-muted uppercase tracking-wider">{t('registration.appliedDate')}</p>
                  <p className="text-sm font-semibold text-brand-text-main">{new Date(selectedRequest.createdAt).toLocaleString()}</p>
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

