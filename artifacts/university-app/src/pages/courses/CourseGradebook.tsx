import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  GraduationCap,
  Save,
  RotateCcw,
  Search,
  AlertCircle,
  CheckCircle2,
  Lock,
  Sparkles,
  Info,
  Calendar,
  Send,
  Edit3,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { hasCapability } from '../../config/capabilities';
import Modal from '../../components/ui/Modal';
import {
  gradebookService,
  mapGradebookError,
  validateGradeScore,
  validateCorrectionReason,
  extractChangedDraftEntries,
  MAX_DECIMAL_PLACES,
  MIN_CORRECTION_REASON_LENGTH,
  MAX_CORRECTION_REASON_LENGTH,
} from '../../services/gradebook.service';
import coursesService from '../../services/courses.service';
import type {
  GradebookData,
  GradebookStudent,
  GradebookComponent,
  GradebookCell,
  CellEditState,
  PublishGradebookResult,
  CorrectGradebookResult,
  GradeCorrectionEntry,
} from '../../types/gradebook';
import type { CourseDetailsData } from './types';
import Button from '../../components/ui/button';
import Badge from '../../components/ui/badge';
import LoadingState from '../../components/ui/LoadingState';
import api from '../../services/api';

interface AcademicTermOption {
  id: number;
  name: string;
  isCurrent: boolean;
}

