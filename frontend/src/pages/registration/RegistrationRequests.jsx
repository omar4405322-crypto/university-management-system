import React, { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import Table, { TableRow, TableCell } from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { Search, Filter, Check, X, Eye, AlertCircle, CheckCircle } from 'lucide-react';
import registrationService from '../../services/registration.service';
import { useTranslation } from 'react-i18next';

const RegistrationRequests = () => {
  const { t } = useTranslation();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);

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

  const filteredRequests = requests.filter(req => 
    req.firstName.toLowerCase().includes(search.toLowerCase()) ||
    req.lastName.toLowerCase().includes(search.toLowerCase()) ||
    req.email.toLowerCase().includes(search.toLowerCase())
  );

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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('registration.title')}</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">{t('registration.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="flex items-center gap-2">
            <Filter size={18} /> {t('common.filters')}
          </Button>
          <Button className="flex items-center gap-2">
            {t('registration.export')}
          </Button>
        </div>
      </div>

      <Card noPadding>
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input 
              placeholder={t('registration.searchPlaceholder')} 
              className="pl-10 h-10 w-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
            <Badge variant="neutral" className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800">{t('common.all')} ({requests.length})</Badge>
            <Badge variant="warning" className="cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/20">{t('common.pending')} ({requests.filter(r => r.status === 'PENDING').length})</Badge>
            <Badge variant="success" className="cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/20">{t('common.approved')} ({requests.filter(r => r.status === 'APPROVED').length})</Badge>
            <Badge variant="danger" className="cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-900/20">{t('common.rejected')} ({requests.filter(r => r.status === 'REJECTED').length})</Badge>
          </div>
        </div>

        <div className="min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600/20 border-t-blue-600"></div>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{t('common.loading')}</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="h-16 w-16 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-4">
                <Search size={32} className="text-slate-300 dark:text-slate-600" />
              </div>
              <p className="text-lg font-semibold text-slate-900 dark:text-white">{t('registration.noRequests')}</p>
            </div>
          ) : (
            <Table headers={[t('registration.requestId'), t('registration.fullName'), t('registration.collegeDept'), t('registration.appliedDate'), t('profile.status'), t('common.actions')]}>
              {filteredRequests.map((req) => (
                <TableRow key={req.id}>
                  <TableCell className="font-medium text-slate-900 dark:text-slate-200">#{req.id}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-900 dark:text-white">{req.firstName} {req.lastName}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{req.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-slate-700 dark:text-slate-300">{req.department?.college?.name || 'N/A'}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{req.department?.name || 'N/A'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-600 dark:text-slate-400">
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
                    <div className="flex items-center gap-2">
                      <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" title={t('common.view')}>
                        <Eye size={18} />
                      </button>
                      {req.status === 'PENDING' && (
                        <>
                          <button 
                            onClick={() => handleApprove(req.id)}
                            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors" 
                            title={t('common.approve')}
                          >
                            <Check size={18} />
                          </button>
                          <button 
                            onClick={() => handleReject(req.id)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors" 
                            title={t('common.reject')}
                          >
                            <X size={18} />
                          </button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </Table>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('common.showing')} {filteredRequests.length} {t('common.of')} {requests.length} {t('registration.requests')}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="h-9 px-3 text-xs" disabled>{t('common.previous')}</Button>
            <Button variant="outline" className="h-9 px-3 text-xs">{t('common.next')}</Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default RegistrationRequests;

