import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Info, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from '../ui/button';
import Badge from '../ui/badge';
import { useToast } from '../../context/ToastContext';
import submissionIntegrityService, {
  type SubmissionIntegrityPolicy,
} from '../../services/submissionIntegrity.service';

export interface ThresholdParseResult {
  valid: boolean;
  value: number | null;
}

function normalizeThresholdInput(raw: string): string {
  return raw
    .trim()
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\u066B/g, '.');
}

export function parseSimilarityThreshold(raw: string): ThresholdParseResult {
  const normalized = normalizeThresholdInput(raw);
  if (normalized === '') {
    return { valid: true, value: null };
  }

  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(normalized)) {
    return { valid: false, value: null };
  }

  const [intRaw, fracRaw = ''] = normalized.split('.');
  if (fracRaw.length > 4) {
    return { valid: false, value: null };
  }

  const intTrimmed = (intRaw === '' ? '0' : intRaw).replace(/^0+/, '') || '0';
  const fracPadded = fracRaw.padEnd(4, '0');

  const isInRange =
    (intTrimmed === '0' && fracPadded !== '0000') ||
    (intTrimmed === '1' && fracPadded === '0000');

  if (!isInRange) {
    return { valid: false, value: null };
  }

  return {
    valid: true,
    value: Number(`${intTrimmed}.${fracPadded}`),
  };
}

