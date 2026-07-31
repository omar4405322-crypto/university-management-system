// ENHANCED: Added College, Department, Bio fields - Phase 5
import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import doctorsService from '../../services/doctors.service';
import collegeService from '../../services/college.service';
import departmentService from '../../services/department.service';
import Button from '../../components/ui/button';
import Input from '../../components/ui/input';
import { useTranslation } from 'react-i18next';
import {
  User,
  Mail,
  Lock,
  Phone,
  Briefcase,
  Hash,
  Building2,
  GraduationCap,
  FileText,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import Modal from '../../components/ui/Modal';
import { useLanguage } from '../../context/LanguageContext';

const SectionHeading = ({ icon, label }: { icon: React.ReactNode; label: string }) => (
  <div className="flex items-center gap-2 pt-2 pb-1">
    <span className="text-brand-primary-500">{icon}</span>
    <span className="text-xs font-black uppercase tracking-widest text-brand-text-muted">{label}</span>
    <div className="flex-1 h-px bg-brand-border/50" />
  </div>
);

interface AddDoctorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AddDoctorModal: React.FC<AddDoctorModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    doctorId: '',
    email: '',
    password: '',
    phone: '',
    specialty: '',
    bio: '',
    departmentId: '',
  });

  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedCollegeId, setSelectedCollegeId] = useState('');
  const [loadingColleges, setLoadingColleges] = useState(false);
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load colleges & departments when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setLoadingColleges(true);
    collegeService.getColleges()
      .then(res => {
        if (res.success) setColleges(Array.isArray(res.data) ? res.data : res.data?.data || []);
      })
      .catch(() => {})
      .finally(() => setLoadingColleges(false));

    setLoadingDepts(true);
    departmentService.getDepartments()
      .then(res => {
        if (res.success) setDepartments(Array.isArray(res.data) ? res.data : res.data?.data || []);
      })
      .catch(() => {})
      .finally(() => setLoadingDepts(false));
  }, [isOpen]);

  // Reset form on open/close
  useEffect(() => {
    if (isOpen) {
      setFormData({ firstName: '', lastName: '', doctorId: '', email: '', password: '', phone: '', specialty: '', bio: '', departmentId: '' });
      setSelectedCollegeId('');
    }
  }, [isOpen]);

  const availableDepartments = useMemo(() =>
    departments.filter((d: any) => {
      if (!selectedCollegeId) return true;
      return (d.collegeId || d.college?.id)?.toString() === selectedCollegeId;
    }),
    [departments, selectedCollegeId]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleCollegeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCollegeId(e.target.value);
    setFormData(prev => ({ ...prev, departmentId: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName || !formData.lastName || !formData.doctorId || !formData.email || !formData.password) {
      toast.error(t('doctors.fillRequired'));
      return;
    }
    if (formData.password.length < 6) {
      toast.error(t('doctors.passwordLength'));
      return;
    }

    try {
      setLoading(true);
      const payload: any = { ...formData };
      if (!payload.departmentId) delete payload.departmentId;
      const result = await doctorsService.createDoctor(payload);
      if (result.success) {
        toast.success(t('doctors.createSuccess', 'Doctor created successfully'));
        onSuccess();
      } else {
        toast.error(result.message || t('doctors.createError'));
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('doctors.createError'));
    } finally {
      setLoading(false);
    }
  };

  const selectClass = "w-full px-4 py-2.5 rounded-xl border border-brand-border bg-brand-bg-page/30 text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 transition-all cursor-pointer text-sm appearance-none disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('doctors.addNew')} subtitle={t('doctors.addDesc')}>
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* ── Identity ── */}
        <SectionHeading icon={<User size={13} />} label={t('doctors.sectionIdentity', 'Personal Info')} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <User size={13} className="text-brand-text-muted" /> {t('doctors.firstName')} <span className="text-rose-500">*</span>
            </label>
            <Input name="firstName" value={formData.firstName} onChange={handleChange}
              placeholder={t('doctors.firstNamePlaceholder')} required
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <User size={13} className="text-brand-text-muted" /> {t('doctors.lastName')} <span className="text-rose-500">*</span>
            </label>
            <Input name="lastName" value={formData.lastName} onChange={handleChange}
              placeholder={t('doctors.lastNamePlaceholder')} required
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <Hash size={13} className="text-brand-text-muted" /> {t('doctors.doctorId')} <span className="text-rose-500">*</span>
            </label>
            <Input name="doctorId" value={formData.doctorId} onChange={handleChange}
              placeholder={t('doctors.doctorIdPlaceholder')} required
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <Briefcase size={13} className="text-brand-text-muted" /> {t('doctors.specialty')}
            </label>
            <Input name="specialty" value={formData.specialty} onChange={handleChange}
              placeholder={t('doctors.specialtyPlaceholder')}
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all" />
          </div>
        </div>

        {/* Bio */}
        <div className="space-y-1.5">
          <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
            <FileText size={13} className="text-brand-text-muted" /> {t('doctors.bio', 'Bio / About')}
          </label>
          <textarea
            name="bio"
            value={formData.bio}
            onChange={handleChange}
            rows={2}
            placeholder={t('doctors.bioPlaceholder', 'e.g. Dr. Ali is an expert in embedded systems with 10+ years of research...')}
            className="w-full px-4 py-2.5 rounded-xl border border-brand-border bg-brand-bg-page/30 text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 transition-all text-sm resize-none"
          />
        </div>

        {/* ── Academic Affiliation ── */}
        <SectionHeading icon={<GraduationCap size={13} />} label={t('doctors.sectionAcademic', 'Academic Affiliation')} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <Building2 size={13} className="text-brand-text-muted" /> {t('colleges.college', 'College / Faculty')}
            </label>
            <div className="relative">
              <select value={selectedCollegeId} onChange={handleCollegeChange} className={selectClass} disabled={loadingColleges}>
                <option value="">{loadingColleges ? t('common.loading', 'Loading...') : t('timetables.selectCollege', 'Select College')}</option>
                {colleges.map((c: any) => (
                  <option key={c.id} value={c.id.toString()}>{isRTL ? c.nameAr || c.name : c.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <GraduationCap size={13} className="text-brand-text-muted" /> {t('departments.department', 'Department')}
            </label>
            <div className="relative">
              <select
                name="departmentId"
                value={formData.departmentId}
                onChange={handleChange}
                className={selectClass}
                disabled={loadingDepts || availableDepartments.length === 0}
              >
                <option value="">{loadingDepts ? t('common.loading', 'Loading...') : t('timetables.selectDept', 'Select Department')}</option>
                {availableDepartments.map((d: any) => (
                  <option key={d.id} value={d.id.toString()}>{isRTL ? d.nameAr || d.name : d.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Courses note */}
        <div className="rounded-xl bg-brand-primary-50 dark:bg-brand-primary-900/10 border border-brand-primary-100 dark:border-brand-primary-800/30 px-4 py-3 flex items-start gap-3">
          <GraduationCap size={16} className="text-brand-primary-500 shrink-0 mt-0.5" />
          <p className="text-xs text-brand-primary-700 dark:text-brand-primary-300">
            {t('doctors.coursesNote', 'Courses taught by this professor will be assigned automatically when you create their schedule slots in the Timetable Management section.')}
          </p>
        </div>

        {/* ── Account Credentials ── */}
        <SectionHeading icon={<Mail size={13} />} label={t('doctors.sectionCredentials', 'Account Credentials')} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <Mail size={13} className="text-brand-text-muted" /> {t('profile.email')} <span className="text-rose-500">*</span>
            </label>
            <Input type="email" name="email" value={formData.email} onChange={handleChange}
              placeholder={t('doctors.emailPlaceholder')} required
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <Lock size={13} className="text-brand-text-muted" /> {t('profile.password')} <span className="text-rose-500">*</span>
            </label>
            <Input type="password" name="password" value={formData.password} onChange={handleChange}
              placeholder={t('doctors.passwordPlaceholder')} required
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all" />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <Phone size={13} className="text-brand-text-muted" /> {t('profile.phone')}
            </label>
            <Input name="phone" value={formData.phone} onChange={handleChange}
              placeholder={t('doctors.phonePlaceholder')}
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all" />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3 border-t border-brand-border pt-5">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={loading} className="min-w-[140px]">
            {loading ? <Loader2 className="animate-spin" size={18} /> : t('doctors.createDoctor')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AddDoctorModal;
