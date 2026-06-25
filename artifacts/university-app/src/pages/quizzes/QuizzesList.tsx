// @ts-nocheck
// FIXED: View submissions opens modal with API results - Phase 5
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import quizService from '../../services/quiz.service';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  Clock,
  HelpCircle,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import QuizSubmissionsModal from './QuizSubmissionsModal';
import { useToast } from '../../context/ToastContext';

const QuizzesList = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isDoctor = user?.role === 'DOCTOR';
  const isStudent = user?.role === 'STUDENT';

  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();
  const [submissionsQuiz, setSubmissionsQuiz] = useState(null);

  const fetchQuizzes = async () => {
    try {
      setLoading(true);
      const result = await quizService.getQuizzes({});
      if (result.success) {
        setQuizzes(result.data);
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


  return (
    <div className="section-gap animate-page">
      <PageHeader
        title={t('quizzes.title')}
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

      

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {loading ? (
          <div className="col-span-full flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="animate-spin text-brand-primary-600" size={48} />
            <p className="label-stat">Syncing assessments...</p>
          </div>
        ) : quizzes.length === 0 ? (
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
          quizzes.map((quiz) => (
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
