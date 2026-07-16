import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import collegeService from '../../services/college.service';
import usersService from '../../services/users.service';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/input';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { School, Info, AlertCircle, CheckCircle, Loader2, ChevronRight, UserPlus, UserCheck, PlusCircle } from 'lucide-react';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  nameAr: z.string().optional(),
  description: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const AddCollegeModal = ({ isOpen, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [step, setStep] = useState(1); // 1 = create college, 2 = assign admin
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) });
  const [newCollege, setNewCollege] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [selectedAdminId, setSelectedAdminId] = useState('');
  const [assignMode, setAssignMode] = useState('select'); // 'select' or 'create'
  const [adminFormData, setAdminFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleAdminChange = (e) => {
    const { name, value } = e.target;
    setAdminFormData({ ...adminFormData, [name]: value });
  };

  const getErrorMessage = (error) => {
    if (error.status === 403) {
      return t('colleges.insufficientPermissions', 'You do not have permission to create colleges. Only Super Admins can create colleges.');
    }
    if (error.status === 401) {
      return t('colleges.sessionExpired', 'Your session has expired. Please login again.');
    }
    if (error.data?.message) {
      return error.data.message;
    }
    if (error.message) {
      return error.message;
    }
    return t('colleges.createError', 'Failed to create college. Please try again.');
  };

  const fetchAvailableAdmins = async () => {
    try {
      setFetching(true);
      const result = await usersService.getUsers({ role: 'COLLEGE_ADMIN' });
      if (result.success) {
        // Filter admins who don't have an assigned college
        const availableAdmins = (result.data || []).filter(admin => !admin.managedCollegeId);
        setAdmins(availableAdmins);
      }
    } catch (error) {
      console.error('Error fetching admins:', error);
      showToast(t('common.errorFetching'), 'error');
    } finally {
      setFetching(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    try {
      setLoading(true);
      const result = await collegeService.createCollege(data);
      if (result.success) {
        setNewCollege(result.data);
        setStep(2);
        fetchAvailableAdmins();
        showToast(t('colleges.addSuccess', 'College created successfully!'), 'success');
      }
    } catch (error) {
      console.error('Error creating college:', error);
      showToast(getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignAdmin = async () => {
    if (!selectedAdminId) {
      // Allow skipping admin assignment
      onSuccess();
      resetModal();
      return;
    }

    try {
      setLoading(true);
      const result = await collegeService.assignAdmin(newCollege.id, parseInt(selectedAdminId));
      if (result.success) {
        showToast(t('colleges.adminAssignedSuccess') || 'Admin assigned successfully', 'success');
        onSuccess();
        resetModal();
      }
    } catch (error) {
      const message = error.response?.data?.message || t('colleges.assignAdminError') || 'Failed to assign admin';
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdmin = async () => {
    if (!adminFormData.email || !adminFormData.password || !adminFormData.firstName || !adminFormData.lastName) {
      showToast(t('colleges.fillAllFields') || 'Please fill in all fields', 'error');
      return;
    }

    try {
      setLoading(true);
      // Create the admin user with managedCollegeId set to the new college
      const result = await usersService.createAdmin({
        email: adminFormData.email,
        password: adminFormData.password,
        role: 'COLLEGE_ADMIN',
        managedCollegeId: newCollege.id,
        firstName: adminFormData.firstName,
        lastName: adminFormData.lastName,
      });

      if (result.success) {
        showToast(t('colleges.adminCreatedAssigned') || 'Admin created and assigned successfully', 'success');
        onSuccess();
        resetModal();
      }
    } catch (error) {
      const message = error.response?.data?.message || t('colleges.createAdminError') || 'Failed to create admin';
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetModal = () => {
    setStep(1);
    reset();
    setNewCollege(null);
    setSelectedAdminId('');
    setAdmins([]);
    setAssignMode('select');
    setAdminFormData({ email: '', password: '', firstName: '', lastName: '' });
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  // Guard: Only SUPER_ADMIN can access this modal
  if (!isOpen || user?.role !== 'SUPER_ADMIN') {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={step === 1 ? t('colleges.addNew') : `${t('colleges.assignAdmin')} - ${newCollege?.name}`}
      subtitle={step === 1 ? t('colleges.addDesc') : t('colleges.assignAdminDesc') || 'Assign an admin to manage this college (optional)'}
    >
      {toast && (
        <div className={`p-4 mb-6 rounded-xl text-white flex items-center gap-2 animate-in slide-in-from-top-2 duration-300 ${toast.type === 'error' ? 'bg-rose-500' : 'bg-brand-green'}`}>
          {toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
          <span className="font-medium text-sm">{toast.message}</span>
        </div>
      )}

      {/* Step Indicator Progress Bar */}
      <div className="flex items-center justify-between mb-8 max-w-xs mx-auto relative px-4 select-none">
        <div className="flex flex-col items-center z-10">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border-2 transition-all duration-300 ${step === 1 ? 'bg-brand-primary-500 border-brand-primary-500 text-white shadow-md shadow-brand-primary-500/20' : 'bg-brand-primary-50 border-brand-primary-200 text-brand-primary-600'}`}>
            1
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider mt-1.5 text-brand-text-primary">
            {t('common.basicInfo') || 'Basic Info'}
          </span>
        </div>
        <div className="flex-1 h-0.5 mx-2 bg-brand-border dark:bg-slate-700 relative -top-3.5 transition-all duration-300">
          <div className="h-full bg-brand-primary-500 transition-all duration-500" style={{ width: step === 2 ? '100%' : '0%' }} />
        </div>
        <div className="flex flex-col items-center z-10">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border-2 transition-all duration-300 ${step === 2 ? 'bg-brand-primary-500 border-brand-primary-500 text-white shadow-md shadow-brand-primary-500/20' : 'bg-brand-bg-card border-brand-border text-brand-text-muted'}`}>
            2
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider mt-1.5 text-brand-text-muted">
            {t('colleges.admin') || 'Admin'}
          </span>
        </div>
      </div>

      {step === 1 ? (
        // Step 1: Create College
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
                  <School size={14} className="text-brand-text-muted" /> {t('colleges.nameEn')} <span className="text-rose-500">*</span>
                </label>
                <Input
                  {...register('name')}
                  placeholder="e.g. College of Engineering"
                  disabled={loading}
                  className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all disabled:opacity-50 disabled:cursor-not-allowed h-11 rounded-xl"
                />
                {errors.name && <p className="text-rose-500 text-xs mt-1">{errors.name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
                  <School size={14} className="text-brand-text-muted" /> {t('colleges.nameAr')}
                </label>
                <Input
                  {...register('nameAr')}
                  placeholder={t('colleges.nameArPlaceholder', 'e.g. Faculty of Engineering')}
                  disabled={loading}
                  className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all disabled:opacity-50 disabled:cursor-not-allowed font-arabic h-11 rounded-xl"
                  dir="rtl"
                />
                {errors.nameAr && <p className="text-rose-500 text-xs mt-1">{errors.nameAr.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
                <Info size={14} className="text-brand-text-muted" /> {t('colleges.description')}
              </label>
              <textarea
                {...register('description')}
                rows={4}
                placeholder={t('colleges.descPlaceholder')}
                disabled={loading}
                className="w-full px-4 py-3 bg-brand-bg-page/30 border border-brand-border rounded-xl text-sm text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 transition-all resize-none placeholder:text-brand-text-muted disabled:opacity-50 disabled:cursor-not-allowed"
              ></textarea>
              {errors.description && <p className="text-rose-500 text-xs mt-1">{errors.description.message}</p>}
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-3 border-t border-brand-border pt-6">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={loading}
              className="text-xs font-black uppercase tracking-wider px-5 py-3"
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting || loading}
              className="min-w-[140px] flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider px-6 py-3"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  <span>{t('common.creating', 'Creating...')}</span>
                </>
              ) : (
                <>
                  {t('colleges.addCollege')}
                  <ChevronRight size={16} className="rtl:-scale-x-100" />
                </>
              )}
            </Button>
          </div>
        </form>
      ) : (
        // Step 2: Assign Admin
        <div className="space-y-6">
          {fetching ? (
            <div className="flex justify-center py-12">
              <Loader2 size={36} className="animate-spin text-brand-primary-500" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Mode Selector Tabs */}
              <div className="flex gap-2 bg-brand-navy-50/50 dark:bg-slate-800/50 rounded-xl p-1 border border-brand-border/60">
                <button
                  type="button"
                  onClick={() => setAssignMode('select')}
                  className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${assignMode === 'select'
                      ? 'bg-brand-primary-500 text-white shadow-md shadow-brand-primary-500/20'
                      : 'text-brand-text-secondary hover:text-brand-text-main'
                    }`}
                >
                  <UserCheck size={14} />
                  {t('colleges.selectExistingAdmin') || 'Select Existing Admin'}
                </button>
                <button
                  type="button"
                  onClick={() => setAssignMode('create')}
                  className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${assignMode === 'create'
                      ? 'bg-brand-primary-500 text-white shadow-md shadow-brand-primary-500/20'
                      : 'text-brand-text-secondary hover:text-brand-text-main'
                    }`}
                >
                  <PlusCircle size={14} />
                  {t('colleges.createNewAdmin') || 'Create New Admin'}
                </button>
              </div>

              {assignMode === 'select' ? (
                // Select Existing Admin
                <div className="animate-fade-in">
                  {admins.length === 0 ? (
                    <div className="text-center py-10 bg-brand-bg-page/40 rounded-2xl p-6 border border-dashed border-brand-border/80">
                      <AlertCircle size={36} className="mx-auto mb-3 text-brand-text-muted" />
                      <p className="font-semibold text-sm text-brand-text-primary mb-2">{t('colleges.noAvailableAdmins') || 'No available COLLEGE_ADMIN users found'}</p>
                      <p className="text-xs text-brand-text-muted">{t('colleges.canCreateAdminLater') || 'You can assign an admin later'}</p>
                    </div>
                  ) : (
                    <div className="space-y-2 text-start">
                      <label className="text-xs font-black uppercase tracking-wider text-brand-text-secondary ml-1">{t('colleges.selectCollegeAdmin') || 'Select College Admin'}</label>
                      <div className="relative">
                        <select
                          value={selectedAdminId}
                          onChange={(e) => setSelectedAdminId(e.target.value)}
                          className="select-brand"
                        >
                          <option value="">{t('common.selectOptional')} {t('colleges.admin')}</option>
                          {admins.map((admin) => (
                            <option key={admin.id} value={admin.id}>
                              {admin.email} ({admin.firstName} {admin.lastName})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // Create New Admin Form
                <div className="space-y-4 text-start animate-fade-in">
                  <p className="text-xs text-brand-text-secondary leading-relaxed bg-brand-bg-page/30 p-3 rounded-xl border border-brand-border/40">
                    {t('colleges.createAdminDesc') || 'Create a new COLLEGE_ADMIN user who will be assigned to this college'}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-black uppercase tracking-wider text-brand-text-secondary ml-1">{t('admins.firstName') || 'First Name'} <span className="text-rose-500">*</span></label>
                      <Input
                        name="firstName"
                        value={adminFormData.firstName}
                        onChange={handleAdminChange}
                        placeholder="Ahmed"
                        required
                        disabled={loading}
                        className="h-11 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-black uppercase tracking-wider text-brand-text-secondary ml-1">{t('admins.lastName') || 'Last Name'} <span className="text-rose-500">*</span></label>
                      <Input
                        name="lastName"
                        value={adminFormData.lastName}
                        onChange={handleAdminChange}
                        placeholder="Mohamed"
                        required
                        disabled={loading}
                        className="h-11 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-wider text-brand-text-secondary ml-1">{t('admins.email') || 'Email'} <span className="text-rose-500">*</span></label>
                    <Input
                      type="email"
                      name="email"
                      value={adminFormData.email}
                      onChange={handleAdminChange}
                      placeholder="admin@college.edu"
                      required
                      disabled={loading}
                      className="h-11 rounded-xl"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-wider text-brand-text-secondary ml-1">{t('admins.password') || 'Password'} <span className="text-rose-500">*</span></label>
                    <Input
                      type="password"
                      name="password"
                      value={adminFormData.password}
                      onChange={handleAdminChange}
                      placeholder="••••••••"
                      required
                      disabled={loading}
                      className="h-11 rounded-xl"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-8 flex justify-end gap-3 border-t border-brand-border pt-6">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={loading}
              className="text-xs font-black uppercase tracking-wider px-5 py-3"
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onSuccess();
                resetModal();
              }}
              disabled={loading}
              className="flex items-center gap-2 text-xs font-black uppercase tracking-wider px-5 py-3"
            >
              {t('common.skip')}
            </Button>
            {assignMode === 'select' ? (
              <Button
                type="button"
                variant="primary"
                disabled={loading}
                onClick={handleAssignAdmin}
                className="min-w-[140px] flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider px-6 py-3"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    <span>{t('common.assigning')}</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={16} />
                    {selectedAdminId ? t('colleges.assignAdmin') : t('common.finish')}
                  </>
                )}
              </Button>
            ) : (
              <Button
                type="button"
                variant="primary"
                disabled={loading}
                onClick={handleCreateAdmin}
                className="min-w-[140px] flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider px-6 py-3"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    <span>{t('common.creating')}</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={16} />
                    {t('colleges.createAndAssign') || 'Create & Assign'}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
};

export default AddCollegeModal; AddCollegeModal;
