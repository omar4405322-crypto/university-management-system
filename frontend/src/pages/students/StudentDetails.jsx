import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import studentsService from '../../services/students.service';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, User, Mail, Shield, Calendar, Phone, MapPin } from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';

const StudentDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStudent = async () => {
      try {
        setLoading(true);
        const result = await studentsService.getStudentById(id);
        if (result.success) {
          setStudent(result.data);
        }
      } catch (err) {
        setError(err.response?.data?.message || t('students.errorFetching'));
      } finally {
        setLoading(false);
      }
    };

    fetchStudent();
  }, [id, t]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-red-600 dark:text-red-400 text-xl mb-4">{error || t('students.noStudents')}</p>
        <button
          onClick={() => navigate('/students')}
          className="text-blue-600 dark:text-blue-400 hover:underline flex items-center justify-center gap-2 mx-auto"
        >
          <ArrowLeft size={18} /> {t('students.backToList')}
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <button
        onClick={() => navigate('/students')}
        className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium"
      >
        <ArrowLeft size={20} /> {t('students.backToList')}
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Personal Info Card */}
        <Card className="lg:col-span-2">
          <div className="flex items-center gap-3 mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
              <User size={20} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('students.personalInformation')}</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            <InfoItem label={t('students.firstName')} value={student.firstName} />
            <InfoItem label={t('students.lastName')} value={student.lastName} />
            <InfoItem label={t('students.studentId')} value={student.studentId} isMono />
            <InfoItem label={t('students.phone')} value={student.phone || t('students.notProvided')} />
            <div className="md:col-span-2">
              <InfoItem label={t('students.address')} value={student.address || t('students.notProvided')} />
            </div>
          </div>
        </Card>

        {/* Account Info Card */}
        <Card>
          <div className="flex items-center gap-3 mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-600 dark:text-purple-400">
              <Shield size={20} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('students.accountDetails')}</h2>
          </div>
          
          <div className="space-y-6">
            <InfoItem 
              label={t('profile.email')} 
              value={student.user?.email} 
              icon={<Mail size={14} className="text-slate-400" />}
            />
            
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('students.accountRole')}</p>
              <Badge variant="info" className="mt-1">
                {student.user?.role}
              </Badge>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('students.enrolledSince')}</p>
              <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                <Calendar size={16} className="text-slate-400" />
                <span className="text-lg font-medium">
                  {new Date(student.enrolledAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('profile.status')}</p>
              <Badge variant={student.status === 'active' ? 'success' : 'warning'}>
                {t(`students.${student.status || 'active'}`)}
              </Badge>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

const InfoItem = ({ label, value, isMono = false, icon = null }) => (
  <div className="space-y-1">
    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</p>
    <div className="flex items-center gap-2">
      {icon}
      <p className={`text-lg text-slate-900 dark:text-white ${isMono ? 'font-mono' : 'font-medium'}`}>
        {value}
      </p>
    </div>
  </div>
);

export default StudentDetails;
