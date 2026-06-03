// FIXED: Student-only registration, i18n, optional phone - Phase 4 / Phase 6
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import departmentService from '../services/department.service';
import collegeService from '../services/college.service';
import { UserPlus, Mail, Lock, User, GraduationCap, AlertCircle, CheckCircle, Loader2, School, Hash, Calendar, ChevronDown, Clock, Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

const Register = () => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'STUDENT',
    firstName: '',
    lastName: '',
    departmentId: '',
    collegeId: '',
    studentId: '',
    year: '1',
    phone: '',
  });
  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    setFormData({
      email: '',
      password: '',
      role: 'STUDENT',
      firstName: '',
      lastName: '',
      departmentId: '',
      collegeId: '',
      studentId: '',
      year: '1',
      phone: '',
    });
  }, []);

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
    fetchColleges();
  }, []);

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
    fetchDepartments();
  }, [formData.collegeId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: (name === 'departmentId' || name === 'collegeId' || name === 'year') ? parseInt(value, 10) || '' : value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitted(false);

    if (!formData.firstName || !formData.lastName || !formData.email || !formData.password) {
      setError(t('common.fillRequired'));
      return;
    }

    if (formData.password.length < 6) {
      setError(t('students.passwordLength'));
      return;
    }

    if (!formData.collegeId) {
      setError(t('auth.selectCollegeError'));
      return;
    }

    if (!formData.departmentId) {
      setError(t('auth.selectDeptError'));
      return;
    }

    if (!formData.studentId) {
      setError(t('auth.studentIdRequired'));
      return;
    }

    setLoading(true);

    try {
      const result = await register({ ...formData, role: 'STUDENT' });
      if (result.success) {
        setSubmitted(true);
        setFormData({
          email: '',
          password: '',
          role: 'STUDENT',
          firstName: '',
          lastName: '',
          departmentId: '',
          collegeId: '',
          studentId: '',
          year: '1',
          phone: '',
        });
      } else {
        setError(result.message || t('auth.regError'));
      }
    } catch (err) {
      setError(err.message || t('common.errorOccurred'));
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg-page px-4">
        <div className="max-w-lg w-full bg-brand-bg-card rounded-3xl border border-brand-border p-10 text-center shadow-2xl">
          <div className="w-20 h-20 rounded-full bg-brand-green/10 flex items-center justify-center mx-auto mb-6">
            <Clock size={40} className="text-brand-green" />
          </div>
          <h2 className="text-2xl font-black text-brand-text-main mb-3">{t('auth.regPendingTitle')}</h2>
          <p className="text-brand-text-sub font-bold leading-relaxed mb-8">{t('auth.regPendingReview')}</p>
          <Button onClick={() => navigate('/login')} className="w-full">{t('auth.backToLogin')}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg-page relative overflow-hidden py-12 px-4">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-brand-green/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-brand-navy/5 blur-[120px]" />
      </div>

      <div className="w-full max-w-[560px] relative z-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center mb-6">
            <img src="/assets/university/logo.svg" alt="University Logo" className="h-20 w-auto" />
          </div>
          <h1 className="tracking-tight">{t('auth.universityName')}</h1>
          <p className="text-brand-text-sub mt-2 font-medium">{t('auth.registerStudentSubtitle')}</p>
        </div>

        <div className="bg-brand-bg-card rounded-3xl shadow-2xl shadow-brand-navy/10 p-8 md:p-10 border border-brand-border/10">
          <form className="form-section" onSubmit={handleSubmit}>
            {error && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-sm font-medium flex items-center gap-3">
                <AlertCircle size={20} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="p-4 bg-brand-accent-yellow/10 border border-brand-accent-yellow/30 rounded-2xl text-sm font-bold text-brand-text-main">
              {t('auth.regReviewNotice', 'Accounts are not active until an administrator approves your request.')}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-brand-text-sub font-bold text-brand-text-main ml-1">{t('auth.firstName')} *</label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-muted z-10" size={18} />
                  <Input
                    name="firstName"
                    type="text"
                    required
                    placeholder={t('auth.firstNamePlaceholder')}
                    className="pl-12 h-12"
                    value={formData.firstName}
                    onChange={handleChange}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-brand-text-sub font-bold text-brand-text-main ml-1">{t('auth.lastName')} *</label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-muted z-10" size={18} />
                  <Input
                    name="lastName"
                    type="text"
                    required
                    placeholder={t('auth.lastNamePlaceholder')}
                    className="pl-12 h-12"
                    value={formData.lastName}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-brand-text-sub font-bold text-brand-text-main ml-1">{t('auth.emailAddress')} *</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-muted z-10" size={18} />
                <Input
                  name="email"
                  type="email"
                  required
                  autoComplete="off"
                  placeholder={t('auth.emailPlaceholder')}
                  className="pl-12 h-12"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-brand-text-sub font-bold text-brand-text-main ml-1">{t('profile.phone')}</label>
              <div className="relative group">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-muted z-10" size={18} />
                <Input
                  name="phone"
                  type="tel"
                  placeholder={t('students.phonePlaceholder')}
                  className="pl-12 h-12"
                  value={formData.phone}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-brand-text-sub font-bold text-brand-text-main ml-1">{t('auth.password')} *</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-muted z-10" size={18} />
                <Input
                  name="password"
                  type="password"
                  required
                  placeholder={t('auth.passwordPlaceholder')}
                  className="pl-12 h-12"
                  value={formData.password}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-brand-text-sub font-bold text-brand-text-main ml-1">{t('auth.college')} *</label>
                <div className="relative group">
                  <School className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-muted z-10" size={18} />
                  <select
                    name="collegeId"
                    required
                    className="w-full h-12 pl-12 pr-12 bg-brand-bg-page/30 border border-brand-border rounded-xl font-bold appearance-none cursor-pointer"
                    value={formData.collegeId}
                    onChange={handleChange}
                  >
                    <option value="">{t('auth.selectCollege')}</option>
                    {colleges.map((college) => (
                      <option key={college.id} value={college.id}>{college.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-text-muted pointer-events-none" size={18} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-brand-text-sub font-bold text-brand-text-main ml-1">{t('auth.department')} *</label>
                <div className="relative group">
                  <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-muted z-10" size={18} />
                  <select
                    name="departmentId"
                    required
                    disabled={!formData.collegeId}
                    className="w-full h-12 pl-12 pr-12 bg-brand-bg-page/30 border border-brand-border rounded-xl font-bold appearance-none cursor-pointer disabled:opacity-50"
                    value={formData.departmentId}
                    onChange={handleChange}
                  >
                    <option value="">{t('auth.selectDept')}</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-text-muted pointer-events-none" size={18} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-brand-text-sub font-bold text-brand-text-main ml-1">{t('auth.studentId')} *</label>
                <div className="relative group">
                  <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-muted z-10" size={18} />
                  <Input
                    name="studentId"
                    type="text"
                    required
                    placeholder={t('auth.studentIdPlaceholder')}
                    className="pl-12 h-12"
                    value={formData.studentId}
                    onChange={handleChange}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-brand-text-sub font-bold text-brand-text-main ml-1">{t('auth.year')} *</label>
                <div className="relative group">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-muted z-10" size={18} />
                  <select
                    name="year"
                    required
                    className="w-full h-12 pl-12 pr-12 bg-brand-bg-page/30 border border-brand-border rounded-xl font-bold appearance-none cursor-pointer"
                    value={formData.year}
                    onChange={handleChange}
                  >
                    <option value="1">{t('auth.year1')}</option>
                    <option value="2">{t('auth.year2')}</option>
                    <option value="3">{t('auth.year3')}</option>
                    <option value="4">{t('auth.year4')}</option>
                    <option value="5">{t('auth.year5')}</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-text-muted pointer-events-none" size={18} />
                </div>
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full h-12 rounded-2xl mt-4">
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  {t('auth.submittingApplication', 'Submitting...')}
                </>
              ) : (
                <>
                  {t('auth.submitApplication', 'Submit Application')}
                  <UserPlus size={18} />
                </>
              )}
            </Button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-brand-text-sub font-medium">
              {t('auth.alreadyHaveAccount')}{' '}
              <Link to="/login" className="text-brand-green font-bold">{t('auth.loginHere')}</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
