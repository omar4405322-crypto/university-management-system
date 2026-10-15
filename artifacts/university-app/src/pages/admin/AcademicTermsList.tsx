import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '../../components/ui/card';
import Badge from '../../components/ui/badge';
import Button from '../../components/ui/button';
import {
  Calendar,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Pencil,
} from 'lucide-react';
import academicTermService, {
  AcademicYearData,
  AcademicTermData,
} from '../../services/academicTerm.service';
import AcademicTermModal from './AcademicTermModal';
import TermSwitchPreviewModal from './TermSwitchPreviewModal';

export const AcademicTermsList: React.FC = () => {
  const { t } = useTranslation();

  const [years, setYears] = useState<AcademicYearData[]>([]);
  const [currentTerm, setCurrentTerm] = useState<AcademicTermData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'YEAR' | 'TERM'>('YEAR');
  const [isEditMode, setIsEditMode] = useState(false);
  const [editData, setEditData] = useState<AcademicYearData | AcademicTermData | null>(null);
  const [selectedYearId, setSelectedYearId] = useState<number | undefined>();
  const [previewTerm, setPreviewTerm] = useState<AcademicTermData | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [yearsRes, currentRes] = await Promise.all([
        academicTermService.getAcademicYears(),
        academicTermService.getCurrentTerm(),
      ]);
      if (yearsRes.data) setYears(yearsRes.data);
      if (currentRes.data) setCurrentTerm(currentRes.data.currentTerm);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          err.message ||
          t('academicTerms.fetchError', 'Failed to load academic calendar data.')
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenCreateYear = () => {
    setModalMode('YEAR');
    setIsEditMode(false);
    setEditData(null);
    setSelectedYearId(undefined);
    setIsModalOpen(true);
  };

  const handleOpenEditYear = (year: AcademicYearData) => {
    setModalMode('YEAR');
    setIsEditMode(true);
    setEditData(year);
    setSelectedYearId(undefined);
    setIsModalOpen(true);
  };

  const handleOpenCreateTerm = (yearId?: number) => {
    setModalMode('TERM');
    setIsEditMode(false);
    setEditData(null);
    setSelectedYearId(yearId || years[0]?.id);
    setIsModalOpen(true);
  };

  const handleOpenEditTerm = (term: AcademicTermData) => {
    setModalMode('TERM');
    setIsEditMode(true);
    setEditData(term);
    setSelectedYearId(term.academicYearId);
    setIsModalOpen(true);
  };

  const handleOpenSwitchPreview = (term: AcademicTermData) => {
    setPreviewTerm(term);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <Calendar className="text-brand-primary-500" size={26} />
            <span>{t('academicTerms.pageTitle', 'Academic Calendar & Terms')}</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t(
              'academicTerms.pageSubtitle',
              'Manage institutional academic years, term boundaries, and calendar activations.'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleOpenCreateYear}
            className="bg-brand-primary-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
          >
            <Plus size={16} />
            <span>{t('academicTerms.createYear', '+ New Academic Year')}</span>
          </Button>
          {years.length > 0 && (
            <Button
              onClick={() => handleOpenCreateTerm()}
              variant="outline"
              className="rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <Plus size={16} />
              <span>{t('academicTerms.createTerm', '+ New Term')}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Global No Active Term Alert */}
      {!loading && !currentTerm && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 rounded-2xl flex items-start gap-3">
          <AlertTriangle size={22} className="shrink-0 text-amber-500 mt-0.5" />
          <div className="flex-1 text-xs leading-relaxed">
            <span className="font-bold text-sm block mb-1">
              {t('academicTerms.noActiveTermTitle', 'No Active Term Configured')}
            </span>
            <span>
              {t(
                'academicTerms.noActiveTermNotice',
                'There is currently no active academic term. Please activate a term from the list below so student course enrollments and schedules function properly.'
              )}
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-2xl text-xs">
          {error}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <Card className="p-12 text-center text-xs text-slate-500">
          {t('common.loading', 'Loading academic terms...')}
        </Card>
      ) : years.length === 0 ? (
        <Card className="p-12 text-center">
          <Calendar size={36} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-1">
            {t('academicTerms.noYears', 'No Academic Years Found')}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            {t('academicTerms.getStarted', 'Get started by creating your first academic year.')}
          </p>
          <Button onClick={handleOpenCreateYear} className="bg-brand-primary-500 text-white rounded-xl text-xs font-bold">
            {t('academicTerms.createYear', '+ New Academic Year')}
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {years.map((year) => (
            <Card key={year.id} className="p-5 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-primary-500/10 text-brand-primary-600 dark:text-brand-primary-400 flex items-center justify-center font-bold text-sm">
                    {year.name.slice(0, 4)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-slate-900 dark:text-white">
                        {year.name}
                      </h2>
                      {year.isCurrent && (
                        <Badge variant="success" className="text-[10px]">
                          {t('common.activeYear', 'Current Year')}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                      <span>{new Date(year.startDate).toLocaleDateString()}</span>
                      <span>—</span>
                      <span>{new Date(year.endDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <Button
                    onClick={() => handleOpenEditYear(year)}
                    variant="outline"
                    className="text-xs font-bold flex items-center gap-1.5 rounded-xl border-slate-200 dark:border-slate-700"
                    aria-label={`${t('academicTerms.editYear', 'Edit Year')}: ${year.name}`}
                  >
                    <Pencil size={13} />
                    <span>{t('academicTerms.editYear', 'Edit Year')}</span>
                  </Button>
                  <Button
                    onClick={() => handleOpenCreateTerm(year.id)}
                    variant="ghost"
                    className="text-xs text-brand-primary-600 dark:text-brand-primary-400 font-bold"
                  >
                    <Plus size={14} className="me-1" />
                    {t('academicTerms.addTermToYear', 'Add Term')}
                  </Button>
                </div>
              </div>

              {/* Terms inside year */}
              {year.terms && year.terms.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {year.terms.map((term) => {
                    const isTermCurrent = term.isCurrent;
                    return (
                      <div
                        key={term.id}
                        className={`p-3.5 rounded-xl border transition-all ${
                          isTermCurrent
                            ? 'bg-emerald-500/5 border-emerald-500/30 shadow-sm'
                            : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <div className="text-sm font-bold text-slate-900 dark:text-white">
                              {term.name}
                            </div>
                            <div className="text-xs text-slate-500 font-medium">
                              {t('academicTerms.semesterNumber', 'Semester')} {term.semesterNumber} ({term.termType})
                            </div>
                          </div>
                          {isTermCurrent ? (
                            <Badge variant="success" className="text-[10px] flex items-center gap-1">
                              <CheckCircle2 size={10} />
                              {t('common.active', 'Active')}
                            </Badge>
                          ) : (
                            <Badge variant="neutral" className="text-[10px]">
                              {t('common.inactive', 'Inactive')}
                            </Badge>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1">
                          <Clock size={12} />
                          <span>
                            {new Date(term.startDate).toLocaleDateString()} – {new Date(term.endDate).toLocaleDateString()}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                          <Button
                            onClick={() => handleOpenEditTerm(term)}
                            variant="outline"
                            className="flex-1 text-xs font-bold py-1.5 rounded-lg border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1.5"
                            aria-label={`${t('academicTerms.editTerm', 'Edit Term')}: ${term.name}`}
                          >
                            <Pencil size={12} />
                            <span>{t('academicTerms.editTerm', 'Edit Term')}</span>
                          </Button>
                          {!isTermCurrent && (
                            <Button
                              onClick={() => handleOpenSwitchPreview(term)}
                              className="flex-1 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-xs font-bold py-1.5"
                            >
                              {t('academicTerms.activateTermAction', 'Activate Term')}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-4 text-xs text-slate-400">
                  {t('academicTerms.noTermsInYear', 'No terms defined for this year yet.')}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Creation / Edit Modal */}
      {isModalOpen && (
        <AcademicTermModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditData(null);
          }}
          mode={modalMode}
          isEdit={isEditMode}
          initialData={editData}
          academicYears={years}
          selectedYearId={selectedYearId}
          onSuccess={fetchData}
        />
      )}

      {/* Switch Preview Modal */}
      {previewTerm && (
        <TermSwitchPreviewModal
          isOpen={Boolean(previewTerm)}
          onClose={() => setPreviewTerm(null)}
          targetTerm={previewTerm}
          onActivated={fetchData}
        />
      )}
    </div>
  );
};

export default AcademicTermsList;
