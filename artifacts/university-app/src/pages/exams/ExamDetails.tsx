// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  MapPin,
  FileText,
  ArrowLeft,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Plus,
  Trash2,
  Users,
  HelpCircle,
  Award,
  Sparkles,
  Play,
  ArrowRight,
  Timer,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import examsService from '../../services/exams.service';
import Card from '../../components/ui/Card';
import { TimeRange } from '../../components/ui/TimeRange';
import Button from '../../components/ui/button';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import { useToast } from '../../context/ToastContext';
import { getExamLabel, getDurationMinutes, getExamTimeWindowStatus } from './examUtils';

const ExamDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language?.startsWith('ar');
  const { user } = useAuth();
  const { showToast } = useToast();

  const [exam, setExam] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [mySubmission, setMySubmission] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [addingQuestion, setAddingQuestion] = useState(false);
  const [newQuestion, setNewQuestion] = useState({
    text: '',
    type: 'MCQ',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correctAnswer: 'A',
    points: 1,
  });

  const isTeacher = ['ADMIN', 'DOCTOR', 'SUPER_ADMIN'].includes(user?.role || '');
  const isStudent = user?.role === 'STUDENT';

  useEffect(() => {
    fetchExamData();
  }, [id]);

  const fetchExamData = async () => {
    try {
      setLoading(true);
      const result = await examsService.getExamById(id);
      if (result.success) setExam(result.data);

      if (isTeacher) {
        const qRes = await examsService.getExamQuestions(id);
        if (qRes.success) setQuestions(Array.isArray(qRes.data) ? qRes.data : []);
      } else if (isStudent) {
        try {
          const subRes = await examsService.getMyExamSubmission(id);
          if (subRes.success && subRes.data) {
            setMySubmission(subRes.data);
          }
        } catch (_e) {
          // Student hasn't submitted yet
        }
      }
    } catch (err: any) {
      setError(t('exams.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.text.trim()) {
      showToast(t('exams.questionTextRequired'), 'error');
      return;
    }

    const payload = {
      ...newQuestion,
      type: newQuestion.type || 'MCQ',
      optionA: newQuestion.type === 'MCQ' ? (newQuestion.optionA?.trim() || null) : null,
      optionB: newQuestion.type === 'MCQ' ? (newQuestion.optionB?.trim() || null) : null,
      optionC: newQuestion.type === 'MCQ' ? (newQuestion.optionC?.trim() || null) : null,
      optionD: newQuestion.type === 'MCQ' ? (newQuestion.optionD?.trim() || null) : null,
    };

    try {
      setAddingQuestion(true);
      const qRes = await examsService.addExamQuestion(id, payload);
      if (qRes.success) {
        setQuestions((prev) => [...prev, qRes.data]);
        setShowAddQuestion(false);
        setNewQuestion({
          text: '',
          type: 'MCQ',
          optionA: '',
          optionB: '',
          optionC: '',
          optionD: '',
          correctAnswer: 'A',
          points: 1,
        });
        showToast(t('exams.questionAddedSuccess'), 'success');
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || t('exams.addQuestionError'), 'error');
    } finally {
      setAddingQuestion(false);
    }
  };

  const handleDeleteQuestion = async (qId: string | number) => {
    if (!window.confirm(t('exams.confirmDeleteQuestion'))) return;
    try {
      const res = await examsService.deleteExamQuestion(qId);
      if (res.success) {
        setQuestions((prev) => prev.filter((q) => q.id !== qId));
        showToast(t('exams.questionDeletedSuccess'), 'success');
      }
    } catch (_err) {
      showToast(t('exams.deleteQuestionError'), 'error');
    }
  };

  // Total calculated points
  const totalPoints = useMemo(() => {
    const sourceQuestions = questions.length > 0 ? questions : (exam?.questions || []);
    return sourceQuestions.reduce((sum, q) => sum + (Number(q.points) || 1), 0);
  }, [questions, exam]);

  const totalQuestionsCount = useMemo(() => {
    return questions.length > 0 ? questions.length : (exam?.questions?.length || 0);
  }, [questions, exam]);

  // Compute duration from start and end times
  const examDuration = useMemo(() => {
    return getDurationMinutes(exam?.startTime, exam?.endTime, exam?.durationMinutes);
  }, [exam]);

  // Compute time window status (NOT_STARTED | ACTIVE | EXPIRED)
  const timeWindowStatus = useMemo(() => {
    return getExamTimeWindowStatus(exam);
  }, [exam]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <Loader2 className="animate-spin text-brand-primary-500" size={44} />
        <p className="text-slate-500 font-extrabold text-sm">{t('exams.fetching')}</p>
      </div>
    );
  }

  if (error || !exam) {
    return (
      <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm p-8">
        <div className="h-20 w-20 rounded-full bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center mx-auto mb-6 text-rose-500">
          <AlertCircle size={40} />
        </div>
        <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100">{error || t('exams.noExams')}</h2>
        <Button variant="outline" className="mt-6" onClick={() => navigate('/exams')}>
          <ArrowLeft size={18} className="rtl:-scale-x-100 me-2" /> {t('common.back')}
        </Button>
      </div>
    );
  }

  const breadcrumbItems = [
    { label: t('exams.title'), link: '/exams' },
    { label: exam.course?.name || t('exams.title') },
  ];

  return (
    <div className="section-gap animate-page space-y-6 max-w-7xl mx-auto">
      {/* ── Breadcrumbs Navigation ─────────────────────────────────────── */}
      <Breadcrumbs items={breadcrumbItems} />

      {/* ── Full-Width Integrated Hero & Metadata Banner ────────────────── */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/80 dark:border-slate-700/70 shadow-sm p-6 space-y-6">
        {/* Top Header Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100 dark:border-slate-700/60">
          <div className="flex items-start gap-4">
            <button
              onClick={() => navigate('/exams')}
              className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all shrink-0 mt-1"
              title={t('common.back')}
            >
              <ArrowLeft size={20} className="rtl:rotate-180" />
            </button>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="px-3 py-1 rounded-xl text-xs font-black bg-brand-primary-500 text-white shadow-sm">
                  {exam.course?.courseCode}
                </span>
                <span className="px-3 py-1 rounded-xl text-xs font-extrabold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                  {getExamLabel(exam.type, t)}
                </span>
                {exam.course?.department?.nameAr || exam.course?.department?.name ? (
                  <span className="text-xs font-bold text-slate-400">
                    · {exam.course?.department?.nameAr || exam.course?.department?.name}
                  </span>
                ) : null}
              </div>
              <h1 className="text-2xl lg:text-3xl font-black text-brand-text-primary dark:text-white mt-2">
                {getExamLabel(exam.type, t)} — {exam.course?.name}
              </h1>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            {isTeacher && (
              <Button
                onClick={() => navigate(`/exams/${id}/submissions`)}
                className="!bg-slate-100 hover:!bg-slate-200 dark:!bg-slate-700 dark:hover:!bg-slate-600 !text-slate-800 dark:!text-white font-extrabold flex items-center gap-2 h-11 px-5 rounded-2xl border-none text-xs"
              >
                <Users size={16} />
                {t('exams.viewSubmissions')}
              </Button>
            )}


            {isStudent && (
              mySubmission ? (
                <Button
                  onClick={() => navigate(`/exams/${id}/results`)}
                  className="!bg-emerald-600 hover:!bg-emerald-700 text-white font-extrabold flex items-center gap-2 h-11 px-5 rounded-2xl shadow-md shadow-emerald-600/20 border-none text-xs"
                >
                  <CheckCircle2 size={16} />
                  {t('exams.viewResults')}
                </Button>
              ) : timeWindowStatus === 'NOT_STARTED' ? (
                <Button
                  disabled
                  className="!bg-slate-100 dark:!bg-slate-700 !text-slate-400 font-bold flex items-center gap-2 h-11 px-5 rounded-2xl border-none text-xs cursor-not-allowed"
                >
                  <Clock size={16} />
                  {t('exams.btnNotStarted', { time: exam.startTime })}
                </Button>
              ) : timeWindowStatus === 'EXPIRED' ? (
                <Button
                  disabled
                  className="!bg-rose-100 dark:!bg-rose-950/40 !text-rose-600 dark:!text-rose-400 font-bold flex items-center gap-2 h-11 px-5 rounded-2xl border-none text-xs cursor-not-allowed"
                >
                  <AlertCircle size={16} />
                  {t('exams.btnExpired')}
                </Button>
              ) : (
                <Button
                  onClick={() => navigate(`/exams/${id}/take`)}
                  className="!bg-brand-primary-500 hover:!bg-brand-primary-600 text-white font-black flex items-center gap-2 h-11 px-6 rounded-2xl shadow-lg shadow-brand-primary-500/30 border-none text-xs"
                >
                  <Play size={16} className="fill-current" />
                  {t('exams.startExamNow')}
                </Button>
              )
            )}
          </div>
        </div>

        {/* Horizontal Metadata Cards Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Date */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-700/60 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand-primary-500/10 text-brand-primary-600 dark:text-brand-primary-400 shrink-0">
              <Calendar size={18} />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-slate-400 block truncate">{t('exams.examDate')}</span>
              <span className="text-xs font-black text-brand-text-primary dark:text-white truncate block">
                {new Date(exam.date).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>

          {/* Time */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-700/60 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
              <Clock size={18} />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-slate-400 block truncate">{t('exams.startTime')}</span>
              <span className="text-xs font-black text-brand-text-primary dark:text-white truncate block dir-ltr">
                <TimeRange start={exam.startTime} end={exam.endTime} />
              </span>
            </div>
          </div>

          {/* Duration */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-700/60 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
              <Timer size={18} />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-slate-400 block truncate">{t('exams.durationLabel')}</span>
              <span className="text-xs font-black text-amber-600 dark:text-amber-400 truncate block">
                {examDuration} {t('exams.minutesUnit')}
              </span>
            </div>
          </div>

          {/* Room */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-700/60 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
              <MapPin size={18} />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-slate-400 block truncate">{t('exams.room')}</span>
              <span className="text-xs font-black text-brand-text-primary dark:text-white truncate block">
                {exam.room || t('exams.tba')}
              </span>
            </div>
          </div>

          {/* Questions Count */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-700/60 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
              <HelpCircle size={18} />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-slate-400 block truncate">{t('exams.totalQuestionsCount')}</span>
              <span className="text-xs font-black text-brand-text-primary dark:text-white truncate block">
                {totalQuestionsCount} {t('exams.questionsUnit')}
              </span>
            </div>
          </div>

          {/* Total Points */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500 text-white shrink-0 shadow-sm">
              <Award size={18} />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 block truncate">{t('exams.totalExamPoints')}</span>
              <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 truncate block">
                {totalPoints} {t('exams.pointsUnit')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Student Announcement Banner (Students Only) ────────────────── */}
      {isStudent && (
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 border border-slate-700/60 animate-in fade-in duration-500">
          <div className="flex items-center gap-5">
            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md shrink-0 border border-white/10">
              <Sparkles className="w-7 h-7 text-brand-primary-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider ${
                    mySubmission
                      ? 'bg-emerald-500 text-white'
                      : timeWindowStatus === 'ACTIVE'
                      ? 'bg-brand-primary-500 text-white'
                      : timeWindowStatus === 'NOT_STARTED'
                      ? 'bg-amber-500 text-white'
                      : 'bg-rose-500 text-white'
                  }`}
                >
                  {mySubmission
                    ? t('exams.statusCompleted')
                    : timeWindowStatus === 'ACTIVE'
                    ? t('exams.statusAvailable')
                    : timeWindowStatus === 'NOT_STARTED'
                    ? t('exams.statusUpcoming')
                    : t('exams.btnExpired')}
                </span>
                <h2 className="text-lg font-black">
                  {mySubmission
                    ? t('exams.submittedBannerTitle')
                    : timeWindowStatus === 'NOT_STARTED'
                    ? t('exams.examNotStartedTitle')
                    : timeWindowStatus === 'EXPIRED'
                    ? t('exams.examExpiredTitle')
                    : t('exams.readyBannerTitle')}
                </h2>
              </div>
              <p className="text-xs text-slate-300 font-semibold mt-1.5 leading-relaxed">
                {mySubmission
                  ? t('exams.submittedBannerDesc')
                  : timeWindowStatus === 'NOT_STARTED'
                  ? t('exams.examNotStartedDesc', {
                      time: exam.startTime,
                      date: new Date(exam.date).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US'),
                    })
                  : timeWindowStatus === 'EXPIRED'
                  ? t('exams.examExpiredDesc', { time: exam.endTime })
                  : t('exams.readyBannerDesc', { duration: examDuration })}
              </p>
            </div>
          </div>
          <div className="shrink-0">
            {mySubmission ? (
              <Button
                onClick={() => navigate(`/exams/${id}/results`)}
                className="!bg-white !text-slate-900 hover:!bg-slate-100 font-extrabold px-6 h-11 rounded-2xl shadow-md border-none text-xs flex items-center gap-2"
              >
                <CheckCircle2 size={18} className="text-emerald-600" />
                {t('exams.viewReportAndResults')}
              </Button>
            ) : timeWindowStatus === 'ACTIVE' ? (
              <Button
                onClick={() => navigate(`/exams/${id}/take`)}
                className="!bg-brand-primary-500 hover:!bg-brand-primary-600 text-white font-black px-7 h-11 rounded-2xl shadow-lg shadow-brand-primary-500/30 border-none text-xs flex items-center gap-2"
              >
                <Play size={18} className="fill-current" />
                {t('exams.startExamNow')}
                <ArrowRight size={16} className="rtl:rotate-180" />
              </Button>
            ) : null}
          </div>
        </div>
      )}

      {/* ── Main Full-Width Questions Management Section ────────────────── */}
      {isTeacher && (
        <Card className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/80 dark:border-slate-700/70 shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-brand-primary-500/10 text-brand-primary-600 dark:text-brand-primary-400">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-brand-text-primary dark:text-white">
                  {t('exams.questionsManagement')}
                </h3>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {t('exams.questionsManagementDesc')}
                </p>
              </div>
            </div>

            <Button
              onClick={() => setShowAddQuestion((prev) => !prev)}
              size="sm"
              className="!bg-brand-primary-500 hover:!bg-brand-primary-600 text-white font-extrabold px-4 h-10 rounded-2xl shadow-sm flex items-center gap-2 border-none text-xs"
            >
              <Plus size={16} />
              {t('exams.addQuestion')}
            </Button>
          </div>

          {/* Add Question Drawer Form */}
          {showAddQuestion && (
            <form
              onSubmit={handleAddQuestion}
              className="p-5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-brand-primary-500/30 space-y-4 animate-in fade-in duration-300"
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <h4 className="font-extrabold text-sm text-brand-text-primary dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-brand-primary-500" />
                  {t('exams.addQuestion')}
                </h4>
                <button
                  type="button"
                  onClick={() => setShowAddQuestion(false)}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
                >
                  {t('common.cancel')}
                </button>
              </div>

              {/* Question Text */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t('exams.questionText')} *
                </label>
                <textarea
                  value={newQuestion.text}
                  onChange={(e) => setNewQuestion({ ...newQuestion, text: e.target.value })}
                  placeholder={t('exams.questionTextPlaceholder')}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-brand-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 transition-all resize-none"
                  rows={3}
                  required
                />
              </div>

              {/* Type & Points */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {t('exams.questionType')}
                  </label>
                  <select
                    value={newQuestion.type}
                    onChange={(e) =>
                      setNewQuestion({
                        ...newQuestion,
                        type: e.target.value,
                        correctAnswer: e.target.value === 'MCQ' ? 'A' : e.target.value === 'TRUE_FALSE' ? 'TRUE' : '',
                      })
                    }
                    className="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-brand-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 cursor-pointer"
                  >
                    <option value="MCQ">{t('exams.mcq')}</option>
                    <option value="TRUE_FALSE">{t('exams.trueFalse')}</option>
                    <option value="SHORT_ANSWER">{t('exams.shortAnswer')}</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {t('exams.points')}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={newQuestion.points}
                    onChange={(e) => setNewQuestion({ ...newQuestion, points: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-brand-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20"
                  />
                </div>
              </div>

              {/* MCQ Options */}
              {newQuestion.type === 'MCQ' && (
                <div className="space-y-2 pt-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {t('exams.mcqOptionsLabel')}
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {[
                      { key: 'optionA', code: 'A' },
                      { key: 'optionB', code: 'B' },
                      { key: 'optionC', code: 'C' },
                      { key: 'optionD', code: 'D' },
                    ].map((opt) => (
                      <div
                        key={opt.key}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all ${
                          newQuestion.correctAnswer === opt.code
                            ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-400 dark:border-emerald-700'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="correctAnswerRadio"
                          checked={newQuestion.correctAnswer === opt.code}
                          onChange={() => setNewQuestion({ ...newQuestion, correctAnswer: opt.code })}
                          className="accent-emerald-500 cursor-pointer"
                          id={`radio-${opt.code}`}
                        />
                        <label htmlFor={`radio-${opt.code}`} className="text-xs font-bold text-slate-500 cursor-pointer shrink-0">
                          {opt.code}.
                        </label>
                        <input
                          type="text"
                          value={(newQuestion as any)[opt.key]}
                          onChange={(e) => setNewQuestion({ ...newQuestion, [opt.key]: e.target.value })}
                          placeholder={t('exams.optionPlaceholder', { code: opt.code })}
                          className="w-full text-xs font-semibold bg-transparent focus:outline-none text-brand-text-primary dark:text-white"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* True/False Selection */}
              {newQuestion.type === 'TRUE_FALSE' && (
                <div className="space-y-2 pt-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {t('exams.correctAnswer')} *
                  </label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 cursor-pointer">
                      <input
                        type="radio"
                        name="tfAnswer"
                        checked={newQuestion.correctAnswer === 'TRUE' || newQuestion.correctAnswer === 'A'}
                        onChange={() => setNewQuestion({ ...newQuestion, correctAnswer: 'TRUE' })}
                        className="accent-emerald-500"
                      />
                      {t('exams.answerTrue')}
                    </label>
                    <label className="flex items-center gap-2 text-xs font-bold text-rose-600 dark:text-rose-400 cursor-pointer">
                      <input
                        type="radio"
                        name="tfAnswer"
                        checked={newQuestion.correctAnswer === 'FALSE' || newQuestion.correctAnswer === 'B'}
                        onChange={() => setNewQuestion({ ...newQuestion, correctAnswer: 'FALSE' })}
                        className="accent-rose-500"
                      />
                      {t('exams.answerFalse')}
                    </label>
                  </div>
                </div>
              )}

              {/* Short Answer Input */}
              {newQuestion.type === 'SHORT_ANSWER' && (
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {t('exams.shortAnswerKeyword')}
                  </label>
                  <input
                    type="text"
                    value={newQuestion.correctAnswer}
                    onChange={(e) => setNewQuestion({ ...newQuestion, correctAnswer: e.target.value })}
                    placeholder={t('exams.shortAnswerPlaceholder')}
                    className="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-brand-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20"
                  />
                </div>
              )}

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAddQuestion(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={addingQuestion}
                  size="sm"
                  className="!bg-brand-primary-500 hover:!bg-brand-primary-600 text-white font-extrabold px-5 h-9 rounded-xl flex items-center gap-2 text-xs border-none"
                >
                  {addingQuestion ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      {t('exams.saveQuestion')}
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}

          {/* Full Width Questions List */}
          <div className="space-y-4">
            {questions.length === 0 ? (
              <div className="text-center py-14 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 space-y-2">
                <FileText className="mx-auto text-slate-300 dark:text-slate-600" size={42} />
                <h4 className="font-extrabold text-sm text-brand-text-primary dark:text-white">
                  {t('exams.noQuestions')}
                </h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {t('exams.noQuestionsSubtitle')}
                </p>
              </div>
            ) : (
              questions.map((q, idx) => (
                <div
                  key={q.id || idx}
                  className="p-6 bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl space-y-4 hover:border-brand-primary-500/40 transition-all duration-200 shadow-2xs"
                >
                  {/* Question Header Row */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-black text-xs text-white bg-slate-900 dark:bg-slate-700 px-3 py-1 rounded-xl">
                        {t('exams.questionNumber', { num: idx + 1 })}
                      </span>
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 px-3 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
                        {q.type === 'MCQ' ? t('exams.mcq') : q.type === 'TRUE_FALSE' ? t('exams.trueFalse') : t('exams.shortAnswer')}
                      </span>
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-xl border border-emerald-200 dark:border-emerald-800/40">
                        {q.points || 1} {t('exams.pointsUnit')}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteQuestion(q.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all"
                      title={t('common.delete')}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  {/* Question Text */}
                  <p className="font-black text-base text-brand-text-primary dark:text-white leading-relaxed">
                    {q.text}
                  </p>

                  {/* MCQ Options Display */}
                  {q.optionA && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-semibold pt-1">
                      {['optionA', 'optionB', 'optionC', 'optionD'].map((optKey, i) => {
                        const code = ['A', 'B', 'C', 'D'][i];
                        const val = q[optKey];
                        if (!val) return null;
                        const isCorrect = q.correctAnswer === code || q.correctAnswer === val;
                        return (
                          <div
                            key={optKey}
                            className={`p-3 rounded-2xl border flex items-center gap-3 ${
                              isCorrect
                                ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300 font-bold'
                                : 'bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <span className={`w-6 h-6 rounded-xl text-xs font-black flex items-center justify-center shrink-0 ${isCorrect ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600'}`}>
                              {code}
                            </span>
                            <span className="truncate">{val}</span>
                            {isCorrect && <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 ms-auto shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Model Answer Footer */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{t('exams.modelAnswer')}:</span>
                    <span className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 px-3 py-0.5 rounded-xl font-black">
                      {q.correctAnswer}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {/* ── Exam Guidelines Card (Full Width) ───────────────────────────── */}
      <Card className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/80 dark:border-slate-700/70 shadow-sm p-6 space-y-4">
        <h3 className="font-extrabold text-base text-brand-text-primary dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-700/60 pb-3">
          <ShieldCheck className="w-5 h-5 text-brand-primary-500" />
          {t('exams.examInstructions')}
        </h3>

        <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 space-y-2.5">
          <h4 className="font-extrabold text-xs text-brand-text-primary dark:text-white">
            {t('exams.generalRules')}
          </h4>
          <ul className="space-y-2 text-xs font-medium text-slate-600 dark:text-slate-400">
            <li className="flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-brand-primary-500 mt-1.5 shrink-0" />
              <span>{t('exams.rule1')}</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-brand-primary-500 mt-1.5 shrink-0" />
              <span>{t('exams.rule2')}</span>
            </li>
          </ul>
        </div>
      </Card>
    </div>
  );
};

export default ExamDetails;
