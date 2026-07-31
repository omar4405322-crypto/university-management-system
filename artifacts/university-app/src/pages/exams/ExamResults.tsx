// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Award,
  TrendingUp,
  FileText,
  AlertTriangle,
  Clock,
  BarChart3,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import examsService from '../../services/exams.service';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/button';
import {
  normalizeAnswers,
  checkAnswerIsCorrect,
  getStudentAnswerText,
  getModelAnswerText,
  formatViolationType,
  getExamLabel,
  isExamEnded,
  normalizeMcqCode,
} from './examUtils';

const ExamResults = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isRTL = i18n.language?.startsWith('ar');

  const [exam, setExam] = useState<any>(null);
  const [submission, setSubmission] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchResults();
  }, [id]);

  const fetchResults = async () => {
    try {
      setLoading(true);

      // Fetch exam info, student's submission, AND the questions separately
      const [examRes, subRes] = await Promise.all([
        examsService.getExamById(id),
        examsService.getMyExamSubmission(id),
      ]);

      if (examRes.success) setExam(examRes.data);
      if (subRes.success) {
        setSubmission(subRes.data);
        if (subRes.data.questions && Array.isArray(subRes.data.questions) && subRes.data.questions.length > 0) {
          setQuestions(subRes.data.questions);
        } else {
          // Fallback if needed, though getMyExamSubmission should attach questions now
          const qRes = await examsService.getExamQuestions(id);
          if (qRes.success) setQuestions(Array.isArray(qRes.data) ? qRes.data : []);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || t('exams.loadError'));
    } finally {
      setLoading(false);
    }
  };

  // Normalize the answers from the submission
  const normalizedAnswers = useMemo(() => {
    return normalizeAnswers(submission?.answers);
  }, [submission]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (!submission || questions.length === 0)
      return { score: 0, maxScore: 0, percent: 0, correct: 0, wrong: 0, unanswered: 0, grade: '-' };

    const maxScore = submission.maxScore || questions.reduce((sum, q) => sum + (Number(q.points) || 1), 0);
    const score = submission.score != null ? Number(submission.score) : 0;
    const percent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

    let correct = 0;
    let wrong = 0;
    let unanswered = 0;

    questions.forEach((q) => {
      const answer = normalizedAnswers[String(q.id)];
      if (!answer) {
        unanswered++;
      } else if (checkAnswerIsCorrect(q, answer)) {
        correct++;
      } else {
        wrong++;
      }
    });

    let grade = '-';
    if (percent >= 90) grade = 'A';
    else if (percent >= 80) grade = 'B+';
    else if (percent >= 70) grade = 'B';
    else if (percent >= 60) grade = 'C';
    else if (percent >= 50) grade = 'D';
    else grade = 'F';

    return { score, maxScore, percent, correct, wrong, unanswered, grade };
  }, [submission, questions, normalizedAnswers]);

  const violations = submission?.violations || [];

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
          <ArrowLeft size={18} className="rtl:-scale-x-100 me-2" /> {t('exams.backToExams')}
        </Button>
      </div>
    );
  }

  const isTeacher = ['ADMIN', 'DOCTOR', 'SUPER_ADMIN'].includes(user?.role || '');
  const hasExamEnded = isExamEnded(exam);
  const showFullResults = isTeacher || hasExamEnded;

  return (
    <div className="section-gap animate-page space-y-6 max-w-5xl mx-auto">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/exams')}
            className="p-3 rounded-xl text-slate-400 hover:text-brand-primary-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all shrink-0"
          >
            <ArrowLeft size={22} className="rtl:-scale-x-100" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-brand-text-primary dark:text-white">
              {t('exams.resultsTitle')}
            </h1>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
              {exam?.course?.name && `${getExamLabel(exam.type, t)} — ${exam.course.name} (${exam.course?.courseCode || ''})`}
            </p>
          </div>
        </div>
      </div>

      {/* ── Time-Gated Result Restriction for Students ───────────────────── */}
      {!showFullResults ? (
        <Card className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-lg p-8 text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center mx-auto shadow-inner">
            <Clock size={40} className="animate-pulse" />
          </div>

          <div className="max-w-md mx-auto space-y-2">
            <h2 className="text-2xl font-black text-brand-text-primary dark:text-white">
              {t('exams.resultsPendingTitle')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
              {t('exams.resultsPendingDesc', { time: exam?.endTime || '' })}
            </p>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-700 inline-block text-xs font-bold text-slate-600 dark:text-slate-300">
            {t('exams.resultsAvailableAt', { time: exam?.endTime || '' })}
          </div>

          <div className="pt-4">
            <Button onClick={() => navigate('/exams')} className="font-extrabold px-8 h-11 rounded-xl">
              {t('exams.backToExams')}
            </Button>
          </div>
        </Card>
      ) : (
        <>

      {/* ── Score Card ──────────────────────────────────────────────────── */}
      <Card className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="bg-gradient-to-r from-brand-primary-500 via-brand-primary-600 to-brand-primary-700 p-8 text-white">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-start">
              <p className="text-sm font-bold text-white/70 uppercase tracking-widest mb-2">
                {t('exams.finalScore')}
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-6xl font-black">{stats.score}</span>
                <span className="text-2xl font-bold text-white/50">/ {stats.maxScore}</span>
              </div>
            </div>

            <div className="flex items-center gap-6">
              {/* Score Percentage Ring */}
              <div className="relative w-24 h-24">
                <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="rgba(255,255,255,0.15)"
                    strokeWidth="3"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="white"
                    strokeWidth="3"
                    strokeDasharray={`${stats.percent}, 100`}
                    strokeLinecap="round"
                    className="transition-all duration-1000"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center font-black text-lg">
                  {stats.percent}%
                </span>
              </div>

              {/* Grade Badge */}
              <div className="text-center">
                <p className="text-xs font-bold text-white/60 uppercase tracking-wider mb-1">{t('exams.grade')}</p>
                <span className={`text-4xl font-black px-5 py-2 rounded-2xl inline-block ${
                  stats.grade === 'A' ? 'bg-emerald-400/20' :
                  stats.grade === 'B+' || stats.grade === 'B' ? 'bg-blue-400/20' :
                  stats.grade === 'C' ? 'bg-amber-400/20' :
                  stats.grade === 'D' ? 'bg-orange-400/20' :
                  'bg-rose-400/20'
                }`}>
                  {stats.grade}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Mini Stats */}
        <div className="grid grid-cols-3 divide-x rtl:divide-x-reverse divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800">
          <div className="p-4 text-center">
            <span className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
              <CheckCircle2 size={12} className="text-emerald-500" />
              {t('exams.correctCount')}
            </span>
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">{stats.correct}</span>
          </div>
          <div className="p-4 text-center">
            <span className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
              <AlertCircle size={12} className="text-rose-500" />
              {t('exams.wrongCount')}
            </span>
            <span className="text-xl font-black text-rose-600 dark:text-rose-400">{stats.wrong}</span>
          </div>
          <div className="p-4 text-center">
            <span className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
              <Clock size={12} className="text-slate-400" />
              {t('exams.skippedCount')}
            </span>
            <span className="text-xl font-black text-slate-500">{stats.unanswered}</span>
          </div>
        </div>
      </Card>

      {/* ── Violations (if any) ─────────────────────────────────────────── */}
      {violations.length > 0 && (
        <Card className="bg-rose-50 dark:bg-rose-950/20 rounded-2xl border border-rose-200 dark:border-rose-800/40 p-5 space-y-3">
          <h3 className="font-extrabold text-sm text-rose-700 dark:text-rose-400 flex items-center gap-2">
            <AlertTriangle size={18} />
            {t('exams.violationsTitle')} ({violations.length})
          </h3>
          <div className="space-y-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
            {violations.map((v: any, i: number) => (
              <div key={i} className="flex justify-between items-center py-1.5 border-b border-rose-100 dark:border-rose-800/30 last:border-0">
                <span>{formatViolationType(v.type, t)}</span>
                <span className="text-rose-400 text-[10px]">
                  {new Date(v.occurredAt).toLocaleTimeString(isRTL ? 'ar-EG' : 'en-US')}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Question-by-Question Review ─────────────────────────────────── */}
      <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 space-y-5">
        <h3 className="font-extrabold text-lg text-brand-text-primary dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-4">
          <BarChart3 size={20} className="text-brand-primary-500" />
          {t('exams.detailedReview')}
        </h3>

        <div className="space-y-4">
          {questions.map((q, idx) => {
            const studentAnswer = normalizedAnswers[String(q.id)];
            const isCorrect = checkAnswerIsCorrect(q, studentAnswer);
            const studentText = getStudentAnswerText(q, studentAnswer, t);
            const modelText = getModelAnswerText(q, t);

            return (
              <div
                key={q.id || idx}
                className={`p-5 rounded-2xl border space-y-3 transition-all ${
                  isCorrect
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-800/40'
                    : studentAnswer
                    ? 'bg-rose-50/50 dark:bg-rose-950/10 border-rose-200 dark:border-rose-800/40'
                    : 'bg-slate-50/80 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700'
                }`}
              >
                {/* Question Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="font-black text-xs text-white bg-brand-primary-500 px-2.5 py-0.5 rounded-lg">
                      {t('exams.questionNumber', { num: idx + 1 })}
                    </span>
                    <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                      {q.type === 'MCQ'
                        ? t('exams.mcq')
                        : q.type === 'TRUE_FALSE'
                        ? t('exams.trueFalse')
                        : t('exams.shortAnswer')}
                    </span>
                    <span className="text-xs font-bold text-slate-400">
                      {q.points || 1} {t('exams.pointsUnit')}
                    </span>
                  </div>
                  {isCorrect ? (
                    <CheckCircle2 size={20} className="text-emerald-500" />
                  ) : studentAnswer ? (
                    <AlertCircle size={20} className="text-rose-500" />
                  ) : (
                    <span className="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                      {t('exams.skipped')}
                    </span>
                  )}
                </div>

                {/* Question Text */}
                <p className="font-extrabold text-sm text-brand-text-primary dark:text-white leading-relaxed">
                  {q.text}
                </p>

                {/* MCQ Options Display */}
                {q.optionA && (
                  <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                    {['optionA', 'optionB', 'optionC', 'optionD'].map((optKey, i) => {
                      const code = ['A', 'B', 'C', 'D'][i];
                      const val = q[optKey];
                      if (!val) return null;
                      const correctCode = normalizeMcqCode(q.correctAnswer, q);
                      const studentCode = normalizeMcqCode(studentAnswer, q);
                      const isAnswer = correctCode === code;
                      const studentPickedThis = studentCode === code;
                      return (
                        <div
                          key={optKey}
                          className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                            isAnswer
                              ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                              : studentPickedThis && !isAnswer
                              ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 line-through'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          <span className="font-bold">{code}.</span>
                          <span className="truncate">{val}</span>
                          {isAnswer && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 ms-auto shrink-0" />}
                          {studentPickedThis && !isAnswer && <AlertCircle className="w-3.5 h-3.5 text-rose-500 ms-auto shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Answer Comparison (for T/F and Short Answer) */}
                {!q.optionA && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] text-slate-400 font-bold block mb-1">{t('exams.yourAnswer')}</span>
                      <span className={`text-xs font-bold block ${isCorrect ? 'text-emerald-600' : studentAnswer ? 'text-rose-600' : 'text-slate-400 italic'}`}>
                        {studentText || t('exams.noAnswer')}
                      </span>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] text-slate-400 font-bold block mb-1">{t('exams.correctAnswerLabel')}</span>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block">{modelText}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div className="text-center pb-8">
        <Button
          variant="outline"
          onClick={() => navigate('/exams')}
          className="font-extrabold px-8 h-12 rounded-xl gap-2"
        >
          <ArrowLeft size={18} className="rtl:-scale-x-100" />
        </Button>
      </div>
        </>
      )}
    </div>
  );
};

export default ExamResults;
