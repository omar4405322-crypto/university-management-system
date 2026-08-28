import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import quizService from '../../services/quiz.service';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  Clock,
  HelpCircle,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
  Search,
  X,
  Plus,
  Layers,
  GraduationCap,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/button';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import QuizSubmissionsModal from './QuizSubmissionsModal';
import { useToast } from '../../context/ToastContext';

const QuizzesList = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isDoctor = user?.role === 'DOCTOR';
  const isStudent = user?.role === 'STUDENT';

  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('latest');
  const { showToast } = useToast();
  const [submissionsQuiz, setSubmissionsQuiz] = useState(null);

  const fetchQuizzes = async () => {
    try {
      setLoading(true);
      const result = await quizService.getQuizzes({});
      if (result.success) {
        setQuizzes(result.data || []);
      }
    } catch (_error) {
      showToast('Error fetching quizzes', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const totalQuestions = useMemo(
    () => (Array.isArray(quizzes) ? quizzes : []).reduce((acc, q) => acc + (q._count?.questions || q.questions?.length || 0), 0),
    [quizzes]
  );
  const activeCoursesCount = useMemo(
    () => new Set((Array.isArray(quizzes) ? quizzes : []).map((q) => q.courseId || q.course?.id).filter(Boolean)).size,
    [quizzes]
  );
  const avgDuration = useMemo(() => {
    const list = Array.isArray(quizzes) ? quizzes : [];
    if (!list.length) return 0;
    return Math.round(list.reduce((acc, q) => acc + (Number(q.duration) || 0), 0) / list.length);
  }, [quizzes]);

  const filteredQuizzes = useMemo(() => {
    const list = Array.isArray(quizzes) ? quizzes : [];
    return list
      .filter((q) => {
        const query = search.trim().toLowerCase();
        if (!query) return true;
        const titleMatch = (q.title || '').toLowerCase().includes(query);
        const descMatch = (q.description || '').toLowerCase().includes(query);
        const codeMatch = (q.course?.courseCode || '').toLowerCase().includes(query);
        const nameMatch = (q.course?.name || '').toLowerCase().includes(query);
        return titleMatch || descMatch || codeMatch || nameMatch;
      })
      .sort((a, b) => {
        if (sortBy === 'duration') return (Number(b.duration) || 0) - (Number(a.duration) || 0);
        if (sortBy === 'questions') return (b._count?.questions || 0) - (a._count?.questions || 0);
        return (a.title || '').localeCompare(b.title || '');
      });
  }, [quizzes, search, sortBy]);

  return (
    <div className="section-gap animate-page pt-4">
      <PageHeader
        title={t('quizzes.title', 'Quizzes')}
        subtitle={
          isDoctor
            ? t('quizzes.subtitleDoctor', 'Manage your course quizzes')
            : t('quizzes.subtitleStudent', 'View and take your course quizzes')
        }
        action={
          isDoctor
            ? {
                label: t('quizzes.createQuiz', 'Create Quiz'),
                onClick: () => navigate('/quizzes/create'),
                icon: Plus,
                className:
                  'bg-brand-primary-500 hover:bg-brand-primary-600 text-white font-bold rounded-xl active:scale-95 transition-all flex items-center gap-2 px-4 py-2',
              }
            : undefined
        }
      />

      {/* ========================================================================= */}
      {/* 1. EXECUTIVE 4-METRIC RIBBON                                              */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
        {/* Total Quizzes */}
        <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              {isRTL ? 'إجمالي الاختبارات' : 'Total Quizzes'}
            </span>
            <span className="text-lg font-black text-slate-900 dark:text-white block mt-0.5 font-mono">
              {quizzes.length}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-brand-primary-50 dark:bg-brand-primary-950/50 text-brand-primary-600 flex items-center justify-center shrink-0">
            <FileText size={16} />
          </div>
        </div>

        {/* Active Courses */}
        <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              {isRTL ? 'المقررات النشطة' : 'Active Courses'}
            </span>
            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 block mt-0.5 font-mono">
              {activeCoursesCount}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center shrink-0">
            <BookOpen size={16} />
          </div>
        </div>

        {/* Total Questions */}
        <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              {isRTL ? 'بنك الأسئلة المتاحة' : 'Total Questions'}
            </span>
            <span className="text-lg font-black text-blue-600 dark:text-blue-400 block mt-0.5 font-mono">
              {totalQuestions}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center shrink-0">
            <HelpCircle size={16} />
          </div>
        </div>

        {/* Avg Duration */}
        <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              {isRTL ? 'متوسط المدة' : 'Avg Duration'}
            </span>
            <span className="text-lg font-black text-amber-600 dark:text-amber-400 block mt-0.5 font-mono">
              {avgDuration} {isRTL ? 'د' : 'min'}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock size={16} />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. UNIFIED COMPACT FILTER TOOLBAR                                         */}
      {/* ========================================================================= */}
      <div className="p-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-2xs flex flex-wrap items-center gap-2 mb-6">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isRTL ? 'البحث بعنوان الاختبار أو المقرر...' : 'Search by quiz title or course...'}
            className="w-full h-8.5 ps-8 pe-8 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Sort Select */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
        >
          <option value="latest">{isRTL ? 'ترتيب: أبجدياً' : 'Sort: Alphabetical'}</option>
          <option value="duration">{isRTL ? 'ترتيب: حسب المدة' : 'Sort: Duration'}</option>
          <option value="questions">{isRTL ? 'ترتيب: حسب عدد الأسئلة' : 'Sort: Questions'}</option>
        </select>

        {/* Clear Filters */}
        {(search || sortBy !== 'latest') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('');
              setSortBy('latest');
            }}
            className="h-8.5 px-2.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl font-bold cursor-pointer"
          >
            <X size={13} className="me-1" />
            {isRTL ? 'مسح' : 'Clear'}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="animate-spin text-brand-primary-600" size={48} />
            <p className="label-stat">{isRTL ? 'جاري تحميل الاختبارات...' : 'Syncing assessments...'}</p>
          </div>
        ) : filteredQuizzes.length === 0 ? (
          <div className="col-span-full">
            <EmptyState
              icon={<BookOpen size={48} />}
              title={t('quizzes.noQuizzes')}
              subtitle={isDoctor ? t('quizzes.subtitleDoctor') : t('quizzes.subtitleStudent')}
              action={
                isDoctor
                  ? {
                      label: t('quizzes.createQuiz'),
                      onClick: () => navigate('/quizzes/create'),
                    }
                  : null
              }
            />
          </div>
        ) : (
          filteredQuizzes.map((quiz) => (
            <Card
              key={quiz.id}
              noPadding
              className="group hover:-translate-y-2 duration-500 border-none shadow-soft rounded-[2rem] overflow-hidden flex flex-col"
            >
              <div className="p-8 flex-grow">
                <div className="flex justify-between items-start mb-6">
                  <Badge
                    variant="primary"
                    className="px-3 py-1 text-[10px] font-black uppercase tracking-widest bg-brand-navy-500 text-white border-none"
                  >
                    {quiz.course?.courseCode}
                  </Badge>
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-surface-subtle dark:bg-slate-800/50">
                    <Clock size={14} className="text-brand-primary-600" />
                    <span className="text-[10px] font-black text-brand-text-primary dark:text-brand-text-main uppercase tracking-widest">
                      {quiz.duration} {t('quizzes.minutes')}
                    </span>
                  </div>
                </div>

                <h3 className="text-2xl font-black text-brand-text-primary dark:text-brand-text-main tracking-tight mb-3 group-hover:text-brand-primary-600 transition-colors">
                  {quiz.title}
                </h3>
                <p className="text-sm font-bold text-brand-text-secondary mb-8 line-clamp-2 leading-relaxed opacity-80">
                  {quiz.description || t('common.noData')}
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-surface-subtle dark:bg-slate-800/50">
                    <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 shadow-sm flex items-center justify-center text-brand-primary-600">
                      <HelpCircle size={16} />
                    </div>
                    <div>
                      <p className="text-[8px] font-black text-brand-text-muted uppercase tracking-widest">
                        Questions
                      </p>
                      <p className="text-xs font-black text-brand-text-primary dark:text-brand-text-main">
                        {quiz._count?.questions || 0}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-surface-subtle dark:bg-slate-800/50">
                    <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 shadow-sm flex items-center justify-center text-brand-accent-emerald">
                      <BookOpen size={16} />
                    </div>
                    <div className="truncate">
                      <p className="text-[8px] font-black text-brand-text-muted uppercase tracking-widest">
                        Course
                      </p>
                      <p className="text-xs font-black text-brand-text-primary dark:text-brand-text-main truncate max-w-[80px]">
                        {quiz.course?.name}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-8 py-5 bg-surface-subtle dark:bg-slate-800/30 border-t border-brand-border dark:border-brand-border mt-auto">
                {isStudent ? (
                  <Button
                    onClick={() => navigate(`/quizzes/${quiz.id}/take`)}
                    className="w-full text-[10px] font-black uppercase tracking-widest py-3.5 gap-2 shadow-lg shadow-brand-primary-600/20"
                  >
                    <FileText size={16} />
                    {t('quizzes.takeQuiz')}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full text-[10px] font-black uppercase tracking-widest py-3.5 gap-2 border-slate-200"
                    onClick={() => setSubmissionsQuiz(quiz)}
                  >
                    <CheckCircle size={16} />
                    {t('quizzes.viewSubmissions')}
                  </Button>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      <QuizSubmissionsModal
        isOpen={Boolean(submissionsQuiz)}
        onClose={() => setSubmissionsQuiz(null)}
        quiz={submissionsQuiz}
      />
    </div>
  );
};

export default QuizzesList;
