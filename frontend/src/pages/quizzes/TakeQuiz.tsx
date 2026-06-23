import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useBlocker } from 'react-router-dom';
import quizService from '../../services/quiz.service';
import { Clock, CheckCircle, AlertCircle, ChevronRight, ChevronLeft, Send, Loader2, Info, Upload, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ConfirmDeleteModal from '../../components/ui/ConfirmDeleteModal';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import { useToast } from '../../context/ToastContext';

interface AnswerValue {
  selectedOption?: string;
  essayText?: string;
  fileUrl?: string;
  fileName?: string;
}

const TakeQuiz = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();

  const [quiz, setQuiz] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);

  const [answers, setAnswers] = useState<Record<number, AnswerValue>>(() => {
    const saved = localStorage.getItem(`quiz_answers_${id}`);
    return saved ? JSON.parse(saved) : {};
  });

  const [timeLeft, setTimeLeft] = useState<number>(() => {
    const saved = localStorage.getItem(`quiz_timer_${id}`);
    return saved ? parseInt(saved) : 0;
  });

  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Save answers to localStorage
  useEffect(() => {
    localStorage.setItem(`quiz_answers_${id}`, JSON.stringify(answers));
  }, [answers, id]);

  // Save timer to localStorage
  useEffect(() => {
    if (timeLeft > 0) {
      localStorage.setItem(`quiz_timer_${id}`, timeLeft.toString());
    }
  }, [timeLeft, id]);

  // Alert at unload
  useEffect(() => {
    if (submitted) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [submitted]);

  // Navigation blocker
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !submitted && currentLocation.pathname !== nextLocation.pathname
  );

  const fetchQuiz = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await quizService.getQuizById(id);
      if (res.success) {
        const quizData = res.data;
        const now = new Date();
        
        // Active windows validation
        if (quizData.startTime && now < new Date(quizData.startTime)) {
          setErrorMsg(`Quiz has not opened yet. It starts at: ${new Date(quizData.startTime).toLocaleString()}`);
          return;
        }
        if (quizData.endTime && now > new Date(quizData.endTime)) {
          setErrorMsg('This quiz is no longer active (closed).');
          return;
        }

        setQuiz(quizData);
        if (!localStorage.getItem(`quiz_timer_${id}`)) {
          const duration = quizData.duration || 30;
          setTimeLeft(duration * 60);
          localStorage.setItem(`quiz_timer_${id}`, (duration * 60).toString());
        }
        if (quizData.hasSubmitted) {
          setSubmitted(true);
        }
      } else {
        setErrorMsg('Quiz not found');
      }
    } catch (error: any) {
      setErrorMsg(error.response?.data?.message || 'Error loading quiz details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchQuiz();
  }, [fetchQuiz]);

  const handleSubmit = useCallback(async () => {
    if (submitting || submitted) return;
    setSubmitting(true);
    try {
      const formattedAnswers = Object.entries(answers).map(([questionId, val]) => ({
        questionId: parseInt(questionId),
        selectedOption: val.selectedOption,
        essayText: val.essayText,
        fileUrl: val.fileUrl,
      }));
      const res = await quizService.submitQuiz(id, formattedAnswers);
      if (res.success) {
        setResult(res.data);
        setSubmitted(true);
        localStorage.removeItem(`quiz_answers_${id}`);
        localStorage.removeItem(`quiz_timer_${id}`);
        showToast('Quiz submitted successfully', 'success');
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Error submitting quiz', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [id, answers, submitting, submitted, showToast]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft <= 0 || submitted || !quiz) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, submitted, quiz, handleSubmit]);

  const handleAnswerSelect = (questionId: number, selectedOption: string) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [questionId]: { selectedOption } }));
  };

  const handleEssayChange = (questionId: number, essayText: string) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [questionId]: { ...prev[questionId], essayText } }));
  };

  const handleFileUpload = async (questionId: number, file: File) => {
    if (submitted || !id) return;
    try {
      const res = await quizService.uploadAnswerFile(Number(id), questionId, file);
      if (res.success) {
        const fileUrl = res.data?.fileUrl || res.data?.url || '';
        setAnswers((prev) => ({ ...prev, [questionId]: { fileUrl, fileName: file.name } }));
        showToast('File uploaded successfully', 'success');
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Error uploading file', 'error');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isTimeCritical = timeLeft > 0 && timeLeft <= 300;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Loader2 className="animate-spin text-brand-green-dark" size={48} />
        <p className="text-brand-text-sub font-bold uppercase tracking-widest text-sm">
          Loading Quiz...
        </p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="max-w-md mx-auto text-center py-20 bg-brand-bg-card rounded-3xl border border-brand-border shadow-soft px-6">
        <div className="h-20 w-20 rounded-full bg-brand-navy-500/5 flex items-center justify-center mx-auto mb-6">
          <AlertCircle size={40} className="text-error" />
        </div>
        <h2 className="text-2xl font-bold text-brand-text-main mb-4">{errorMsg}</h2>
        <Button variant="outline" onClick={() => navigate('/quizzes')}>
          Back to Quizzes
        </Button>
      </div>
    );
  }

  const needsManualGrading = quiz.questions?.some((q: any) => q.type === 'ESSAY' || q.type === 'FILE_UPLOAD');

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto mt-12 p-8 bg-brand-bg-card border border-brand-border rounded-3xl shadow-soft text-center animate-in zoom-in duration-500">
        <div className="bg-emerald-50 dark:bg-emerald-950/20 text-brand-green-dark w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={48} />
        </div>
        <h1 className="text-3xl font-black text-brand-text-primary dark:text-white mb-2">Quiz Submitted!</h1>
        
        {needsManualGrading ? (
          <p className="text-brand-text-secondary font-bold mb-8 max-w-md mx-auto">
            Your answers have been submitted for review. Some questions require manual grading by the doctor.
          </p>
        ) : (
          <>
            <p className="text-brand-text-secondary font-bold mb-8">
              Here is your auto-graded result summary:
            </p>
            {result && (
              <div className="bg-brand-bg-page rounded-2xl border border-brand-border p-6 mb-8 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-brand-text-muted uppercase font-bold tracking-wider">Your Score</p>
                  <p className="text-3xl font-black text-brand-green-dark mt-1">
                    {result.score?.toFixed(1) || 0}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-brand-text-muted uppercase font-bold tracking-wider">Status</p>
                  <p className="text-3xl font-black text-brand-green-dark mt-1">
                    Completed
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        <Button
          onClick={() => navigate('/quizzes')}
          className="px-8 shadow-xl shadow-brand-green-dark/20"
        >
          Back to Quizzes
        </Button>
      </div>
    );
  }

  const currentQuestion = quiz.questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === quiz.questions.length - 1;

  return (
    <div className="min-h-[calc(100vh-120px)] bg-brand-bg-page pb-12">
      <div className="bg-brand-bg-card border-b border-brand-border sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div>
            <h1 className="font-black text-lg text-brand-text-primary dark:text-white truncate max-w-[200px] md:max-w-none">
              {quiz.title}
            </h1>
            <p className="text-xs text-slate-400 font-bold">{quiz.course?.courseCode} – {quiz.course?.name}</p>
          </div>
          <div
            className={`flex items-center px-5 py-2.5 rounded-xl font-mono text-lg font-black transition-all shadow-inner ${isTimeCritical ? 'bg-error text-white animate-pulse' : 'bg-brand-navy-500 text-brand-green'}`}
          >
            <Clock size={18} className="mr-2" />
            {formatTime(timeLeft)}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto mt-6 px-6">
        {isTimeCritical && (
          <div className="mb-4 p-4 rounded-2xl bg-red-50 text-red-800 dark:bg-red-950/20 dark:text-red-300 border border-red-100 dark:border-red-900 flex items-center gap-3 animate-pulse">
            <AlertCircle size={20} className="shrink-0" />
            <p className="text-xs font-black uppercase tracking-wider">
              Only 5 minutes left! The quiz will automatically submit when time expires.
            </p>
          </div>
        )}

        <div className="mb-6 flex justify-between items-center text-sm text-brand-text-secondary">
          <span className="font-bold">
            Question {currentQuestionIndex + 1} of {quiz.questions.length}
          </span>
          <span className="text-xs font-bold text-slate-400">({currentQuestion.points} Points)</span>
        </div>

        <Card className="p-8 border-none shadow-soft rounded-[2rem] animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-start gap-3 mb-8">
            <Badge variant="primary" className="text-[10px] font-black uppercase tracking-widest shrink-0 mt-1">
              {currentQuestion.type}
            </Badge>
            <h2 className="text-xl font-black text-brand-text-primary dark:text-white leading-relaxed">
              {currentQuestion.text}
            </h2>
          </div>

          {currentQuestion.type === 'MCQ' && (
            <div className="space-y-4">
              {['A', 'B', 'C', 'D'].map((opt) => {
                const optionKey = `option${opt}`;
                const isSelected = answers[currentQuestion.id]?.selectedOption === opt;
                return (
                  <button
                    key={opt}
                    onClick={() => handleAnswerSelect(currentQuestion.id, opt)}
                    className={`w-full text-left p-5 rounded-2xl border-2 transition-all flex items-center gap-4 ${
                      isSelected
                        ? 'border-brand-green-dark bg-brand-accent-emerald/5 shadow-md shadow-brand-green-dark/10'
                        : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-brand-green-dark/30'
                    }`}
                  >
                    <span
                      className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 transition-all ${
                        isSelected
                          ? 'bg-brand-green-dark text-white shadow-md'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                      }`}
                    >
                      {opt}
                    </span>
                    <span className={`font-bold ${isSelected ? 'text-brand-text-primary dark:text-white' : 'text-slate-500'}`}>
                      {currentQuestion[optionKey]}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {currentQuestion.type === 'TRUE_FALSE' && (
            <div className="grid grid-cols-2 gap-4">
              {['True', 'False'].map((opt) => {
                const mappedVal = opt === 'True' ? 'TRUE' : 'FALSE';
                const isSelected = answers[currentQuestion.id]?.selectedOption === mappedVal;
                return (
                  <button
                    key={opt}
                    onClick={() => handleAnswerSelect(currentQuestion.id, mappedVal)}
                    className={`flex flex-col items-center justify-center py-10 rounded-2xl border-2 transition-all ${
                      isSelected
                        ? 'border-brand-green-dark bg-brand-accent-emerald/10 shadow-lg shadow-brand-green-dark/10 text-brand-green-dark'
                        : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-xl font-black">{opt}</span>
                  </button>
                );
              })}
            </div>
          )}

          {currentQuestion.type === 'ESSAY' && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400">Your Written Answer</label>
              <textarea
                rows={6}
                className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-transparent outline-none focus:ring-4 focus:ring-brand-green-dark/20 focus:border-brand-green-dark transition-all"
                placeholder="Write your answer details here..."
                value={answers[currentQuestion.id]?.essayText || ''}
                onChange={(e) => handleEssayChange(currentQuestion.id, e.target.value)}
              />
              {currentQuestion.maxWords && (
                <p className="text-xs text-slate-400 font-medium">
                  Max {currentQuestion.maxWords} words
                </p>
              )}
            </div>
          )}

          {currentQuestion.type === 'FILE_UPLOAD' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-8 text-center hover:border-brand-green-dark/30 transition-colors">
                {answers[currentQuestion.id]?.fileUrl ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-2 text-brand-green-dark">
                      <Upload size={24} />
                      <span className="font-bold">{answers[currentQuestion.id]?.fileName || 'File uploaded'}</span>
                    </div>
                    <p className="text-xs text-slate-400">File uploaded successfully</p>
                  </div>
                ) : (
                  <label className="cursor-pointer block">
                    <input
                      type="file"
                      className="hidden"
                      accept={currentQuestion.allowedFileTypes ? currentQuestion.allowedFileTypes.split(',').map((t: string) => `.${t.trim()}`).join(',') : undefined}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(currentQuestion.id, file);
                      }}
                    />
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                        <Upload size={24} />
                      </div>
                      <p className="font-bold text-brand-text-primary dark:text-white">Click to upload file</p>
                      <p className="text-xs text-slate-400">
                        {currentQuestion.allowedFileTypes
                          ? `Accepted: ${currentQuestion.allowedFileTypes}`
                          : 'All file types accepted'}
                      </p>
                    </div>
                  </label>
                )}
              </div>
            </div>
          )}
        </Card>

        <div className="mt-8 flex justify-between items-center">
          <Button
            variant="outline"
            onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentQuestionIndex === 0}
            className="gap-2 px-6"
          >
            <ChevronLeft size={20} className="rtl:-scale-x-100" /> Previous
          </Button>

          {isLastQuestion ? (
            <Button
              onClick={() => setShowConfirmSubmit(true)}
              disabled={submitting}
              className="px-8 gap-2 bg-brand-green-dark hover:bg-brand-primary-600 shadow-xl shadow-brand-green-dark/20 font-black"
            >
              Submit Quiz <Send size={18} />
            </Button>
          ) : (
            <Button
              onClick={() => setCurrentQuestionIndex((prev) => Math.min(quiz.questions.length - 1, prev + 1))}
              className="px-8 gap-2"
            >
              Next <ChevronRight size={20} className="rtl:-scale-x-100" />
            </Button>
          )}
        </div>
      </div>

      <ConfirmDeleteModal
        isOpen={showConfirmSubmit}
        onClose={() => setShowConfirmSubmit(false)}
        onConfirm={() => {
          setShowConfirmSubmit(false);
          handleSubmit();
        }}
        title="Submit Quiz"
        message="Are you sure you want to submit? Once submitted, you cannot edit your answers."
        confirmLabel="Yes, submit"
        confirmVariant="primary"
      />

      <ConfirmDeleteModal
        isOpen={blocker.state === 'blocked'}
        onClose={() => blocker.reset()}
        onConfirm={() => blocker.proceed()}
        title="Leave Quiz?"
        message="Are you sure you want to leave the quiz? Your current answers will be preserved but the timer will continue running."
        confirmLabel="Leave"
        cancelLabel="Stay"
        variant="warning"
      />
    </div>
  );
};

export default TakeQuiz;
