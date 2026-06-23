import React, { useState, useEffect } from 'react';
import doctorsService from '../../services/doctors.service';
import departmentService from '../../services/department.service';
import coursesService from '../../services/courses.service';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTranslation } from 'react-i18next';
import {
  X,
  User,
  Phone,
  Briefcase,
  AlertCircle,
  CheckCircle,
  Building2,
  BookOpen,
  GraduationCap,
  Mail,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';

interface EditDoctorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  doctor: any;
}

const EditDoctorModal: React.FC<EditDoctorModalProps> = ({ isOpen, onClose, onSuccess, doctor }) => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');
  const isRTL = isAr;

  const [activeTab, setActiveTab] = useState<'personal' | 'department' | 'courses'>('personal');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    specialty: '',
    departmentId: '',
    isActive: true,
  });

  const [departments, setDepartments] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [initialCourseIds, setInitialCourseIds] = useState<number[]>([]);
  const [checkedCourseIds, setCheckedCourseIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (doctor) {
      setFormData({
        firstName: doctor.firstName || '',
        lastName: doctor.lastName || '',
        phone: doctor.phone || '',
        specialty: doctor.specialty || '',
        departmentId: doctor.departmentId ? doctor.departmentId.toString() : '',
        isActive: doctor.isActive !== false,
      });

      // Filter and pre-fill assigned courses
      if (courses.length > 0) {
        const assignedIds = courses
          .filter((course) => course.doctorId === doctor.id)
          .map((course) => course.id);
        setInitialCourseIds(assignedIds);
        setCheckedCourseIds(assignedIds);
      }
    }
  }, [doctor, courses]);

  // Fetch departments & courses when modal opens
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [deptRes, coursesRes] = await Promise.all([
          departmentService.getDepartments(),
          coursesService.getCourses({ limit: 1000 }),
        ]);

        if (deptRes.success) {
          setDepartments(deptRes.data);
        }
        if (coursesRes.success) {
          const allCourses = coursesRes.data.courses || [];
          setCourses(allCourses);

          if (doctor) {
            const assignedIds = allCourses
              .filter((course: any) => course.doctorId === doctor.id)
              .map((course: any) => course.id);
            setInitialCourseIds(assignedIds);
            setCheckedCourseIds(assignedIds);
          }
        }
      } catch (error) {
        console.error('Error fetching modal data:', error);
      }
    };

    if (isOpen) {
      fetchData();
      setActiveTab('personal');
      setToast(null);
    }
  }, [isOpen, doctor]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleCourseToggle = (courseId: number) => {
    setCheckedCourseIds((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName || !formData.lastName) {
      showToast(t('doctors.fillRequired', 'يرجى ملء الحقول المطلوبة'), 'error');
      return;
    }

    try {
      setLoading(true);

      // 1. Update doctor personal details & department
      const doctorData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone || null,
        specialty: formData.specialty || null,
        departmentId: formData.departmentId ? parseInt(formData.departmentId, 10) : null,
      };

      const doctorResult = await doctorsService.updateDoctor(doctor.id.toString(), doctorData);

      if (!doctorResult.success) {
        showToast(doctorResult.message || t('doctors.updateError', 'حدث خطأ أثناء التحديث'), 'error');
        setLoading(false);
        return;
      }

      // 2. Compute course updates
      const toAdd = checkedCourseIds.filter((id) => !initialCourseIds.includes(id));
      const toRemove = initialCourseIds.filter((id) => !checkedCourseIds.includes(id));

      const addPromises = toAdd.map((courseId) =>
        coursesService.updateCourse(courseId.toString(), { doctorId: doctor.id })
      );

      const removePromises = toRemove.map((courseId) =>
        coursesService.updateCourse(courseId.toString(), { doctorId: null })
      );

      await Promise.all([...addPromises, ...removePromises]);

      onSuccess();
    } catch (error: any) {
      showToast(
        error.response?.data?.message || t('doctors.updateError', 'حدث خطأ أثناء التحديث'),
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-brand-navy-500/40 backdrop-blur-sm" onClick={onClose}></div>

      {/* Modal Content */}
      <div className="relative bg-brand-bg-card dark:bg-brand-bg-elevated rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto border border-brand-border dark:border-brand-border flex flex-col text-start">
        {/* Header */}
        <div className="px-6 py-4 border-b border-brand-border dark:border-brand-border flex justify-between items-center bg-brand-bg-page/50 dark:bg-brand-bg-elevated/50">
          <div>
            <h2 className="text-xl font-bold text-brand-text-primary dark:text-brand-text-main">
              {t('doctors.editTitle', 'تعديل بيانات الأستاذ')}: {doctor?.doctorId}
            </h2>
            <p className="text-sm text-brand-text-secondary dark:text-brand-text-muted mt-0.5">
              {t('doctors.editDesc', 'تعديل البيانات الشخصية والمقررات المسندة للأستاذ')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-brand-text-muted hover:text-brand-text-secondary dark:hover:text-brand-text-secondary hover:bg-brand-bg-page dark:hover:bg-brand-bg-elevated rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs Bar */}
        <div className="flex border-b border-brand-border dark:border-brand-border bg-brand-bg-page/20 px-6">
          <button
            type="button"
            onClick={() => setActiveTab('personal')}
            className={`py-3 px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'personal'
                ? 'border-brand-green-dark text-brand-green-dark dark:text-brand-green'
                : 'border-transparent text-brand-text-secondary dark:text-brand-text-muted hover:text-brand-text-primary'
            }`}
          >
            <User size={16} />
            {t('doctors.personalTab', 'البيانات الشخصية')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('department')}
            className={`py-3 px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'department'
                ? 'border-brand-green-dark text-brand-green-dark dark:text-brand-green'
                : 'border-transparent text-brand-text-secondary dark:text-brand-text-muted hover:text-brand-text-primary'
            }`}
          >
            <Building2 size={16} />
            {t('doctors.departmentTab', 'القسم الرئيسي')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('courses')}
            className={`py-3 px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'courses'
                ? 'border-brand-green-dark text-brand-green-dark dark:text-brand-green'
                : 'border-transparent text-brand-text-secondary dark:text-brand-text-muted hover:text-brand-text-primary'
            }`}
          >
            <BookOpen size={16} />
            {t('doctors.coursesTab', 'المقررات المسندة')}
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col">
          {toast && (
            <div
              className={`mb-6 p-4 rounded-xl text-white flex items-center gap-2 animate-in slide-in-from-top-2 duration-300 ${
                toast.type === 'error' ? 'bg-error' : 'bg-success'
              }`}
            >
              {toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
              <span className="font-medium">{toast.message}</span>
            </div>
          )}

          {/* Tab 1: Personal Details */}
          {activeTab === 'personal' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-brand-text-primary dark:text-brand-text-secondary flex items-center gap-2 ml-1">
                  <User size={14} className="text-brand-text-muted dark:text-brand-text-secondary" />{' '}
                  {t('doctors.firstName', 'الاسم الأول')} <span className="text-error">*</span>
                </label>
                <Input
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder={t('doctors.firstNamePlaceholder', 'أدخل الاسم الأول')}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-brand-text-primary dark:text-brand-text-secondary flex items-center gap-2 ml-1">
                  <User size={14} className="text-brand-text-muted dark:text-brand-text-secondary" />{' '}
                  {t('doctors.lastName', 'الاسم الأخير')} <span className="text-error">*</span>
                </label>
                <Input
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder={t('doctors.lastNamePlaceholder', 'أدخل الاسم الأخير')}
                  required
                />
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <label className="text-sm font-semibold text-brand-text-primary dark:text-brand-text-secondary flex items-center gap-2 ml-1">
                  <Mail size={14} className="text-brand-text-muted dark:text-brand-text-secondary" />{' '}
                  {t('profile.email', 'البريد الإلكتروني')}
                </label>
                <div className="w-full h-10 px-4 flex items-center bg-brand-bg-page/50 dark:bg-brand-bg-elevated border border-brand-border dark:border-brand-border rounded-xl text-sm text-brand-text-secondary dark:text-brand-text-muted cursor-not-allowed select-none font-mono">
                  {doctor?.user?.email}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-brand-text-primary dark:text-brand-text-secondary flex items-center gap-2 ml-1">
                  <Phone size={14} className="text-brand-text-muted dark:text-brand-text-secondary" />{' '}
                  {t('profile.phone', 'رقم الهاتف')}
                </label>
                <Input
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder={t('doctors.phonePlaceholder', 'أدخل رقم الهاتف')}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-brand-text-primary dark:text-brand-text-secondary flex items-center gap-2 ml-1">
                  <Briefcase size={14} className="text-brand-text-muted dark:text-brand-text-secondary" />{' '}
                  {t('doctors.specialty', 'التخصص')}
                </label>
                <Input
                  name="specialty"
                  value={formData.specialty}
                  onChange={handleChange}
                  placeholder={t('doctors.specialtyPlaceholder', 'أدخل التخصص')}
                />
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <label className="text-sm font-semibold text-brand-text-primary dark:text-brand-text-secondary flex items-center gap-2 ml-1">
                  <GraduationCap size={14} className="text-brand-text-muted dark:text-brand-text-secondary" />{' '}
                  {t('profile.status', 'الحالة')}
                </label>
                <select
                  name="isActive"
                  value={formData.isActive ? 'active' : 'inactive'}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'active' })}
                  className="w-full h-10 px-4 bg-brand-bg-card dark:bg-brand-bg-elevated border border-brand-border dark:border-brand-border rounded-xl text-sm text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 transition-all appearance-none cursor-pointer"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: isAr ? 'left 1rem center' : 'right 1rem center',
                    backgroundSize: '1rem',
                  }}
                >
                  <option value="active">{t('students.active', 'نشط')}</option>
                  <option value="inactive">{t('students.inactive', 'غير نشط')}</option>
                </select>
              </div>
            </div>
          )}

          {/* Tab 2: Primary Department */}
          {activeTab === 'department' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-brand-text-primary dark:text-brand-text-secondary flex items-center gap-2 ml-1">
                  <Building2 size={14} className="text-brand-text-muted dark:text-brand-text-secondary" />{' '}
                  {t('doctors.primaryDept', 'القسم الرئيسي')}
                </label>
                <select
                  name="departmentId"
                  value={formData.departmentId}
                  onChange={handleChange}
                  className="w-full h-10 px-4 bg-brand-bg-card dark:bg-brand-bg-elevated border border-brand-border dark:border-brand-border rounded-xl text-sm text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 transition-all appearance-none cursor-pointer"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: isAr ? 'left 1rem center' : 'right 1rem center',
                    backgroundSize: '1rem',
                  }}
                >
                  <option value="">{t('doctors.selectDept', 'اختر القسم الرئيسي')}</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id.toString()}>
                      {isRTL ? (dept.nameAr || dept.name) : dept.name} {dept.college ? `(${isRTL ? (dept.college.nameAr || dept.college.name) : dept.college.name})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Tab 3: Assigned Courses */}
          {activeTab === 'courses' && (
            <div className="space-y-4">
              <div className="border-b border-brand-border dark:border-brand-border pb-2">
                <h3 className="text-sm font-bold text-brand-text-primary dark:text-brand-text-main">
                  {t('doctors.coursesList', 'قائمة المقررات الدراسية')}
                </h3>
                <p className="text-xs text-brand-text-secondary dark:text-brand-text-muted mt-1">
                  {t('doctors.coursesInstructions', 'حدد المقررات الدراسية التي يقوم الأستاذ بتدريسها عبر جميع الكليات والأقسام')}
                </p>
              </div>

              {courses.length === 0 ? (
                <div className="text-center py-8 text-brand-text-secondary">
                  {t('doctors.noCourses', 'لا توجد مقررات دراسية متاحة')}
                </div>
              ) : (
                <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-1">
                  {/* Group courses by department */}
                  {Array.from(new Set(courses.map((c) => c.departmentId))).map((deptId) => {
                    const deptCourses = courses.filter((c) => c.departmentId === deptId);
                    const deptName =
                      deptCourses[0]?.department?.nameAr ||
                      deptCourses[0]?.department?.name ||
                      t('common.unknownDept', 'قسم غير معروف');

                    return (
                      <div key={deptId} className="border border-brand-border dark:border-brand-border rounded-xl p-4 bg-brand-bg-page/10">
                        <h4 className="text-xs font-bold text-brand-green-dark dark:text-brand-green mb-3 flex items-center gap-1.5 border-b border-brand-border dark:border-brand-border/40 pb-2">
                          <Building2 size={12} />
                          {deptName}
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {deptCourses.map((course) => (
                            <label
                              key={course.id}
                              className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                                checkedCourseIds.includes(course.id)
                                  ? 'border-brand-green-dark bg-brand-primary-50/10 dark:bg-brand-primary-900/5 text-brand-text-primary dark:text-brand-text-main'
                                  : 'border-brand-border dark:border-brand-border/60 hover:bg-brand-bg-page text-brand-text-secondary'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checkedCourseIds.includes(course.id)}
                                onChange={() => handleCourseToggle(course.id)}
                                className="w-4 h-4 rounded border-brand-border text-brand-green-dark focus:ring-brand-green-dark accent-brand-green-dark cursor-pointer"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold font-mono text-brand-navy-500 dark:text-brand-green">
                                  {course.courseCode}
                                </p>
                                <p className="text-sm font-bold truncate">{isRTL ? (course.nameAr || course.name) : course.name}</p>
                                <p className="text-[10px] text-brand-text-muted mt-0.5">
                                  {t('common.year', 'السنة')} {course.year} • {t('timetables.semester', 'الفصل')} {course.semester}
                                </p>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Footer Buttons */}
          <div className="mt-8 flex justify-end gap-3 border-t border-brand-border dark:border-brand-border pt-6">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              {t('common.cancel', 'إلغاء')}
            </Button>
            <Button type="submit" loading={loading} disabled={loading} className="min-w-[120px]">
              {t('common.saveChanges', 'حفظ التغييرات')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditDoctorModal;
