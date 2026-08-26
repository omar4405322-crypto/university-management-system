// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  AlertCircle,
  Loader2,
  FileText,
  CheckCircle2,
  Users,
  Award,
  Eye,
  ChevronDown,
  ChevronUp,
  Clock,
  AlertTriangle,
  BarChart3,
  Search,
  Monitor,
  MapPin,
  Wifi,
  Globe,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import examsService from '../../services/exams.service';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/button';
import { useToast } from '../../context/ToastContext';
import {
  normalizeAnswers,
  checkAnswerIsCorrect,
  getStudentAnswerText,
  getModelAnswerText,
  formatViolationType,
  getExamLabel,
} from './examUtils';

const ExamSubmissions = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language?.startsWith('ar');
  const { user } = useAuth();
  const { showToast } = useToast();

  const [exam, setExam] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<number | string | null>(null);
  const [gradingId, setGradingId] = useState<number | string | null>(null);
  const [gradeValue, setGradeValue] = useState<number | string>('');
  const [savingGrade, setSavingGrade] = useState(false);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [examRes, subRes, qRes] = await Promise.all([
        examsService.getExamById(id),
        examsService.getExamSubmissions(id),
        examsService.getExamQuestions(id),
      ]);

      if (examRes.success) setExam(examRes.data);
      if (subRes.success) setSubmissions(Array.isArray(subRes.data) ? subRes.data : subRes.data?.submissions || []);
      if (qRes.success) setQuestions(Array.isArray(qRes.data) ? qRes.data : []);
    } catch (err: any) {
      setError(err.response?.data?.message || t('exams.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGrade = async (submissionId: number | string) => {
    const score = Number(gradeValue);
    if (isNaN(score) || score < 0) {
      showToast(t('exams.invalidScore'), 'error');
      return;
    }
    try {
      setSavingGrade(true);
      const res = await examsService.gradeSubmission(submissionId, score);
      if (res.success) {
        showToast(t('exams.gradeSuccess'), 'success');
        setGradingId(null);
        setGradeValue('');
        fetchData();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || t('exams.gradeError'), 'error');
    } finally {
      setSavingGrade(false);
    }
  };

  // ── Statistics ──────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = submissions.length;
    const graded = submissions.filter((s) => s.status === 'GRADED' || s.score != null).length;
    const pending = total - graded;
    const scores = submissions.filter((s) => s.score != null).map((s) => Number(s.score));
    const avg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '-';
    const maxScore = submissions[0]?.maxScore || questions.reduce((sum, q) => sum + (Number(q.points) || 1), 0) || 0;
    const passed = scores.filter((s) => s >= maxScore * 0.5).length;
    const passRate = scores.length > 0 ? Math.round((passed / scores.length) * 100) : 0;
    return { total, graded, pending, avg, maxScore, passRate };
  }, [submissions, questions]);

  // ── Filtered submissions ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!search.trim()) return submissions;
    const term = search.toLowerCase();
    return submissions.filter(
      (s) =>
        (s.student?.user?.firstName || '').toLowerCase().includes(term) ||
        (s.student?.user?.lastName || '').toLowerCase().includes(term) ||
        (s.student?.user?.email || '').toLowerCase().includes(term)
    );
  }, [submissions, search]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <Loader2 className="animate-spin text-brand-primary-500" size={48} />
        <p className="text-slate-500 font-extrabold text-sm">{t('exams.fetching')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm p-8">
        <AlertCircle className="text-rose-500 mx-auto mb-4" size={48} />
        <h2 className="text-xl font-black text-rose-600 dark:text-rose-400 mb-6">{error}</h2>
        <Button variant="outline" onClick={() => navigate('/exams')}>
          <ArrowLeft size={18} className="rtl:-scale-x-100 me-2" /> {t('common.back')}
        </Button>
      </div>
    );
  }

  return (
    <div className="section-gap animate-page space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/exams/${id}`)}
            className="p-3 rounded-xl text-slate-400 hover:text-brand-primary-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all shrink-0"
          >
            <ArrowLeft size={22} className="rtl:-scale-x-100" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-brand-text-primary dark:text-white">
              {t('exams.submissionsTitle')}
            </h1>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
              {exam?.course?.name && `${getExamLabel(exam.type, t)} — ${exam.course.name} (${exam.course?.courseCode || ''})`}
            </p>
          </div>
        </div>
      </div>

      {/* ── Stats Row ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600"><Users size={20} /></div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t('exams.totalSubmissions')}</span>
            <span className="text-xl font-black text-brand-text-primary dark:text-white">{stats.total}</span>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600"><CheckCircle2 size={20} /></div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t('exams.gradedCount')}</span>
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">{stats.graded}</span>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600"><Clock size={20} /></div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t('exams.pendingCount')}</span>
            <span className="text-xl font-black text-amber-600 dark:text-amber-400">{stats.pending}</span>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-brand-primary-500/10 text-brand-primary-600"><BarChart3 size={20} /></div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t('exams.averageScore')}</span>
            <span className="text-xl font-black text-brand-primary-600 dark:text-brand-primary-400">{stats.avg}</span>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-600"><Award size={20} /></div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t('exams.passRate')}</span>
            <span className="text-xl font-black text-teal-600 dark:text-teal-400">{stats.passRate}%</span>
          </div>
        </div>
      </div>

      {/* ── Search Bar ──────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
        <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl px-4 py-2.5 border border-slate-200 dark:border-slate-700">
          <Search size={18} className="text-slate-400 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('exams.searchStudentPlaceholder')}
            className="w-full bg-transparent text-sm font-semibold text-brand-text-primary dark:text-white focus:outline-none placeholder-slate-400"
          />
        </div>
      </div>

      {/* ── Submissions List ────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-12 text-center">
          <FileText className="mx-auto text-slate-300 dark:text-slate-600 mb-4" size={48} />
          <h3 className="font-extrabold text-lg text-brand-text-primary dark:text-white">
            {t('exams.noSubmissions')}
          </h3>
          <p className="text-sm text-slate-400 mt-1">{t('exams.noSubmissionsDesc')}</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((sub) => {
            const isExpanded = expandedId === sub.id;
            const isGrading = gradingId === sub.id;
            const studentName = sub.student?.user
              ? `${sub.student.user.firstName || ''} ${sub.student.user.lastName || ''}`.trim() || t('exams.unknownStudent')
              : t('exams.unknownStudent');
            const normalizedAnswers = normalizeAnswers(sub.answers);
            const isGraded = sub.status === 'GRADED' || sub.score != null;
            const maxScore = sub.maxScore || stats.maxScore;
            const scorePercent = isGraded && maxScore > 0 ? Math.round((Number(sub.score) / maxScore) * 100) : 0;
            const violationList = sub.violations || sub.antiCheatLogs || sub.violationsLog || [];
            const ipAddr = sub.deviceInfo?.ipAddress || sub.ipAddress || sub.ip || null;
            const lat = sub.deviceInfo?.latitude ?? sub.latitude ?? sub.lat ?? null;
            const lng = sub.deviceInfo?.longitude ?? sub.longitude ?? sub.lng ?? null;

            return (
              <Card
                key={sub.id}
                className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-all"
              >
                {/* Student Row */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : sub.id)}
                  className="flex items-center justify-between p-5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-2xl bg-brand-primary-500/10 text-brand-primary-600 dark:text-brand-primary-400 flex items-center justify-center font-black text-sm shrink-0">
                      {studentName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-brand-text-primary dark:text-white">{studentName}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">{sub.student?.user?.email || ''}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {violationList.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 text-[10px] font-bold">
                        <AlertTriangle size={12} />
                        {violationList.length} {t('exams.violationsCount')}
                      </span>
                    )}

                    {sub.status === 'CANCELLED_CHEATING' ? (
                      <span className="px-3 py-1 rounded-full bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700 text-xs font-extrabold flex items-center gap-1.5 shadow-sm">
                        <ShieldAlert size={14} className="text-rose-600 dark:text-rose-400" />
                        {t('exams.cancelledByCheating')}
                      </span>
                    ) : isGraded ? (
                      <div className="flex items-center gap-2">
                        <div className="text-end">
                          <span className="text-lg font-black text-brand-primary-600 dark:text-brand-primary-400">
                            {sub.score}
                          </span>
                          <span className="text-xs text-slate-400 font-bold">/{maxScore}</span>
                        </div>
                        <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
                          scorePercent >= 85 ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400' :
                          scorePercent >= 60 ? 'bg-blue-100 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400' :
                          scorePercent >= 50 ? 'bg-amber-100 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400' :
                          'bg-rose-100 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400'
                        }`}>
                          {scorePercent}%
                        </span>
                      </div>
                    ) : (
                      <span className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-bold">
                        {t('exams.pendingGrading')}
                      </span>
                    )}

                    <div className="p-1 text-slate-400">
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-700 p-5 bg-slate-50/50 dark:bg-slate-900/30 space-y-4 animate-in fade-in duration-200">
                    
                    {/* ── Security & Device Info Report ───────────────────── */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3 shadow-sm">
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
                        <div className="flex items-center gap-2">
                          <ShieldAlert className="w-4 h-4 text-brand-primary-500" />
                          <h5 className="font-extrabold text-xs text-brand-text-primary dark:text-white">
                            {t('exams.securityReportTitle') || 'تقرير الأمان والجهاز وتحديد الموقع'}
                          </h5>
                        </div>
                        {sub.status === 'CANCELLED_CHEATING' ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-rose-500 text-white font-extrabold text-[10px]">
                            ⚠️ {t('exams.cancelledByCheating') || 'تم إلغاء الامتحان بسبب الغش'}
                          </span>
                        ) : violationList.length > 0 ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-extrabold text-[10px]">
                            ⚡ {t('exams.flaggedSubmission') || 'توجد مخالفات مسجلة'}
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-extrabold text-[10px]">
                            ✓ {t('exams.cleanSubmission') || 'جلسة نظيفة'}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        {/* IP Address */}
                        <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                          <span className="text-[10px] font-bold text-slate-400 block mb-0.5 flex items-center gap-1">
                            <Wifi className="w-3 h-3 text-blue-500" />
                            {t('exams.ipAddress') || 'عنوان الـ IP'}
                          </span>
                          <span className="font-extrabold text-brand-text-primary dark:text-white block font-mono">
                            {ipAddr || t('exams.notAvailable')}
                          </span>
                        </div>

                        {/* Location GPS & Maps Link */}
                        <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                          <span className="text-[10px] font-bold text-slate-400 block mb-0.5 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-rose-500" />
                            {t('exams.locationInfo') || 'الموقع الجغرافي (GPS)'}
                          </span>
                          {lat != null && lng != null ? (
                            <a
                              href={`https://www.google.com/maps?q=${lat},${lng}`}
                              target="_blank"
                              rel="noreferrer"
                              className="font-extrabold text-brand-primary-600 dark:text-brand-primary-400 hover:underline flex items-center gap-1 text-[11px] truncate"
                            >
                              <span>{Number(lat).toFixed(4)}, {Number(lng).toFixed(4)}</span>
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          ) : (
                            <span className="font-extrabold text-slate-400 block">
                              {sub.deviceInfo?.locationDenied ? t('exams.locationDenied') : t('exams.notAvailable')}
                            </span>
                          )}
                        </div>

                        {/* Device & OS */}
                        <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                          <span className="text-[10px] font-bold text-slate-400 block mb-0.5 flex items-center gap-1">
                            <Monitor className="w-3 h-3 text-emerald-500" />
                            {t('exams.deviceType') || 'الجهاز والمتصفح'}
                          </span>
                          <span className="font-extrabold text-brand-text-primary dark:text-white block truncate">
                            {sub.deviceInfo?.deviceType || 'Desktop'} ({sub.deviceInfo?.browserName || 'Browser'})
                          </span>
                          <span className="text-[10px] text-slate-400 block">{sub.deviceInfo?.operatingSystem || ''}</span>
                        </div>

                        {/* Leave Count & Timezone */}
                        <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                          <span className="text-[10px] font-bold text-slate-400 block mb-0.5 flex items-center gap-1">
                            <Globe className="w-3 h-3 text-amber-500" />
                            {t('exams.leavesCount') || 'عدد المغادرات والمنطقة'}
                          </span>
                          <span className="font-extrabold text-rose-600 dark:text-rose-400 block">
                            {sub.leaveCount ?? sub.deviceInfo?.leaveCount ?? 0} {t('exams.leavesCount') || 'مرة مغادرة'}
                          </span>
                          <span className="text-[10px] text-slate-400 block truncate">{sub.deviceInfo?.timezone || ''}</span>
                        </div>
                      </div>
                    </div>

                    {/* Violations */}
                    {violationList.length > 0 && (
                      <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 rounded-xl p-4 space-y-2">
                        <h5 className="font-extrabold text-xs text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                          <AlertTriangle size={14} />
                          {t('exams.violationsTitle')} ({violationList.length})
                        </h5>
                        <div className="space-y-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
                          {violationList.map((v: any, i: number) => (
                            <div key={i} className="flex justify-between items-center py-1 border-b border-rose-100 dark:border-rose-800/30 last:border-0">
                              <span>{formatViolationType(v.type, t)}</span>
                              <span className="text-rose-400 text-[10px]">
                                {new Date(v.occurredAt).toLocaleTimeString(isRTL ? 'ar-EG' : 'en-US')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Answers Review */}
                    <div className="space-y-3">
                      <h5 className="font-extrabold text-xs text-brand-text-primary dark:text-white flex items-center gap-1.5">
                        <Eye size={14} className="text-brand-primary-500" />
                        {t('exams.answersReview')}
                      </h5>

                      {questions.map((q, idx) => {
                        const studentAnswer = normalizedAnswers[String(q.id)];
                        const isCorrect = checkAnswerIsCorrect(q, studentAnswer);
                        const studentText = getStudentAnswerText(q, studentAnswer, t);
                        const modelText = getModelAnswerText(q, t);

                        return (
                          <div
                            key={q.id || idx}
                            className={`p-4 rounded-xl border text-xs space-y-2 ${
                              isCorrect
                                ? 'bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-800/40'
                                : studentAnswer
                                ? 'bg-rose-50/50 dark:bg-rose-950/10 border-rose-200 dark:border-rose-800/40'
                                : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-black text-brand-text-primary dark:text-white">
                                {t('exams.questionNumber', { num: idx + 1 })}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-500">{q.points || 1} {t('exams.pointsUnit')}</span>
                                {isCorrect ? (
                                  <CheckCircle2 size={14} className="text-emerald-500" />
                                ) : studentAnswer ? (
                                  <AlertCircle size={14} className="text-rose-500" />
                                ) : (
                                  <span className="text-slate-400 font-bold">—</span>
                                )}
                              </div>
                            </div>

                            <p className="font-bold text-brand-text-primary dark:text-white">{q.text}</p>

                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <div className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                                <span className="text-[10px] text-slate-400 font-bold block">{t('exams.studentAnswer')}</span>
                                <span className={`font-bold block truncate ${isCorrect ? 'text-emerald-600' : studentAnswer ? 'text-rose-600' : 'text-slate-400'}`}>
                                  {studentText || t('exams.noAnswer')}
                                </span>
                              </div>
                              <div className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                                <span className="text-[10px] text-slate-400 font-bold block">{t('exams.correctAnswerLabel')}</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400 block truncate">{modelText}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Grading Section */}
                    <div className="flex items-center gap-4 pt-3 border-t border-slate-200 dark:border-slate-700">
                      {isGrading ? (
                        <div className="flex items-center gap-3 w-full">
                          <input
                            type="number"
                            value={gradeValue}
                            onChange={(e) => setGradeValue(e.target.value)}
                            placeholder={t('exams.enterScore')}
                            min={0}
                            max={maxScore}
                            className="h-10 px-4 w-32 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-brand-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20"
                          />
                          <span className="text-xs font-bold text-slate-400">/ {maxScore}</span>
                          <Button
                            size="sm"
                            onClick={() => handleSaveGrade(sub.id)}
                            disabled={savingGrade}
                            className="!bg-brand-primary-500 hover:!bg-brand-primary-600 text-white font-extrabold px-4 h-10 rounded-xl flex items-center gap-2 border-none"
                          >
                            {savingGrade ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                            {t('exams.saveGrade')}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setGradingId(null); setGradeValue(''); }}>
                            {t('common.cancel')}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => {
                            setGradingId(sub.id);
                            setGradeValue(sub.score ?? '');
                          }}
                          className="!bg-brand-primary-500 hover:!bg-brand-primary-600 text-white font-extrabold px-4 h-10 rounded-xl flex items-center gap-2 border-none"
                        >
                          <Award size={14} />
                          {isGraded ? t('exams.updateGrade') : t('exams.assignGrade')}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ExamSubmissions;
