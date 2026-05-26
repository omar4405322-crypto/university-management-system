import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import departmentService from '../services/department.service';
import collegeService from '../services/college.service';
import { UserPlus, Mail, Lock, User, Briefcase, GraduationCap, AlertCircle, CheckCircle, Loader2, School, Hash, Calendar } from 'lucide-react';
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
  });
  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { register } = useAuth();
  const navigate = useNavigate();

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
      [name]: (name === 'departmentId' || name === 'collegeId' || name === 'year') ? parseInt(value) || '' : value 
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!formData.departmentId) {
      setError(t('auth.selectDeptError'));
      return;
    }

    setLoading(true);

    try {
      const result = await register(formData);
      if (result.success) {
        setSuccess(t('auth.regSuccess'));
        setTimeout(() => navigate('/login'), 3000);
      } else {
        setError(result.message || 'Registration failed');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden py-12 px-4">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/5 blur-[120px]"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/5 blur-[120px]"></div>
      </div>

      <div className="w-full max-w-[560px] relative z-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center p-3 bg-blue-600 rounded-2xl shadow-xl shadow-blue-500/20 mb-6 group transition-transform hover:scale-105 duration-300">
            <UserPlus size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            Join Our Community
          </h1>
          <p className="text-slate-500 mt-2 font-medium">
            Create your account to start managing your academic life
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl shadow-slate-200/60 p-8 md:p-10 border border-slate-100">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-sm font-medium flex items-center gap-3 animate-in shake duration-300">
                <AlertCircle size={20} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}
            
            {success && (
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-600 text-sm font-medium flex items-center gap-3 animate-in fade-in zoom-in-95 duration-300">
                <CheckCircle size={20} className="shrink-0" />
                <span>{success}</span>
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 ml-1">{t('auth.role')} *</label>
              <div className="relative group">
                <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors z-10" size={18} />
                <select
                  name="role"
                  className="w-full h-12 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all appearance-none cursor-pointer relative"
                  value={formData.role}
                  onChange={handleChange}
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1rem' }}
                >
                  <option value="STUDENT">{t('auth.student')}</option>
                  <option value="DOCTOR">{t('auth.doctor')}</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 ml-1">First Name *</label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                  <Input
                    name="firstName"
                    type="text"
                    required
                    placeholder="John"
                    className="pl-12 h-12 bg-slate-50 border-slate-200 focus:bg-white transition-all"
                    value={formData.firstName}
                    onChange={handleChange}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 ml-1">Last Name *</label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                  <Input
                    name="lastName"
                    type="text"
                    required
                    placeholder="Doe"
                    className="pl-12 h-12 bg-slate-50 border-slate-200 focus:bg-white transition-all"
                    value={formData.lastName}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 ml-1">Email Address *</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                <Input
                  name="email"
                  type="email"
                  required
                  placeholder="john.doe@university.edu"
                  className="pl-12 h-12 bg-slate-50 border-slate-200 focus:bg-white transition-all"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 ml-1">Password *</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                <Input
                  name="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  className="pl-12 h-12 bg-slate-50 border-slate-200 focus:bg-white transition-all"
                  value={formData.password}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 ml-1">{t('auth.college')} *</label>
                <div className="relative group">
                  <School className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors z-10" size={18} />
                  <select
                    name="collegeId"
                    required
                    className="w-full h-12 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all appearance-none cursor-pointer relative"
                    value={formData.collegeId}
                    onChange={handleChange}
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1rem' }}
                  >
                    <option value="">{t('auth.selectCollege')}</option>
                    {colleges.map(college => (
                      <option key={college.id} value={college.id}>
                        {college.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 ml-1">{t('auth.department')} *</label>
                <div className="relative group">
                  <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors z-10" size={18} />
                  <select
                    name="departmentId"
                    required
                    disabled={!formData.collegeId}
                    className="w-full h-12 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all appearance-none cursor-pointer relative disabled:opacity-50"
                    value={formData.departmentId}
                    onChange={handleChange}
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1rem' }}
                  >
                    <option value="">{t('auth.selectDept')}</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {formData.role === 'STUDENT' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 ml-1">{t('auth.studentId')} *</label>
                  <div className="relative group">
                    <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                    <Input
                      name="studentId"
                      type="text"
                      required
                      placeholder={t('auth.studentIdPlaceholder')}
                      className="pl-12 h-12 bg-slate-50 border-slate-200 focus:bg-white transition-all"
                      value={formData.studentId}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 ml-1">{t('auth.year')} *</label>
                  <div className="relative group">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors z-10" size={18} />
                    <select
                      name="year"
                      required
                      className="w-full h-12 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all appearance-none cursor-pointer relative"
                      value={formData.year}
                      onChange={handleChange}
                      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1rem' }}
                    >
                      <option value="1">{t('auth.year1')}</option>
                      <option value="2">{t('auth.year2')}</option>
                      <option value="3">{t('auth.year3')}</option>
                      <option value="4">{t('auth.year4')}</option>
                      <option value="5">{t('auth.year5')}</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 text-base font-bold shadow-lg shadow-blue-500/25 mt-4"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="animate-spin" size={20} />
                  Creating Account...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  {t('auth.register')}
                  <UserPlus size={18} />
                </span>
              )}
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-slate-500 font-medium">
              {t('auth.alreadyHaveAccount')}{' '}
              <Link to="/login" className="text-blue-600 hover:text-blue-700 font-bold underline-offset-4 hover:underline transition-all">
                {t('auth.loginHere')}
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-8 text-center text-slate-400 text-xs font-medium uppercase tracking-widest">
          &copy; 2026 University Management System
        </p>
      </div>
    </div>
  );
};

export default Register;
