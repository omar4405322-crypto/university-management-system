// @ts-nocheck
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Shield,
  ArrowLeft,
  Monitor,
  MapPin,
  Wifi,
  Eye,
  ShieldAlert,
  XCircle,
  Ban,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import examsService from '../../services/exams.service';
import Button from '../../components/ui/button';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import { logger } from '../../lib/logger';
import { useAntiCheat } from '../../hooks/useAntiCheat';
import {
  getDurationMinutes,
  isExamStarted,
  isExamEnded,
  getAntiCheatSettings,
  shuffleQuestionsForStudent,
  formatDeviceInfo,
  getDefaultLeaveWarningMessage,
  calculateDistanceMeters,
} from './examUtils';

const TakeExam = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();

  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('PREPARING'); // PREPARING, IN_PROGRESS, COMPLETING, COMPLETED, CANCELLED
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showBlockerModal, setShowBlockerModal] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Anti-cheat warning
  const [warningMsg, setWarningMsg] = useState('');

  // Get anti-cheat settings from exam
  const antiCheatSettings = useMemo(() => getAntiCheatSettings(exam), [exam]);

  // The actual warning message to display (professor's custom or default)
  const leaveWarningMessage = useMemo(() => {
    if (antiCheatSettings.leaveWarningMessage) return antiCheatSettings.leaveWarningMessage;
    return t('exams.defaultLeaveWarning', { seconds: antiCheatSettings.leaveGraceSeconds });
  }, [antiCheatSettings, t]);

  const [answers, setAnswers] = useState(() => {
    const saved = localStorage.getItem(`exam_answers_${id}`);
    return saved ? JSON.parse(saved) : {};
  });

  const [timeLeft, setTimeLeft] = useState(() => {
    const saved = localStorage.getItem(`exam_timer_${id}`);
    return saved ? parseInt(saved) : 0;
  });

  // ── Anti-Cheat Hook ──────────────────────────────────────────────────────────
  const handleExamCancelled = useCallback(async () => {
    setStatus('CANCELLED');
    try {
      const answersArray = Object.keys(answers).map(qId => ({
        questionId: qId,
        answer: answers[qId]
      }));
      await examsService.cancelExam(id, {
        reason: `Student left exam and did not return within ${antiCheatSettings.leaveGraceSeconds} seconds.`,
        antiCheatLogs: violations,
        answers: answersArray,
        deviceInfo: deviceInfo,
      });
    } catch (err) {
      logger.error('Failed to cancel exam', err);
    }
    localStorage.removeItem(`exam_answers_${id}`);
    localStorage.removeItem(`exam_timer_${id}`);
    localStorage.removeItem(`exam_violations_${id}`);
    localStorage.removeItem(`exam_device_${id}`);
    localStorage.removeItem(`exam_leaves_${id}`);
  }, [id, answers, violations, deviceInfo, antiCheatSettings.leaveGraceSeconds]);

  const {
    violations,
    violationCount,
    deviceInfo,
    leaveCount,
    isCountdownActive,
    countdownSeconds,
    examCancelled,
    multiTabBlocked,
    refreshDeviceInfo,
  } = useAntiCheat(
    (violation) => {
      if (status !== 'IN_PROGRESS') return;
      let msg = t('exams.violationWarning') + ' ';
      switch (violation.type) {
        case 'TAB_SWITCH': msg += t('exams.tabSwitchWarning'); break;
        case 'BLUR': msg += t('exams.blurWarning'); break;
        case 'RIGHT_CLICK': msg += t('exams.rightClickWarning'); break;
        case 'COPY_PASTE': msg += t('exams.clipboardWarning'); break;
        case 'FULLSCREEN_EXIT': msg += t('exams.fullscreenExitWarning'); break;
        case 'SCREENSHOT': msg += t('exams.violation_SCREENSHOT'); break;
        case 'DEVTOOLS': msg += t('exams.violation_DEVTOOLS'); break;
        case 'WINDOW_RESIZE': msg += t('exams.violation_WINDOW_RESIZE'); break;
        case 'MULTI_TAB': msg += t('exams.violation_MULTI_TAB'); break;
        default: msg += violation.details;
      }
      setWarningMsg(msg);
      setTimeout(() => setWarningMsg(''), 5000);
    },
    status === 'IN_PROGRESS' && antiCheatSettings.antiCheatEnabled,
    {
      examId: id,
      settings: antiCheatSettings,
      onExamCancelled: handleExamCancelled,
    }
  );

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
      setError(err.response?.data?.message || t('exams.loadError'));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

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

      const finalDeviceInfo = deviceInfo || collectDeviceInfo();

      await examsService.submitExam(id, {
        answers: answersArray,
        antiCheatLogs: violations,
        violations: violations,
        deviceInfo: finalDeviceInfo,
        leaveCount: leaveCount,
        ipAddress: finalDeviceInfo?.ipAddress,
        latitude: finalDeviceInfo?.latitude,
        longitude: finalDeviceInfo?.longitude,
      });
      
      setStatus('COMPLETED');
      localStorage.removeItem(`exam_answers_${id}`);
      localStorage.removeItem(`exam_timer_${id}`);
      localStorage.removeItem(`exam_violations_${id}`);
      localStorage.removeItem(`exam_device_${id}`);
      localStorage.removeItem(`exam_leaves_${id}`);
      navigate(`/exams/${id}/results`);
    } catch (err) {
      logger.error('Failed to submit exam', err);
      alert(t('exams.submitError'));
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

  // Show blocker modal when route navigation is blocked
  useEffect(() => {
    if (blocker.state === 'blocked') {
      setShowBlockerModal(true);
    }
  }, [blocker.state]);

  const startExam = async () => {
    if (!isExamStarted(exam)) {
      setError(t('exams.examNotStartedDesc', { time: exam?.startTime || '', date: new Date(exam?.date).toLocaleDateString() }));
      return;
    }
    if (isExamEnded(exam)) {
      setError(t('exams.examExpiredDesc', { time: exam?.endTime || '' }));
      return;
    }

    // Geofencing Check (Campus / Building Location Restriction)
    if (antiCheatSettings.enableGeofencing) {
      if (deviceInfo?.locationDenied || deviceInfo?.latitude == null || deviceInfo?.longitude == null) {
        setError(t('exams.geofenceLocationDeniedErr') || 'Location permission is required to verify you are inside the designated exam building.');
        return;
      }
      if (antiCheatSettings.allowedLat != null && antiCheatSettings.allowedLng != null) {
        const distance = calculateDistanceMeters(
          deviceInfo.latitude,
          deviceInfo.longitude,
          antiCheatSettings.allowedLat,
          antiCheatSettings.allowedLng
        );
        const radius = antiCheatSettings.allowedRadiusMeters || 200;
        if (distance > radius) {
          setError(
            t('exams.outsideGeofenceErr', { distance, radius }) ||
            `Access Denied: You are outside the designated exam hall/building area. (Distance: ${distance}m, Max allowed: ${radius}m)`
          );
          return;
        }
      }
    }

    try {
      setLoading(true);

      // Send device info with start session
      await examsService.startExamSession(id, {
        deviceInfo: deviceInfo,
      });

      // Also report device info separately (for persistence)
      if (deviceInfo) {
        examsService.reportDeviceInfo(id, deviceInfo).catch(() => {});
      }
      
      const qRes = await examsService.getExamQuestions(id);
      if (qRes.success) {
        let fetchedQuestions = qRes.data;
        // Shuffle questions if enabled
        if (antiCheatSettings.shuffleQuestions && user?.id) {
          fetchedQuestions = shuffleQuestionsForStudent(fetchedQuestions, user.id);
        }
        setQuestions(fetchedQuestions);
      }

      const duration = getDurationMinutes(exam?.startTime, exam?.endTime, exam?.durationMinutes);
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
      setError(err.response?.data?.message || t('exams.startError'));
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

  // Answered count
  const answeredCount = useMemo(() => {
    return Object.keys(answers).filter((k) => answers[k] != null && answers[k] !== '').length;
  }, [answers]);

  // Compute duration
  const examDuration = useMemo(() => {
    if (!exam) return 120;
    return getDurationMinutes(exam.startTime, exam.endTime, exam.durationMinutes);
  }, [exam]);

  // Device info formatted for display
  const deviceInfoItems = useMemo(() => formatDeviceInfo(deviceInfo, t), [deviceInfo, t]);

  // Per-student watermark text (displayed during IN_PROGRESS)
  const watermarkText = useMemo(() => {
    if (!user) return '';
    const studentName =
      user.name ||
      (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : '') ||
      user.firstName ||
      '';
    const studentIdentifier = user.studentId || user.academicNumber || (user.id ? `ID: ${user.id}` : '');
    const userEmail = user.email || '';
    const parts = [studentName, studentIdentifier, userEmail].filter(Boolean);
    return parts.join(' • ');
  }, [user]);

  // ── MULTI-TAB BLOCKED SCREEN ───────────────────────────────────────────────
  if (multiTabBlocked) {
    return (
      <div className="max-w-xl mx-auto py-20 px-6 text-center">
        <div className="p-8 bg-white dark:bg-slate-800 rounded-3xl border-2 border-rose-300 dark:border-rose-700 shadow-2xl">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-rose-500/10 flex items-center justify-center">
            <Ban size={40} className="text-rose-500" />
          </div>
          <h2 className="text-2xl font-black text-rose-600 dark:text-rose-400 mb-4">
            {t('exams.multiTabBlockedTitle')}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 font-semibold mb-8 leading-relaxed">
            {t('exams.multiTabBlockedDesc')}
          </p>
          <Button onClick={() => navigate('/exams')} className="!bg-rose-500 hover:!bg-rose-600 text-white border-none">
            {t('exams.backToExams')}
          </Button>
        </div>
      </div>
    );
  }

  // ── EXAM CANCELLED SCREEN ──────────────────────────────────────────────────
  if (status === 'CANCELLED' || examCancelled) {
    return (
      <div className="max-w-xl mx-auto py-20 px-6 text-center">
        <div className="p-8 bg-white dark:bg-slate-800 rounded-3xl border-2 border-rose-300 dark:border-rose-700 shadow-2xl">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-rose-500/10 flex items-center justify-center animate-pulse">
            <XCircle size={40} className="text-rose-500" />
          </div>
          <h2 className="text-2xl font-black text-rose-600 dark:text-rose-400 mb-4">
            {t('exams.examCancelledTitle')}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 font-semibold mb-4 leading-relaxed">
            {t('exams.examCancelledDesc')}
          </p>
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-700/40 text-xs font-bold text-rose-600 dark:text-rose-400 mb-8">
            {t('exams.examCancelledReason', { seconds: antiCheatSettings.leaveGraceSeconds })}
          </div>
          <Button onClick={() => navigate('/exams')} className="!bg-slate-800 hover:!bg-slate-900 text-white border-none">
            {t('exams.backToExams')}
          </Button>
        </div>
      </div>
    );
  }

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-120px)] gap-4">
        <Loader2 className="animate-spin text-brand-primary-500" size={48} />
        <p className="text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
          {t('common.loading')}
        </p>
      </div>
    );

  if (error) {
    return (
      <div className="max-w-3xl mx-auto py-20 px-6 text-center">
        <AlertTriangle size={48} className="mx-auto text-rose-500 mb-4" />
        <h2 className="text-xl font-bold text-rose-600 dark:text-rose-400 mb-6">{error}</h2>
        <Button onClick={() => navigate('/exams')}>
          {t('common.back')}
        </Button>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 relative">
      {/* ── Per-Student Anti-Screenshot Watermark Overlay ─────────────────── */}
      {status === 'IN_PROGRESS' && watermarkText && (
        <div
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none select-none z-[15] overflow-hidden flex flex-wrap content-between justify-between p-8 opacity-[0.06] dark:opacity-[0.08]"
        >
          {Array.from({ length: 16 }).map((_, i) => (
            <div
              key={i}
              className="transform -rotate-12 text-xs md:text-sm font-black tracking-widest text-slate-900 dark:text-white whitespace-nowrap m-6 select-none"
            >
              {watermarkText} • {exam?.course?.courseCode || ''} • {new Date().toLocaleDateString()}
            </div>
          ))}
        </div>
      )}

      {/* ── LEAVE COUNTDOWN OVERLAY ─────────────────────────────────────────── */}
      {isCountdownActive && status === 'IN_PROGRESS' && (
        <div className="fixed inset-0 z-[9999] bg-rose-900/95 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="max-w-lg w-full bg-white dark:bg-slate-800 rounded-3xl p-10 shadow-2xl border-4 border-rose-500 text-center space-y-6">
            <div className="w-24 h-24 mx-auto rounded-full bg-rose-500 flex items-center justify-center animate-pulse">
              <ShieldAlert size={48} className="text-white" />
            </div>
            <h2 className="text-3xl font-black text-rose-600 dark:text-rose-400">
              {t('exams.leaveCountdownTitle')}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 font-semibold leading-relaxed">
              {leaveWarningMessage}
            </p>
            <div className="text-7xl font-black text-rose-600 dark:text-rose-400 tabular-nums animate-pulse">
              {countdownSeconds}
            </div>
            <p className="text-xs font-bold text-rose-500 uppercase tracking-widest">
              {t('exams.leaveCountdownTimer', { seconds: countdownSeconds })}
            </p>
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 text-xs font-bold text-amber-700 dark:text-amber-400">
              {t('exams.leaveCountMessage', { count: leaveCount, max: antiCheatSettings.maxLeavesBeforeCancel })}
            </div>
          </div>
        </div>
      )}

      {/* Anti-cheat Warning Toast */}
      {warningMsg && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-10">
          <AlertTriangle size={24} />
          <span className="font-bold">{warningMsg}</span>
        </div>
      )}

      {/* ── PREPARING Screen ─────────────────────────────────────────────── */}
      {status === 'PREPARING' && (
        <div className="space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(`/exams/${id}`)}
                className="p-3 text-slate-400 hover:text-brand-primary-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-2xl transition-all duration-300"
              >
                <ArrowLeft size={24} className="rtl:-scale-x-100" />
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-black text-brand-text-primary dark:text-white">{exam?.course?.name}</h1>
                  <div className="font-bold bg-brand-primary-500 text-white px-3 py-1 rounded-full text-sm">
                    {exam?.type === 'FINAL' ? t('exams.typeFinal') : exam?.type === 'MIDTERM' ? t('exams.typeMidterm') : t('exams.typeQuiz')}
                  </div>
                </div>
                <p className="text-slate-500 dark:text-slate-400 font-bold mt-1 uppercase tracking-wider text-sm">
                  {exam?.course?.courseCode} — {t('exams.digitalExamPortal')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-slate-900 dark:bg-slate-700 text-white rounded-2xl">
              <Timer size={24} className="text-brand-primary-400" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {t('exams.durationLabel')}
                </p>
                <p className="text-sm font-black">{examDuration} {t('exams.minutesUnit')}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
                <h3 className="font-extrabold text-brand-text-primary dark:text-white text-lg mb-4 flex items-center gap-2">
                  <Shield size={20} className="text-brand-primary-500" />
                  {t('exams.secureExamGuidelines')}
                </h3>
                <div className="space-y-6 pt-2">
                  <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-4">
                    <div className="flex gap-4">
                      <div className="p-3 bg-slate-900/5 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl h-fit">
                        <Lock size={20} />
                      </div>
                      <div>
                        <h4 className="font-black text-brand-text-primary dark:text-white">{t('exams.antiCheatEnabled')}</h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-bold mt-1">
                          {t('exams.antiCheatDescription')}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* ── Device Info Transparency Section ──────────────────────── */}
                  {deviceInfoItems.length > 0 && (
                    <div className="p-5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-500/10 rounded-xl">
                            <Eye size={18} className="text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <h4 className="font-black text-blue-800 dark:text-blue-300 text-sm">
                              {t('exams.deviceInfoTitle')}
                            </h4>
                            <p className="text-xs text-blue-600/70 dark:text-blue-400/70 font-semibold mt-0.5">
                              {t('exams.deviceInfoDesc')}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => refreshDeviceInfo()}
                          className="px-3 py-1.5 rounded-xl bg-blue-500 text-white font-bold text-xs hover:bg-blue-600 transition-all flex items-center gap-1.5 shrink-0"
                        >
                          <MapPin size={14} />
                          {t('exams.refreshLocation') || 'تحديد / تحديث موقعي الجغرافي'}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {deviceInfoItems.map((item, idx) => (
                          <div key={idx} className="p-2.5 rounded-xl bg-white/60 dark:bg-slate-800/60 border border-blue-200/40 dark:border-blue-800/30">
                            <span className="text-[10px] font-bold text-blue-500/60 dark:text-blue-400/60 block mb-0.5">
                              {item.label}
                            </span>
                            <span className="text-xs font-black text-blue-900 dark:text-blue-200 block truncate">
                              {item.value}
                            </span>
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-blue-600/50 dark:text-blue-400/50 font-semibold text-center">
                        {t('exams.deviceInfoTransparency')}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 text-amber-800 dark:text-amber-400">
                    <AlertTriangle size={20} className="shrink-0" />
                    <p className="text-xs font-black">
                      {t('exams.integrityAgreement')}
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            <div className="lg:col-span-1 space-y-6">
              <Button
                onClick={startExam}
                className="w-full h-16 rounded-2xl shadow-xl shadow-brand-primary-500/20 text-lg font-black flex items-center justify-center gap-3 !bg-brand-primary-500 hover:!bg-brand-primary-600 text-white border-none"
              >
                {t('exams.startDigitalExam')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── IN_PROGRESS Screen ───────────────────────────────────────────── */}
      {status === 'IN_PROGRESS' && currentQuestion && (
        <div className="space-y-6">
          {/* Sticky Header Bar */}
          <div className="sticky top-4 z-20 flex justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center gap-4 px-4 w-full">
              <div className="flex flex-col min-w-max">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {t('exams.progress')}
                </span>
                <span className="text-sm font-black text-brand-text-primary dark:text-white">
                  {currentQuestionIndex + 1} / {questions.length}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 overflow-hidden mx-4">
                <div
                  className="h-full bg-brand-primary-500 transition-all duration-500"
                  style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
                />
              </div>
              <div className="flex flex-col min-w-max">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {t('exams.answered')}
                </span>
                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                  {answeredCount} / {questions.length}
                </span>
              </div>
            </div>

            <div
              className={`flex items-center px-6 py-2.5 rounded-2xl font-mono text-lg font-black shadow-inner transition-colors ms-4 ${timeLeft < 300 ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 dark:bg-slate-900 text-brand-primary-500'}`}
            >
              <Timer size={20} className="me-3" />
              {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </div>
          </div>

          {/* Violation counter indicator */}
          {violationCount > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-700/40 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400">
              <ShieldAlert size={14} />
              <span>{violationCount} {t('exams.violationsCount')}</span>
              {leaveCount > 0 && (
                <span className="ms-2 px-2 py-0.5 bg-rose-500/10 rounded-full text-[10px]">
                  {t('exams.leavesCount')}: {leaveCount}/{antiCheatSettings.maxLeavesBeforeCancel + 1}
                </span>
              )}
            </div>
          )}

          {/* Question Navigator Grid */}
          <div className="flex flex-wrap gap-2 p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            {questions.map((q, idx) => {
              const isAnswered = answers[q.id] != null && answers[q.id] !== '';
              const isCurrent = idx === currentQuestionIndex;
              return (
                <button
                  key={q.id || idx}
                  onClick={() => setCurrentQuestionIndex(idx)}
                  className={`w-10 h-10 rounded-xl text-xs font-black transition-all duration-200 border-2 ${
                    isCurrent
                      ? 'bg-brand-primary-500 text-white border-brand-primary-500 scale-110 shadow-md'
                      : isAnswered
                      ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700'
                      : 'bg-slate-50 dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-brand-primary-500/40'
                  }`}
                  title={`${t('exams.questionNumber', { num: idx + 1 })}${isAnswered ? ` ✓` : ''}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          {/* Question Card */}
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <Card className="p-8 rounded-[2.5rem] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="flex items-start justify-between mb-8">
                <h3 className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100 leading-relaxed">
                  {currentQuestion.text}
                </h3>
                <span className="bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 px-3 py-1 rounded-lg text-sm font-bold min-w-max">
                  {currentQuestion.points || 1} {t('exams.pointsUnit')}
                </span>
              </div>

              {(() => {
                const qType = (currentQuestion.type || '').toUpperCase().replace('-', '_');
                
                // Collect direct options (optionA, optionB, optionC, optionD)
                const directOpts = ['A', 'B', 'C', 'D']
                  .map((letter) => ({
                    code: letter,
                    text: currentQuestion[`option${letter}`] || currentQuestion[`option_${letter.toLowerCase()}`],
                  }))
                  .filter((o) => o.text && String(o.text).trim().length > 0);

                const isTrueFalse = qType === 'TRUE_FALSE' || qType === 'TRUEFALSE' || qType === 'TF';
                const isShortAnswer = qType === 'SHORT_ANSWER' || qType === 'ESSAY' || qType === 'TEXT';
                const isMcq = qType === 'MCQ' || qType === 'MULTIPLE_CHOICE' || directOpts.length > 0;

                // 1. True / False Rendering
                if (isTrueFalse) {
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        { value: 'TRUE', label: t('exams.answerTrue') },
                        { value: 'FALSE', label: t('exams.answerFalse') },
                      ].map((opt) => {
                        const isSelected =
                          answers[currentQuestion.id] === opt.value ||
                          answers[currentQuestion.id] === (opt.value === 'TRUE' ? 'A' : 'B') ||
                          answers[currentQuestion.id] === (opt.value === 'TRUE' ? 'true' : 'false');
                        return (
                          <button
                            key={opt.value}
                            onClick={() => handleAnswerSelect(currentQuestion.id, opt.value)}
                            className={`flex items-center justify-center gap-4 p-6 rounded-3xl border-2 text-center transition-all duration-300 ${
                              isSelected
                                ? 'border-brand-primary-500 bg-brand-primary-500/10 shadow-lg font-black text-brand-primary-600 dark:text-brand-primary-400 scale-[1.02]'
                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-brand-primary-500/40'
                            }`}
                          >
                            <span className="text-lg font-black">{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  );
                }

                // 2. MCQ Rendering
                if (isMcq || directOpts.length > 0) {
                  const optsToRender = directOpts.length > 0 ? directOpts : [
                    { code: 'A', text: t('exams.optionA') },
                    { code: 'B', text: t('exams.optionB') },
                    { code: 'C', text: t('exams.optionC') },
                    { code: 'D', text: t('exams.optionD') },
                  ];

                  return (
                    <div className="grid grid-cols-1 gap-4">
                      {optsToRender.map((opt) => {
                        const isSelected = answers[currentQuestion.id] === opt.code;
                        return (
                          <button
                            key={opt.code}
                            onClick={() => handleAnswerSelect(currentQuestion.id, opt.code)}
                            className={`flex items-center gap-5 p-5 rounded-3xl border-2 text-start transition-all duration-300 group ${
                              isSelected
                                ? 'border-brand-primary-500 bg-brand-primary-500/10 shadow-lg shadow-brand-primary-500/10'
                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-brand-primary-500/30'
                            }`}
                          >
                            <div
                              className={`w-9 h-9 shrink-0 rounded-2xl flex items-center justify-center font-black transition-all ${
                                isSelected
                                  ? 'bg-brand-primary-500 text-white shadow-md'
                                  : 'bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-500 group-hover:text-brand-primary-500'
                              }`}
                            >
                              {opt.code}
                            </div>
                            <span
                              className={`text-base font-extrabold ${
                                isSelected
                                  ? 'text-slate-900 dark:text-white'
                                  : 'text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {opt.text}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  );
                }

                // 3. Short Answer / Essay
                return (
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      {t('exams.writeAnswerHere')}
                    </label>
                    <textarea
                      rows={5}
                      value={answers[currentQuestion.id] || ''}
                      onChange={(e) => handleAnswerSelect(currentQuestion.id, e.target.value)}
                      placeholder={t('exams.answerPlaceholder')}
                      className="w-full border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-primary-500 outline-none resize-none"
                    />
                  </div>
                );
              })()}

            </Card>

            {/* Navigation */}
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
                  onClick={() => setShowSubmitConfirm(true)}
                  className="rounded-2xl px-8 h-12 shadow-xl shadow-brand-primary-500/20 gap-2 !bg-brand-primary-500 hover:!bg-brand-primary-600 font-black text-white border-none"
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

      {/* ── Submit Confirmation Modal ─────────────────────────────────────── */}
      <Modal
        isOpen={showSubmitConfirm}
        onClose={() => setShowSubmitConfirm(false)}
        size="sm"
        title={
          <div className="flex items-center gap-3 text-brand-text-primary dark:text-white">
            <div className="p-2.5 rounded-2xl bg-brand-primary-500/10 text-brand-primary-600 dark:text-brand-primary-400 shrink-0">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold">{t('exams.submitConfirmTitle')}</h2>
            </div>
          </div>
        }
      >
        <div className="space-y-4 pt-2">
          <p className="text-sm text-slate-600 dark:text-slate-300 font-semibold">
            {t('exams.submitConfirmDesc')}
          </p>
          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
            <span className="text-slate-500">{t('exams.answeredQuestions')}</span>
            <span className="text-brand-primary-600 dark:text-brand-primary-400">{answeredCount} / {questions.length}</span>
          </div>
          {answeredCount < questions.length && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl text-xs font-bold text-amber-700 dark:text-amber-400">
              <AlertTriangle size={16} className="shrink-0" />
              {t('exams.unansweredWarning', { count: questions.length - answeredCount })}
            </div>
          )}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowSubmitConfirm(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setShowSubmitConfirm(false);
                handleSubmitExam();
              }}
              className="!bg-brand-primary-500 hover:!bg-brand-primary-600 text-white font-extrabold px-5 h-10 rounded-xl flex items-center gap-2 border-none"
            >
              <CheckCircle2 className="w-4 h-4" />
              {t('exams.submitConfirmAction')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Route Blocker Modal ───────────────────────────────────────────── */}
      <Modal
        isOpen={showBlockerModal}
        onClose={() => {
          setShowBlockerModal(false);
          blocker.reset?.();
        }}
        size="sm"
        title={
          <div className="flex items-center gap-3 text-brand-text-primary dark:text-white">
            <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-extrabold">{t('exams.leaveExamTitle')}</h2>
          </div>
        }
      >
        <div className="space-y-4 pt-2">
          <p className="text-sm text-slate-600 dark:text-slate-300 font-semibold">
            {t('exams.leaveExamDesc')}
          </p>
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowBlockerModal(false);
                blocker.reset?.();
              }}
            >
              {t('exams.stayInExam')}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setShowBlockerModal(false);
                blocker.proceed?.();
              }}
              className="!bg-rose-500 hover:!bg-rose-600 text-white font-extrabold px-5 h-10 rounded-xl flex items-center gap-2 border-none"
            >
              {t('exams.leaveExam')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default TakeExam;
