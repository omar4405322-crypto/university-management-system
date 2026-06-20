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
    _AlertCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import examsService from '../../services/exams.service';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import ConfirmDeleteModal from '../../components/ui/ConfirmDeleteModal';
import { logger } from '../../lib/logger';

const TakeExam = () => {
  const { id } = useParams();
  const navigate = useNavigate();
    const { t, _i18n } = useTranslation();
    const { _user } = useAuth();

  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState('');
  const [status, setStatus] = useState('PREPARING'); // PREPARING, READY, IN_PROGRESS, COMPLETED
  const [showEmergencyExitConfirm, setShowEmergencyExitConfirm] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

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

  // Alert at 5 minutes
  useEffect(() => {
    if (status === 'IN_PROGRESS' && timeLeft === 300) {
      // show toast warning (simulated)
      logger.warn('تبقى 5 دقائق فقط!');
    }
  }, [timeLeft, status]);

  const fetchExam = useCallback(async () => {
    try {
      setLoading(true);
            const result = await examsService.getExamById(id);
      if (result.success) {
        setExam(result.data);
        // If no timer exists, initialize from exam duration
        if (!localStorage.getItem(`exam_timer_${id}`)) {
          const duration = result.data.durationMinutes || result.data.duration || 120;
          setTimeLeft(duration * 60);
        }
      }
    } catch (_err: any) {
      setError('Failed to load exam details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchExam();
  }, [fetchExam]);

  const handleSubmitExam = async () => {
    // simulation of submission
    setStatus('COMPLETED');
    localStorage.removeItem(`exam_answers_${id}`);
    localStorage.removeItem(`exam_timer_${id}`);
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

  // 2. Add a React Router navigation blocker
  const _blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      status === 'IN_PROGRESS' && currentLocation.pathname !== nextLocation.pathname
  );

  const startExam = () => {
    const duration = exam?.durationMinutes || exam?.duration || 120;
    if (!localStorage.getItem(`exam_timer_${id}`)) {
      setTimeLeft(duration * 60);
      localStorage.setItem(`exam_timer_${id}`, (duration * 60).toString());
    }
    setStatus('IN_PROGRESS');
  };

  const handleAnswerSelect = (questionId, optionIndex) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionIndex,
    }));
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < (exam?.questions?.length || 1) - 1) {
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
        <Loader2 className="animate-spin text-brand-primary-500" size={48} />
        <p className="text-sm font-black uppercase tracking-widest text-brand-text-muted">
          {t('common.loading')}
        </p>
      </div>
    );

  if (status === 'COMPLETED')
    return (
      <div className="max-w-3xl mx-auto py-20 px-6 text-center animate-in zoom-in duration-500">
        <div className="w-20 h-20 rounded-3xl bg-brand-primary-50 dark:bg-brand-primary-900/20 flex items-center justify-center mx-auto mb-8 shadow-xl">
          <CheckCircle2 size={40} className="text-brand-primary-500" />
        </div>
        <h2 className="text-3xl font-black text-brand-text-primary dark:text-brand-text-main mb-3">
          {t('exams.submittedTitle')}
        </h2>
        <p className="text-brand-text-secondary font-bold mb-10 max-w-md mx-auto leading-relaxed">
          {t('exams.submittedDesc')}
        </p>
        <Button
          onClick={() => navigate('/exams')}
          className="rounded-2xl px-8 h-12 shadow-xl shadow-brand-primary-500/20"
        >
          {t('exams.backToExams')}
        </Button>
      </div>
    );

  const currentQuestion = exam?.questions?.[currentQuestionIndex];

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      {status === 'PREPARING' && (
        <div className="space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(`/exams/${id}`)}
                className="p-3 text-brand-text-sub hover:text-brand-green hover:bg-brand-green/10 rounded-2xl transition-all duration-300"
              >
                <ChevronLeft size={24} className="rtl:-scale-x-100" />
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-black text-brand-text-main">{exam.course?.name}</h1>
                  <div variant={exam.type === 'FINAL' ? 'danger' : 'info'} className="font-bold">
                    {exam.type}
                  </div>
                </div>
                <p className="text-brand-text-sub font-bold mt-1 uppercase tracking-wider">
                  {exam.course?.courseCode} — Digital Exam Portal
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-brand-navy text-white rounded-2xl">
              <Timer size={24} className="text-brand-green" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-brand-gray/60">
                  Duration
                </p>
                <p className="text-sm font-black">120 Minutes</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card title="Secure Exam Guidelines" borderLeft={false}>
                <div className="space-y-6 pt-2">
                  <div className="p-6 rounded-2xl bg-brand-bg-page border border-brand-border space-y-4">
                    <div className="flex gap-4">
                      <div className="p-3 bg-brand-navy/5 text-brand-navy rounded-xl h-fit">
                        <span size={20} />
                      </div>
                      <div>
                        <h4 className="font-black text-brand-text-main">Fullscreen Mode</h4>
                        <p className="text-sm text-brand-text-sub font-bold mt-1">
                          The exam will open in fullscreen. Exiting fullscreen or switching tabs
                          will be flagged as a violation.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="p-3 bg-brand-navy/5 text-brand-navy rounded-xl h-fit">
                        <span size={20} />
                      </div>
                      <div>
                        <h4 className="font-black text-brand-text-main">AI Proctoring</h4>
                        <p className="text-sm text-brand-text-sub font-bold mt-1">
                          Your camera and microphone will be monitored during the entire session to
                          ensure academic integrity.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="p-3 bg-brand-navy/5 text-brand-navy rounded-xl h-fit">
                        <Lock size={20} />
                      </div>
                      <div>
                        <h4 className="font-black text-brand-text-main">Restricted Access</h4>
                        <p className="text-sm text-brand-text-sub font-bold mt-1">
                          Calculators and external notes are only permitted if explicitly mentioned
                          by the instructor.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-4 rounded-xl bg-brand-yellow/10 border border-brand-yellow/20 text-brand-yellow-dark">
                    <AlertTriangle size={20} className="shrink-0" />
                    <p className="text-xs font-black">
                      By clicking "Start Exam", you agree to the university's academic integrity
                      policy and the use of digital proctoring.
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            <div className="lg:col-span-1 space-y-6">
              <Card title="Pre-Exam Checklist" borderLeft={false}>
                <div className="space-y-4 pt-2">
                  {[
                    'Internet connection stable',
                    'Webcam & Mic working',
                    'Quiet environment',
                    'University ID ready',
                    'No prohibited devices',
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-brand-navy/5 transition-colors group"
                    >
                      <div className="h-5 w-5 rounded-full border-2 border-brand-green flex items-center justify-center group-hover:bg-brand-green transition-all">
                        <CheckCircle2
                          size={12}
                          className="text-transparent group-hover:text-white"
                        />
                      </div>
                      <span className="text-sm font-bold text-brand-text-main">{item}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Button
                onClick={startExam}
                className="w-full h-16 rounded-2xl shadow-xl shadow-brand-green/20 text-lg font-black flex items-center justify-center gap-3"
              >
                <span size={20} fill="currentColor" /> Start Digital Exam
              </Button>

              <div className="text-center">
                <p className="text-caption flex items-center justify-center gap-2">
                  <span size={14} className="text-brand-green" /> Secure Session ID:{' '}
                                    {id.substring(0, 8).toUpperCase()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {status === 'IN_PROGRESS' && (
        <div className="space-y-8">
          <div className="sticky top-4 z-20 flex justify-between items-center bg-brand-bg-card/80 backdrop-blur-xl p-4 rounded-[2rem] border border-brand-border shadow-soft">
            <div className="flex items-center gap-4 px-4">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest">
                  {t('exams.progress')}
                </span>
                <span className="text-sm font-black text-brand-text-primary dark:text-brand-text-main">
                  {currentQuestionIndex + 1} / {exam?.questions?.length}
                </span>
              </div>
              <div className="w-32 h-2 rounded-full bg-brand-bg-page border border-brand-border overflow-hidden">
                <div
                  className="h-full bg-brand-primary-500 transition-all duration-500"
                  style={{
                    width: `${((currentQuestionIndex + 1) / (exam?.questions?.length || 1)) * 100}%`,
                  }}
                />
              </div>
            </div>

            <div
              className={`flex items-center px-6 py-2.5 rounded-2xl font-mono text-lg font-black shadow-inner transition-colors ${false ? 'bg-error text-white animate-pulse' : 'bg-brand-navy text-brand-green'}`}
            >
              <Timer size={20} className="mr-3" />
              {String(timeLeft)}
            </div>
          </div>

          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <Card className="p-8 border-l-0 rounded-[2.5rem]">
              <h3 className="text-xl md:text-2xl font-black text-brand-text-primary dark:text-brand-text-main mb-10 leading-relaxed">
                {currentQuestion?.text}
              </h3>

              <div className="grid grid-cols-1 gap-4">
                {currentQuestion?.options?.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleAnswerSelect(currentQuestion.id, idx)}
                    className={`flex items-center gap-5 p-6 rounded-3xl border-2 text-start transition-all duration-300 group ${
                      answers[currentQuestion.id] === idx
                        ? 'border-brand-primary-500 bg-brand-primary-500/5 shadow-lg shadow-brand-primary-500/10'
                        : 'border-brand-border bg-brand-bg-page/50 hover:border-brand-primary-500/30 hover:bg-brand-bg-page'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center font-black transition-all ${
                        answers[currentQuestion.id] === idx
                          ? 'bg-brand-primary-500 text-white shadow-lg'
                          : 'bg-brand-bg-page border border-brand-border text-brand-text-muted group-hover:text-brand-primary-500'
                      }`}
                    >
                      {String.fromCharCode(65 + idx)}
                    </div>
                    <span
                      className={`text-lg font-bold ${
                        answers[currentQuestion.id] === idx
                          ? 'text-brand-text-primary dark:text-brand-text-main'
                          : 'text-brand-text-secondary'
                      }`}
                    >
                      {option}
                    </span>
                  </button>
                ))}
              </div>
            </Card>

            <div className="flex items-center justify-between pt-4">
              <Button
                variant="ghost"
                onClick={prevQuestion}
                disabled={currentQuestionIndex === 0}
                className="rounded-2xl px-6 h-12 gap-2"
              >
                <ChevronLeft size={20} className="rtl:-scale-x-100" /> {t('common.previous')}
              </Button>

              {currentQuestionIndex === (exam?.questions?.length || 1) - 1 ? (
                <Button
                  onClick={() => setShowEmergencyExitConfirm(true)}
                  className="rounded-2xl px-8 h-12 shadow-xl shadow-brand-primary-500/20 gap-2 bg-brand-primary-500 hover:bg-brand-primary-600 font-black"
                >
                  <Send size={20} className="rtl:-scale-x-100" /> {t('exams.finishAndSubmit')}
                </Button>
              ) : (
                <Button onClick={nextQuestion} className="rounded-2xl px-8 h-12 gap-2">
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
