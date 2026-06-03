// FIXED: isOpen prop, auto-generate student ID, strip collegeId on POST - Phase 5
import React, { useState, useEffect } from 'react';
import studentsService from '../../services/students.service';
import collegeService from '../../services/college.service';
import departmentService from '../../services/department.service';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { User, Mail, Lock, Phone, MapPin, Hash, AlertCircle, CheckCircle, School, GraduationCap, Calendar, Loader2, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import Modal from '../../components/ui/Modal';

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

  const generateStudentId = () => {
    const year = new Date().getFullYear();
    const suffix = String(Math.floor(1000 + Math.random() * 9000));
    setFormData((prev) => ({ ...prev, studentId: `${year}${suffix}` }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.firstName || !formData.lastName || !formData.studentId || !formData.email || !formData.password || !formData.departmentId || !formData.collegeId) {
      showToast(t('students.fillRequired'), 'error');
      return;
    }

    if (formData.password.length < 6) {
      showToast(t('students.passwordLength'), 'error');
      return;
    }

    try {
      setLoading(true);
      const { collegeId, ...payload } = formData;
      const result = await studentsService.createStudent(payload);
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('students.addNew')}
      subtitle={t('students.addDesc')}
    >
      <form onSubmit={handleSubmit} className="form-section">
        {toast && (
          <div className={`p-4 rounded-xl text-white flex items-center gap-2 animate-in slide-in-from-top-2 duration-300 ${toast.type === 'error' ? 'bg-rose-500' : 'bg-brand-green'}`}>
            {toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
            <span className="font-medium">{toast.message}</span>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <User size={14} className="text-brand-text-muted" /> {t('students.firstName')} <span className="text-rose-500">*</span>
            </label>
            <Input
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              placeholder={t('students.firstNamePlaceholder')}
              required
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <User size={14} className="text-brand-text-muted" /> {t('students.lastName')} <span className="text-rose-500">*</span>
            </label>
            <Input
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              placeholder={t('students.lastNamePlaceholder')}
              required
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <Hash size={14} className="text-brand-text-muted" /> {t('students.studentId')} <span className="text-rose-500">*</span>
            </label>
            <div className="flex gap-2">
              <Input
                name="studentId"
                value={formData.studentId}
                onChange={handleChange}
                placeholder={t('students.studentIdPlaceholder')}
                required
                className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={generateStudentId}
                title={t('students.generateId')}
                className="shrink-0 px-3"
              >
                <RefreshCw size={16} />
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <Mail size={14} className="text-brand-text-muted" /> {t('students.emailAddress')} <span className="text-rose-500">*</span>
            </label>
            <Input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder={t('students.emailPlaceholder')}
              required
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <Lock size={14} className="text-brand-text-muted" /> {t('students.password')} <span className="text-rose-500">*</span>
            </label>
            <Input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder={t('students.passwordPlaceholder')}
              required
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <Phone size={14} className="text-brand-text-muted" /> {t('students.phoneNumber')}
            </label>
            <Input
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder={t('students.phonePlaceholder')}
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
            />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <MapPin size={14} className="text-brand-text-muted" /> {t('students.homeAddress')}
            </label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              rows="3"
              className="w-full px-4 py-2 bg-brand-bg-page/30 border border-brand-border rounded-xl text-sm text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20 transition-all resize-none placeholder:text-brand-text-muted"
              placeholder={t('students.addressPlaceholder')}
            ></textarea>
          </div>

          <div className="border-t border-brand-border md:col-span-2 pt-4 mt-2">
            <h3 className="text-sm font-bold text-brand-text-main mb-4 flex items-center gap-2">
              <School size={16} className="text-brand-green" />
              {t('profile.academicInfo')}
            </h3>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <Calendar size={14} className="text-brand-text-muted" /> {t('profile.year')} <span className="text-rose-500">*</span>
            </label>
            <select
              name="year"
              value={formData.year}
              onChange={handleChange}
              className="w-full h-10 px-4 bg-brand-bg-page/30 border border-brand-border rounded-xl text-sm text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20 transition-all appearance-none cursor-pointer"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23132231'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1rem' }}
              required
            >
              <option value="1">{t('auth.year1')}</option>
              <option value="2">{t('auth.year2')}</option>
              <option value="3">{t('auth.year3')}</option>
              <option value="4">{t('auth.year4')}</option>
              <option value="5">{t('auth.year5')}</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <School size={14} className="text-brand-text-muted" /> {t('profile.college')} <span className="text-rose-500">*</span>
            </label>
            <select
              name="collegeId"
              value={formData.collegeId}
              onChange={handleChange}
              className="w-full h-10 px-4 bg-brand-bg-page/30 border border-brand-border rounded-xl text-sm text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20 transition-all appearance-none cursor-pointer"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23132231'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1rem' }}
              required
            >
              <option value="">{t('auth.selectCollege')}</option>
              {colleges.map(college => (
                <option key={college.id} value={college.id}>{college.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <GraduationCap size={14} className="text-brand-text-muted" /> {t('profile.department')} <span className="text-rose-500">*</span>
            </label>
            <select
              name="departmentId"
              value={formData.departmentId}
              onChange={handleChange}
              disabled={!formData.collegeId}
              className="w-full h-10 px-4 bg-brand-bg-page/30 border border-brand-border rounded-xl text-sm text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20 transition-all appearance-none cursor-pointer disabled:opacity-50"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23132231'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1rem' }}
              required
            >
              <option value="">{t('auth.selectDept')}</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3 border-t border-brand-border pt-6">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={loading}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="min-w-[140px]"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : t('students.createStudent')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AddStudentModal;
