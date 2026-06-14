import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import degreeAuditService from '../../services/degreeAudit.service';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import LoadingState from '../../components/ui/LoadingState';
import ErrorState from '../../components/ui/ErrorState';
import { GraduationCap, CheckCircle2, XCircle, AlertTriangle, BookOpen, Calculator, Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const DegreeAudit: React.FC = () => {
  const { t } = useTranslation();
  const { studentId } = useParams<{ studentId: string }>();
  const [audit, setAudit] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAudit = async () => {
      try {
        setLoading(true);
        const response = await degreeAuditService.getAudit(parseInt(studentId || '0'));
        if (response.success) {
          setAudit(response.data);
        } else {
          setError(response.message || 'Failed to fetch degree audit');
        }
      } catch (err: any) {
        setError(err.response?.data?.message || 'Error loading degree audit');
      } finally {
        setLoading(false);
      }
    };

    if (studentId) fetchAudit();
  }, [studentId]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!audit) return <ErrorState message="No audit data found" />;

  return (
    <div className="space-y-6">
      <PageHeader 
        title={t('degreeAudit.title', 'Degree Audit')}
        subtitle={`${audit.programName} - ${t('degreeAudit.studentId', 'ID')}: ${audit.studentId}`}
      />

      {audit.eligibleForGraduation && (
        <div className="bg-brand-green/10 border border-brand-green/20 rounded-2xl p-6 flex items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="w-12 h-12 bg-brand-green/20 rounded-full flex items-center justify-center text-brand-green">
            <GraduationCap size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-brand-green">
              {t('degreeAudit.eligibleTitle', 'Eligible for Graduation!')}
            </h3>
            <p className="text-brand-text-muted">
              {t('degreeAudit.eligibleDesc', 'You have met all academic requirements for graduation.')}
            </p>
          </div>
        </div>
      )}

      {audit.blockers.length > 0 && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-rose-500/20 rounded-full flex items-center justify-center text-rose-500">
            <XCircle size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-rose-500">
              {t('degreeAudit.notEligibleTitle', 'Not Eligible for Graduation')}
            </h3>
            <ul className="text-brand-text-muted list-disc list-inside">
              {audit.blockers.map((blocker: string, i: number) => (
                <li key={i}>{blocker}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <Calculator className="text-brand-green" size={20} />
            <span className="text-sm font-medium text-brand-text-muted">{t('degreeAudit.gpa', 'Current GPA')}</span>
          </div>
          <div className="text-2xl font-bold flex items-center gap-2">
            {audit.gpa.toFixed(2)}
            <Badge variant={audit.meetsGpaRequirement ? 'success' : 'danger'}>
              {audit.meetsGpaRequirement ? t('common.met', 'Met') : t('common.unmet', 'Unmet')}
            </Badge>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="text-brand-green" size={20} />
            <span className="text-sm font-medium text-brand-text-muted">{t('degreeAudit.credits', 'Credits Completed')}</span>
          </div>
          <div className="text-2xl font-bold">
            {audit.totalCreditsCompleted} / {audit.totalCreditsRequired}
          </div>
          <div className="mt-2 w-full bg-brand-bg-page h-2 rounded-full overflow-hidden">
            <div 
              className="bg-brand-green h-full transition-all duration-1000" 
              style={{ width: `${(audit.totalCreditsCompleted / audit.totalCreditsRequired) * 100}%` }}
            />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="text-brand-green" size={20} />
            <span className="text-sm font-medium text-brand-text-muted">{t('degreeAudit.estimatedGraduation', 'Estimated Graduation')}</span>
          </div>
          <div className="text-2xl font-bold">{audit.estimatedGraduationSemester}</div>
        </Card>
      </div>

      <div className="space-y-6">
        {audit.categories.map((category: any, i: number) => (
          <Card key={i} className="overflow-hidden">
            <div className="p-6 border-b border-brand-border bg-brand-bg-page/50">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">{category.name}</h3>
                <Badge variant={category.percentage === 100 ? 'success' : 'warning'}>
                  {category.percentage.toFixed(0)}% {t('common.complete', 'Complete')}
                </Badge>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-brand-text-muted">
                  {category.completedCredits} / {category.requiredCredits} {t('degreeAudit.credits', 'Credits')}
                </span>
              </div>
              <div className="w-full bg-brand-border h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-brand-green h-full transition-all duration-1000" 
                  style={{ width: `${category.percentage}%` }}
                />
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-brand-bg-page/30 text-xs font-bold text-brand-text-muted uppercase tracking-wider">
                    <th className="px-6 py-3">{t('common.code', 'Code')}</th>
                    <th className="px-6 py-3">{t('common.course', 'Course')}</th>
                    <th className="px-6 py-3">{t('common.credits', 'Credits')}</th>
                    <th className="px-6 py-3">{t('common.grade', 'Grade')}</th>
                    <th className="px-6 py-3">{t('common.status', 'Status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border">
                  {category.courses.map((course: any, j: number) => (
                    <tr key={j} className="hover:bg-brand-bg-page/50 transition-colors">
                      <td className="px-6 py-4 font-mono text-sm">{course.courseCode}</td>
                      <td className="px-6 py-4 text-sm font-medium">{course.courseName}</td>
                      <td className="px-6 py-4 text-sm">{course.credits}</td>
                      <td className="px-6 py-4 text-sm font-bold">{course.grade || '-'}</td>
                      <td className="px-6 py-4">
                        {course.status === 'completed' ? (
                          <div className="flex items-center gap-1.5 text-brand-green">
                            <CheckCircle2 size={14} />
                            <span className="text-xs font-bold uppercase">{t('common.completed', 'Completed')}</span>
                          </div>
                        ) : course.status === 'in_progress' ? (
                          <div className="flex items-center gap-1.5 text-brand-blue">
                            <Calendar size={14} />
                            <span className="text-xs font-bold uppercase">{t('common.inProgress', 'In Progress')}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-brand-text-muted">
                            <XCircle size={14} />
                            <span className="text-xs font-bold uppercase">{t('common.remaining', 'Remaining')}</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {category.courses.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-brand-text-muted italic">
                        {t('degreeAudit.noCourses', 'No courses found in this category')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default DegreeAudit;
