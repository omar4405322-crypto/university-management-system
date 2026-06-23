import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Eye, User, Calendar, Award, CheckCircle, XCircle, ChevronDown, ChevronUp, Save, FileText, Download } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import quizService from '../../services/quiz.service';
import { logger } from '../../lib/logger';
import { useToast } from '../../context/ToastContext';

const QuizSubmissionsModal = ({ isOpen, onClose, quiz }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [grades, setGrades] = useState<Record<number, { score: number; feedback: string }>>({});
  const [overallFeedback, setOverallFeedback] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !quiz?.id) return;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        setExpandedId(null);
        setGrades({});
        setOverallFeedback('');
        const result = await quizService.getQuizSubmissions(quiz.id);
        if (result.success) {
          setSubmissions(result.data || []);
        } else {
          setSubmissions([]);
        }
      } catch (err: any) {
        logger.error('Error loading submissions:', err);
        setError(t('quizzes.submissionsLoadError'));
        setSubmissions([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isOpen, quiz?.id, t]);

  const formatDate = (value) => {
    if (!value) return '—';
    return new Date(value).toLocaleString();
  };

  const toggleExpand = (sub) => {
    if (expandedId === sub.id) {
      setExpandedId(null);
      setGrades({});
      setOverallFeedback('');
      return;
    }
    setExpandedId(sub.id);
    setGrades({});
    setOverallFeedback(sub.feedback || '');

    const initialGrades = {};
    if (sub.answers) {
      (Array.isArray(sub.answers) ? sub.answers : []).forEach((ans) => {
        initialGrades[ans.id || ans.questionId] = {
          score: ans.score ?? '',
          feedback: ans.feedback || '',
        };
      });
    }
    setGrades(initialGrades);
  };

  const updateGrade = (answerId, field, value) => {
    setGrades((prev) => ({
      ...prev,
      [answerId]: { ...prev[answerId], [field]: value },
    }));
  };

  const getQuestionPoints = (sub, questionId) => {
    if (!sub.quiz?.questions) return null;
    const q = sub.quiz.questions.find((q) => q.id === questionId);
    return q?.points || null;
  };

  const handleSaveGrades = async (sub) => {
    try {
      setSaving(true);
      const gradesPayload = Object.entries(grades).map(([answerId, data]) => ({
        answerId: Number(answerId),
        score: Number(data.score) || 0,
        feedback: data.feedback || '',
      }));
      await quizService.gradeSubmission(quiz.id, sub.id, {
        feedback: overallFeedback,
        grades: gradesPayload,
      });
      showToast('Grades saved successfully', 'success');
      const result = await quizService.getQuizSubmissions(quiz.id);
      if (result.success) {
        setSubmissions(result.data || []);
      }
    } catch (err) {
      showToast('Failed to save grades', 'error');
    } finally {
      setSaving(false);
    }
  };

  const renderAnswer = (answer, sub) => {
    const question = sub.quiz?.questions?.find((q) => q.id === answer.questionId);
    const points = question?.points || 0;
    const answerId = answer.id;
    const isAutoGraded = answer.isCorrect !== undefined && answer.isCorrect !== null;
    const gradeEntry = grades[answerId] || { score: '', feedback: '' };

    return (
      <div key={answer.id || answer.questionId} className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm font-bold text-brand-text-primary dark:text-white mb-1">
              {question?.text || `Question #${answer.questionId}`}
            </p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{question?.type || 'Unknown'}</p>
          </div>
          <div className="text-xs font-bold text-slate-400 whitespace-nowrap">{points} pts</div>
        </div>

        {answer.selectedOption && (
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-brand-text-main">
            Selected: {answer.selectedOption}
          </div>
        )}

        {answer.essayText && (
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm text-brand-text-main whitespace-pre-wrap max-h-32 overflow-y-auto">
            {answer.essayText}
          </div>
        )}

        {answer.fileUrl && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
            <FileText size={16} className="text-brand-green-dark" />
            <a href={answer.fileUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-brand-green-dark hover:underline flex items-center gap-1">
              <Download size={14} /> View uploaded file
            </a>
          </div>
        )}

        {isAutoGraded ? (
          <div className="flex items-center gap-2">
            {answer.isCorrect ? (
              <Badge variant="success" className="gap-1">
                <CheckCircle size={12} /> Correct
              </Badge>
            ) : (
              <Badge variant="danger" className="gap-1">
                <XCircle size={12} /> Incorrect
              </Badge>
            )}
            {answer.score != null && (
              <span className="text-sm font-bold text-brand-text-muted">Score: {answer.score}/{points}</span>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Score (0-{points})</label>
              <input
                type="number"
                min={0}
                max={points}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-transparent outline-none focus:ring-4 focus:ring-brand-green-dark/20 focus:border-brand-green-dark transition-all text-sm font-bold"
                value={gradeEntry.score}
                onChange={(e) => updateGrade(answerId, 'score', e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Feedback</label>
              <textarea
                rows={2}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-transparent outline-none focus:ring-4 focus:ring-brand-green-dark/20 focus:border-brand-green-dark transition-all text-xs"
                placeholder="Optional feedback..."
                value={gradeEntry.feedback}
                onChange={(e) => updateGrade(answerId, 'feedback', e.target.value)}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  const hasManualQuestions = (sub) => {
    return sub.answers?.some((a) => a.isCorrect === undefined || a.isCorrect === null);
  };

  const totalScore = (sub) => {
    if (!sub.answers) return null;
    const scores = sub.answers.filter((a) => a.score != null).map((a) => Number(a.score));
    return scores.length > 0 ? scores.reduce((s, v) => s + v, 0) : null;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('quizzes.submissionsTitle', { title: quiz?.title })}
      subtitle={t('quizzes.submissionsSubtitle')}
      size="lg"
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="animate-spin text-brand-green-dark" size={36} />
          <p className="text-sm font-bold text-brand-text-muted">{t('common.loading')}</p>
        </div>
      ) : error ? (
        <p className="text-sm font-bold text-error py-8 text-center">{error}</p>
      ) : submissions.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-brand-text-sub font-bold">{t('quizzes.noSubmissions')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-2xl border border-brand-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-subtle border-b border-brand-border">
                  <th className="px-4 py-3 text-start font-black uppercase tracking-widest text-[10px] text-brand-text-muted">
                    {t('students.fullName')}
                  </th>
                  <th className="px-4 py-3 text-start font-black uppercase tracking-widest text-[10px] text-brand-text-muted">
                    {t('quizzes.score')}
                  </th>
                  <th className="px-4 py-3 text-start font-black uppercase tracking-widest text-[10px] text-brand-text-muted">
                    {t('quizzes.submittedAt')}
                  </th>
                  <th className="px-4 py-3 text-start font-black uppercase tracking-widest text-[10px] text-brand-text-muted">
                    Status
                  </th>
                  <th className="px-4 py-3 text-end font-black uppercase tracking-widest text-[10px] text-brand-text-muted">
                    {t('common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {submissions.map((sub) => {
                  const isExpanded = expandedId === sub.id;
                  const hasManual = hasManualQuestions(sub);
                  const total = totalScore(sub);
                  return (
                    <React.Fragment key={sub.id}>
                      <tr className={`hover:bg-surface-subtle/50 transition-colors ${isExpanded ? 'bg-surface-subtle' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 font-bold text-brand-text-main">
                            <User size={14} className="text-brand-green-dark" />
                            {sub.student?.firstName} {sub.student?.lastName}
                            <span className="text-[10px] text-brand-text-muted">
                              ({sub.student?.studentId})
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {sub.status === 'GRADED' && total != null ? (
                            <Badge variant="success" className="gap-1">
                              <Award size={12} />
                              {total} pts
                            </Badge>
                          ) : sub.score != null ? (
                            <Badge variant="primary" className="gap-1">
                              <Award size={12} />
                              {sub.score}%
                            </Badge>
                          ) : (
                            <span className="text-slate-400 font-bold">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-brand-text-sub font-semibold">
                          <span className="inline-flex items-center gap-1">
                            <Calendar size={12} />
                            {formatDate(sub.submittedAt)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {sub.status === 'GRADED' ? (
                            <Badge variant="success" className="text-[10px] gap-1">
                              <CheckCircle size={10} /> GRADED
                            </Badge>
                          ) : (
                            <Badge variant="warning" className="text-[10px]">
                              Pending
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-[10px] font-black uppercase tracking-widest"
                            onClick={() => toggleExpand(sub)}
                          >
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            {isExpanded ? 'Hide' : 'View'} Answers
                          </Button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={5} className="px-4 py-4 bg-slate-50/50 dark:bg-slate-800/20">
                            <div className="space-y-4">
                              {sub.answers && Array.isArray(sub.answers) && sub.answers.length > 0 ? (
                                sub.answers.map((answer) => renderAnswer(answer, sub))
                              ) : (
                                <p className="text-sm text-slate-400 font-semibold text-center py-4">No answers stored</p>
                              )}

                              {hasManual && (
                                <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                                  <div>
                                    <label className="text-xs font-black uppercase tracking-widest text-slate-400 block mb-1">Overall Feedback</label>
                                    <textarea
                                      rows={2}
                                      className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 outline-none focus:ring-4 focus:ring-brand-green-dark/20 focus:border-brand-green-dark transition-all text-sm"
                                      placeholder="General feedback for the student..."
                                      value={overallFeedback}
                                      onChange={(e) => setOverallFeedback(e.target.value)}
                                    />
                                  </div>
                                  <div className="flex justify-end">
                                    <Button
                                      onClick={() => handleSaveGrades(sub)}
                                      disabled={saving}
                                      className="gap-2"
                                    >
                                      {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                      {saving ? 'Saving...' : 'Save Grades'}
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default QuizSubmissionsModal;
