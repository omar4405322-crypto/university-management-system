// @ts-nocheck
﻿// FIXED: Show quiz submissions with scores and answer preview - Phase 5
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Eye, User, Calendar, Award } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/button';
import Badge from '../../components/ui/Badge';
import quizService from '../../services/quiz.service';
import { logger } from '../../lib/logger';

const QuizSubmissionsModal = ({ isOpen, onClose, quiz }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !quiz?.id) return;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        setSelectedSubmission(null);
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
          <Loader2 className="animate-spin text-brand-primary-600" size={36} />
          <p className="text-sm font-bold text-brand-text-muted">{t('common.loading')}</p>
        </div>
      ) : error ? (
        <p className="text-sm font-bold text-error py-8 text-center">{error}</p>
      ) : submissions.length === 0 ? (
        <div className="py-12 text-center">
          {/* TODO: backend supports GET /quizzes/:id/results — wire answer-detail view when expanded */}
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
                        <User size={14} className="text-brand-primary-600" />
                        {sub.student?.firstName} {sub.student?.lastName}
                        <span className="text-[10px] text-brand-text-muted">
                          ({sub.student?.studentId})
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="primary" className="gap-1">
                        <Award size={12} />
                        {sub.score != null ? `${sub.score}%` : '—'}
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
                        onClick={() => setSelectedSubmission(sub)}
                      >
                        <Eye size={14} />
                        {t('quizzes.viewAnswers')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedSubmission && (
            <div className="p-4 rounded-2xl bg-surface-subtle border border-brand-border">
              <h4 className="text-sm font-black text-brand-text-main mb-3">
                {t('quizzes.answersFor', {
                  name: `${selectedSubmission.student?.firstName} ${selectedSubmission.student?.lastName}`,
                })}
              </h4>
              {selectedSubmission.answers && typeof selectedSubmission.answers === 'object' ? (
                <ul className="space-y-2 text-sm">
                  {Object.entries(selectedSubmission.answers).map(([qId, answer]) => (
                    <li
                      key={qId}
                      className="flex justify-between gap-4 font-semibold text-brand-text-sub"
                    >
                      <span>
                        {t('quizzes.question')} {qId}
                      </span>
                      <span className="text-brand-text-main">{String(answer)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-brand-text-muted">{t('quizzes.noAnswersStored')}</p>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

export default QuizSubmissionsModal;
