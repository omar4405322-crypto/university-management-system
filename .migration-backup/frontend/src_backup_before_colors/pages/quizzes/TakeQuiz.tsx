// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useBlocker } from 'react-router-dom';
import quizService from '../../services/quiz.service';
import { Clock, CheckCircle, AlertCircle, ChevronRight, ChevronLeft, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ConfirmDeleteModal from '../../components/ui/ConfirmDeleteModal';

const TakeQuiz = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState(() => {
    const saved = localStorage.getItem(`quiz_answers_${id}`);
    return saved ? JSON.parse(saved) : {};
  });
  const [timeLeft, setTimeLeft] = useState(() => {
    const saved = localStorage.getItem(`quiz_timer_${id}`);
    return saved ? parseInt(saved) : 0;
  });
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);

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

  // 1. Add a beforeunload event listener
  useEffect(() => {
    if (submitted) return;
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [submitted]);

  // 2. Add a React Router navigation blocker
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !submitted && currentLocation.pathname !== nextLocation.pathname
  );

  const fetchQuiz = useCallback(async () => {
    try {
      setLoading(true);
            const res = await quizService.getQuizById(id);
      if (res.success) {
        setQuiz(res.data);
        if (!localStorage.getItem(`quiz_timer_${id}`)) {
          const duration = res.data.duration || 30; // default 30 mins
          setTimeLeft(duration * 60);
          localStorage.setItem(`quiz_timer_${id}`, (duration * 60).toString());
        }
        if (res.data.hasSubmitted) {
          setSubmitted(true);
          // If already submitted, we might want to fetch results or just show message
        }
      }
    } catch (_error) {
      alert('Error loading quiz');
      navigate('/quizzes');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchQuiz();
  }, [fetchQuiz]);

  const handleSubmit = useCallback(async () => {
    if (submitting || submitted) return;
    setSubmitting(true);
    try {
      const formattedAnswers = Object.entries(answers).map(([questionId, answer]) => ({
        questionId: parseInt(questionId),
        answer,
      }));
            const res = await quizService.submitQuiz(id, formattedAnswers);
      if (res.success) {
        setResult(res.data);
        setSubmitted(true);
        localStorage.removeItem(`quiz_answers_${id}`);
        localStorage.removeItem(`quiz_timer_${id}`);
      }
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error submitting quiz');
    } finally {
      setSubmitting(false);
    }
  }, [id, answers, submitting, submitted]);

  useEffect(() => {
    if (timeLeft <= 0 || submitted) return;
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
  }, [timeLeft, submitted, handleSubmit]);

  const handleAnswerSelect = (questionId, option) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isTimeCritical = timeLeft > 0 && timeLeft <= 300; // 5 minutes

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary-500"></div>
      </div>
    );

  if (submitted && result) {
    return (
      <div className="max-w-2xl mx-auto mt-12 p-8 bg-brand-bg-card rounded-2xl shadow-lg text-center">
        <div className="bg-success/10 text-success w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={48} />
        </div>
        <h1 className="text-3xl font-bold text-brand-text-primary mb-2">Quiz Submitted!</h1>
        <p className="text-brand-text-secondary mb-8">
          Your results are being processed or are shown below.
        </p>

        <div className="bg-brand-bg-page rounded-xl p-6 mb-8 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-brand-text-muted uppercase font-bold">Your Score</p>
            <p className="text-3xl font-bold text-info">
              {result.score} / {result.totalPoints}
            </p>
          </div>
          <div>
            <p className="text-xs text-brand-text-muted uppercase font-bold">{t('quiz.percentage')}</p>
            <p className="text-3xl font-bold text-info">
              {Math.round((result.score / result.totalPoints) * 100)}%
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('/quizzes')}
          className="px-8 py-3 bg-brand-primary-500 text-white rounded-xl font-bold hover:bg-brand-primary-600 transition-colors"
        >
          Back to Quizzes
        </button>
      </div>
    );
  }

  const currentQuestion = quiz.questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === quiz.questions.length - 1;

  return (
    <div className="min-h-screen bg-brand-bg-page pb-12">
      <div className="bg-brand-bg-card border-b border-brand-border sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <h1 className="font-bold text-brand-text-primary truncate max-w-[200px] md:max-w-none">
            {quiz.title}
          </h1>
          <div
            className={`flex items-center px-4 py-2 rounded-lg font-mono font-bold transition-colors ${isTimeCritical ? 'bg-error text-white animate-pulse' : 'bg-info/10 text-info'}`}
          >
            <Clock size={18} className="mr-2" />
            {formatTime(timeLeft)}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto mt-4 px-6">
        {isTimeCritical && (
          <div className="mb-4 p-4 rounded-xl bg-error/10 border border-error/20 flex items-center gap-3 animate-in slide-in-from-top-2 duration-300">
            <AlertCircle size={20} className="text-error" />
            <p className="text-sm font-black text-error uppercase tracking-widest">
              {i18n.language === 'ar' ? 'تبقى 5 دقائق فقط!' : 'Only 5 minutes left!'}
            </p>
          </div>
        )}

        <div className="mb-6 flex justify-between items-center text-sm text-brand-text-secondary">
          <span>
            Question {currentQuestionIndex + 1} of {quiz.questions.length}
          </span>
          <div className="flex space-x-1">
            {quiz.questions.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full ${
                  i === currentQuestionIndex
                    ? 'bg-brand-primary-500'
                    : answers[quiz.questions[i].id]
                      ? 'bg-success'
                      : 'bg-brand-border'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="bg-brand-bg-card rounded-2xl shadow-sm border border-brand-border p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-xl font-bold text-brand-text-primary mb-8">{currentQuestion.text}</h2>

          <div className="space-y-4">
            {['A', 'B', 'C', 'D'].map((opt) => {
              const optionKey = `option${opt}`;
              const isSelected = answers[currentQuestion.id] === opt;
              return (
                <button
                  key={opt}
                  onClick={() => handleAnswerSelect(currentQuestion.id, opt)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center ${
                    isSelected
                      ? 'border-info bg-info/10 text-info shadow-sm'
                      : 'border-brand-border hover:border-brand-border text-brand-text-secondary'
                  }`}
                >
                  <span
                    className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold mr-4 ${
                      isSelected
                        ? 'bg-brand-primary-500 text-white'
                        : 'bg-brand-bg-page text-brand-text-muted'
                    }`}
                  >
                    {opt}
                  </span>
                  <span className="font-medium">{currentQuestion[optionKey]}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-8 flex justify-between items-center">
          <button
            onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentQuestionIndex === 0}
            className="flex items-center px-6 py-2 rounded-xl font-bold text-brand-text-secondary hover:bg-brand-border disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={20} className="rtl:-scale-x-100 mr-1" /> Previous
          </button>

          {isLastQuestion ? (
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to submit your quiz?')) {
                  handleSubmit();
                }
              }}
              disabled={submitting}
              className="flex items-center px-8 py-3 bg-success text-white rounded-xl font-bold hover:brightness-90 shadow-lg shadow-success/20 disabled:opacity-50 transition-all"
            >
              {submitting ? (
                'Submitting...'
              ) : (
                <span className="flex items-center">
                  Submit Quiz <Send size={18} className="rtl:-scale-x-100 ml-2" />
                </span>
              )}
            </button>
          ) : (
            <button
              onClick={() =>
                setCurrentQuestionIndex((prev) => Math.min(quiz.questions.length - 1, prev + 1))
              }
              className="flex items-center px-8 py-3 bg-brand-primary-500 text-white rounded-xl font-bold hover:bg-brand-primary-600 shadow-lg shadow-brand-primary-500/20 transition-all"
            >
              Next <ChevronRight size={20} className="rtl:-scale-x-100 ml-1" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation Protection Modal */}
      <ConfirmDeleteModal
        isOpen={blocker.state === 'blocked'}
                onClose={() => blocker.reset()}
                onConfirm={() => blocker.proceed()}
        title={t('quiz.leaveWarningTitle')}
        message={t('quiz.leaveWarningMessage')}
        confirmLabel={t('quiz.leaveButton')}
        cancelLabel={t('quiz.stayButton')}
        variant="warning"
      />
    </div>
  );
};

export default TakeQuiz;
