import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, User, Calendar, Award, CheckCircle, AlertCircle, FileText, Send } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import taskService from '../../services/task.service';
import { logger } from '../../lib/logger';
import { useToast } from '../../context/ToastContext';

const TaskSubmissionsModal = ({ isOpen, onClose, task }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [scoreInput, setScoreInput] = useState('');
  const [savingScore, setSavingScore] = useState(false);
  const [error, setError] = useState(null);
  const { showToast } = useToast();

  useEffect(() => {
    if (!isOpen || !task?.id) return;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        setSelectedSubmission(null);
        setScoreInput('');
        const result = await taskService.getTaskSubmissions(task.id);
        if (result.success) {
          setSubmissions(result.data || []);
        } else {
          setSubmissions([]);
        }
      } catch (err: any) {
        logger.error('Error loading submissions:', err);
        setError(t('tasks.submissionsLoadError', 'Error loading submissions'));
        setSubmissions([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isOpen, task?.id, t]);

  const formatDate = (value) => {
    if (!value) return '—';
    return new Date(value).toLocaleString();
  };

  const handleGrade = async (submission) => {
    if (!scoreInput || isNaN(Number(scoreInput))) {
      showToast(t('tasks.invalidScore', 'Invalid score'), 'error');
      return;
    }
    
    if (Number(scoreInput) < 0 || Number(scoreInput) > (task?.maxScore || 100)) {
      showToast(t('tasks.scoreOutOfBounds', 'Score out of bounds'), 'error');
      return;
    }

    try {
      setSavingScore(true);
      const result = await taskService.gradeSubmission(task.id, submission.id, { score: Number(scoreInput) });
      if (result.success) {
        showToast(t('tasks.gradeSaved', 'Grade saved successfully'), 'success');
        setSubmissions(prev => prev.map(s => s.id === submission.id ? { ...s, score: Number(scoreInput) } : s));
        setSelectedSubmission(null);
        setScoreInput('');
      }
    } catch (err: any) {
      logger.error('Error grading submission:', err);
      showToast(err.response?.data?.message || t('tasks.gradeError', 'Error saving grade'), 'error');
    } finally {
      setSavingScore(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('tasks.submissionsTitle', 'Submissions for Task')}
      subtitle={task?.title}
      size="lg"
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="animate-spin text-brand-primary-500" size={36} />
          <p className="text-sm font-bold text-brand-text-muted">{t('common.loading')}</p>
        </div>
      ) : error ? (
        <p className="text-sm font-bold text-error py-8 text-center">{error}</p>
      ) : submissions.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-brand-text-sub font-bold">{t('tasks.noSubmissions', 'No submissions yet')}</p>
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
                    {t('tasks.score', 'Score')}
                  </th>
                  <th className="px-4 py-3 text-start font-black uppercase tracking-widest text-[10px] text-brand-text-muted">
                    {t('tasks.submittedAt', 'Submitted At')}
                  </th>
                  <th className="px-4 py-3 text-end font-black uppercase tracking-widest text-[10px] text-brand-text-muted">
                    {t('common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {submissions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-surface-subtle/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 font-bold text-brand-text-main">
                        <User size={14} className="text-brand-primary-500" />
                        {sub.student?.firstName} {sub.student?.lastName}
                        <span className="text-[10px] text-brand-text-muted">
                          ({sub.student?.studentId})
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="primary" className="gap-1 bg-brand-primary-50 text-brand-primary-500 dark:bg-brand-primary-900/20">
                        <Award size={12} />
                        {sub.score != null ? `${sub.score} / ${task?.maxScore || 100}` : '—'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-brand-text-sub font-semibold">
                      <span className="inline-flex items-center gap-1">
                        <Calendar size={12} />
                        {formatDate(sub.submittedAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-[10px] font-black uppercase tracking-widest"
                        onClick={() => {
                          setSelectedSubmission(sub);
                          setScoreInput(sub.score != null ? sub.score.toString() : '');
                        }}
                      >
                        <FileText size={14} className="mr-1" />
                        {t('tasks.viewDetails', 'Details')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedSubmission && (
            <div className="p-5 rounded-2xl bg-surface-subtle border border-brand-border animate-in slide-in-from-top-2">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-sm font-black text-brand-text-main">
                  {t('tasks.submissionFor', 'Submission Details:')} {selectedSubmission.student?.firstName} {selectedSubmission.student?.lastName}
                </h4>
                <button onClick={() => setSelectedSubmission(null)} className="text-brand-text-muted hover:text-brand-text-main">
                  <AlertCircle size={16} />
                </button>
              </div>
              
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-brand-text-muted mb-1">Notes</p>
                  <p className="text-brand-text-secondary font-medium bg-white dark:bg-slate-900 p-3 rounded-xl border border-brand-border">
                    {selectedSubmission.notes || <span className="italic opacity-50">No notes provided</span>}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-brand-text-muted mb-1">Attached File</p>
                  {selectedSubmission.fileUrl ? (
                    <a 
                      href={selectedSubmission.fileUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-brand-primary-500 hover:text-brand-primary-600 font-bold bg-brand-primary-50 dark:bg-brand-primary-900/10 px-3 py-2 rounded-lg transition-colors"
                    >
                      <FileText size={16} />
                      View Attachment
                    </a>
                  ) : (
                    <p className="text-brand-text-secondary font-medium italic opacity-50">No file attached</p>
                  )}
                </div>

                <div className="pt-4 mt-4 border-t border-brand-border">
                  <p className="text-[10px] font-black uppercase tracking-widest text-brand-text-muted mb-2">Grading</p>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={scoreInput}
                      onChange={(e) => setScoreInput(e.target.value)}
                      placeholder={`Max: ${task?.maxScore || 100}`}
                      className="px-3 py-2 border border-brand-border rounded-lg focus:ring-2 focus:ring-brand-primary-500 outline-none w-32 font-bold text-brand-text-main bg-white dark:bg-slate-900"
                    />
                    <Button 
                      onClick={() => handleGrade(selectedSubmission)} 
                      disabled={savingScore}
                      size="sm"
                      className="gap-2"
                    >
                      {savingScore ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                      Save Grade
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

export default TaskSubmissionsModal;
