import React, { useState, useEffect } from 'react';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import { examSessionService, ExamSubmission } from '../../../services/examSession.service';
import { useToast } from '../../../context/ToastContext';

interface GradeSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  submission: ExamSubmission | null;
}

const GradeSubmissionModal: React.FC<GradeSubmissionModalProps> = ({ isOpen, onClose, onSuccess, submission }) => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [violations, setViolations] = useState<any>(null);
  
  // Format: { answerId: { score, feedback } }
  const [grades, setGrades] = useState<Record<number, { score: number; feedback: string }>>({});
  const [overallFeedback, setOverallFeedback] = useState('');

  // Initialize grades when modal opens
  React.useEffect(() => {
    if (isOpen && submission) {
      setOverallFeedback(submission.feedback || '');
      const initialGrades: Record<number, { score: number; feedback: string }> = {};
      submission.answers?.forEach(ans => {
        if (ans.question?.type === 'ESSAY' || ans.question?.type === 'FILE_UPLOAD') {
           initialGrades[ans.id] = {
             score: ans.score || 0,
             feedback: ans.feedback || ''
           };
        }
      });
      setGrades(initialGrades);
    }
  }, [isOpen, submission]);

  // Fetch violations when modal opens
  useEffect(() => {
    if (isOpen && submission?.id) {
      examSessionService
        .getViolations(submission.examSessionId, submission.id)
        .then(setViolations)
        .catch(() => {}); // silently fail
    } else {
      setViolations(null);
    }
  }, [isOpen, submission?.id, submission?.examSessionId]);

  if (!submission) return null;

  const handleGradeChange = (answerId: number, field: 'score' | 'feedback', value: any) => {
    setGrades(prev => ({
      ...prev,
      [answerId]: {
        ...prev[answerId],
        [field]: value
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const formattedAnswers = Object.entries(grades).map(([ansId, data]) => ({
        answerId: Number(ansId),
        score: Number(data.score),
        feedback: data.feedback
      }));

      await examSessionService.gradeSubmission(submission.examSessionId, submission.id, {
        feedback: overallFeedback,
        answers: formattedAnswers
      });
      
      showToast('Submission graded successfully', 'success');
      onSuccess();
      onClose();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to grade submission', 'error');
    } finally {
      setLoading(false);
    }
  };

  const manualAnswers = submission.answers?.filter(
    a => a.question?.type === 'ESSAY' || a.question?.type === 'FILE_UPLOAD'
  ) || [];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Grade Submission - ${submission.student?.firstName} ${submission.student?.lastName}`} size="lg">
      <form onSubmit={handleSubmit} className="p-6 flex flex-col h-[80vh]">
        
        <div className="flex-1 overflow-y-auto pr-2 space-y-8">
          <div className="bg-surface-subtle dark:bg-slate-800/50 p-4 rounded-xl flex justify-between items-center">
            <div>
              <p className="text-sm font-bold text-brand-text-muted uppercase tracking-widest">Student</p>
              <p className="font-bold text-brand-text-primary dark:text-white">
                {submission.student?.studentId} - {submission.student?.firstName} {submission.student?.lastName}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-brand-text-muted uppercase tracking-widest">Auto Score</p>
              <p className="text-xl font-black text-brand-text-primary dark:text-white">{submission.totalScore || 0}</p>
            </div>
          </div>

          {manualAnswers.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              No manual grading required for this submission.
            </div>
          ) : (
            manualAnswers.map((ans, idx) => {
              const q = ans.question;
              if (!q) return null;
              
              return (
                <div key={ans.id} className="border border-slate-200 dark:border-slate-700 rounded-2xl p-6">
                  <div className="flex justify-between mb-4">
                     <span className="text-xs font-black uppercase tracking-widest text-brand-text-muted">Question {idx + 1} ({q.type})</span>
                     <span className="text-xs font-black text-brand-green-dark">{q.points} Points</span>
                  </div>
                  <h4 className="text-lg font-bold text-brand-text-primary dark:text-white mb-4">
                    {q.text}
                  </h4>
                  
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl mb-6">
                    <span className="text-xs font-bold text-brand-text-muted block mb-2">Student's Answer:</span>
                    {q.type === 'ESSAY' && (
                      <p className="text-sm text-brand-text-primary dark:text-slate-300 whitespace-pre-wrap">{ans.essayText || 'No answer provided'}</p>
                    )}
                    {q.type === 'FILE_UPLOAD' && (
                      ans.fileUrl ? (
                        <a href={ans.fileUrl} target="_blank" rel="noreferrer" className="text-brand-green-dark underline text-sm font-medium">
                          View Uploaded File
                        </a>
                      ) : (
                        <span className="text-sm italic text-slate-500">No file uploaded</span>
                      )
                    )}
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    <div className="col-span-1">
                      <Input
                        type="number"
                        label={`Score (0-${q.points})`}
                        min={0}
                        max={q.points}
                        value={grades[ans.id]?.score || 0}
                        onChange={(e) => handleGradeChange(ans.id, 'score', Number(e.target.value))}
                        required
                      />
                    </div>
                    <div className="col-span-3">
                      <Input
                        label="Feedback (Optional)"
                        value={grades[ans.id]?.feedback || ''}
                        onChange={(e) => handleGradeChange(ans.id, 'feedback', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}

          <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
            <label className="text-sm font-bold text-brand-text-primary block mb-2">Overall Feedback</label>
            <textarea
              className="w-full p-4 rounded-xl border border-slate-200 bg-transparent"
              rows={3}
              value={overallFeedback}
              onChange={(e) => setOverallFeedback(e.target.value)}
              placeholder="Leave a general comment for the student..."
            />
          </div>

          {/* Violations Panel */}
          {violations && violations.total > 0 && (
            <div className="mt-4 border border-red-200 dark:border-red-800 rounded-xl p-4 bg-red-50 dark:bg-red-950/30">
              <h4 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-3 flex items-center gap-2">
                <span>⚠️</span>
                Integrity Violations Detected ({violations.total})
              </h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(violations.summary).map(([type, count]) => (
                  <span
                    key={type}
                    className="text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-3 py-1.5 rounded-full font-medium border border-red-200 dark:border-red-700"
                  >
                    {type.replace(/_/g, ' ')}: {count as number}x
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-6 shrink-0 border-t border-slate-200 dark:border-slate-700 mt-4">
          <Button variant="outline" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" disabled={loading} className="min-w-[120px]">
            {loading ? 'Saving...' : 'Save Grade'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default GradeSubmissionModal;