const CourseGradebook: React.FC = () => {
  const { courseId, id } = useParams<{ courseId?: string; id?: string }>();
  const activeCourseId = courseId || id;
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();

  // Role permissions
  const isDoctor = useMemo(() => user?.role === 'DOCTOR', [user?.role]);
  const canEdit = useMemo(() => {
    return user?.role === 'DOCTOR' || user?.role === 'TEACHING_ASSISTANT';
  }, [user?.role]);
  const canEditStructure = useMemo(
    () => hasCapability(user?.role, 'gradeStructure.edit'),
    [user?.role]
  );

  // Component State
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [gradebook, setGradebook] = useState<GradebookData | null>(null);
  const [course, setCourse] = useState<CourseDetailsData | null>(null);
  const [availableTerms, setAvailableTerms] = useState<AcademicTermOption[]>([]);
  const [selectedTermId, setSelectedTermId] = useState<number | null>(null);

  // Search filter
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Cell Edits: key = `${enrollmentId}:${componentId}`
  const [cellEdits, setCellEdits] = useState<Record<string, CellEditState>>({});

  // Error States
  const [pageError, setPageError] = useState<{
    status?: number;
    titleKey: string;
    descKey: string;
    rawMessage?: string;
  } | null>(null);

  // Optimistic Lock conflict banner
  const [optimisticConflict, setOptimisticConflict] = useState<boolean>(false);

  // ── Publish State ──
  const [isPublishModalOpen, setIsPublishModalOpen] = useState<boolean>(false);
  const [publishing, setPublishing] = useState<boolean>(false);
  const [publishResult, setPublishResult] = useState<PublishGradebookResult | null>(null);

  // ── Correction State ──
  const [correctionTarget, setCorrectionTarget] = useState<{
    student: GradebookStudent;
    component: GradebookComponent;
    cell: GradebookCell;
  } | null>(null);
  const [correctionScoreInput, setCorrectionScoreInput] = useState<string>('');
  const [correctionIsAbsent, setCorrectionIsAbsent] = useState<boolean>(false);
  const [correctionReason, setCorrectionReason] = useState<string>('');
  const [submittingCorrection, setSubmittingCorrection] = useState<boolean>(false);
  const [correctionResult, setCorrectionResult] = useState<CorrectGradebookResult | null>(null);

  // Fetch available academic terms
  useEffect(() => {
    let mounted = true;
    const fetchTerms = async () => {
      try {
        const res = await api.get('/academic-terms');
        if (mounted && res.data?.success && Array.isArray(res.data.data)) {
          setAvailableTerms(res.data.data);
        }
      } catch {
        // Non-blocking for terms list
      }
    };
    fetchTerms();
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch Course details for header
  useEffect(() => {
    if (!activeCourseId) return;
    let mounted = true;
    const fetchCourse = async () => {
      try {
        const res = await coursesService.getCourseById(String(activeCourseId));
        if (mounted && res.success && res.data) {
          setCourse(res.data);
        }
      } catch {
        // Fallback info from gradebook data
      }
    };
    fetchCourse();
    return () => {
      mounted = false;
    };
  }, [activeCourseId]);

  // Main Gradebook Data Fetcher
  const fetchGradebookData = useCallback(
    async (termIdToFetch?: number | null) => {
      if (!activeCourseId) return;
      setLoading(true);
      setPageError(null);
      setOptimisticConflict(false);

      try {
        const res = await gradebookService.getGradebook(activeCourseId, termIdToFetch ?? undefined);

        if (!res.success) {
          const status = res.status;
          const msg = res.message || '';

          if (status === 403) {
            setPageError({
              status: 403,
              titleKey: 'gradebook.forbiddenTitle',
              descKey: 'gradebook.forbiddenDesc',
              rawMessage: msg,
            });
          } else if (status === 404) {
            setPageError({
              status: 404,
              titleKey: 'gradebook.notFoundTitle',
              descKey: 'gradebook.notFoundDesc',
              rawMessage: msg,
            });
          } else if (status === 409 || msg.includes('Grade structure has not been defined')) {
            setPageError({
              status: 409,
              titleKey: 'gradebook.noStructureTitle',
              descKey: 'gradebook.noStructureDesc',
              rawMessage: msg,
            });
          } else {
            setPageError({
              status,
              titleKey: 'gradebook.errors.generic',
              descKey: 'gradebook.errors.generic',
              rawMessage: msg,
            });
          }
          setGradebook(null);
          return;
        }

        const data = res.data;
        setGradebook(data);
        if (data.termId && !selectedTermId) {
          setSelectedTermId(data.termId);
        }

        // Initialize cell edits state from existing cell values
        const initialEdits: Record<string, CellEditState> = {};
        for (const student of data.students || []) {
          for (const grade of student.grades || []) {
            const key = `${student.enrollmentId}:${grade.componentId}`;
            initialEdits[key] = {
              score: grade.score,
              isAbsent: grade.isAbsent,
              notes: grade.notes,
              inputRaw: grade.score !== null && grade.score !== undefined ? String(grade.score) : '',
              errorKey: null,
            };
          }
        }
        setCellEdits(initialEdits);
      } catch (err: unknown) {
        setPageError({
          titleKey: 'gradebook.errors.generic',
          descKey: 'gradebook.errors.generic',
          rawMessage: String(err),
        });
      } finally {
        setLoading(false);
      }
    },
    [activeCourseId, selectedTermId]
  );

  useEffect(() => {
    fetchGradebookData(selectedTermId);
  }, [fetchGradebookData, selectedTermId]);

  // Handle Term Selector Change
  const handleTermChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTermId = e.target.value ? Number(e.target.value) : null;
    setSelectedTermId(newTermId);
  };

  // Handle Score Input Change
  const handleScoreChange = (
    enrollmentId: number,
    component: GradebookComponent,
    rawVal: string
  ) => {
    const key = `${enrollmentId}:${component.id}`;
    const trimmed = rawVal.trim();

    if (trimmed === '') {
      setCellEdits((prev) => ({
        ...prev,
        [key]: {
          ...(prev[key] || { isAbsent: false }),
          score: null,
          inputRaw: '',
          errorKey: null,
        },
      }));
      return;
    }

    const parsed = Number(trimmed);
    const validation = validateGradeScore(parsed, component.maxPoints, false);

    setCellEdits((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || { isAbsent: false }),
        score: validation.valid ? parsed : null,
        inputRaw: rawVal,
        errorKey: validation.valid ? null : validation.errorKey,
      },
    }));
  };

  // Handle Absent (ABS) Toggle
  const handleAbsentToggle = (enrollmentId: number, componentId: number) => {
    const key = `${enrollmentId}:${componentId}`;
    setCellEdits((prev) => {
      const current = prev[key] || { score: null, isAbsent: false, inputRaw: '' };
      const nextAbsent = !current.isAbsent;
      return {
        ...prev,
        [key]: {
          ...current,
          isAbsent: nextAbsent,
          score: nextAbsent ? null : current.score,
          inputRaw: nextAbsent ? '' : current.inputRaw,
          errorKey: null,
        },
      };
    });
  };

  // Collect flat original cells for changed cells diffing
  const allOriginalCells = useMemo(() => {
    if (!gradebook?.students) return [];
    return gradebook.students.flatMap((s) =>
      s.grades.map((g) => ({
        enrollmentId: s.enrollmentId,
        componentId: g.componentId,
        score: g.score,
        isAbsent: g.isAbsent,
        version: g.version,
        source: g.source,
        notes: g.notes,
      }))
    );
  }, [gradebook]);

  // Changed cells calculation
  const changedEntries = useMemo(() => {
    return extractChangedDraftEntries(allOriginalCells, cellEdits);
  }, [allOriginalCells, cellEdits]);

  // Has any validation error in current edits
  const hasValidationErrors = useMemo(() => {
    return Object.values(cellEdits).some((edit) => Boolean(edit.errorKey));
  }, [cellEdits]);

  // Can Save button be enabled?
  const isSaveEnabled = canEdit && changedEntries.length > 0 && !hasValidationErrors && !saving;

  // Save Draft Handler
  const handleSaveDraft = async () => {
    if (!activeCourseId || !isSaveEnabled) return;
    setSaving(true);
    setOptimisticConflict(false);

    try {
      const res = await gradebookService.saveGradebookDraft(
        activeCourseId,
        changedEntries,
        selectedTermId ?? undefined
      );

      if (!res.success) {
        const errorKey = mapGradebookError(res.message, res.status);
        if (
          res.status === 409 &&
          (res.message?.includes('Optimistic lock') ||
            res.message?.includes('version') ||
            res.message?.toLowerCase().includes('conflict'))
        ) {
          setOptimisticConflict(true);
        }
        showToast(t(errorKey, res.message || 'Failed to save gradebook draft'), 'error');
        return;
      }

      showToast(t('gradebook.savedSuccess', 'Gradebook draft saved successfully.'), 'success');
      await fetchGradebookData(selectedTermId);
    } catch {
      showToast(t('gradebook.errors.generic', 'Failed to save gradebook draft'), 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Publish Handlers (Doctor ONLY, double-click protected) ──
  const handleConfirmPublish = async () => {
    if (!activeCourseId || publishing) return;
    setPublishing(true);
    setOptimisticConflict(false);

    try {
      const res = await gradebookService.publishGradebook(
        activeCourseId,
        selectedTermId ?? undefined
      );

      if (!res.success) {
        const errorKey = mapGradebookError(res.message, res.status);
        if (
          res.status === 409 &&
          (res.message?.includes('Optimistic lock') ||
            res.message?.includes('version') ||
            res.message?.toLowerCase().includes('conflict'))
        ) {
          setOptimisticConflict(true);
        }
        showToast(t(errorKey, res.message || 'Failed to publish gradebook'), 'error');
        setIsPublishModalOpen(false);
        return;
      }

      setIsPublishModalOpen(false);
      setPublishResult(res.data);
      showToast(t('gradebook.publishSuccess', 'Gradebook published successfully.'), 'success');
      await fetchGradebookData(selectedTermId);
    } catch {
      showToast(t('gradebook.errors.generic', 'Failed to publish gradebook'), 'error');
      setIsPublishModalOpen(false);
    } finally {
      setPublishing(false);
    }
  };

  // ── Correction Handlers (Doctor ONLY, PUBLISHED MANUAL cells) ──
  const handleOpenCorrection = (
    student: GradebookStudent,
    component: GradebookComponent,
    cell: GradebookCell
  ) => {
    setCorrectionTarget({ student, component, cell });
    setCorrectionScoreInput(
      cell.score !== null && cell.score !== undefined ? String(cell.score) : ''
    );
    setCorrectionIsAbsent(Boolean(cell.isAbsent));
    setCorrectionReason('');
  };

  const correctionReasonValidation = useMemo(() => {
    return validateCorrectionReason(correctionReason);
  }, [correctionReason]);

  const correctionScoreValidation = useMemo(() => {
    if (correctionIsAbsent) return { valid: true, errorKey: null };
    const trimmed = correctionScoreInput.trim();
    if (trimmed === '') return { valid: false, errorKey: 'gradebook.validation.invalidNumber' };
    const parsed = Number(trimmed);
    const maxPoints = correctionTarget?.component.maxPoints ?? 100;
    return validateGradeScore(parsed, maxPoints, false);
  }, [correctionIsAbsent, correctionScoreInput, correctionTarget?.component.maxPoints]);

  const isCorrectionSubmitEnabled =
    !submittingCorrection &&
    correctionReasonValidation.valid &&
    correctionScoreValidation.valid;

  const handleConfirmCorrection = async () => {
    if (!activeCourseId || !correctionTarget || !isCorrectionSubmitEnabled || submittingCorrection) return;
    setSubmittingCorrection(true);
    setOptimisticConflict(false);

    try {
      const parsedScore = correctionIsAbsent ? null : Number(correctionScoreInput.trim());
      const correctionEntry: GradeCorrectionEntry = {
        enrollmentId: correctionTarget.student.enrollmentId,
        componentId: correctionTarget.component.id,
        score: parsedScore,
        isAbsent: correctionIsAbsent,
        version: correctionTarget.cell.version ?? 0,
        reason: correctionReason.trim(),
      };

      const res = await gradebookService.correctGradebook(
        activeCourseId,
        [correctionEntry],
        selectedTermId ?? undefined
      );

      if (!res.success) {
        const errorKey = mapGradebookError(res.message, res.status);
        if (
          res.status === 409 &&
          (res.message?.includes('Optimistic lock') ||
            res.message?.includes('version') ||
            res.message?.toLowerCase().includes('conflict'))
        ) {
          setOptimisticConflict(true);
        }
        showToast(t(errorKey, res.message || 'Failed to correct grade'), 'error');
        setCorrectionTarget(null);
        return;
      }

      setCorrectionTarget(null);
      setCorrectionResult(res.data);
      showToast(t('gradebook.correctionSuccess', 'Grade corrected successfully.'), 'success');
      await fetchGradebookData(selectedTermId);
    } catch {
      showToast(t('gradebook.errors.generic', 'Failed to correct grade'), 'error');
      setCorrectionTarget(null);
    } finally {
      setSubmittingCorrection(false);
    }
  };

  // Filtered students by search query
  const filteredStudents = useMemo(() => {
    if (!gradebook?.students) return [];
    if (!searchQuery.trim()) return gradebook.students;
    const q = searchQuery.toLowerCase().trim();
    return gradebook.students.filter((s: GradebookStudent) => {
      const fullName = `${s.firstName} ${s.lastName}`.toLowerCase();
      const code = (s.studentIdCode || '').toLowerCase();
      return fullName.includes(q) || code.includes(q);
    });
  }, [gradebook?.students, searchQuery]);

  // Back Navigation
  const handleBack = () => {
    if (activeCourseId) {
      navigate(`/courses/${activeCourseId}`);
    } else {
      navigate('/courses');
    }
  };

  // ── Render Error Screen (403, 404, 409 missing structure, generic) ──
  if (pageError) {
    return (
      <div
        data-gradebook-error="true"
        className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300"
      >
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-brand-text-primary dark:text-brand-text-main mb-2">
          {t(pageError.titleKey, 'Gradebook Unavailable')}
        </h2>
        <p className="text-sm text-brand-text-secondary dark:text-brand-text-sub max-w-md mb-6 font-medium">
          {t(pageError.descKey, pageError.rawMessage || 'The requested gradebook could not be loaded.')}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            data-back-button="true"
            onClick={handleBack}
            variant="outline"
            size="default"
            className="rounded-xl flex items-center gap-2"
          >
            <ArrowLeft size={16} />
            <span>{t('gradebook.back', 'Back to Course')}</span>
          </Button>
          {pageError.status === 409 && canEditStructure && (
            <Button
              type="button"
              data-configure-structure="true"
              data-grade-structure-link="true"
              onClick={() => navigate(`/courses/${activeCourseId}/grade-structure`)}
              variant="default"
              size="default"
              className="rounded-xl flex items-center gap-2"
            >
              <span>{t('gradeStructure.configureButton', 'Configure Grade Structure')}</span>
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── Loading Screen ──
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoadingState message={t('common.loading', 'Loading...')} />
      </div>
    );
  }

  const structure = gradebook?.structure;
  const components = structure?.components || [];

  return (
    <div className="space-y-6 max-w-full overflow-hidden animate-in fade-in duration-300 pb-12">
      {/* ── Top Header & Actions ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-border/60 pb-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            data-back-button="true"
            onClick={handleBack}
            className="p-2.5 rounded-xl border border-brand-border hover:bg-surface-subtle transition-colors text-brand-text-sub"
            title={t('gradebook.back', 'Back to Course')}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-brand-primary-500/10 text-brand-primary-600 dark:text-brand-primary-400">
                <GraduationCap size={18} />
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-brand-text-primary dark:text-brand-text-main">
                {t('gradebook.title', 'Course Gradebook')}
              </h1>
              {course?.courseCode && (
                <Badge variant="primary" className="text-xs font-bold uppercase">
                  {course.courseCode}
                </Badge>
              )}
            </div>
            <p className="text-xs text-brand-text-secondary dark:text-brand-text-sub font-medium mt-1">
              {course?.name || t('gradebook.subtitle', 'Record, review, and manage student course marks.')}
            </p>
          </div>
        </div>

        {/* Header Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Term Selector */}
          <div className="flex items-center gap-2 bg-surface-card border border-brand-border/70 rounded-xl px-3 py-1.5 shadow-xs">
            <Calendar size={14} className="text-brand-text-sub" />
            <label htmlFor="gradebook-term-select" className="sr-only">
              {t('gradebook.termSelectLabel', 'Academic Term')}
            </label>
            <select
              id="gradebook-term-select"
              aria-label={t('gradebook.termSelectLabel', 'Academic Term')}
              value={selectedTermId ?? ''}
              onChange={handleTermChange}
              className="bg-transparent text-xs font-bold text-brand-text-primary dark:text-brand-text-main focus:outline-hidden cursor-pointer"
            >
              {availableTerms.map((term) => (
                <option key={term.id} value={term.id} className="dark:bg-brand-navy-900">
                  {term.name} {term.isCurrent ? '(Active)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Read-Only Badge for Admins */}
          {!canEdit && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-subtle border border-brand-border/70 text-xs font-bold text-brand-text-sub">
              <Lock size={14} />
              <span>{t('gradebook.readOnlyBanner', 'Read-Only Mode')}</span>
            </div>
          )}

          {/* Publish Gradebook Button (Doctor ONLY, disabled when unsaved drafts exist or publishing) */}
          {isDoctor && (
            <div className="relative">
              <Button
                type="button"
                data-publish-button="true"
                disabled={changedEntries.length > 0 || publishing}
                onClick={() => setIsPublishModalOpen(true)}
                variant="outline"
                size="default"
                title={
                  changedEntries.length > 0
                    ? t('gradebook.unsavedDraftWarning', 'Save or discard unsaved draft changes before publishing.')
                    : undefined
                }
                className="rounded-xl flex items-center gap-2 border-brand-primary-500/50 text-brand-primary-600 dark:text-brand-primary-400 hover:bg-brand-primary-500/10 shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={15} />
                <span>
                  {publishing
                    ? t('gradebook.publishing', 'Publishing...')
                    : t('gradebook.publish', 'Publish Gradebook')}
                </span>
              </Button>
            </div>
          )}

          {/* Save Draft Button (Doctor and TA only) */}
          {canEdit && (
            <Button
              type="button"
              data-save-draft="true"
              disabled={!isSaveEnabled}
              onClick={handleSaveDraft}
              variant="default"
              size="default"
              className="rounded-xl flex items-center gap-2 shadow-xs transition-all"
            >
              <Save size={16} />
              <span>
                {saving
                  ? t('gradebook.saving', 'Saving...')
                  : t('gradebook.saveDraft', 'Save Draft')}
              </span>
              {changedEntries.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-white/25 text-[10px] font-black">
                  {changedEntries.length}
                </span>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* ── Optimistic Lock Failure Banner ── */}
      {optimisticConflict && (
        <div data-optimistic-banner="true" className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 dark:text-amber-300">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs sm:text-sm font-semibold">
              {t(
                'gradebook.optimisticLockBanner',
                'Another instructor updated the gradebook. Your current edits have been kept. Please review or reload latest data.'
              )}
            </p>
          </div>
          <Button
            type="button"
            data-reload-latest="true"
            variant="outline"
            size="sm"
            onClick={() => fetchGradebookData(selectedTermId)}
            className="rounded-xl flex items-center gap-1.5 shrink-0"
          >
            <RotateCcw size={14} />
            <span>{t('gradebook.reloadLatest', 'Reload Latest')}</span>
          </Button>
        </div>
      )}

      {/* ── Pass Mark Null Notice Banner ── */}
      {structure && structure.passMark === null && (
        <div className="bg-brand-primary-500/10 border border-brand-primary-500/25 rounded-2xl p-3.5 flex items-center gap-3 text-brand-primary-900 dark:text-brand-primary-300 text-xs font-semibold">
          <Info size={18} className="text-brand-primary-600 dark:text-brand-primary-400 shrink-0" />
          <span>
            {t(
              'gradebook.passMarkNotSet',
              'Informational: Pass mark has not been set for this course grade structure.'
            )}
          </span>
        </div>
      )}

      {/* ── Structure Summary Ribbon & Client-side Search ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Structure Metrics */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-3 py-1.5 rounded-xl bg-surface-card border border-brand-border text-xs font-bold text-brand-text-sub flex items-center gap-1.5">
            <span className="text-brand-text-muted">{t('gradebook.totalPointsLabel', 'Total Points')}:</span>
            <span className="text-brand-text-primary dark:text-brand-text-main font-black">
              {structure?.totalPoints ?? 100}
            </span>
          </div>

          {structure?.passMark !== null && structure?.passMark !== undefined && (
            <div className="px-3 py-1.5 rounded-xl bg-surface-card border border-brand-border text-xs font-bold text-brand-text-sub flex items-center gap-1.5">
              <span className="text-brand-text-muted">{t('gradebook.passMarkLabel', 'Pass Mark')}:</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-black">
                {structure.passMark}
              </span>
            </div>
          )}

          <div className="px-3 py-1.5 rounded-xl bg-surface-card border border-brand-border text-xs font-bold text-brand-text-sub flex items-center gap-1.5">
            <span className="text-brand-text-muted">{t('courses.students', 'Students')}:</span>
            <span className="text-brand-text-primary dark:text-brand-text-main font-black">
              {gradebook?.students?.length ?? 0}
            </span>
          </div>
        </div>

        {/* Client-side Search Toolbar */}
        <div className="relative w-full md:w-80">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-muted rtl:left-auto rtl:right-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('gradebook.searchPlaceholder', 'Search students by name or academic ID...')}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-brand-border bg-surface-card text-xs text-brand-text-primary dark:text-brand-text-main focus:outline-hidden focus:border-brand-primary-500 rtl:pl-3 rtl:pr-9"
          />
        </div>
      </div>

      {/* ── Gradebook Table Container with Sticky Column & Header ── */}
      <div data-table-container="true" className="bg-surface-card rounded-2xl border border-brand-border shadow-xs overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[68vh] relative">
          <table className="w-full text-left border-collapse rtl:text-right">
            {/* Sticky Header */}
            <thead className="sticky top-0 bg-surface-card/95 backdrop-blur-md z-20 border-b border-brand-border shadow-2xs">
              <tr>
                {/* Sticky Student Column Header */}
                <th
                  scope="col"
                  className="sticky left-0 bg-surface-card z-20 p-3.5 text-xs font-black text-brand-text-sub uppercase tracking-wider min-w-[220px] max-w-[280px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] rtl:left-auto rtl:right-0 rtl:shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.08)]"
                >
                  {t('gradebook.studentColumn', 'Student')}
                </th>

                {/* Dynamic Component Headers */}
                {components.map((comp: GradebookComponent) => (
                  <th
                    key={comp.id}
                    scope="col"
                    className="p-3.5 text-xs font-bold text-brand-text-sub min-w-[150px] whitespace-nowrap border-l border-brand-border/40 rtl:border-l-0 rtl:border-r"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-black text-brand-text-primary dark:text-brand-text-main truncate">
                        {comp.name}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-surface-subtle text-brand-text-muted">
                        /{comp.maxPoints}
                      </span>
                    </div>
                    <div className="mt-1">
                      {comp.source !== 'MANUAL' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-brand-primary-600 dark:text-brand-primary-400 bg-brand-primary-500/10 px-2 py-0.5 rounded-full">
                          <Sparkles size={10} />
                          {t('gradebook.sourceAuto', 'Automatic')}
                        </span>
                      ) : (
                        <span className="text-[10px] text-brand-text-muted font-medium">
                          {t('gradebook.passMarkLabel', 'Manual')}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-brand-border/40">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td
                    colSpan={components.length + 1}
                    className="text-center py-12 text-sm text-brand-text-muted font-semibold"
                  >
                    {searchQuery.trim()
                      ? t('gradebook.noStudentsFound', 'No students matching your search criteria.')
                      : t('gradebook.noStudentsEnrolled', 'No students enrolled in this course.')}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student: GradebookStudent) => {
                  const studentFullName = `${student.firstName} ${student.lastName}`;
                  return (
                    <tr
                      key={student.enrollmentId}
                      data-student-row="true"
                      className="hover:bg-surface-subtle/50 transition-colors group"
                    >
                      {/* Sticky Student Identifier Cell */}
                      <td className="sticky left-0 bg-surface-card group-hover:bg-surface-subtle/80 transition-colors z-10 p-3.5 min-w-[220px] max-w-[280px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] rtl:left-auto rtl:right-0 rtl:shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.08)]">
                        <div className="font-bold text-xs text-brand-text-primary dark:text-brand-text-main truncate" title={studentFullName}>
                          {studentFullName}
                        </div>
                        <div className="text-[11px] font-mono text-brand-text-muted truncate mt-0.5" title={student.studentIdCode}>
                          {student.studentIdCode}
                        </div>
                      </td>

                      {/* Component Cells */}
                      {components.map((comp: GradebookComponent) => {
                        const cellKey = `${student.enrollmentId}:${comp.id}`;
                        const cellData = student.grades.find((g) => g.componentId === comp.id);
                        const isAuto = comp.source !== 'MANUAL';
                        const isPublished = cellData?.status === 'PUBLISHED';
                        const editState = cellEdits[cellKey];

                        // 1. AUTO Component: localized badge, read-only
                        if (isAuto) {
                          const displayScore = cellData?.score ?? cellData?.value;
                          return (
                            <td
                              key={comp.id}
                              className="p-3 text-xs border-l border-brand-border/40 rtl:border-l-0 rtl:border-r"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono font-bold text-brand-text-primary dark:text-brand-text-main">
                                  {displayScore !== null && displayScore !== undefined ? displayScore : '—'}
                                </span>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-primary-500/10 text-brand-primary-600 dark:text-brand-primary-400">
                                  {t('gradebook.sourceAuto', 'Automatic')}
                                </span>
                              </div>
                            </td>
                          );
                        }

                        // 2. PUBLISHED Manual Component: read-only with published badge & Doctor Correct action
                        if (isPublished) {
                          return (
                            <td
                              key={comp.id}
                              className="p-3 text-xs border-l border-brand-border/40 rtl:border-l-0 rtl:border-r"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono font-bold text-brand-text-primary dark:text-brand-text-main">
                                  {cellData?.isAbsent
                                    ? t('gradebook.absent', 'ABS')
                                    : cellData?.score !== null && cellData?.score !== undefined
                                    ? cellData.score
                                    : '—'}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                    <CheckCircle2 size={10} />
                                    {t('gradebook.published', 'Published')}
                                  </span>
                                  {isDoctor && (
                                    <button
                                      type="button"
                                      data-correct-cell="true"
                                      aria-label={t('gradebook.correctCell', 'Correct Mark')}
                                      onClick={() => cellData && handleOpenCorrection(student, comp, cellData)}
                                      className="p-1 rounded-lg border border-brand-border hover:bg-surface-subtle text-brand-text-sub hover:text-brand-primary-600 transition-colors"
                                      title={t('gradebook.correctCell', 'Correct Mark')}
                                    >
                                      <Edit3 size={12} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </td>
                          );
                        }

                        // 3. Read-only for non-editors (e.g. Admins viewing DRAFT cells)
                        if (!canEdit) {
                          return (
                            <td
                              key={comp.id}
                              className="p-3 text-xs border-l border-brand-border/40 rtl:border-l-0 rtl:border-r"
                            >
                              <span className="font-mono font-bold text-brand-text-primary dark:text-brand-text-main">
                                {cellData?.isAbsent
                                  ? t('gradebook.absent', 'ABS')
                                  : cellData?.score !== null && cellData?.score !== undefined
                                  ? cellData.score
                                  : '—'}
                              </span>
                            </td>
                          );
                        }

                        // 4. EDITABLE Manual Component (Doctor/TA): Score input + ABS toggle
                        const isAbsent = Boolean(editState?.isAbsent);
                        const rawInput = editState?.inputRaw ?? '';
                        const hasError = Boolean(editState?.errorKey);

                        return (
                          <td
                            key={comp.id}
                            className="p-2.5 text-xs border-l border-brand-border/40 rtl:border-l-0 rtl:border-r"
                          >
                            <div className="flex items-center gap-1.5">
                              {/* Numeric Score Input */}
                              <input
                                type="number"
                                data-cell-input="true"
                                disabled={isAbsent}
                                step="0.01"
                                min="0"
                                max={comp.maxPoints}
                                value={rawInput}
                                onChange={(e) =>
                                  handleScoreChange(student.enrollmentId, comp, e.target.value)
                                }
                                placeholder="—"
                                className={`w-20 px-2 py-1.5 rounded-lg border font-mono text-xs text-brand-text-primary dark:text-brand-text-main bg-surface-card focus:outline-hidden transition-colors ${
                                  isAbsent
                                    ? 'bg-surface-subtle text-brand-text-muted cursor-not-allowed opacity-60'
                                    : hasError
                                    ? 'border-error ring-1 ring-error/50'
                                    : 'border-brand-border focus:border-brand-primary-500'
                                }`}
                              />

                              {/* ABS Toggle Button */}
                              <button
                                type="button"
                                onClick={() =>
                                  handleAbsentToggle(student.enrollmentId, comp.id)
                                }
                                title={t(
                                  'gradebook.absentTooltip',
                                  'Mark absent (score will be set to null)'
                                )}
                                className={`px-2 py-1.5 rounded-lg font-bold text-[10px] transition-colors border ${
                                  isAbsent
                                    ? 'bg-rose-500 text-white border-rose-600 shadow-xs'
                                    : 'bg-surface-card hover:bg-surface-subtle text-brand-text-sub border-brand-border'
                                }`}
                              >
                                {t('gradebook.absent', 'ABS')}
                              </button>
                            </div>

                            {/* Inline Error Message */}
                            {hasError && editState?.errorKey && (
                              <p className="text-[10px] font-semibold text-error mt-1 leading-tight">
                                {t(editState.errorKey, 'Invalid score')}
                              </p>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Publish Confirmation Modal (Doctor Only) ── */}
      <Modal
        isOpen={isPublishModalOpen}
        onClose={() => !publishing && setIsPublishModalOpen(false)}
        title={t('gradebook.publishModalTitle', 'Publish Course Gradebook')}
        subtitle={t('gradebook.publishModalDesc', 'Publishing will convert all current draft marks into final published marks and calculate student completion status. This action cannot be undone. Do you wish to proceed?')}
        size="sm"
        ariaLabel={t('gradebook.publishModalTitle', 'Publish Course Gradebook')}
      >
        <div data-publish-modal="true" className="p-4 sm:p-6 space-y-4 max-w-full overflow-hidden">
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-900 dark:text-amber-300 text-xs font-medium">
            <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p>
              {t(
                'gradebook.publishModalDesc',
                'Publishing will convert all current draft marks into final published marks and calculate student completion status.'
              )}
            </p>
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              data-publish-cancel="true"
              variant="outline"
              size="default"
              disabled={publishing}
              onClick={() => setIsPublishModalOpen(false)}
              className="rounded-xl"
            >
              {t('gradebook.cancel', 'Cancel')}
            </Button>
            <Button
              type="button"
              data-publish-confirm="true"
              variant="default"
              size="default"
              disabled={publishing}
              onClick={handleConfirmPublish}
              className="rounded-xl flex items-center gap-2"
            >
              <Send size={15} />
              <span>
                {publishing
                  ? t('gradebook.publishing', 'Publishing...')
                  : t('gradebook.confirmPublish', 'Confirm & Publish')}
              </span>
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Publish Result Summary Modal ── */}
      <Modal
        isOpen={Boolean(publishResult)}
        onClose={() => setPublishResult(null)}
        title={t('gradebook.publishSummaryTitle', 'Publication Results')}
        size="sm"
        ariaLabel={t('gradebook.publishSummaryTitle', 'Publication Results')}
      >
        <div data-publish-summary-modal="true" className="p-4 sm:p-6 space-y-4 max-w-full overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div data-publish-complete="true" className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {publishResult?.complete.length ?? 0}
              </div>
              <div className="text-xs font-bold text-brand-text-sub mt-1">
                {t('gradebook.completedCount', 'Completed')}
              </div>
            </div>
            <div data-publish-incomplete="true" className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
                {publishResult?.incomplete.length ?? 0}
              </div>
              <div className="text-xs font-bold text-brand-text-sub mt-1">
                {t('gradebook.incompleteCount', 'Incomplete')}
              </div>
            </div>
            <div data-publish-skipped="true" className="p-3.5 rounded-xl bg-surface-subtle border border-brand-border text-center">
              <div className="text-2xl font-black text-brand-text-muted">
                {publishResult?.skipped.length ?? 0}
              </div>
              <div className="text-xs font-bold text-brand-text-sub mt-1">
                {t('gradebook.skippedCount', 'Skipped')}
              </div>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button
              type="button"
              data-publish-close="true"
              variant="outline"
              size="default"
              onClick={() => setPublishResult(null)}
              className="rounded-xl"
            >
              {t('gradebook.close', 'Close')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Correction Modal (Doctor Only) ── */}
      <Modal
        isOpen={Boolean(correctionTarget)}
        onClose={() => !submittingCorrection && setCorrectionTarget(null)}
        title={t('gradebook.correctModalTitle', 'Correct Published Mark')}
        subtitle={
          correctionTarget
            ? `${correctionTarget.student.firstName} ${correctionTarget.student.lastName} — ${correctionTarget.component.name}`
            : undefined
        }
        size="sm"
        ariaLabel={t('gradebook.correctModalTitle', 'Correct Published Mark')}
      >
        <div data-correction-modal="true" className="p-4 sm:p-6 space-y-4 max-w-full overflow-hidden">
          {/* Current Score Display */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-surface-subtle border border-brand-border text-xs">
            <span className="text-brand-text-muted font-bold">
              {t('gradebook.currentScore', 'Current Score')}:
            </span>
            <span className="font-mono font-black text-brand-text-primary dark:text-brand-text-main">
              {correctionTarget?.cell.isAbsent
                ? t('gradebook.absent', 'ABS')
                : correctionTarget?.cell.score !== null && correctionTarget?.cell.score !== undefined
                ? correctionTarget.cell.score
                : '—'}
              {' '}/ {correctionTarget?.component.maxPoints}
            </span>
          </div>

          {/* New Score / ABS Input */}
          <div className="space-y-1.5">
            <label htmlFor="correction-new-score" className="block text-xs font-bold text-brand-text-sub">
              {t('gradebook.newScore', 'New Score')}
            </label>
            <div className="flex items-center gap-2">
              <input
                id="correction-new-score"
                type="number"
                data-correction-score-input="true"
                disabled={correctionIsAbsent}
                step="0.01"
                min="0"
                max={correctionTarget?.component.maxPoints ?? 100}
                value={correctionScoreInput}
                onChange={(e) => setCorrectionScoreInput(e.target.value)}
                placeholder="0.00"
                className={`flex-1 px-3 py-2 rounded-xl border font-mono text-xs text-brand-text-primary dark:text-brand-text-main bg-surface-card focus:outline-hidden transition-colors ${
                  correctionIsAbsent
                    ? 'bg-surface-subtle text-brand-text-muted cursor-not-allowed opacity-60'
                    : !correctionScoreValidation.valid && !correctionIsAbsent
                    ? 'border-error ring-1 ring-error/50'
                    : 'border-brand-border focus:border-brand-primary-500'
                }`}
              />
              <button
                type="button"
                data-correction-abs-toggle="true"
                onClick={() => {
                  setCorrectionIsAbsent(!correctionIsAbsent);
                  if (!correctionIsAbsent) {
                    setCorrectionScoreInput('');
                  }
                }}
                className={`px-3 py-2 rounded-xl font-bold text-xs transition-colors border ${
                  correctionIsAbsent
                    ? 'bg-rose-500 text-white border-rose-600 shadow-xs'
                    : 'bg-surface-card hover:bg-surface-subtle text-brand-text-sub border-brand-border'
                }`}
              >
                {t('gradebook.absent', 'ABS')}
              </button>
            </div>
            {!correctionIsAbsent && !correctionScoreValidation.valid && correctionScoreValidation.errorKey && (
              <p className="text-[10px] font-semibold text-error leading-tight">
                {t(correctionScoreValidation.errorKey, 'Invalid score')}
              </p>
            )}
          </div>

          {/* Reason Input (Textarea with counter and validation) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="correction-reason" className="block text-xs font-bold text-brand-text-sub">
                {t('gradebook.reasonLabel', 'Correction Reason')}
              </label>
              <span
                className={`text-[10px] font-mono font-bold ${
                  correctionReason.length < MIN_CORRECTION_REASON_LENGTH ||
                  correctionReason.length > MAX_CORRECTION_REASON_LENGTH
                    ? 'text-amber-500'
                    : 'text-brand-text-muted'
                }`}
              >
                {correctionReason.length} / {MAX_CORRECTION_REASON_LENGTH}
              </span>
            </div>
            <textarea
              id="correction-reason"
              data-correction-reason-input="true"
              rows={3}
              value={correctionReason}
              onChange={(e) => setCorrectionReason(e.target.value)}
              placeholder={t('gradebook.reasonPlaceholder', 'Enter justification for this mark adjustment (5-500 characters)...')}
              className={`w-full px-3 py-2 rounded-xl border text-xs text-brand-text-primary dark:text-brand-text-main bg-surface-card focus:outline-hidden transition-colors resize-none ${
                !correctionReasonValidation.valid && correctionReason.length > 0
                  ? 'border-error ring-1 ring-error/50'
                  : 'border-brand-border focus:border-brand-primary-500'
              }`}
            />
            {!correctionReasonValidation.valid && correctionReasonValidation.errorKey && (
              <p data-correction-reason-error="true" className="text-[10px] font-semibold text-error leading-tight">
                {t(correctionReasonValidation.errorKey, 'Reason is invalid')}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              data-correction-cancel="true"
              variant="outline"
              size="default"
              disabled={submittingCorrection}
              onClick={() => setCorrectionTarget(null)}
              className="rounded-xl"
            >
              {t('gradebook.cancel', 'Cancel')}
            </Button>
            <Button
              type="button"
              data-correction-submit="true"
              variant="default"
              size="default"
              disabled={!isCorrectionSubmitEnabled}
              onClick={handleConfirmCorrection}
              className="rounded-xl flex items-center gap-2"
            >
              <Check size={15} />
              <span>
                {submittingCorrection
                  ? t('gradebook.savingCorrection', 'Submitting...')
                  : t('gradebook.saveCorrection', 'Submit Correction')}
              </span>
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Correction Result Summary Modal ── */}
      <Modal
        isOpen={Boolean(correctionResult)}
        onClose={() => setCorrectionResult(null)}
        title={t('gradebook.correctionSummaryTitle', 'Correction Applied')}
        size="sm"
        ariaLabel={t('gradebook.correctionSummaryTitle', 'Correction Applied')}
      >
        <div data-correction-summary-modal="true" className="p-4 sm:p-6 space-y-4 max-w-full overflow-hidden">
          {/* Entries Before & After */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-brand-text-sub uppercase tracking-wider">
              {t('gradebook.currentScore', 'Grade Entries')}
            </h4>
            {correctionResult?.entries.map((entry, idx) => (
              <div
                key={idx}
                data-correction-entry-result="true"
                className="p-3 rounded-xl bg-surface-subtle border border-brand-border space-y-1 text-xs"
              >
                <div className="flex items-center justify-between font-mono">
                  <span className="text-brand-text-muted">
                    {t('gradebook.before', 'Before')}:{' '}
                    <span className="font-bold text-brand-text-primary dark:text-brand-text-main">
                      {entry.before.isAbsent ? t('gradebook.absent', 'ABS') : entry.before.score ?? '—'}
                    </span>
                  </span>
                  <span className="text-brand-text-muted font-bold">→</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                    {t('gradebook.after', 'After')}:{' '}
                    <span>{entry.after.isAbsent ? t('gradebook.absent', 'ABS') : entry.after.score ?? '—'}</span>
                  </span>
                </div>
                <div className="text-[11px] text-brand-text-sub truncate">
                  <span className="text-brand-text-muted">{t('gradebook.reasonLabel', 'Correction Reason')}: </span>
                  {entry.reason}
                </div>
              </div>
            ))}
          </div>

          {/* Enrollment Totals Before & After */}
          {correctionResult?.enrollmentTotals && correctionResult.enrollmentTotals.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-brand-text-sub uppercase tracking-wider">
                {t('gradebook.finalTotal', 'Total Marks')}
              </h4>
              {correctionResult.enrollmentTotals.map((total, idx) => (
                <div
                  key={idx}
                  data-correction-total-result="true"
                  className="p-3 rounded-xl bg-brand-primary-500/10 border border-brand-primary-500/20 space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between font-mono">
                    <span className="text-brand-text-sub">
                      {t('gradebook.before', 'Before')}: {total.before.finalPointsEarned ?? '—'} / {total.before.finalPointsMax ?? '—'} ({total.before.finalGrade ?? '—'}%)
                    </span>
                  </div>
                  <div className="flex items-center justify-between font-mono font-bold text-brand-primary-700 dark:text-brand-primary-300">
                    <span>
                      {t('gradebook.after', 'After')}: {total.after.finalPointsEarned ?? '—'} / {total.after.finalPointsMax ?? '—'} ({total.after.finalGrade ?? '—'}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              data-correction-close="true"
              variant="outline"
              size="default"
              onClick={() => setCorrectionResult(null)}
              className="rounded-xl"
            >
              {t('gradebook.close', 'Close')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CourseGradebook;
