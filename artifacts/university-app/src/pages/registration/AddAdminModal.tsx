// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, Lock, ShieldCheck, Building2, Users, Loader2, User } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/button';
import Input from '../../components/ui/input';
import usersService from '../../services/users.service';
import departmentService from '../../services/department.service';
import { useToast } from '../../context/ToastContext';

interface AddAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  colleges: any[];
}

const AddAdminModal: React.FC<AddAdminModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  colleges = [],
}) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { showToast } = useToast();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('SUPER_ADMIN');
  const [managedCollegeId, setManagedCollegeId] = useState('');
  const [managedDepartmentId, setManagedDepartmentId] = useState('');
  const [departments, setDepartments] = useState([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFirstName('');
      setLastName('');
      setEmail('');
      setPassword('');
      setRole('SUPER_ADMIN');
      setManagedCollegeId('');
      setManagedDepartmentId('');
      setDepartments([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (managedCollegeId) {
      fetchDepartments(managedCollegeId);
    } else {
      setDepartments([]);
      setManagedDepartmentId('');
    }
  }, [managedCollegeId]);

  const fetchDepartments = async (collegeId: string) => {
    try {
      setLoadingDepartments(true);
      const res = await departmentService.getDepartments({ collegeId });
      if (res.success) {
        setDepartments(res.data || []);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
    } finally {
      setLoadingDepartments(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName || !lastName || !email || !password) {
      showToast(isRTL ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill in required fields', 'error');
      return;
    }

    if (password.length < 8) {
      showToast(isRTL ? 'يجب أن تكون كلمة المرور 8 أحرف على الأقل' : 'Password must be at least 8 characters long', 'error');
      return;
    }

    if ((role === 'COLLEGE_ADMIN' || role === 'DEPARTMENT_ADMIN') && !managedCollegeId) {
      showToast(isRTL ? 'يرجى اختيار الكلية' : 'Please select a college', 'error');
      return;
    }

    if (role === 'DEPARTMENT_ADMIN' && !managedDepartmentId) {
      showToast(isRTL ? 'يرجى اختيار القسم' : 'Please select a department', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const payload: any = {
        firstName,
        lastName,
        email,
        password,
        role,
      };

      if (managedCollegeId) payload.managedCollegeId = managedCollegeId;
      if (managedDepartmentId) payload.managedDepartmentId = managedDepartmentId;

      const res = await usersService.createAdmin(payload);
      if (res.success) {
        showToast(isRTL ? 'تم إنشاء حساب المسؤول بنجاح' : 'Admin account created successfully', 'success');
        onSuccess();
        onClose();
      } else {
        showToast(res.message || (isRTL ? 'فشل إنشاء حساب المسؤول' : 'Failed to create admin'), 'error');
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || (isRTL ? 'فشل إنشاء حساب المسؤول' : 'Failed to create admin'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isRTL ? 'إضافة مسؤول جديد' : 'Add New Admin'}
      subtitle={isRTL ? 'إضافة حساب جديد وتحديد صلاحياته ونطاق إدارته' : 'Create a new admin account and set permissions'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-start pt-2">
        {/* Name Fields */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-brand-text-muted flex items-center gap-2">
              <User size={14} className="text-brand-primary-500" />
              {isRTL ? 'الاسم الأول' : 'First Name'} *
            </label>
            <Input
              type="text"
              placeholder={isRTL ? 'أحمد' : 'John'}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-brand-text-muted flex items-center gap-2">
              <User size={14} className="text-brand-primary-500" />
              {isRTL ? 'اسم العائلة' : 'Last Name'} *
            </label>
            <Input
              type="text"
              placeholder={isRTL ? 'محمد' : 'Doe'}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label className="text-xs font-black uppercase tracking-wider text-brand-text-muted flex items-center gap-2">
            <Mail size={14} className="text-brand-primary-500" />
            {isRTL ? 'البريد الإلكتروني' : 'Email Address'} *
          </label>
          <Input
            type="email"
            placeholder="admin@university.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label className="text-xs font-black uppercase tracking-wider text-brand-text-muted flex items-center gap-2">
            <Lock size={14} className="text-brand-primary-500" />
            {isRTL ? 'كلمة المرور' : 'Password'} *
          </label>
          <Input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <p className="text-[11px] text-brand-text-muted">
            {isRTL ? '8 أحرف على الأقل' : 'Minimum 8 characters'}
          </p>
        </div>

        {/* Role Select */}
        <div className="space-y-1.5">
          <label className="text-xs font-black uppercase tracking-wider text-brand-text-muted flex items-center gap-2">
            <ShieldCheck size={14} className="text-brand-primary-500" />
            {isRTL ? 'الصلاحية / نوع الحساب' : 'Role / Account Type'} *
          </label>
          <select
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              if (e.target.value === 'SUPER_ADMIN') {
                setManagedCollegeId('');
                setManagedDepartmentId('');
              }
            }}
            className="w-full px-4 py-2.5 bg-brand-bg-page border border-brand-border rounded-xl text-sm font-semibold text-brand-text-primary focus:ring-2 focus:ring-brand-primary-500/20 outline-none"
          >
            <option value="SUPER_ADMIN">{isRTL ? 'مسؤول الجامعة (Super Admin)' : 'Super Admin'}</option>
            <option value="COLLEGE_ADMIN">{isRTL ? 'مسؤول كلية (College Admin)' : 'College Admin'}</option>
            <option value="DEPARTMENT_ADMIN">{isRTL ? 'مسؤول قسم (Department Admin)' : 'Department Admin'}</option>
          </select>
        </div>

        {/* College Selection for COLLEGE_ADMIN or DEPARTMENT_ADMIN */}
        {(role === 'COLLEGE_ADMIN' || role === 'DEPARTMENT_ADMIN') && (
          <div className="space-y-1.5 animate-in fade-in duration-200">
            <label className="text-xs font-black uppercase tracking-wider text-brand-text-muted flex items-center gap-2">
              <Building2 size={14} className="text-brand-primary-500" />
              {isRTL ? 'الكلية التابعة' : 'Managed College'} *
            </label>
            <select
              value={managedCollegeId}
              onChange={(e) => {
                setManagedCollegeId(e.target.value);
                setManagedDepartmentId('');
              }}
              className="w-full px-4 py-2.5 bg-brand-bg-page border border-brand-border rounded-xl text-sm font-semibold text-brand-text-primary focus:ring-2 focus:ring-brand-primary-500/20 outline-none"
              required
            >
              <option value="">{isRTL ? 'اختر الكلية...' : 'Select College...'}</option>
              {colleges.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Department Selection for DEPARTMENT_ADMIN */}
        {role === 'DEPARTMENT_ADMIN' && (
          <div className="space-y-1.5 animate-in fade-in duration-200">
            <label className="text-xs font-black uppercase tracking-wider text-brand-text-muted flex items-center gap-2">
              <Users size={14} className="text-brand-primary-500" />
              {isRTL ? 'القسم التابع' : 'Managed Department'} *
            </label>
            <select
              value={managedDepartmentId}
              onChange={(e) => setManagedDepartmentId(e.target.value)}
              disabled={!managedCollegeId || loadingDepartments}
              className="w-full px-4 py-2.5 bg-brand-bg-page border border-brand-border rounded-xl text-sm font-semibold text-brand-text-primary focus:ring-2 focus:ring-brand-primary-500/20 outline-none disabled:opacity-50"
              required
            >
              <option value="">
                {loadingDepartments
                  ? (isRTL ? 'جاري تحميل الأقسام...' : 'Loading departments...')
                  : (isRTL ? 'اختر القسم...' : 'Select Department...')}
              </option>
              {departments.map((d: any) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mt-8 flex justify-end gap-3 pt-4 border-t border-brand-border">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            {isRTL ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="animate-spin" size={16} />
                {isRTL ? 'جاري الإضافة...' : 'Creating...'}
              </span>
            ) : (
              isRTL ? 'إضافة المسؤول' : 'Add Admin'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AddAdminModal;
