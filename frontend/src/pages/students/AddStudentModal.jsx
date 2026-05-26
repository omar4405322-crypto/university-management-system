import React, { useState, useEffect } from 'react';
import studentsService from '../../services/students.service';
import collegeService from '../../services/college.service';
import departmentService from '../../services/department.service';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { X, User, Mail, Lock, Phone, MapPin, Hash, AlertCircle, CheckCircle, School, GraduationCap, Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const AddStudentModal = ({ isOpen, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    studentId: '',
    email: '',
    password: '',
    phone: '',
    address: '',
    year: '1',
    collegeId: '',
    departmentId: '',
  });
  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const fetchColleges = async () => {
      try {
        const result = await collegeService.getColleges();
        if (result.success) {
          setColleges(result.data);
        }
      } catch (err) {
        console.error('Error fetching colleges:', err);
      }
    };
    if (isOpen) fetchColleges();
  }, [isOpen]);

  useEffect(() => {
    const fetchDepartments = async () => {
      if (!formData.collegeId) {
        setDepartments([]);
        return;
      }
      try {
        const result = await departmentService.getDepartments({ collegeId: formData.collegeId });
        if (result.success) {
          setDepartments(result.data);
        }
      } catch (err) {
        console.error('Error fetching departments:', err);
      }
    };
    if (isOpen) fetchDepartments();
  }, [isOpen, formData.collegeId]);

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ 
      ...formData, 
      [name]: (name === 'departmentId' || name === 'collegeId' || name === 'year') ? parseInt(value) || '' : value 
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.firstName || !formData.lastName || !formData.studentId || !formData.email || !formData.password || !formData.departmentId) {
      showToast(t('students.fillRequired'), 'error');
      return;
    }

    if (formData.password.length < 6) {
      showToast(t('students.passwordLength'), 'error');
      return;
    }

    try {
      setLoading(true);
      const result = await studentsService.createStudent(formData);
      if (result.success) {
        onSuccess();
      } else {
        showToast(result.message || t('students.createError'), 'error');
      }
    } catch (error) {
      showToast(error.response?.data?.message || t('students.createError'), 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
      
      {/* Modal Content */}
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('students.addNew')}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{t('students.addDesc')}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6">
          {toast && (
            <div className={`mb-6 p-4 rounded-xl text-white flex items-center gap-2 animate-in slide-in-from-top-2 duration-300 ${toast.type === 'error' ? 'bg-rose-500' : 'bg-emerald-500'}`}>
              {toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
              <span className="font-medium">{toast.message}</span>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 ml-1">
                <User size={14} className="text-slate-400 dark:text-slate-500" /> {t('students.firstName')} <span className="text-rose-500">*</span>
              </label>
              <Input
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder={t('students.firstNamePlaceholder')}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 ml-1">
                <User size={14} className="text-slate-400 dark:text-slate-500" /> {t('students.lastName')} <span className="text-rose-500">*</span>
              </label>
              <Input
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder={t('students.lastNamePlaceholder')}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 ml-1">
                <Hash size={14} className="text-slate-400 dark:text-slate-500" /> {t('students.studentId')} <span className="text-rose-500">*</span>
              </label>
              <Input
                name="studentId"
                value={formData.studentId}
                onChange={handleChange}
                placeholder={t('students.studentIdPlaceholder')}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 ml-1">
                <Mail size={14} className="text-slate-400 dark:text-slate-500" /> {t('students.emailAddress')} <span className="text-rose-500">*</span>
              </label>
              <Input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder={t('students.emailPlaceholder')}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 ml-1">
                <Lock size={14} className="text-slate-400 dark:text-slate-500" /> {t('students.password')} <span className="text-rose-500">*</span>
              </label>
              <Input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder={t('students.passwordPlaceholder')}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 ml-1">
                <Phone size={14} className="text-slate-400 dark:text-slate-500" /> {t('students.phoneNumber')}
              </label>
              <Input
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder={t('students.phonePlaceholder')}
              />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 ml-1">
                <MapPin size={14} className="text-slate-400 dark:text-slate-500" /> {t('students.homeAddress')}
              </label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                rows="3"
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all resize-none placeholder:text-slate-400 dark:placeholder:text-slate-600"
                placeholder={t('students.addressPlaceholder')}
              ></textarea>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 md:col-span-2 pt-4 mt-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <School size={16} className="text-blue-500" />
                {t('profile.academicInfo')}
              </h3>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 ml-1">
                <Calendar size={14} className="text-slate-400 dark:text-slate-500" /> {t('profile.year')} <span className="text-rose-500">*</span>
              </label>
              <select
                name="year"
                value={formData.year}
                onChange={handleChange}
                className="w-full h-10 px-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1rem' }}
                required
              >
                <option value="1">Year 1</option>
                <option value="2">Year 2</option>
                <option value="3">Year 3</option>
                <option value="4">Year 4</option>
                <option value="5">Year 5</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 ml-1">
                <School size={14} className="text-slate-400 dark:text-slate-500" /> {t('profile.college')} <span className="text-rose-500">*</span>
              </label>
              <select
                name="collegeId"
                value={formData.collegeId}
                onChange={handleChange}
                className="w-full h-10 px-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1rem' }}
                required
              >
                <option value="">{t('auth.selectCollege')}</option>
                {colleges.map(college => (
                  <option key={college.id} value={college.id}>{college.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 ml-1">
                <GraduationCap size={14} className="text-slate-400 dark:text-slate-500" /> {t('profile.department')} <span className="text-rose-500">*</span>
              </label>
              <select
                name="departmentId"
                value={formData.departmentId}
                onChange={handleChange}
                disabled={!formData.collegeId}
                className="w-full h-10 px-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer disabled:opacity-50"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1rem' }}
                required
              >
                <option value="">{t('auth.selectDept')}</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              loading={loading}
              className="min-w-[140px]"
            >
              {t('students.createStudent')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddStudentModal;
