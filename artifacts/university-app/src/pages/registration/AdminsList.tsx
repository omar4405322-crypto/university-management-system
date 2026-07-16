// @ts-nocheck
// FIXED: Guard optional email when rendering admin rows (prevents intermittent blank page) - Phase 1
import React, { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import Table, { TableRow, TableCell, TableHeader, TableHead, TableBody, ActionMenu } from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import FilterBar from '../../components/ui/FilterBar';
import { Trash2, ShieldCheck, AlertCircle, CheckCircle, X, Loader2, Building2, Users, Search, Plus } from 'lucide-react';
import usersService from '../../services/users.service';
import collegeService from '../../services/college.service';
import departmentService from '../../services/department.service';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import MaskedEmail from '../../components/MaskedEmail';
import Input from '../../components/ui/input';
import Button from '../../components/ui/Button';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
  role: z.enum(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN']),
  managedCollegeId: z.string().optional(),
  managedDepartmentId: z.string().optional()
});

type FormData = z.infer<typeof schema>;

const AdminModal = ({ isOpen, onClose, onSuccess, colleges }) => {
  const { t } = useTranslation();
  const [departments, setDepartments] = useState([]);
  const [toast, setToast] = useState(null);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      password: '',
      role: 'SUPER_ADMIN',
      managedCollegeId: '',
      managedDepartmentId: ''
    }
  });

  const role = watch('role');
  const managedCollegeId = watch('managedCollegeId');

  useEffect(() => {
    if (isOpen) {
      reset();
    }
  }, [isOpen, reset]);

  useEffect(() => {
    if (managedCollegeId) {
      fetchDepartments(managedCollegeId);
    }
  }, [managedCollegeId]);

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchDepartments = async (collegeId) => {
    try {
      const res = await departmentService.getDepartments({ collegeId });
      if (res.success) setDepartments(res.data);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const onSubmit = async (data) => {
    try {
      const payload = {
        email: data.email,
        password: data.password,
        role: data.role,
        managedCollegeId: data.managedCollegeId || undefined,
        managedDepartmentId: data.managedDepartmentId || undefined,
      };
      const res = await usersService.createAdmin(payload);
      if (res.success) {
        onSuccess();
        onClose();
      }
    } catch (error) {
      showToast(error.response?.data?.message || t('admins.createError'), 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800">
        <div className="px-6 py-4 border-b border-brand-border dark:border-brand-border flex justify-between items-center bg-surface-subtle dark:bg-slate-800/50">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('admins.addNew')}</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {toast && (
            <div className={`p-4 rounded-xl text-white flex items-center gap-2 ${toast.type === 'error' ? 'bg-rose-500' : 'bg-emerald-500'}`}>
              <AlertCircle size={20} />
              <span>{toast.message}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('admins.email')}</label>
            <Input type="email" {...register('email')} placeholder="example@email.com" />
            {errors.email && <p className="text-rose-500 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('admins.password')}</label>
            <Input type="password" {...register('password')} placeholder="••••••••" />
            {errors.password && <p className="text-rose-500 text-xs mt-1">{errors.password.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('admins.roleType')}</label>
            <select {...register('role', { onChange: () => { setValue('managedCollegeId', ''); setValue('managedDepartmentId', ''); } })} className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none dark:text-white">
              <option value="SUPER_ADMIN">{t('admins.roleSuperAdmin')}</option>
              <option value="COLLEGE_ADMIN">{t('admins.roleCollegeAdmin')}</option>
              <option value="DEPARTMENT_ADMIN">{t('admins.roleDeptAdmin')}</option>
            </select>
            {errors.role && <p className="text-rose-500 text-xs mt-1">{errors.role.message}</p>}
          </div>

          {(role === 'COLLEGE_ADMIN' || role === 'DEPARTMENT_ADMIN') && (
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('admins.college')}</label>
              <select 
                {...register('managedCollegeId', { onChange: () => setValue('managedDepartmentId', '') })}
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
              >
                <option value="">{t('admins.selectCollege')}</option>
                {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {errors.managedCollegeId && <p className="text-rose-500 text-xs mt-1">{errors.managedCollegeId.message}</p>}
            </div>
          )}

          {role === 'DEPARTMENT_ADMIN' && (
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('admins.department')}</label>
              <select 
                {...register('managedDepartmentId')}
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
              >
                <option value="">{t('admins.selectDepartment')}</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              {errors.managedDepartmentId && <p className="text-rose-500 text-xs mt-1">{errors.managedDepartmentId.message}</p>}
            </div>
          )}

          <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-brand-border dark:border-brand-border">
            <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={isSubmitting}>{t('admins.createAdmin')}</Button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AdminsList = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.classList.add('bg-slate-50', 'dark:bg-slate-900');
    }
    return () => {
      if (mainEl) {
        mainEl.classList.remove('bg-slate-50', 'dark:bg-slate-900');
      }
    };
  }, []);

  const isRTL = i18n.language === 'ar';

  const totalAdminsCount = (admins || []).length;
  const universityAdminsCount = (admins || []).filter((admin) => !admin.managedCollege && !admin.college).length;
  const collegeAndDeptAdminsCount = totalAdminsCount - universityAdminsCount;

  useEffect(() => {
    fetchAdmins();
    fetchColleges();
  }, []);

  const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'];

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const res = await usersService.getUsers({ role: ADMIN_ROLES });
      if (res.success) {
        const list = Array.isArray(res.data) ? res.data : [];
        setAdmins(list.filter((u) => ADMIN_ROLES.includes(u.role)));
      }
    } catch (error) {
      console.error('Error fetching admins:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchColleges = async () => {
    try {
      const res = await collegeService.getColleges();
      if (res.success) setColleges(res.data);
    } catch (error) {
      console.error('Error fetching colleges:', error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm(t('admins.deleteConfirm'))) {
      try {
        const res = await usersService.deleteUser(id);
        if (res.success) {
          showToast(t('admins.deleteSuccess'), 'success');
          fetchAdmins();
        }
      } catch (error) {
        showToast(error.response?.data?.message || t('admins.deleteError'), 'error');
      }
    }
  };

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const filteredAdmins = (admins || []).filter((admin) =>
    (admin.email || '').toLowerCase().includes((search || '').toLowerCase())
  );

  return (
    <div className="pt-6 section-gap animate-in fade-in duration-700">
      {toast && (
        <div className={`${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
          <div className="flex items-center gap-2">
            {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}

      <PageHeader 
        title={t('admins.title')}
        subtitle={t('admins.subtitle')}
        action={user?.role === 'SUPER_ADMIN' ? {
          label: t('admins.addAdmin'),
          onClick: () => setIsModalOpen(true),
          icon: Plus,
          className: "bg-brand-primary-500 hover:bg-brand-primary-600 text-white font-bold rounded-xl active:scale-95 transition-all flex items-center gap-2 px-4 py-2"
        } : null}
      />

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Total Admins */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 flex items-center gap-4 group hover:-translate-y-0.5 hover:shadow-md transition-all text-start">
          <div className="rounded-xl p-2.5 bg-brand-primary-500/10 text-brand-primary-500">
            <ShieldCheck size={24} />
          </div>
          <div className="flex flex-col">
            <span className="text-2xl font-black text-brand-text-primary dark:text-white">
              {totalAdminsCount}
            </span>
            <span className="text-sm text-brand-text-secondary dark:text-slate-400 font-bold">
              {t('admins.totalAdmins')}
            </span>
          </div>
        </div>

        {/* Card 2: University Admins */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 flex items-center gap-4 group hover:-translate-y-0.5 hover:shadow-md transition-all text-start">
          <div className="rounded-xl p-2.5 bg-blue-500/10 text-blue-500">
            <Building2 size={24} />
          </div>
          <div className="flex flex-col">
            <span className="text-2xl font-black text-brand-text-primary dark:text-white">
              {universityAdminsCount}
            </span>
            <span className="text-sm text-brand-text-secondary dark:text-slate-400 font-bold">
              {t('admins.universityAdmins')}
            </span>
          </div>
        </div>

        {/* Card 3: College & Dept Admins */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 flex items-center gap-4 group hover:-translate-y-0.5 hover:shadow-md transition-all text-start">
          <div className="rounded-xl p-2.5 bg-amber-500/10 text-amber-500">
            <Users size={24} />
          </div>
          <div className="flex flex-col">
            <span className="text-2xl font-black text-brand-text-primary dark:text-white">
              {collegeAndDeptAdminsCount}
            </span>
            <span className="text-sm text-brand-text-secondary dark:text-slate-400 font-bold">
              {t('admins.collegeAndDeptAdmins')}
            </span>
          </div>
        </div>
      </div>

      {/* Search Bar Card */}
      <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
        <div className="relative w-full">
          <Search
            className="absolute start-3 top-1/2 -translate-y-1/2 text-brand-text-muted"
            size={18}
          />
          <input
            type="text"
            placeholder={t('admins.searchPlaceholder')}
            className="w-full border border-slate-200 dark:border-slate-700 rounded-xl ps-10 pe-3 py-2 text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-primary-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </Card>

      {/* Table Content / Empty States */}
      <div className="min-h-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <Loader2 className="animate-spin text-brand-primary-500" size={40} />
            <p className="text-sm font-semibold text-brand-text-secondary dark:text-slate-400">
              {t('common.loading')}
            </p>
          </div>
        ) : filteredAdmins.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="rounded-full bg-brand-primary-500/10 p-5 mb-4">
              <ShieldCheck className="w-10 h-10 text-brand-primary-500" />
            </div>
            <h3 className="text-lg font-bold text-brand-text-primary dark:text-white mb-1">
              {t('admins.noAdmins')}
            </h3>
            <p className="text-sm text-brand-text-secondary dark:text-slate-400">
              {t('admins.noAdminsDesc')}
            </p>
          </div>
        ) : (
          <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden p-0">
            <div className="overflow-x-auto">
              <Table className="w-full">
                <TableHeader className="bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700">
                  <TableRow>
                    <TableHead className="text-start p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {t('admins.colAdmin')}
                    </TableHead>
                    <TableHead className="text-start p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {t('admins.colEmail')}
                    </TableHead>
                    <TableHead className="text-center p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {t('admins.colRole')}
                    </TableHead>
                    <TableHead className="text-center p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {t('admins.colScope')}
                    </TableHead>
                    <TableHead className="text-center p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {t('admins.colCreatedAt')}
                    </TableHead>
                    <TableHead className="text-end p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 pe-6">
                      {t('admins.colActions')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAdmins.map((admin) => {
                    let roleClass = 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
                    let roleLabel = t('admins.roleAdmin');
                    
                    if (admin.role === 'SUPER_ADMIN') {
                      roleClass = 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
                      roleLabel = t('admins.roleSuperAdmin');
                    } else if (admin.role === 'COLLEGE_ADMIN') {
                      roleClass = 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400';
                      roleLabel = t('admins.roleCollegeAdmin');
                    } else if (admin.role === 'DEPARTMENT_ADMIN') {
                      roleClass = 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
                      roleLabel = t('admins.roleDeptAdmin');
                    }

                    return (
                      <TableRow 
                        key={admin.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 last:border-b-0 transition-colors"
                      >
                        <TableCell className="p-4 text-start">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-brand-primary-500/10 flex items-center justify-center flex-shrink-0">
                              <ShieldCheck className="w-5 h-5 text-brand-primary-600" />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-brand-text-primary dark:text-white">
                                {(admin.email || 'admin').split('@')[0]}
                              </span>
                              <span className="text-xs text-brand-text-secondary dark:text-slate-400">
                                <MaskedEmail email={admin.email} />
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="p-4 text-start font-medium text-slate-500 dark:text-slate-400">
                          <MaskedEmail email={admin.email} />
                        </TableCell>
                        <TableCell className="p-4 text-center">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${roleClass}`}>
                            {roleLabel}
                          </span>
                        </TableCell>
                        <TableCell className="p-4 text-center font-medium">
                          <div className="flex flex-col items-center">
                            <span className="text-xs font-bold text-brand-text-primary dark:text-white uppercase tracking-tight truncate max-w-[180px]">
                              {admin.managedCollege?.name || admin.college?.name || 'All University'}
                            </span>
                            {admin.department && (
                              <span className="text-[10px] text-brand-text-secondary dark:text-slate-400 truncate max-w-[150px]">
                                {admin.department.name}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="p-4 text-center font-medium text-slate-500 dark:text-slate-400">
                          {new Date(admin.createdAt).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </TableCell>
                        <TableCell className="p-4 text-end pe-6">
                          {user?.role === 'SUPER_ADMIN' && admin.id !== user.id ? (
                            <ActionMenu actions={[
                              { label: 'Delete', icon: Trash2, variant: 'delete', onClick: () => handleDelete(admin.id) },
                            ]} />
                          ) : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </div>

      <AdminModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={fetchAdmins} colleges={colleges} />
    </div>
  );
};

export default AdminsList;