export function SubmissionIntegrityPolicyCard() {
  const { t } = useTranslation();
  const { success } = useToast();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savedPolicy, setSavedPolicy] = useState<SubmissionIntegrityPolicy | null>(null);

  const [exactDuplicateBlock, setExactDuplicateBlock] = useState(true);
  const [thresholdInput, setThresholdInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const savingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadPolicy = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setSaveError(null);

    const res = await submissionIntegrityService.getPolicy();
    if (!isMountedRef.current) return;

    if (res.success && res.data) {
      setSavedPolicy(res.data);
      setExactDuplicateBlock(Boolean(res.data.exactDuplicateBlock));
      setThresholdInput(
        res.data.similarityThreshold === null || res.data.similarityThreshold === undefined
          ? ''
          : String(res.data.similarityThreshold)
      );
    } else {
      setSavedPolicy(null);
      const message =
        res.status === 403
          ? t('errors.forbidden')
          : res.message || t('errors.serverError');
      setLoadError(message);
    }
    setLoading(false);
  }, [t]);

  useEffect(() => {
    void loadPolicy();
  }, [loadPolicy]);

  const parsedThreshold = useMemo(
    () => parseSimilarityThreshold(thresholdInput),
    [thresholdInput]
  );

  const isDirty = useMemo(() => {
    if (!savedPolicy) return false;
    if (exactDuplicateBlock !== savedPolicy.exactDuplicateBlock) return true;
    if (!parsedThreshold.valid) return true;
    return parsedThreshold.value !== savedPolicy.similarityThreshold;
  }, [exactDuplicateBlock, parsedThreshold, savedPolicy]);

  const isSaveDisabled =
    !savedPolicy || loading || saving || !parsedThreshold.valid || !isDirty;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving || savingRef.current) return;
    if (!savedPolicy || !parsedThreshold.valid || !isDirty) return;

    savingRef.current = true;
    setSaving(true);
    setSaveError(null);

    try {
      const res = await submissionIntegrityService.updatePolicy({
        exactDuplicateBlock,
        similarityThreshold: parsedThreshold.value,
      });

      if (!isMountedRef.current) return;

      if (res.success && res.data) {
        setSavedPolicy(res.data);
        setExactDuplicateBlock(Boolean(res.data.exactDuplicateBlock));
        setThresholdInput(
          res.data.similarityThreshold === null || res.data.similarityThreshold === undefined
            ? ''
            : String(res.data.similarityThreshold)
        );
        success(t('settings.submissionIntegrity.saveSuccess'));
      } else {
        const message =
          res.status === 403
            ? t('errors.forbidden')
            : res.message || t('errors.unexpected');
        setSaveError(message);
      }
    } finally {
      savingRef.current = false;
      if (isMountedRef.current) {
        setSaving(false);
      }
    }
  };

  const switchId = 'submission-integrity-duplicate-switch';
  const switchLabelId = 'submission-integrity-duplicate-label';
  const thresholdInputId = 'submission-integrity-threshold-input';
  const thresholdHelperId = 'submission-integrity-threshold-helper';
  const thresholdErrorId = 'submission-integrity-threshold-error';

  const thresholdDescribedBy = parsedThreshold.valid
    ? thresholdHelperId
    : `${thresholdHelperId} ${thresholdErrorId}`;

  return (
    <section
      data-testid="submission-integrity-policy-card"
      aria-busy={loading}
      className="space-y-4"
    >
      <div className="border-b border-slate-100 dark:border-slate-700/60 pb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-brand-primary-500 shrink-0" aria-hidden="true" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {t('settings.submissionIntegrity.title')}
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t('settings.submissionIntegrity.description')}
          </p>
        </div>
        <Badge variant="primary" className="text-xs font-bold shrink-0">
          {t('settings.submissionIntegrity.superAdminOnlyBadge')}
        </Badge>
      </div>

      {loading && (
        <div
          data-testid="submission-integrity-loading"
          className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 px-3.5 py-3 text-xs text-slate-600 dark:text-slate-300"
        >
          <Loader2 size={15} className="animate-spin text-brand-primary-500 shrink-0" aria-hidden="true" />
          <span>{t('settings.submissionIntegrity.loading')}</span>
        </div>
      )}

      {!loading && loadError && (
        <div
          data-testid="submission-integrity-load-error"
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 px-3.5 py-3 text-xs text-rose-700 dark:text-rose-300"
        >
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <AlertCircle size={15} className="shrink-0 mt-0.5" aria-hidden="true" />
            <span className="break-words">{loadError}</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="submission-integrity-retry-button"
            onClick={() => void loadPolicy()}
            className="text-xs font-semibold shrink-0 cursor-pointer"
          >
            <RefreshCw size={13} aria-hidden="true" />
            <span>{t('common.retry')}</span>
          </Button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {!loading && savedPolicy && (
          <>
            {savedPolicy.isDefault && (
              <div
                data-testid="submission-integrity-default-notice"
                className="flex items-start gap-2 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 px-3.5 py-2.5 text-xs text-amber-800 dark:text-amber-200"
              >
                <Info size={15} className="shrink-0 mt-0.5" aria-hidden="true" />
                <span>{t('settings.submissionIntegrity.defaultNotice')}</span>
              </div>
            )}

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1 text-start">
                <label
                  id={switchLabelId}
                  htmlFor={switchId}
                  className="block text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
                >
                  {t('settings.submissionIntegrity.exactDuplicateLabel')}
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {t('settings.submissionIntegrity.exactDuplicateDesc')}
                </p>
              </div>
              <button
                id={switchId}
                type="button"
                role="switch"
                aria-checked={exactDuplicateBlock}
                aria-labelledby={switchLabelId}
                disabled={saving}
                onClick={() => {
                  setExactDuplicateBlock((prev) => !prev);
                  setSaveError(null);
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary-500 focus-visible:ring-offset-2 cursor-pointer disabled:opacity-50 ${
                  exactDuplicateBlock
                    ? 'bg-brand-primary-600'
                    : 'bg-slate-300 dark:bg-slate-600'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${
                    exactDuplicateBlock
                      ? 'translate-x-6 rtl:-translate-x-6'
                      : 'translate-x-1 rtl:-translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="space-y-1.5 text-start">
              <label
                htmlFor={thresholdInputId}
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                {t('settings.submissionIntegrity.similarityThresholdLabel')}
              </label>
              <input
                id={thresholdInputId}
                type="text"
                inputMode="decimal"
                dir="ltr"
                value={thresholdInput}
                disabled={saving}
                aria-invalid={!parsedThreshold.valid ? 'true' : undefined}
                aria-describedby={thresholdDescribedBy}
                onChange={(e) => {
                  setThresholdInput(e.target.value);
                  setSaveError(null);
                }}
                className={`w-full sm:max-w-xs px-3 py-2 text-xs tabular-nums border rounded-xl outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-1.5 ${
                  parsedThreshold.valid
                    ? 'border-slate-200 dark:border-slate-700 focus:ring-brand-primary-500'
                    : 'border-rose-400 dark:border-rose-500 focus:ring-rose-500'
                }`}
              />
              <p
                id={thresholdHelperId}
                className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums"
              >
                {t('settings.submissionIntegrity.similarityThresholdHelper')}
              </p>
              {!parsedThreshold.valid && (
                <p
                  id={thresholdErrorId}
                  role="alert"
                  className="text-xs font-medium text-rose-600 dark:text-rose-400 tabular-nums"
                >
                  {t('settings.submissionIntegrity.invalidThresholdFormat')}
                </p>
              )}
            </div>
          </>
        )}

        {saveError && (
          <div
            data-testid="submission-integrity-save-error"
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 px-3.5 py-2.5 text-xs text-rose-700 dark:text-rose-300"
          >
            <AlertCircle size={15} className="shrink-0 mt-0.5" aria-hidden="true" />
            <span className="break-words">{saveError}</span>
          </div>
        )}

        <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex justify-end">
          <Button
            type="submit"
            size="sm"
            data-testid="submission-integrity-save-button"
            disabled={isSaveDisabled}
            className="bg-brand-primary-600 hover:bg-brand-primary-700 text-white text-xs font-bold cursor-pointer"
          >
            {saving
              ? t('settings.submissionIntegrity.saving')
              : t('settings.submissionIntegrity.saveButton')}
          </Button>
        </div>
      </form>
    </section>
  );
}

export default SubmissionIntegrityPolicyCard;
