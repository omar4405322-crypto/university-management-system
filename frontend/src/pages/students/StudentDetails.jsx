import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import studentsService from '../../services/students.service';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, User, Mail, Shield, Calendar, Phone, MapPin } from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import LoadingState from '../../components/ui/LoadingState';

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
    return <LoadingState message={t('common.loading')} />;
  }

  if (error || !student) {
    return (
      <div className="page-padding text-center">
        <div className="max-w-md mx-auto py-20">
          <p className="text-error text-xl mb-4 font-bold">{error || t('students.noStudents')}</p>
          <button
            onClick={() => navigate('/students')}
            className="text-brand-accent-blue hover:underline flex items-center justify-center gap-2 mx-auto font-medium"
          >
            <ArrowLeft size={18} /> {t('students.backToList')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-padding content-container section-gap">
      <button
        onClick={() => navigate('/students')}
        className="flex items-center gap-2 text-brand-text-secondary dark:text-brand-text-muted hover:text-info dark:hover:text-info transition-colors font-medium"
      >
        <ArrowLeft size={20} /> {t('students.backToList')}
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-5 xl:gap-6">
        {/* Personal Info Card */}
        <Card className="lg:col-span-2 xl:col-span-3">
          <div className="flex items-center gap-3 mb-6 border-b border-brand-border dark:border-brand-border pb-4">
            <div className="p-2 bg-info/10 dark:bg-info/20 rounded-lg text-info dark:text-info">
              <User size={20} />
            </div>
            <h2 className="text-xl font-bold text-brand-text-primary dark:text-brand-text-main">{t('students.personalInformation')}</h2>
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
          <div className="flex items-center gap-3 mb-6 border-b border-brand-border dark:border-brand-border pb-4">
            <div className="p-2 bg-info/10 dark:bg-info/20 rounded-lg text-info dark:text-info">
              <Shield size={20} />
            </div>
            <h2 className="text-xl font-bold text-brand-text-primary dark:text-brand-text-main">{t('students.accountDetails')}</h2>
          </div>
          
          <div className="space-y-6">
            <InfoItem 
              label={t('profile.email')} 
              value={student.user?.email} 
              icon={<Mail size={14} className="text-brand-text-muted" />}
            />
            
            <div className="space-y-1">
              <p className="text-xs font-bold text-brand-text-secondary dark:text-brand-text-muted uppercase tracking-wider">{t('students.accountRole')}</p>
              <Badge variant="info" className="mt-1">
                {student.user?.role}
              </Badge>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-bold text-brand-text-secondary dark:text-brand-text-muted uppercase tracking-wider">{t('students.enrolledSince')}</p>
              <div className="flex items-center gap-2 text-brand-text-primary dark:text-brand-text-main">
                <Calendar size={16} className="text-brand-text-muted" />
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
              <p className="text-xs font-bold text-brand-text-secondary dark:text-brand-text-muted uppercase tracking-wider">{t('profile.status')}</p>
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
    <p className="text-xs font-bold text-brand-text-secondary dark:text-brand-text-muted uppercase tracking-wider">{label}</p>
    <div className="flex items-center gap-2">
      {icon}
      <p className={`text-lg text-brand-text-primary dark:text-brand-text-main ${isMono ? 'font-mono' : 'font-medium'}`}>
        {value}
      </p>
    </div>
  </div>
);

export default StudentDetails;
