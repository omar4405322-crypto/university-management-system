// @ts-nocheck
import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import teachingAssistantsService from '../../services/teachingAssistants.service';
import doctorsService from '../../services/doctors.service';
import Button from '../../components/ui/button';
import { useTranslation } from 'react-i18next';
import { X, Search, Loader2, Link, Trash2 } from 'lucide-react';

const AssignDoctorModal = ({ isOpen, onClose, onSuccess, ta }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [search, setSearch] = useState('');
  const [fetchingDoctors, setFetchingDoctors] = useState(false);
  const [assigningDoctorId, setAssigningDoctorId] = useState(null);
  const [unassigningDoctorId, setUnassigningDoctorId] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchDoctors();
    }
  }, [isOpen, search]);

  const fetchDoctors = async () => {
    setFetchingDoctors(true);
    try {
      const res = await doctorsService.getDoctors({ limit: 50, search });
      if (res.success && res.data?.doctors) {
        setDoctors(res.data.doctors);
      }
    } catch (error) {
      console.error('Error fetching doctors:', error);
    } finally {
      setFetchingDoctors(false);
    }
  };

  const handleAssign = async (doctorId: string) => {
    try {
      setAssigningDoctorId(doctorId);
      const res = await teachingAssistantsService.assignToDoctor(ta.id, doctorId);
      if (res.success) {
        toast.success(t('teachingAssistants.assignSuccess'));
        onSuccess();
      } else {
        toast.error(res.message || t('teachingAssistants.assignError'));
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('teachingAssistants.assignError'));
    } finally {
      setAssigningDoctorId(null);
    }
  };

  const handleUnassign = async (doctorId: string) => {
    try {
      setUnassigningDoctorId(doctorId);
      const res = await teachingAssistantsService.unassignFromDoctor(ta.id, doctorId);
      if (res.success) {
        toast.success(t('teachingAssistants.unassignSuccess'));
        onSuccess();
      } else {
        toast.error(res.message || t('teachingAssistants.unassignError'));
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('teachingAssistants.unassignError'));
    } finally {
      setUnassigningDoctorId(null);
    }
  };

  if (!isOpen || !ta) return null;

  const assignedDoctorIds = new Set(ta.doctors?.map((d: any) => d.doctorId) || []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-brand-navy-500/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-brand-bg-card dark:bg-brand-bg-elevated rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
        <div className="px-6 py-4 border-b border-brand-border dark:border-brand-border flex justify-between items-center bg-brand-bg-page/50 dark:bg-brand-bg-elevated/50 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-brand-text-primary dark:text-brand-text-main">
              {t('teachingAssistants.assignDoctor')}: {ta.employeeId}
            </h2>
            <p className="text-sm text-brand-text-secondary dark:text-brand-text-muted mt-0.5">
              {t('teachingAssistants.assignDoctorSubtitle')}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-brand-text-muted hover:text-brand-text-secondary hover:bg-brand-bg-page dark:hover:bg-brand-bg-elevated rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="mb-6">
            <h3 className="text-sm font-bold text-brand-text-main mb-3">{t('teachingAssistants.currentlyAssigned')}</h3>
            {ta.doctors && ta.doctors.length > 0 ? (
              <div className="space-y-2">
                {ta.doctors.map((d: any) => (
                  <div key={d.id} className="flex items-center justify-between p-3 border border-brand-border rounded-xl bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-primary-500/10 flex items-center justify-center text-brand-primary-600 font-bold text-xs">
                        {d.doctor.firstName?.[0]}{d.doctor.lastName?.[0]}
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-brand-text-primary dark:text-white">
                          {d.doctor.firstName} {d.doctor.lastName}
                        </div>
                        <div className="text-xs text-brand-text-secondary">{d.doctor.doctorId}</div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUnassign(d.doctorId)}
                      disabled={unassigningDoctorId === d.doctorId}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-900/30"
                    >
                      {unassigningDoctorId === d.doctorId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-brand-text-muted italic bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl text-center border border-dashed border-brand-border">
                {t('teachingAssistants.noDoctorsAssigned')}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-bold text-brand-text-main mb-3">{t('teachingAssistants.selectDoctor')}</h3>
            <div className="relative mb-4">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-brand-text-muted" size={16} />
              <input
                type="text"
                placeholder={t('doctors.searchPlaceholder')}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl ps-9 pe-3 py-2 text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-primary-500"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              {fetchingDoctors && doctors.length === 0 ? (
                <div className="flex justify-center p-4"><Loader2 className="w-6 h-6 animate-spin text-brand-primary-500" /></div>
              ) : doctors.filter(doc => !assignedDoctorIds.has(doc.id)).length > 0 ? (
                doctors.filter(doc => !assignedDoctorIds.has(doc.id)).map((doc: any) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 border border-brand-border rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold text-xs">
                        {doc.firstName?.[0]}{doc.lastName?.[0]}
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-brand-text-primary dark:text-white">
                          {doc.firstName} {doc.lastName}
                        </div>
                        <div className="text-xs text-brand-text-secondary">{doc.doctorId} • {doc.specialty || '—'}</div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAssign(doc.id)}
                      disabled={assigningDoctorId === doc.id}
                      className="hover:bg-brand-primary-50 hover:text-brand-primary-600 dark:hover:bg-brand-primary-900/20"
                    >
                      {assigningDoctorId === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link className="w-4 h-4 mr-1" />}
                      {t('teachingAssistants.assign')}
                    </Button>
                  </div>
                ))
              ) : (
                <div className="text-center text-sm text-brand-text-muted p-4">
                  {t('doctors.noSearchResults')}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-brand-border dark:border-brand-border flex justify-end shrink-0">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AssignDoctorModal;
