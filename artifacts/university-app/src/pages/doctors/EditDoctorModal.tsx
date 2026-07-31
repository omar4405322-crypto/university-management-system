// ENHANCED: Added Department selector, bio, courses-taught display - Phase 5
import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import doctorsService from '../../services/doctors.service';
import collegeService from '../../services/college.service';
import departmentService from '../../services/department.service';
import Button from '../../components/ui/button';
import Input from '../../components/ui/input';
import { useTranslation } from 'react-i18next';
import {
  X,
  User,
  Phone,
  Briefcase,
  Building2,
  GraduationCap,
  BookOpen,
  FileText,
  ChevronDown,
  Hash,
  Loader2,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

const SectionHeading = ({ icon, label }: { icon: React.ReactNode; label: string }) => (
  <div className="flex items-center gap-2 py-2">
    <span className="text-brand-primary-500">{icon}</span>
    <span className="text-xs font-black uppercase tracking-widest text-brand-text-muted">{label}</span>
    <div className="flex-1 h-px bg-brand-border/50" />
  </div>
);

interface EditDoctorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  doctor: any;
}

const EditDoctorModal: React.FC<EditDoctorModalProps> = ({ isOpen, onClose, onSuccess, doctor }) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
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

  // Load college & department lists
  useEffect(() => {
    if (!isOpen) return;
    setLoadingColleges(true);
    collegeService.getColleges()
      .then(res => { if (res.success) setColleges(Array.isArray(res.data) ? res.data : res.data?.data || []); })
      .catch(() => {})
      .finally(() => setLoadingColleges(false));

    setLoadingDepts(true);
    departmentService.getDepartments()
      .then(res => { if (res.success) setDepartments(Array.isArray(res.data) ? res.data : res.data?.data || []); })
      .catch(() => {})
      .finally(() => setLoadingDepts(false));
  }, [isOpen]);

  // Pre-fill from doctor prop
  useEffect(() => {
    if (doctor) {
      setFormData({
        firstName: doctor.firstName || '',
        lastName: doctor.lastName || '',
        phone: doctor.phone || '',
        specialty: doctor.specialty || '',
        bio: doctor.bio || '',
        departmentId: doctor.departmentId?.toString() || '',
      });
      // Pre-select the college from the doctor's department
      const collegeId = doctor.department?.college?.id || doctor.department?.collegeId;
      setSelectedCollegeId(collegeId?.toString() || '');
    }
  }, [doctor]);

  const availableDepartments = useMemo(() =>
    departments.filter((d: any) => {
      if (!selectedCollegeId) return true;
      return (d.collegeId || d.college?.id)?.toString() === selectedCollegeId;
    }),
    [departments, selectedCollegeId]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleCollegeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCollegeId(e.target.value);
    setFormData(prev => ({ ...prev, departmentId: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName || !formData.lastName) {
      toast.error(t('doctors.fillRequired'));
      return;
    }
    try {
      setLoading(true);
      const payload: any = { ...formData };
      if (!payload.departmentId) payload.departmentId = null;
      else payload.departmentId = parseInt(payload.departmentId);
      const result = await doctorsService.updateDoctor(doctor.id, payload);
      if (result.success) {
        toast.success(t('doctors.updateSuccess', 'Doctor updated successfully'));
        onSuccess();
      } else {
        toast.error(result.message || t('doctors.updateError'));
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('doctors.updateError'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const taughtCourses: any[] = doctor?.taughtCourses || [];
  const selectClass = "w-full px-4 py-2.5 rounded-xl border border-brand-border bg-brand-bg-page/30 text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 transition-all cursor-pointer text-sm appearance-none disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-brand-navy-500/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-brand-bg-card dark:bg-brand-bg-elevated rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="sticky top-0 z-10 px-6 py-4 border-b border-brand-border flex justify-between items-start bg-brand-bg-card dark:bg-brand-bg-elevated">
          <div>
            <h2 className="text-xl font-bold text-brand-text-primary dark:text-brand-text-main">
              {t('doctors.editTitle')}: <span className="text-brand-primary-500">{doctor?.firstName} {doctor?.lastName}</span>
            </h2>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {doctor?.doctorId && (
                <span className="flex items-center gap-1 text-xs text-brand-text-muted">
                  <Hash size={11} /> {doctor.doctorId}
                </span>
              )}
              {doctor?.department?.name && (
                <span className="flex items-center gap-1 text-xs text-brand-text-muted">
                  <Building2 size={11} /> {doctor.department.name}
                </span>
              )}
              {doctor?.department?.college?.name && (
                <span className="flex items-center gap-1 text-xs text-brand-primary-500 font-semibold">
                  <GraduationCap size={11} /> {doctor.department.college.name}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-brand-text-muted hover:text-brand-text-secondary rounded-xl transition-colors shrink-0 mt-1">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          {/* ── Personal Info ── */}
          <SectionHeading icon={<User size={13} />} label={t('doctors.sectionIdentity', 'Personal Info')} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-brand-text-primary flex items-center gap-2 ml-1">
                <User size={13} className="text-brand-text-muted" /> {t('doctors.firstName')} <span className="text-rose-500">*</span>
              </label>
              <Input name="firstName" value={formData.firstName} onChange={handleChange} placeholder="e.g. Sarah" required />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-brand-text-primary flex items-center gap-2 ml-1">
                <User size={13} className="text-brand-text-muted" /> {t('doctors.lastName')} <span className="text-rose-500">*</span>
              </label>
              <Input name="lastName" value={formData.lastName} onChange={handleChange} placeholder="e.g. Wilson" required />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-brand-text-primary flex items-center gap-2 ml-1">
                <Briefcase size={13} className="text-brand-text-muted" /> {t('doctors.specialty')}
              </label>
              <Input name="specialty" value={formData.specialty} onChange={handleChange} placeholder={t('doctors.specialtyPlaceholder')} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-brand-text-primary flex items-center gap-2 ml-1">
                <Phone size={13} className="text-brand-text-muted" /> {t('profile.phone')}
              </label>
              <Input name="phone" value={formData.phone} onChange={handleChange} placeholder={t('doctors.phonePlaceholder')} />
            </div>
          </div>

          {/* Bio */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-brand-text-primary flex items-center gap-2 ml-1">
              <FileText size={13} className="text-brand-text-muted" /> {t('doctors.bio', 'Bio / About')}
            </label>
            <textarea
              name="bio"
              value={formData.bio}
              onChange={handleChange}
              rows={3}
              placeholder={t('doctors.bioPlaceholder', 'e.g. Dr. Ali is an expert in embedded systems...')}
              className="w-full px-4 py-2.5 rounded-xl border border-brand-border bg-brand-bg-page/30 text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 transition-all text-sm resize-none"
            />
          </div>

          {/* ── Academic Affiliation ── */}
          <SectionHeading icon={<GraduationCap size={13} />} label={t('doctors.sectionAcademic', 'Academic Affiliation')} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-brand-text-primary flex items-center gap-2 ml-1">
                <Building2 size={13} className="text-brand-text-muted" /> {t('colleges.college', 'College / Faculty')}
              </label>
              <div className="relative">
                <select value={selectedCollegeId} onChange={handleCollegeChange} className={selectClass} disabled={loadingColleges}>
                  <option value="">{loadingColleges ? t('common.loading') : t('timetables.selectCollege', 'Select College')}</option>
                  {colleges.map((c: any) => (
                    <option key={c.id} value={c.id.toString()}>{isRTL ? c.nameAr || c.name : c.name}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-brand-text-primary flex items-center gap-2 ml-1">
                <GraduationCap size={13} className="text-brand-text-muted" /> {t('departments.department', 'Department')}
              </label>
              <div className="relative">
                <select
                  name="departmentId"
                  value={formData.departmentId}
                  onChange={handleChange}
                  className={selectClass}
                  disabled={loadingDepts}
                >
                  <option value="">{loadingDepts ? t('common.loading') : t('timetables.selectDept', 'No Department')}</option>
                  {availableDepartments.map((d: any) => (
                    <option key={d.id} value={d.id.toString()}>{isRTL ? d.nameAr || d.name : d.name}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* ── Courses Taught ── */}
          <SectionHeading icon={<BookOpen size={13} />} label={t('doctors.coursesTaught', 'Courses Taught')} />
          {taughtCourses.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {taughtCourses.map((course: any) => (
                <div key={course.id} className="flex items-start gap-2 p-3 rounded-xl bg-brand-primary-50 dark:bg-brand-primary-900/10 border border-brand-primary-100 dark:border-brand-primary-800/30">
                  <BookOpen size={14} className="text-brand-primary-500 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-brand-primary-700 dark:text-brand-primary-300 truncate">{course.name}</p>
                    <p className="text-[10px] text-brand-text-muted mt-0.5">
                      {course.courseCode} · {t('common.year', 'Year')} {course.year} · {t('schedule.sem', 'Sem')} {course.semester}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-brand-border bg-brand-bg-page/30 px-4 py-5 text-center">
              <BookOpen size={22} className="mx-auto text-brand-text-muted opacity-40 mb-2" />
              <p className="text-xs text-brand-text-muted">{t('doctors.noCoursesYet', 'No courses assigned yet. Create schedule slots to link courses.')}</p>
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex justify-end gap-3 border-t border-brand-border pt-5">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={loading} className="min-w-[120px]">
              {loading ? <Loader2 size={16} className="animate-spin" /> : t('common.saveChanges')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditDoctorModal;
