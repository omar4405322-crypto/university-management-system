// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, ShieldCheck, Building2, Users, Loader2 } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/button';
import Input from '../../components/ui/input';
import usersService from '../../services/users.service';
import departmentService from '../../services/department.service';
import { useToast } from '../../context/ToastContext';

interface EditAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  admin: any;
  colleges: any[];
}

const EditAdminModal: React.FC<EditAdminModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  admin,
  colleges = [],
}) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState('SUPER_ADMIN');
  const [managedCollegeId, setManagedCollegeId] = useState('');
  const [managedDepartmentId, setManagedDepartmentId] = useState('');
  const [departments, setDepartments] = useState([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && admin) {
      setEmail(admin.email || '');
      setRole(admin.role || 'SUPER_ADMIN');
      const collegeId = admin.managedCollegeId || admin.managedCollege?.id || admin.college?.id || '';
      const deptId = admin.managedDepartmentId || admin.managedDepartment?.id || admin.department?.id || '';
      setManagedCollegeId(collegeId ? String(collegeId) : '');
      setManagedDepartmentId(deptId ? String(deptId) : '');
      if (collegeId) {
        fetchDepartments(String(collegeId));
      }
    }
  }, [isOpen, admin]);

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
    if (!admin) return;

    if (!email) {
      showToast(isRTL ? 'يرجى إدخال البريد الإلكتروني' : 'Please enter email address', 'error');
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
        email,
        role,
      };

      if (managedCollegeId) payload.managedCollegeId = managedCollegeId;
      if (managedDepartmentId) payload.managedDepartmentId = managedDepartmentId;

      const res = await usersService.updateAdmin(admin.id, payload);
      if (res.success) {
        showToast(isRTL ? 'تم تحديث بيانات المسؤول بنجاح' : 'Admin updated successfully', 'success');
        onSuccess();
        onClose();
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || (isRTL ? 'فشل تحديث البيانات' : 'Failed to update admin'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isRTL ? 'تعديل بيانات المسؤول' : 'Edit Admin Details'}
      subtitle={isRTL ? 'تعديل الدور والصلاحيات والنطاق الأكاديمي للمسؤول' : 'Update admin role, permissions, and scope'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-start pt-2">
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

        {/* College Selection */}
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
                if (e.target.value) {
                  fetchDepartments(e.target.value);
                }
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

        {/* Department Selection */}
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
                {isRTL ? 'جاري الحفظ...' : 'Saving...'}
              </span>
            ) : (
              isRTL ? 'حفظ التعديلات' : 'Save Changes'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default EditAdminModal;
