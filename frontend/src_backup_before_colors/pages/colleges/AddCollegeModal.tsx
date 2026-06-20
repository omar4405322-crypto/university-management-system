import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import collegeService from '../../services/college.service';
import usersService from '../../services/users.service';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { School, Info, AlertCircle, CheckCircle, Loader2, ChevronRight, UserPlus, UserCheck, PlusCircle } from 'lucide-react';
import { logger } from '../../lib/logger';
import { useToast } from '../../context/ToastContext';

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
  const { showToast } = useToast();


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
    } catch (error: any) {
      logger.error('Error fetching admins:', error);
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
    } catch (error: any) {
      logger.error('Error creating college:', error);
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
    } catch (error: any) {
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
    } catch (error: any) {
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
      

      {step === 1 ? (
        // Step 1: Create College
        <form onSubmit={handleSubmit(onSubmit)} className="form-section">
          <div className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
                <School size={14} className="text-brand-text-muted" /> {t('colleges.nameEn')} <span className="text-rose-500">*</span>
              </label>
              <Input
                {...register('name')}
                placeholder="e.g. College of Engineering"
                disabled={loading}
                className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all disabled:opacity-50 disabled:cursor-not-allowed font-arabic"
                dir="rtl"
              />
              {errors.nameAr && <p className="text-rose-500 text-xs mt-1">{errors.nameAr.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
                <Info size={14} className="text-brand-text-muted" /> {t('colleges.description')}
              </label>
              <textarea
                {...register('description')}
                rows="3"
                placeholder={t('colleges.descPlaceholder')}
                disabled={loading}
                className="w-full px-4 py-2 bg-brand-bg-page/30 border border-brand-border rounded-xl text-sm text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20 transition-all resize-none placeholder:text-brand-text-muted disabled:opacity-50 disabled:cursor-not-allowed"
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
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || loading}
              className="min-w-[140px] flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  <span>{t('common.creating', 'Creating...')}</span>
                </>
              ) : (
                <>
                  {t('colleges.addCollege')}
                  <ChevronRight size={18} className="rtl:-scale-x-100" />
                </>
              )}
            </Button>
          </div>
        </form>
      ) : (
        // Step 2: Assign Admin
        <div className="form-section space-y-5">
          {fetching ? (
            <div className="flex justify-center py-8">
              <Loader2 size={32} className="animate-spin text-brand-primary-500" />
            </div>
          ) : (
            <div className="space-y-5">
              {/* Mode Selector */}
              <div className="flex gap-2 bg-brand-navy/5 rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => setAssignMode('select')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${
                    assignMode === 'select'
                      ? 'bg-brand-primary-500 text-white shadow-md'
                      : 'text-brand-text-secondary hover:text-brand-text-main'
                  }`}
                >
                  <UserCheck size={16} className="inline-block mr-1" />
                  {t('colleges.selectExistingAdmin') || 'Select Existing Admin'}
                </button>
                <button
                  type="button"
                  onClick={() => setAssignMode('create')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${
                    assignMode === 'create'
                      ? 'bg-brand-primary-500 text-white shadow-md'
                      : 'text-brand-text-secondary hover:text-brand-text-main'
                  }`}
                >
                  <PlusCircle size={16} className="inline-block mr-1" />
                  {t('colleges.createNewAdmin') || 'Create New Admin'}
                </button>
              </div>

              {assignMode === 'select' ? (
                // Select Existing Admin
                <div>
                  {admins.length === 0 ? (
                    <div className="text-center py-8 bg-brand-navy/5 rounded-lg p-4 border border-brand-border">
                      <AlertCircle size={40} className="mx-auto mb-3 text-brand-text-muted" />
                      <p className="text-brand-text-secondary mb-4">{t('colleges.noAvailableAdmins') || 'No available COLLEGE_ADMIN users found'}</p>
                      <p className="text-sm text-brand-text-muted">{t('colleges.canCreateAdminLater') || 'You can assign an admin later'}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('colleges.selectCollegeAdmin') || 'Select College Admin'}</label>
                      <select
                        value={selectedAdminId}
                        onChange={(e) => setSelectedAdminId(e.target.value)}
                        className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none"
                      >
                        <option value="">{t('common.selectOptional')} {t('colleges.admin')}</option>
                        {admins.map((admin) => (
                          <option key={admin.id} value={admin.id}>
                            {admin.email}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              ) : (
                // Create New Admin Form
                <div className="space-y-4">
                  <p className="text-sm text-brand-text-secondary">{t('colleges.createAdminDesc') || 'Create a new COLLEGE_ADMIN user who will be assigned to this college'}</p>
                  
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('admins.email') || 'Email'}</label>
                    <Input
                      type="email"
                      name="email"
                      value={adminFormData.email}
                      onChange={handleAdminChange}
                      placeholder="admin@college.edu"
                      required
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('admins.password') || 'Password'}</label>
                    <Input
                      type="password"
                      name="password"
                      value={adminFormData.password}
                      onChange={handleAdminChange}
                      placeholder="••••••••"
                      required
                      disabled={loading}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('admins.firstName') || 'First Name'}</label>
                      <Input
                        name="firstName"
                        value={adminFormData.firstName}
                        onChange={handleAdminChange}
                        placeholder="Ahmed"
                        required
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('admins.lastName') || 'Last Name'}</label>
                      <Input
                        name="lastName"
                        value={adminFormData.lastName}
                        onChange={handleAdminChange}
                        placeholder="Mohamed"
                        required
                        disabled={loading}
                      />
                    </div>
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
              className="flex items-center gap-2"
            >
              {t('common.skip')}
            </Button>
            {assignMode === 'select' ? (
              <Button
                type="button"
                disabled={loading}
                onClick={handleAssignAdmin}
                className="min-w-[140px] flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    <span>{t('common.assigning')}</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={18} />
                    {selectedAdminId ? t('colleges.assignAdmin') : t('common.finish')}
                  </>
                )}
              </Button>
            ) : (
              <Button
                type="button"
                disabled={loading}
                onClick={handleCreateAdmin}
                className="min-w-[140px] flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    <span>{t('common.creating')}</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={18} />
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

export default AddCollegeModal;
