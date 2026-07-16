// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useBlocker } from 'react-router-dom';
import {
  Timer,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Send,
  Loader2,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import examsService from '../../services/exams.service';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import ConfirmDeleteModal from '../../components/ui/ConfirmDeleteModal';
import { logger } from '../../lib/logger';
import { useAntiCheat, ExamViolationType } from '../../hooks/useAntiCheat';

const TakeExam = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();

  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('PREPARING'); // PREPARING, IN_PROGRESS, COMPLETED
  const [showEmergencyExitConfirm, setShowEmergencyExitConfirm] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Anti-cheat warning
  const [warningMsg, setWarningMsg] = useState('');

  const { violations } = useAntiCheat((violation) => {
    let msg = t('exams.violationWarning', 'تحذير: تم رصد مخالفة — ');
    switch (violation.type) {
      case 'TAB_SWITCH': msg += t('exams.tabSwitchWarning', 'محاولة تبديل النافذة'); break;
      case 'BLUR': msg += t('exams.blurWarning', 'فقدان التركيز على نافذة الامتحان'); break;
      case 'RIGHT_CLICK': msg += t('exams.rightClickWarning', 'استخدام الزر الأيمن للفأرة'); break;
      case 'COPY_PASTE': msg += t('exams.clipboardWarning', 'محاولة النسخ/اللصق'); break;
      case 'FULLSCREEN_EXIT': msg += t('exams.fullscreenExitWarning', 'الخروج من وضع ملء الشاشة'); break;
      default: msg += violation.details;
    }
    setWarningMsg(msg);
    setTimeout(() => setWarningMsg(''), 5000);
  }, status === 'IN_PROGRESS');

  const [answers, setAnswers] = useState(() => {
    const saved = localStorage.getItem(`exam_answers_${id}`);
    return saved ? JSON.parse(saved) : {};
  });

  const [timeLeft, setTimeLeft] = useState(() => {
    const saved = localStorage.getItem(`exam_timer_${id}`);
    return saved ? parseInt(saved) : 0;
  });

  // Save answers to localStorage
  useEffect(() => {
    if (status === 'IN_PROGRESS') {
      localStorage.setItem(`exam_answers_${id}`, JSON.stringify(answers));
    }
  }, [answers, id, status]);

  // Save timer to localStorage
  useEffect(() => {
    if (status === 'IN_PROGRESS' && timeLeft > 0) {
      localStorage.setItem(`exam_timer_${id}`, timeLeft.toString());
    }
  }, [timeLeft, id, status]);

  // Countdown timer logic
  useEffect(() => {
    if (status !== 'IN_PROGRESS' || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [status, timeLeft]);

  const fetchExam = useCallback(async () => {
    try {
      setLoading(true);
      const result = await examsService.getExamById(id);
      if (result.success) {
        setExam(result.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load exam details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchExam();
  }, [fetchExam]);

  const handleSubmitExam = async () => {
    try {
      setStatus('COMPLETING');
      
      const answersArray = Object.keys(answers).map(qId => ({
        questionId: qId,
        answer: answers[qId]
      }));

      await examsService.submitExam(id, {
        answers: answersArray,
        antiCheatLogs: violations
      });
      
      setStatus('COMPLETED');
      localStorage.removeItem(`exam_answers_${id}`);
      localStorage.removeItem(`exam_timer_${id}`);
      navigate(`/exams/${id}/results`);
    } catch (err) {
      logger.error('Failed to submit exam', err);
      alert('Failed to submit exam. Please try again.');
      setStatus('IN_PROGRESS');
    }
  };

  useEffect(() => {
    if (status !== 'IN_PROGRESS') return;
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [status]);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      status === 'IN_PROGRESS' && currentLocation.pathname !== nextLocation.pathname
  );

  const startExam = async () => {
    try {
      setLoading(true);
      await examsService.startExamSession(id);
      
      const qRes = await examsService.getExamQuestions(id);
      if (qRes.success) {
        setQuestions(qRes.data);
      }

      const duration = exam?.durationMinutes || 120;
      if (!localStorage.getItem(`exam_timer_${id}`)) {
        setTimeLeft(duration * 60);
        localStorage.setItem(`exam_timer_${id}`, (duration * 60).toString());
      }
      
      setStatus('IN_PROGRESS');
      
      try {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } catch (e) {
        console.warn('Could not enter fullscreen', e);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Could not start exam. Maybe you already submitted it?');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (questionId, value) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };

  const prevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-120px)] gap-4">
        <Loader2 className="animate-spin text-brand-primary-600" size={48} />
        <p className="text-sm font-black uppercase tracking-widest text-brand-text-muted">
          {t('common.loading')}
        </p>
      </div>
    );

  if (error) {
    return (
      <div className="max-w-3xl mx-auto py-20 px-6 text-center">
        <AlertTriangle size={48} className="mx-auto text-brand-red mb-4" />
        <h2 className="text-xl font-bold text-brand-red mb-6">{error}</h2>
        <Button onClick={() => navigate('/exams')}>
          {t('common.back')}
        </Button>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 relative">
      {warningMsg && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-10">
          <AlertTriangle size={24} />
          <span className="font-bold">{warningMsg}</span>
        </div>
      )}

      {status === 'PREPARING' && (
        <div className="space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-brand-bg-card p-6 rounded-3xl shadow-sm border border-brand-border">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(`/exams/${id}`)}
                className="p-3 text-brand-text-sub hover:text-brand-green hover:bg-brand-green/10 rounded-2xl transition-all duration-300"
              >
                <ChevronLeft size={24} className="rtl:-scale-x-100" />
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-black text-brand-text-main">{exam?.course?.name}</h1>
                  <div className="font-bold bg-brand-primary-500 text-white px-3 py-1 rounded-full text-sm">
                    {exam?.type}
                  </div>
                </div>
                <p className="text-brand-text-sub font-bold mt-1 uppercase tracking-wider">
                  {exam?.course?.courseCode} — Digital Exam Portal
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-brand-navy-500 text-white rounded-2xl">
              <Timer size={24} className="text-brand-green" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-brand-gray/60">
                  Duration
                </p>
                <p className="text-sm font-black">{exam?.durationMinutes || 120} Minutes</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card title="Secure Exam Guidelines" borderLeft={false}>
                <div className="space-y-6 pt-2">
                  <div className="p-6 rounded-2xl bg-brand-bg-page border border-brand-border space-y-4">
                    <div className="flex gap-4">
                      <div className="p-3 bg-brand-navy-500/5 text-brand-navy-500 rounded-xl h-fit">
                        <Lock size={20} />
                      </div>
                      <div>
                        <h4 className="font-black text-brand-text-main">Anti-Cheat Enabled</h4>
                        <p className="text-sm text-brand-text-sub font-bold mt-1">
                          Switching tabs, exiting fullscreen, right-clicking, and copy/pasting are prohibited and will be logged.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-4 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/30 text-yellow-800 dark:text-yellow-400">
                    <AlertTriangle size={20} className="shrink-0" />
                    <p className="text-xs font-black">
                      By clicking "Start Exam", you agree to the university's academic integrity policy.
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            <div className="lg:col-span-1 space-y-6">
              <Button
                onClick={startExam}
                className="w-full h-16 rounded-2xl shadow-xl shadow-brand-green/20 text-lg font-black flex items-center justify-center gap-3 bg-brand-primary-500 hover:bg-brand-primary-600 text-white"
              >
                Start Digital Exam
              </Button>
            </div>
          </div>
        </div>
      )}

      {status === 'IN_PROGRESS' && currentQuestion && (
        <div className="space-y-8">
          <div className="sticky top-4 z-20 flex justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center gap-4 px-4 w-full">
              <div className="flex flex-col min-w-max">
                <span className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest">
                  {t('exams.progress')}
                </span>
                <span className="text-sm font-black text-brand-text-primary dark:text-brand-text-main">
                  {currentQuestionIndex + 1} / {questions.length}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 overflow-hidden mx-4">
                <div
                  className="h-full bg-brand-primary-500 transition-all duration-500"
                  style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
                />
              </div>
            </div>

            <div
              className={`flex items-center px-6 py-2.5 rounded-2xl font-mono text-lg font-black shadow-inner transition-colors ${timeLeft < 300 ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 dark:bg-slate-900 text-brand-primary-500'}`}
            >
              <Timer size={20} className="mr-3" />
              {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </div>
          </div>

          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <Card className="p-8 border-l-0 rounded-[2.5rem]">
              <div className="flex items-start justify-between mb-8">
                <h3 className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100 leading-relaxed">
                  {currentQuestion.text}
                </h3>
                <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 px-3 py-1 rounded-lg text-sm font-bold min-w-max">
                  {currentQuestion.points} Points
                </span>
              </div>

              {currentQuestion.type === 'MCQ' && (
                <div className="grid grid-cols-1 gap-4">
                  {['A', 'B', 'C', 'D'].map((letter) => {
                    const optionText = currentQuestion[`option${letter}`];
                    if (!optionText) return null;
                    const isSelected = answers[currentQuestion.id] === letter;
                    return (
                      <button
                        key={letter}
                        onClick={() => handleAnswerSelect(currentQuestion.id, letter)}
                        className={`flex items-center gap-5 p-6 rounded-3xl border-2 text-start transition-all duration-300 group ${
                          isSelected
                            ? 'border-brand-primary-500 bg-brand-primary-500/5 shadow-lg shadow-brand-primary-500/10'
                            : 'border-slate-200 dark:border-slate-700 bg-transparent hover:border-brand-primary-500/30'
                        }`}
                      >
                        <div
                          className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center font-black transition-all ${
                            isSelected
                              ? 'bg-brand-primary-500 text-white shadow-lg'
                              : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 group-hover:text-brand-primary-500'
                          }`}
                        >
                          {letter}
                        </div>
                        <span
                          className={`text-lg font-bold ${
                            isSelected
                              ? 'text-slate-800 dark:text-slate-100'
                              : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {optionText}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {currentQuestion.type === 'TRUE_FALSE' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { value: 'true', label: t('exams.true', 'True') },
                    { value: 'false', label: t('exams.false', 'False') }
                  ].map((opt) => {
                    const isSelected = answers[currentQuestion.id] === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => handleAnswerSelect(currentQuestion.id, opt.value)}
                        className={`flex items-center gap-5 p-6 rounded-3xl border-2 text-start transition-all duration-300 group ${
                          isSelected
                            ? 'border-brand-primary-500 bg-brand-primary-500/5 shadow-lg shadow-brand-primary-500/10'
                            : 'border-slate-200 dark:border-slate-700 bg-transparent hover:border-brand-primary-500/30'
                        }`}
                      >
                        <span className={`text-lg font-bold mx-auto ${isSelected ? 'text-brand-primary-500' : 'text-slate-600 dark:text-slate-400'}`}>
                          {opt.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {currentQuestion.type === 'SHORT_ANSWER' && (
                <div>
                  <textarea
                    rows={6}
                    value={answers[currentQuestion.id] || ''}
                    onChange={(e) => handleAnswerSelect(currentQuestion.id, e.target.value)}
                    placeholder={t('exams.shortAnswerPlaceholder', 'Write your answer here...')}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-slate-800 focus:ring-2 focus:ring-brand-primary-500 outline-none"
                  />
                </div>
              )}

            </Card>

            <div className="flex items-center justify-between pt-4">
              <Button
                variant="outline"
                onClick={prevQuestion}
                disabled={currentQuestionIndex === 0}
                className="rounded-2xl px-6 h-12 gap-2"
              >
                <ChevronLeft size={20} className="rtl:-scale-x-100" /> {t('common.previous')}
              </Button>

              {currentQuestionIndex === questions.length - 1 ? (
                <Button
                  onClick={() => setShowEmergencyExitConfirm(true)}
                  className="rounded-2xl px-8 h-12 shadow-xl shadow-brand-primary-600/20 gap-2 bg-brand-primary-500 hover:bg-brand-primary-600 font-black text-white"
                >
                  <Send size={20} className="rtl:-scale-x-100" /> {t('exams.finishAndSubmit')}
                </Button>
              ) : (
                <Button onClick={nextQuestion} className="rounded-2xl px-8 h-12 gap-2 bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 border-none">
                  {t('common.next')} <ChevronRight size={20} className="rtl:-scale-x-100" />
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={showEmergencyExitConfirm}
        title={t('exams.submitConfirmTitle')}
        message={t('exams.submitConfirmDesc')}
        confirmLabel={t('exams.submitConfirmAction')}
        confirmVariant="primary"
        onClose={() => setShowEmergencyExitConfirm(false)}
        onConfirm={() => {
          setShowEmergencyExitConfirm(false);
          handleSubmitExam();
        }}
      />
    </div>
  );
};

export default TakeExam;
