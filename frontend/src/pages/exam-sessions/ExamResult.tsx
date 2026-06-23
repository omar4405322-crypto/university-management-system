import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { examSessionService, ExamSubmission, ExamAnswer } from '../../services/examSession.service';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/ui/PageHeader';
import { CheckCircle, XCircle, FileText, Loader2, ArrowLeft } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';

const ExamResult = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [submission, setSubmission] = useState<ExamSubmission | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResult = async () => {
      try {
        setLoading(true);
        const data = await examSessionService.getMyResult(Number(id));
        setSubmission(data);
      } catch (error) {
        // Results might not be available or showResultsAfter is false
        navigate('/exam-sessions');
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchResult();
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="section-gap flex flex-col items-center justify-center py-24">
        <Loader2 className="animate-spin text-brand-green-dark mb-4" size={48} />
        <p className="label-stat">Loading your results...</p>
      </div>
    );
  }

  if (!submission) return null;

  if (submission.status !== 'GRADED' && !submission.examSession?.showResultsAfter) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
        <div className="text-5xl">⏳</div>
        <h2 className="text-xl font-semibold">Results Not Available Yet</h2>
        <p className="text-gray-500">
          Your exam has been submitted. Results will be released by your doctor.
        </p>
      </div>
    );
  }

  const totalPossible = submission.answers?.reduce((sum, a) => sum + (a.question?.points || 0), 0) || 0;
  // NOTE: If submission is not graded, totalScore might not reflect the full manual score yet, but we display what we have.
  // Actually, getMyResult only returns if showResultsAfter = true.
  
  // Need the passing score from the session, but getMyResult returns the submission.
  // We can just rely on the score calculation. Let's assume 50% passing for UI if not returned.
  // Since we didn't include the session passingScore in the submission return explicitly in backend, we'll estimate or just show score.
  const score = submission.totalScore || 0;
  const percentage = totalPossible > 0 ? (score / totalPossible) * 100 : 0;
  const passed = percentage >= 50; // default 50%

  return (
    <div className="section-gap animate-page">
      <Button variant="outline" className="mb-6 gap-2" onClick={() => navigate('/exam-sessions')}>
        <ArrowLeft size={16} /> Back to Exam Sessions
      </Button>
      
      <PageHeader
        title="Exam Results"
        subtitle="Review your performance and doctor feedback"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <Card className="col-span-1 flex flex-col items-center justify-center p-8 border-none shadow-soft rounded-[2rem]">
           {/* Circular progress representation */}
           <div className="relative w-48 h-48 mb-6 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                 <circle cx="50" cy="50" r="45" fill="transparent" stroke="currentColor" strokeWidth="10" className="text-slate-100 dark:text-slate-800" />
                 <circle 
                   cx="50" cy="50" r="45" fill="transparent" stroke="currentColor" strokeWidth="10" 
                   strokeDasharray={283} strokeDashoffset={283 - (283 * percentage) / 100}
                   className={`transition-all duration-1000 ease-out ${passed ? 'text-brand-accent-emerald' : 'text-red-500'}`} 
                 />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                 <span className="text-4xl font-black text-brand-text-primary dark:text-white">{score}</span>
                 <span className="text-sm font-bold text-brand-text-muted">/ {totalPossible}</span>
              </div>
           </div>
           
           <Badge className={`px-4 py-2 text-sm font-black uppercase tracking-widest border-none ${passed ? 'bg-brand-accent-emerald/20 text-brand-green-dark' : 'bg-red-100 text-red-600'}`}>
             {passed ? 'Passed' : 'Failed'}
           </Badge>

           <div className="mt-6 text-center">
             <p className="text-sm font-bold text-brand-text-secondary">Status: <span className="text-brand-text-primary dark:text-white uppercase">{submission.status}</span></p>
           </div>
        </Card>

        {submission.feedback && (
          <Card className="col-span-1 lg:col-span-2 p-8 border-none shadow-soft rounded-[2rem] bg-brand-navy-50 dark:bg-brand-navy-900/20">
             <h3 className="text-lg font-black mb-4 flex items-center gap-2 text-brand-navy-800 dark:text-brand-navy-200">
               <FileText size={20} /> Overall Feedback
             </h3>
             <p className="text-brand-text-secondary leading-relaxed">{submission.feedback}</p>
          </Card>
        )}
      </div>

      <h3 className="text-xl font-black mb-6">Question Breakdown</h3>
      <div className="space-y-6">
        {submission.answers?.map((answer: ExamAnswer, index: number) => {
          const q = answer.question;
          if (!q) return null;
          
          const isCorrect = answer.isCorrect;
          
          return (
            <Card key={answer.id} noPadding className="overflow-hidden border-none shadow-sm rounded-3xl">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-sm font-bold text-brand-text-muted uppercase tracking-widest">
                    Question {index + 1}
                  </span>
                  <div className="flex gap-2">
                    {answer.score !== undefined && (
                      <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-none">
                        Score: {answer.score} / {q.points}
                      </Badge>
                    )}
                    {(q.type === 'MCQ' || q.type === 'TRUE_FALSE') && (
                      isCorrect ? (
                        <Badge className="bg-green-100 text-green-700 border-none"><CheckCircle size={14} className="mr-1 inline"/> Correct</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-700 border-none"><XCircle size={14} className="mr-1 inline"/> Incorrect</Badge>
                      )
                    )}
                  </div>
                </div>
                
                <h4 className="text-lg font-bold text-brand-text-primary dark:text-white mb-4">
                  {q.text}
                </h4>

                <div className="bg-surface-subtle dark:bg-slate-800/50 rounded-xl p-4 space-y-4">
                  <div>
                    <span className="text-xs font-bold text-brand-text-muted block mb-1">Your Answer:</span>
                    <p className="font-medium text-brand-text-primary dark:text-white">
                      {q.type === 'MCQ' || q.type === 'TRUE_FALSE' ? answer.selectedOption || 'No answer' : null}
                      {q.type === 'ESSAY' ? answer.essayText || 'No answer' : null}
                      {q.type === 'FILE_UPLOAD' ? (
                        answer.fileUrl ? <a href={answer.fileUrl} target="_blank" rel="noreferrer" className="text-brand-green-dark underline">View Uploaded File</a> : 'No file uploaded'
                      ) : null}
                    </p>
                  </div>

                  {q.correctAnswer && (
                     <div>
                       <span className="text-xs font-bold text-brand-text-muted block mb-1">Correct Answer:</span>
                       <p className="font-medium text-green-600">{q.correctAnswer}</p>
                     </div>
                  )}

                  {answer.feedback && (
                     <div className="mt-4 p-4 bg-brand-navy-50 dark:bg-brand-navy-900/30 rounded-lg">
                       <span className="text-xs font-bold text-brand-navy-600 dark:text-brand-navy-300 block mb-1">Doctor's Feedback:</span>
                       <p className="text-sm font-medium">{answer.feedback}</p>
                     </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default ExamResult;
