import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Sliders,
  Save,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  Lock,
  Sparkles,
  Calendar,
  GraduationCap,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { hasCapability } from '../../config/capabilities';
import {
  gradebookService,
  mapGradeStructureError,
  validateGradeStructureDraft,
  isGradeStructureDirty,
  buildGradeStructurePutPayload,
  ALLOWED_GRADE_COMPONENT_SOURCES,
  MAX_POINTS_TECHNICAL_CEILING,
  MAX_COMPONENT_NAME_LENGTH,
} from '../../services/gradebook.service';
import coursesService from '../../services/courses.service';
import type {
  GradeStructureData,
  GradeStructureRowDraft,
  GradeComponentSource,
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

const CourseGradeStructure: React.FC = () => {
  const { courseId, id } = useParams<{ courseId?: string; id?: string }>();
  const activeCourseId = courseId || id;
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();

  const canEditRole = useMemo(
    () => hasCapability(user?.role, 'gradeStructure.edit'),
    [user?.role]
  );

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const savingRef = useRef<boolean>(false);
  const rowCounterRef = useRef<number>(1);

  const [structure, setStructure] = useState<GradeStructureData | null>(null);
  const [course, setCourse] = useState<CourseDetailsData | null>(null);
  const [availableTerms, setAvailableTerms] = useState<AcademicTermOption[]>([]);
  const [selectedTermId, setSelectedTermId] = useState<number | null>(null);

  const [passMarkInput, setPassMarkInput] = useState<string>('');
  const [rows, setRows] = useState<GradeStructureRowDraft[]>([]);

  const [pageError, setPageError] = useState<{
    status?: number;
    titleKey: string;
    descKey: string;
    errorKey?: string;
    rawMessage?: string;
  } | null>(null);

  const [saveErrorKey, setSaveErrorKey] = useState<string | null>(null);

  const isLocked = Boolean(structure?.isLocked);
  const canEdit = canEditRole && !isLocked;

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
        // Fallback info from structure data
      }
    };
    fetchCourse();
    return () => {
      mounted = false;
    };
  }, [activeCourseId]);

  const fetchStructureData = useCallback(
    async (termIdToFetch?: number | null) => {
      if (!activeCourseId) return;
      setLoading(true);
      setPageError(null);
      setSaveErrorKey(null);

      try {
        const res = await gradebookService.getGradeStructure(
          activeCourseId,
          termIdToFetch ?? undefined
        );

        if (!res.success) {
          const status = res.status;
          const msg = res.message || '';
          const mappedErrorKey = mapGradeStructureError(msg, status);

          if (status === 403) {
            setPageError({
              status: 403,
              titleKey: 'gradeStructure.forbiddenTitle',
              descKey: mappedErrorKey,
              errorKey: mappedErrorKey,
              rawMessage: msg,
            });
          } else if (status === 404) {
            setPageError({
              status: 404,
              titleKey: 'gradeStructure.notFoundTitle',
              descKey: mappedErrorKey,
              errorKey: mappedErrorKey,
              rawMessage: msg,
            });
          } else {
            setPageError({
              status,
              titleKey: 'gradeStructure.errors.generic',
              descKey: mappedErrorKey,
              errorKey: mappedErrorKey,
              rawMessage: msg,
            });
          }
          setStructure(null);
          return;
        }

        const data = res.data;
        setStructure(data);
        if (data.termId && !selectedTermId) {
          setSelectedTermId(data.termId);
        }

        setPassMarkInput(
          data.passMark !== null && data.passMark !== undefined ? String(data.passMark) : ''
        );

        const initialRows: GradeStructureRowDraft[] = (data.components || []).map((comp) => ({
          rowKey: `existing-${comp.id}`,
          id: comp.id,
          name: comp.name,
          nameAr: comp.nameAr ?? '',
          maxPointsInput: String(comp.maxPoints),
          source: comp.source,
        }));
        setRows(initialRows);
      } catch (err: unknown) {
        setPageError({
          titleKey: 'gradeStructure.errors.generic',
          descKey: 'gradeStructure.errors.generic',
          rawMessage: String(err),
        });
      } finally {
        setLoading(false);
      }
    },
    [activeCourseId, selectedTermId]
  );

  useEffect(() => {
    fetchStructureData(selectedTermId);
  }, [fetchStructureData, selectedTermId]);

  const validation = useMemo(
    () => validateGradeStructureDraft(passMarkInput, rows),
    [passMarkInput, rows]
  );

  const isDirty = useMemo(
    () => canEdit && isGradeStructureDirty(structure, passMarkInput, rows),
    [canEdit, structure, passMarkInput, rows]
  );

  // Unsaved-changes guard (beforeunload)
  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = t(
        'gradeStructure.unsavedChanges',
        'You have unsaved changes in the grade structure.'
      );
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty, t]);

  const handleTermChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTermId = e.target.value ? Number(e.target.value) : null;
    setSelectedTermId(newTermId);
  };

  const handleAddRow = () => {
    if (!canEdit) return;
    const key = `new-${rowCounterRef.current++}`;
    setRows((prev) => [
      ...prev,
      {
        rowKey: key,
        name: '',
        nameAr: '',
        maxPointsInput: '',
        source: 'MANUAL',
      },
    ]);
  };

  const handleRemoveRow = (index: number) => {
    if (!canEdit) return;
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMoveRow = (index: number, direction: -1 | 1) => {
    if (!canEdit) return;
    const targetIndex = index + direction;
    setRows((prev) => {
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  const handleRowFieldChange = (
    index: number,
    field: 'name' | 'nameAr' | 'maxPointsInput' | 'source',
    value: string
  ) => {
    if (!canEdit) return;
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        if (field === 'source') {
          return { ...row, source: value as GradeComponentSource };
        }
        return { ...row, [field]: value };
      })
    );
  };

  const isSaveEnabled = canEdit && isDirty && validation.valid && !saving;

  const handleSave = async () => {
    if (!activeCourseId || !isSaveEnabled || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveErrorKey(null);

    try {
      const payload = buildGradeStructurePutPayload(passMarkInput, rows);
      const res = await gradebookService.updateGradeStructure(
        activeCourseId,
        payload,
        selectedTermId ?? undefined
      );

      if (!res.success) {
        const errorKey = mapGradeStructureError(res.message, res.status);
        setSaveErrorKey(errorKey);
        showToast(t(errorKey), 'error');
        return;
      }

      setSaveErrorKey(null);
      showToast(t('gradeStructure.savedSuccess'), 'success');
      await fetchStructureData(selectedTermId);
    } catch {
      const fallbackKey = 'gradeStructure.errors.generic';
      setSaveErrorKey(fallbackKey);
      showToast(t(fallbackKey), 'error');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (activeCourseId) {
      navigate(`/courses/${activeCourseId}`);
    } else {
      navigate('/courses');
    }
  };

  const handleOpenGradebook = () => {
    if (activeCourseId) {
      navigate(`/courses/${activeCourseId}/gradebook`);
    }
  };

  if (pageError) {
    return (
      <div
        data-grade-structure-error="true"
        className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300"
      >
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-brand-text-primary dark:text-brand-text-main mb-2">
          {t(pageError.titleKey)}
        </h2>
        <p
          data-error-description="true"
          className="text-sm text-brand-text-secondary dark:text-brand-text-sub max-w-md mb-6 font-medium"
        >
          {t(pageError.descKey)}
        </p>
        <Button
          data-back-button="true"
          onClick={handleBack}
          variant="outline"
          size="default"
          className="rounded-xl flex items-center gap-2"
        >
          <ArrowLeft size={16} />
          <span>{t('gradeStructure.back')}</span>
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoadingState message={t('common.loading', 'Loading...')} />
      </div>
    );
  }

  const displayedTotal = canEdit ? validation.totalPoints : structure?.totalPoints ?? 0;

  return (
    <div
      data-grade-structure-page="true"
      data-dirty={isDirty ? 'true' : 'false'}
      className="space-y-6 max-w-full overflow-hidden animate-in fade-in duration-300 pb-12"
    >
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-border/60 pb-5">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            data-back-button="true"
            onClick={handleBack}
            className="p-2.5 rounded-xl border border-brand-border hover:bg-surface-subtle transition-colors text-brand-text-sub shrink-0"
            title={t('gradeStructure.back')}
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="p-1.5 rounded-lg bg-brand-primary-500/10 text-brand-primary-600 dark:text-brand-primary-400 shrink-0">
                <Sliders size={18} />
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-brand-text-primary dark:text-brand-text-main truncate">
                {t('gradeStructure.title')}
              </h1>
              {course?.courseCode && (
                <Badge variant="primary" className="text-xs font-bold uppercase">
                  {course.courseCode}
                </Badge>
              )}
              {isDirty && (
                <span
                  data-unsaved-badge="true"
                  className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                >
                  {t('gradeStructure.unsavedBadge')}
                </span>
              )}
            </div>
            <p className="text-xs text-brand-text-secondary dark:text-brand-text-sub font-medium mt-1 truncate">
              {course?.name || t('gradeStructure.subtitle')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Term Selector */}
          <div className="flex items-center gap-2 bg-surface-card border border-brand-border/70 rounded-xl px-3 py-1.5 shadow-xs">
            <Calendar size={14} className="text-brand-text-sub shrink-0" />
            <label htmlFor="grade-structure-term-select" className="sr-only">
              {t('gradeStructure.termSelectLabel')}
            </label>
            <select
              id="grade-structure-term-select"
              data-term-select="true"
              aria-label={t('gradeStructure.termSelectLabel')}
              value={selectedTermId ?? ''}
              onChange={handleTermChange}
              className="bg-transparent text-xs font-bold text-brand-text-primary dark:text-brand-text-main focus:outline-hidden cursor-pointer"
            >
              {availableTerms.map((term) => (
                <option key={term.id} value={term.id} className="dark:bg-brand-navy-900">
                  {term.name}
                </option>
              ))}
            </select>
          </div>

          {/* Open Gradebook Link */}
          <Button
            type="button"
            data-open-gradebook="true"
            variant="outline"
            size="default"
            onClick={handleOpenGradebook}
            className="rounded-xl flex items-center gap-2 text-xs"
          >
            <GraduationCap size={15} />
            <span>{t('gradeStructure.openGradebook')}</span>
          </Button>

          {/* Add Component Button (Admins only when unlocked) */}
          {canEdit && (
            <Button
              type="button"
              data-add-component="true"
              variant="outline"
              size="default"
              onClick={handleAddRow}
              className="rounded-xl flex items-center gap-1.5 text-xs"
            >
              <Plus size={15} />
              <span>{t('gradeStructure.addComponent')}</span>
            </Button>
          )}

          {/* Save Structure Button (Admins only when unlocked) */}
          {canEdit && (
            <Button
              type="button"
              data-save-structure="true"
              disabled={!isSaveEnabled}
              onClick={handleSave}
              variant="default"
              size="default"
              className="rounded-xl flex items-center gap-2 shadow-xs transition-all text-xs"
            >
              <Save size={15} />
              <span>
                {saving ? t('gradeStructure.saving') : t('gradeStructure.save')}
              </span>
            </Button>
          )}
        </div>
      </div>

      {/* Locked Structure Banner */}
      {isLocked && (
        <div
          data-locked-banner="true"
          className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-3 text-amber-900 dark:text-amber-300 text-xs sm:text-sm font-semibold"
        >
          <Lock size={18} className="text-amber-600 dark:text-amber-400 shrink-0" />
          <span>{t('gradeStructure.lockedBanner')}</span>
        </div>
      )}

      {/* Read-Only Role Banner (Doctor / TA) */}
      {!canEditRole && !isLocked && (
        <div
          data-readonly-banner="true"
          className="bg-surface-subtle border border-brand-border rounded-2xl p-3.5 flex items-center gap-2.5 text-brand-text-sub text-xs font-bold"
        >
          <Lock size={16} className="shrink-0" />
          <span>{t('gradeStructure.readOnlyBanner')}</span>
        </div>
      )}

      {/* Save Error Banner (for 409 / 422 / 403 backend errors on PUT) */}
      {saveErrorKey && (
        <div
          data-save-error-banner="true"
          role="alert"
          className="bg-error/10 border border-error/30 rounded-2xl p-4 flex items-center gap-3 text-error text-xs sm:text-sm font-semibold"
        >
          <AlertCircle size={18} className="shrink-0" />
          <span>{t(saveErrorKey)}</span>
        </div>
      )}

      {/* Pass Mark & Live Total Summary Bar */}
      <div className="bg-surface-card border border-brand-border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-1.5">
          <label
            htmlFor="grade-structure-passmark-input"
            className="block text-xs font-bold text-brand-text-sub"
          >
            {t('gradeStructure.passMarkLabel')}
          </label>
          {canEdit ? (
            <div>
              <input
                id="grade-structure-passmark-input"
                type="number"
                step="0.01"
                min="0"
                data-passmark-input="true"
                data-structure-input="true"
                value={passMarkInput}
                onChange={(e) => setPassMarkInput(e.target.value)}
                placeholder={t('gradeStructure.passMarkPlaceholder')}
                className={`w-44 px-3 py-1.5 rounded-xl border font-mono text-xs text-brand-text-primary dark:text-brand-text-main bg-surface-card focus:outline-hidden transition-colors ${
                  validation.passMarkErrorKey
                    ? 'border-error ring-1 ring-error/50'
                    : 'border-brand-border focus:border-brand-primary-500'
                }`}
              />
              {validation.passMarkErrorKey && (
                <p
                  data-passmark-error="true"
                  data-inline-error="true"
                  className="text-[11px] font-semibold text-error mt-1 leading-tight"
                >
                  {t(validation.passMarkErrorKey)}
                </p>
              )}
            </div>
          ) : (
            <div
              data-passmark-readonly="true"
              className="font-mono text-sm font-black text-brand-text-primary dark:text-brand-text-main"
            >
              {structure?.passMark !== null && structure?.passMark !== undefined
                ? structure.passMark
                : t('gradeStructure.passMarkNotSet')}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="px-3.5 py-2 rounded-xl bg-surface-subtle border border-brand-border text-xs font-bold text-brand-text-sub flex items-center gap-2">
            <span className="text-brand-text-muted">
              {t('gradeStructure.componentsCountLabel')}:
            </span>
            <span
              data-components-count="true"
              className="font-mono font-black text-brand-text-primary dark:text-brand-text-main"
            >
              {rows.length}
            </span>
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-brand-primary-500/10 border border-brand-primary-500/25 text-xs font-bold text-brand-primary-700 dark:text-brand-primary-300 flex items-center gap-2">
            <span>{t('gradeStructure.totalPointsLabel')}:</span>
            <span
              data-live-total="true"
              className="font-mono text-sm font-black"
            >
              {displayedTotal}
            </span>
          </div>
        </div>
      </div>

      {/* Components Table / Empty State */}
      <div
        data-structure-table-container="true"
        className="bg-surface-card rounded-2xl border border-brand-border shadow-xs overflow-hidden"
      >
        {rows.length === 0 ? (
          <div
            data-empty-structure="true"
            className="p-8 text-center space-y-3"
          >
            <p className="text-sm font-bold text-brand-text-primary dark:text-brand-text-main">
              {t('gradeStructure.emptyTitle')}
            </p>
            <p className="text-xs text-brand-text-sub max-w-md mx-auto">
              {canEdit
                ? t('gradeStructure.emptyDesc')
                : t('gradeStructure.emptyReadOnlyDesc')}
            </p>
            {canEdit && validation.formErrorKey && (
              <p
                data-form-error="true"
                data-inline-error="true"
                className="text-xs font-semibold text-error"
              >
                {t(validation.formErrorKey)}
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto relative">
            <table className="w-full text-left border-collapse rtl:text-right">
              <thead className="bg-surface-card border-b border-brand-border">
                <tr>
                  <th
                    scope="col"
                    className="p-3 text-xs font-black text-brand-text-sub uppercase tracking-wider w-16"
                  >
                    {t('gradeStructure.columns.order')}
                  </th>
                  <th
                    scope="col"
                    className="p-3 text-xs font-black text-brand-text-sub uppercase tracking-wider min-w-[180px]"
                  >
                    {t('gradeStructure.columns.name')}
                  </th>
                  <th
                    scope="col"
                    className="p-3 text-xs font-black text-brand-text-sub uppercase tracking-wider min-w-[160px]"
                  >
                    {t('gradeStructure.columns.nameAr')}
                  </th>
                  <th
                    scope="col"
                    className="p-3 text-xs font-black text-brand-text-sub uppercase tracking-wider min-w-[130px]"
                  >
                    {t('gradeStructure.columns.maxPoints')}
                  </th>
                  <th
                    scope="col"
                    className="p-3 text-xs font-black text-brand-text-sub uppercase tracking-wider min-w-[170px]"
                  >
                    {t('gradeStructure.columns.source')}
                  </th>
                  {canEdit && (
                    <th
                      scope="col"
                      className="p-3 text-xs font-black text-brand-text-sub uppercase tracking-wider w-32 text-right rtl:text-left"
                    >
                      {t('gradeStructure.columns.actions')}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border/40">
                {rows.map((row, idx) => {
                  const rowError = validation.rowErrors[idx] || {
                    nameErrorKey: null,
                    nameArErrorKey: null,
                    maxPointsErrorKey: null,
                    sourceErrorKey: null,
                  };

                  return (
                    <tr
                      key={row.rowKey || `row-${idx}`}
                      data-component-row="true"
                      data-row-index={idx}
                      className="hover:bg-surface-subtle/40 transition-colors align-top"
                    >
                      {/* Display Order */}
                      <td className="p-3 text-xs font-mono font-bold text-brand-text-muted">
                        <span
                          data-display-order="true"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-surface-subtle border border-brand-border text-brand-text-primary dark:text-brand-text-main"
                        >
                          {idx + 1}
                        </span>
                      </td>

                      {/* Component Name (EN) */}
                      <td className="p-3 text-xs">
                        {canEdit ? (
                          <div>
                            <input
                              type="text"
                              data-component-name="true"
                              data-structure-input="true"
                              maxLength={MAX_COMPONENT_NAME_LENGTH}
                              value={row.name}
                              onChange={(e) =>
                                handleRowFieldChange(idx, 'name', e.target.value)
                              }
                              placeholder={t('gradeStructure.placeholders.name')}
                              aria-label={t('gradeStructure.columns.name')}
                              className={`w-full min-w-[150px] px-2.5 py-1.5 rounded-xl border text-xs text-brand-text-primary dark:text-brand-text-main bg-surface-card focus:outline-hidden transition-colors ${
                                rowError.nameErrorKey
                                  ? 'border-error ring-1 ring-error/50'
                                  : 'border-brand-border focus:border-brand-primary-500'
                              }`}
                            />
                            {rowError.nameErrorKey && (
                              <p
                                data-name-error="true"
                                data-inline-error="true"
                                className="text-[10px] font-semibold text-error mt-1 leading-tight"
                              >
                                {t(rowError.nameErrorKey)}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span
                            data-component-name-readonly="true"
                            className="font-bold text-brand-text-primary dark:text-brand-text-main"
                          >
                            {row.name}
                          </span>
                        )}
                      </td>

                      {/* Component Name (AR) */}
                      <td className="p-3 text-xs">
                        {canEdit ? (
                          <div>
                            <input
                              type="text"
                              data-component-name-ar="true"
                              data-structure-input="true"
                              maxLength={MAX_COMPONENT_NAME_LENGTH}
                              value={row.nameAr}
                              onChange={(e) =>
                                handleRowFieldChange(idx, 'nameAr', e.target.value)
                              }
                              placeholder={t('gradeStructure.placeholders.nameAr')}
                              aria-label={t('gradeStructure.columns.nameAr')}
                              className={`w-full min-w-[140px] px-2.5 py-1.5 rounded-xl border text-xs text-brand-text-primary dark:text-brand-text-main bg-surface-card focus:outline-hidden transition-colors ${
                                rowError.nameArErrorKey
                                  ? 'border-error ring-1 ring-error/50'
                                  : 'border-brand-border focus:border-brand-primary-500'
                              }`}
                            />
                            {rowError.nameArErrorKey && (
                              <p
                                data-name-ar-error="true"
                                data-inline-error="true"
                                className="text-[10px] font-semibold text-error mt-1 leading-tight"
                              >
                                {t(rowError.nameArErrorKey)}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span
                            data-component-name-ar-readonly="true"
                            className="text-brand-text-sub font-medium"
                          >
                            {row.nameAr || '—'}
                          </span>
                        )}
                      </td>

                      {/* Max Points */}
                      <td className="p-3 text-xs">
                        {canEdit ? (
                          <div>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max={MAX_POINTS_TECHNICAL_CEILING}
                              data-component-points="true"
                              data-structure-input="true"
                              value={row.maxPointsInput}
                              onChange={(e) =>
                                handleRowFieldChange(idx, 'maxPointsInput', e.target.value)
                              }
                              placeholder={t('gradeStructure.placeholders.maxPoints')}
                              aria-label={t('gradeStructure.columns.maxPoints')}
                              className={`w-28 px-2.5 py-1.5 rounded-xl border font-mono text-xs text-brand-text-primary dark:text-brand-text-main bg-surface-card focus:outline-hidden transition-colors ${
                                rowError.maxPointsErrorKey
                                  ? 'border-error ring-1 ring-error/50'
                                  : 'border-brand-border focus:border-brand-primary-500'
                              }`}
                            />
                            {rowError.maxPointsErrorKey && (
                              <p
                                data-points-error="true"
                                data-inline-error="true"
                                className="text-[10px] font-semibold text-error mt-1 leading-tight"
                              >
                                {t(rowError.maxPointsErrorKey)}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span
                            data-component-points-readonly="true"
                            className="font-mono font-bold text-brand-text-primary dark:text-brand-text-main"
                          >
                            {row.maxPointsInput}
                          </span>
                        )}
                      </td>

                      {/* Source */}
                      <td className="p-3 text-xs">
                        {canEdit ? (
                          <div>
                            <select
                              data-component-source="true"
                              value={row.source}
                              onChange={(e) =>
                                handleRowFieldChange(idx, 'source', e.target.value)
                              }
                              aria-label={t('gradeStructure.columns.source')}
                              className={`w-full min-w-[150px] px-2.5 py-1.5 rounded-xl border text-xs font-bold text-brand-text-primary dark:text-brand-text-main bg-surface-card focus:outline-hidden cursor-pointer ${
                                rowError.sourceErrorKey
                                  ? 'border-error ring-1 ring-error/50'
                                  : 'border-brand-border focus:border-brand-primary-500'
                              }`}
                            >
                              {ALLOWED_GRADE_COMPONENT_SOURCES.map((src) => (
                                <option key={src} value={src} className="dark:bg-brand-navy-900">
                                  {t(`gradeStructure.sources.${src}`)}
                                </option>
                              ))}
                            </select>
                            {rowError.sourceErrorKey && (
                              <p
                                data-source-error="true"
                                data-inline-error="true"
                                className="text-[10px] font-semibold text-error mt-1 leading-tight"
                              >
                                {t(rowError.sourceErrorKey)}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span
                            data-component-source-readonly="true"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-brand-primary-500/10 text-brand-primary-600 dark:text-brand-primary-400"
                          >
                            {row.source !== 'MANUAL' && <Sparkles size={11} />}
                            <span>{t(`gradeStructure.sources.${row.source}`)}</span>
                          </span>
                        )}
                      </td>

                      {/* Reorder & Remove Actions */}
                      {canEdit && (
                        <td className="p-3 text-xs text-right rtl:text-left">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              data-move-up="true"
                              disabled={idx === 0}
                              onClick={() => handleMoveRow(idx, -1)}
                              aria-label={t('gradeStructure.actions.moveUp')}
                              title={t('gradeStructure.actions.moveUp')}
                              className="p-1.5 rounded-lg border border-brand-border hover:bg-surface-subtle text-brand-text-sub disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              <ArrowUp size={13} />
                            </button>
                            <button
                              type="button"
                              data-move-down="true"
                              disabled={idx === rows.length - 1}
                              onClick={() => handleMoveRow(idx, 1)}
                              aria-label={t('gradeStructure.actions.moveDown')}
                              title={t('gradeStructure.actions.moveDown')}
                              className="p-1.5 rounded-lg border border-brand-border hover:bg-surface-subtle text-brand-text-sub disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              <ArrowDown size={13} />
                            </button>
                            <button
                              type="button"
                              data-remove-row="true"
                              onClick={() => handleRemoveRow(idx)}
                              aria-label={t('gradeStructure.actions.remove')}
                              title={t('gradeStructure.actions.remove')}
                              className="p-1.5 rounded-lg border border-brand-border hover:bg-error/10 text-brand-text-sub hover:text-error transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CourseGradeStructure;

