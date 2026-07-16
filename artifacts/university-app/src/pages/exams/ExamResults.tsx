import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, AlertTriangle, CheckCircle2, ArrowLeft, ShieldAlert } from 'lucide-react';
import examsService from '../../services/exams.service';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';

const ExamResults = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchResult();
  }, [id]);

  const fetchResult = async () => {
    try {
      setLoading(true);
      const res = await examsService.getMyExamSubmission(id);
      if (res.success) {
        setSubmission(res.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load results');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Loader2 className="animate-spin text-brand-primary-500" size={48} />
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700">
        <AlertTriangle size={40} className="text-red-500 mx-auto mb-6" />
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{error || 'Submission not found'}</h2>
        <Button variant="outline" className="mt-6" onClick={() => navigate('/exams')}>
          Return to Exams
        </Button>
      </div>
    );
  }

  const { status, score, maxScore, violations, submittedAt } = submission;
  const isPending = status === 'PENDING';

  return (
    <div className="section-gap animate-in fade-in max-w-2xl mx-auto py-12">
      <Card className="text-center py-12 px-6 rounded-[2.5rem] border-slate-200 dark:border-slate-700 shadow-xl shadow-brand-primary-500/5 relative overflow-hidden">
        
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-brand-primary-500/10 to-transparent"></div>

        {isPending ? (
          <div className="h-24 w-24 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center mx-auto mb-8 relative z-10">
            <Loader2 size={48} className="animate-spin" />
          </div>
        ) : (
          <div className="h-24 w-24 rounded-full bg-brand-primary-500/10 text-brand-primary-500 flex items-center justify-center mx-auto mb-8 relative z-10">
            <CheckCircle2 size={48} />
          </div>
        )}

        <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100 mb-4 relative z-10">
          {isPending ? 'Exam Submitted Successfully' : 'Your Exam Results'}
        </h1>
        
        <p className="text-slate-500 font-bold mb-8 relative z-10">
          Submitted on: {new Date(submittedAt).toLocaleString()}
        </p>

        {!isPending && (
          <div className="inline-flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800 p-8 rounded-3xl border border-slate-200 dark:border-slate-700 mb-8 relative z-10 w-full max-w-sm">
            <span className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2">Final Score</span>
            <div className="text-5xl font-black text-brand-primary-500">
              {score} <span className="text-2xl text-slate-400">/ {maxScore}</span>
            </div>
            
            {score !== null && maxScore !== null && (
              <div className="mt-4 w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-brand-primary-500 h-full" 
                  style={{ width: `${(score / maxScore) * 100}%` }}
                ></div>
              </div>
            )}
          </div>
        )}

        {isPending && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50 p-6 rounded-2xl mb-8 relative z-10">
            <h3 className="font-bold text-yellow-800 dark:text-yellow-500 mb-2">Manual Grading Required</h3>
            <p className="text-sm text-yellow-700 dark:text-yellow-600 font-medium">
              Your exam includes short-answer questions that require manual review by the instructor. 
              Your final score will be available once the grading is complete.
            </p>
          </div>
        )}

        {violations && violations.length > 0 && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 p-6 rounded-2xl mb-8 relative z-10 text-left">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400 font-black mb-3">
              <ShieldAlert size={20} />
              Academic Integrity Warning
            </div>
            <p className="text-sm text-red-700 dark:text-red-300 font-bold mb-3">
              Our system recorded {violations.length} anti-cheat violation(s) during your session. 
              This has been logged and will be reviewed by the instructor.
            </p>
            <ul className="text-xs text-red-600 dark:text-red-400 font-bold space-y-1 list-disc list-inside">
              {violations.slice(0, 3).map(v => (
                <li key={v.id}>{v.type} - {new Date(v.occurredAt).toLocaleTimeString()}</li>
              ))}
              {violations.length > 3 && <li>...and {violations.length - 3} more</li>}
            </ul>
          </div>
        )}

        <Button 
          onClick={() => navigate('/exams')}
          className="bg-slate-800 hover:bg-slate-900 text-white rounded-2xl px-8 h-14 font-black text-lg w-full md:w-auto relative z-10"
        >
          <ArrowLeft size={20} className="mr-2 rtl:-scale-x-100" />
          Back to My Exams
        </Button>
      </Card>
    </div>
  );
};

export default ExamResults;
