// @ts-nocheck
// FIXED: Course detail page with breadcrumbs - Phase 6
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BookOpen, Users, GraduationCap, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import coursesService from '../../services/courses.service';
import { logger } from '../../lib/logger';

interface CourseDetailsProps {
  courseId?: string;
  isDrawerMode?: boolean;
}

const CourseDetails: React.FC<CourseDetailsProps> = ({ courseId, isDrawerMode = false }) => {
  const { id } = useParams();
  const actualId = courseId || id;
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);

  const isRTL = i18n.language === 'ar';

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const result = await coursesService.getCourseById(actualId);
        if (result.success) setCourse(result.data);
      } catch (err: any) {
        logger.error(err);
        setCourse(null);
      } finally {
        setLoading(false);
      }
    };
    if (actualId) load();
  }, [actualId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Loader2 className="animate-spin text-brand-brand-green-dark" size={48} />
        <p className="text-sm font-bold text-brand-text-muted">{t('common.loading')}</p>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="text-center py-20">
        <AlertCircle size={40} className="text-brand-text-muted mx-auto mb-4" />
        <h2 className="text-2xl font-bold">{t('courses.noCourses')}</h2>
        {!isDrawerMode && (
          <Button variant="outline" className="mt-6" onClick={() => navigate('/courses')}>
            <ArrowLeft size={18} className={isRTL ? 'ml-2 rotate-180' : 'mr-2'} /> {t('common.back')}
          </Button>
        )}
      </div>
    );
  }

  const breadcrumbItems = [
    { label: t('nav.courses'), link: '/courses' },
    ...(course.department?.college?.name
      ? [
          {
            label: course.department.college.name,
            link: `/colleges/${course.department.college.id}`,
          },
        ]
      : []),
    ...(course.department?.name
      ? [{ label: course.department.name, link: `/departments/${course.department.id}` }]
      : []),
    { label: course.name },
  ];

  return (
    <div className={isDrawerMode ? "animate-in fade-in duration-500" : "section-gap animate-in fade-in duration-500"}>
      {!isDrawerMode && (
        <div className="mb-4">
                    <Breadcrumbs items={breadcrumbItems} />
        </div>
      )}

      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between bg-brand-bg-card p-6 rounded-3xl border border-brand-border shadow-soft mb-6">
        <div className="flex items-center gap-4">
          {!isDrawerMode && (
            <button
              type="button"
              onClick={() => navigate('/courses')}
              className="p-3 rounded-2xl hover:bg-brand-primary-50 text-brand-text-sub transition-colors"
            >
              <ArrowLeft size={22} className={isRTL ? 'rotate-180' : ''} />
            </button>
          )}
          <div>
            <Badge variant="primary" className="mb-2">
              {course.courseCode}
            </Badge>
            <h1 className="text-3xl font-black text-brand-text-main">{course.name}</h1>
            <p className="text-sm text-brand-text-sub font-bold mt-1">
              {course.department?.name}
              {course.doctor && ` · ${course.doctor.firstName} ${course.doctor.lastName}`}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-brand-primary-50 text-brand-brand-green-dark">
            <Users size={24} />
          </div>
          <div>
            <p className="label-stat">{t('courses.students')}</p>
            <p className="text-2xl font-black">
              {course._count?.students ?? course.students?.length ?? 0}
            </p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-brand-navy-50 text-brand-navy-500">
            <BookOpen size={24} />
          </div>
          <div>
            <p className="label-stat">{t('courses.credits')}</p>
            <p className="text-2xl font-black">{course.credits}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-brand-accent-yellow/10 text-brand-accent-yellow">
            <GraduationCap size={24} />
          </div>
          <div>
            <p className="label-stat">{t('auth.year')}</p>
            <p className="text-2xl font-black">{t(`auth.year${course.year}`, course.year)}</p>
          </div>
        </Card>
      </div>

      <Card title={t('courses.description')}>
        {course.description ? (
          <p className="text-brand-text-sub font-medium leading-relaxed">{course.description}</p>
        ) : (
          <p className="text-[var(--color-text-secondary)] italic text-sm">
            {i18n.language === 'ar'
              ? 'لا يوجد وصف لهذه المادة حتى الآن'
              : 'No description available for this course yet.'}
          </p>
        )}
      </Card>
    </div>
  );
};

export default CourseDetails;
