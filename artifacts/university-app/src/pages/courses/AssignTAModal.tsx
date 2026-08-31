import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import {
  X,
  Users,
  Award,
  Search,
  CheckCircle2,
  AlertCircle,
  Building2,
  Calendar,
  Clock,
  MapPin,
  Loader2,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import Button from '../../components/ui/button';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';

interface AssignTAModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: any;
  currentAssignedTAs?: any[];
  onSuccess: () => void;
}

export default function AssignTAModal({
  isOpen,
  onClose,
  course,
  currentAssignedTAs = [],
  onSuccess,
}: AssignTAModalProps) {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { showToast } = useToast();

  const [tas, setTas] = useState<any[]>([]);
  const [fetchingTAs, setFetchingTAs] = useState(false);
  const [selectedTAId, setSelectedTAId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Time & Room config
  const [dayOfWeek, setDayOfWeek] = useState('MONDAY');
  const [startTime, setStartTime] = useState('12:00');
  const [endTime, setEndTime] = useState('14:00');
  const [room, setRoom] = useState('Lab 1');
  const [slotType, setSlotType] = useState<'TUTORIAL' | 'LAB'>('TUTORIAL');
  const [includeScheduleSlot, setIncludeScheduleSlot] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchTAs();
      if (currentAssignedTAs.length > 0) {
        setSelectedTAId(String(currentAssignedTAs[0].id));
      } else {
        setSelectedTAId('');
      }
      setError(null);
    }
  }, [isOpen, currentAssignedTAs]);

  const fetchTAs = async () => {
    try {
      setFetchingTAs(true);
      setError(null);
      // Fetch all TAs across the university
      const res = await api.get('/teaching-assistants', { params: { limit: 200 } });
      const list = res.data?.data?.teachingAssistants || [];
      setTas(list);
    } catch (err: any) {
      console.error('Failed to fetch TAs list:', err);
      setError(isRTL ? 'تعذر جلب قائمة المعيدين' : 'Failed to load teaching assistants list');
    } finally {
      setFetchingTAs(false);
    }
  };

  const filteredTAs = useMemo(() => {
    if (!searchQuery.trim()) return tas;
    const q = searchQuery.toLowerCase().trim();
    return tas.filter((ta) => {
      const fullName = `${ta.firstName || ''} ${ta.lastName || ''}`.toLowerCase();
      const empId = (ta.employeeId || '').toLowerCase();
      const email = (ta.user?.email || '').toLowerCase();
      const spec = (ta.specialization || '').toLowerCase();
      const deptName = (ta.department?.name || ta.department?.nameAr || '').toLowerCase();
      const colName = (ta.department?.college?.name || ta.department?.college?.nameAr || '').toLowerCase();
      return (
        fullName.includes(q) ||
        empId.includes(q) ||
        email.includes(q) ||
        spec.includes(q) ||
        deptName.includes(q) ||
        colName.includes(q)
      );
    });
  }, [tas, searchQuery]);

  const selectedTA = useMemo(() => {
    return tas.find((ta) => String(ta.id) === selectedTAId);
  }, [tas, selectedTAId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTAId) {
      setError(isRTL ? 'الرجاء اختيار المعيد المسؤول' : 'Please select a teaching assistant');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await api.post(`/teaching-assistants/${selectedTAId}/assign-course`, {
        courseId: Number(course.id),
        dayOfWeek: includeScheduleSlot ? dayOfWeek : undefined,
        startTime: includeScheduleSlot ? startTime : undefined,
        endTime: includeScheduleSlot ? endTime : undefined,
        room: includeScheduleSlot ? (room || 'Lab 1') : undefined,
        slotType: includeScheduleSlot ? slotType : undefined,
      });

      showToast(
        isRTL
          ? `تم إسناد سكشن/معمل مقرر (${course.name}) إلى م. ${selectedTA?.firstName || ''} ${selectedTA?.lastName || selectedTA?.employeeId} بنجاح`
          : `Successfully assigned ${course.name} to TA ${selectedTA?.firstName || ''} ${selectedTA?.lastName || selectedTA?.employeeId}`,
        'success'
      );

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error assigning TA to course:', err);
      const msg =
        err.response?.data?.message ||
        (isRTL ? 'فشل إسناد المعيد للمقرر' : 'Failed to assign teaching assistant to course');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-primary-500/10 text-brand-primary-600 dark:text-brand-primary-400 flex items-center justify-center font-bold">
              <Users size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                {isRTL ? 'إسناد معيد للمقرر الدراسي (سكاشن ومعامل)' : 'Assign Teaching Assistant to Course'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {course?.name} ({course?.courseCode})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-start">
          {error && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-2xl border border-rose-200 dark:border-rose-800/60 text-xs font-bold flex items-start gap-2.5">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Search Box */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {isRTL ? 'البحث عن المعيد' : 'Search Teaching Assistant'}
            </label>
            <div className="relative">
              <Search
                size={16}
                className={`absolute top-3.5 ${isRTL ? 'right-3.5' : 'left-3.5'} text-slate-400`}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  isRTL
                    ? 'ابحث بالاسم، الرقم الوظيفي، التخصص، أو القسم...'
                    : 'Search by name, ID, specialty, or department...'
                }
                className={`w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 ${
                  isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'
                } text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-brand-primary-500 focus:border-brand-primary-500 transition-all`}
              />
            </div>
          </div>

          {/* TA Selection List */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {isRTL ? 'اختر المعيد المسؤول' : 'Select Teaching Assistant'} <span className="text-rose-500">*</span>
            </label>

            {fetchingTAs ? (
              <div className="py-8 text-center text-slate-400 space-y-2">
                <Loader2 size={24} className="animate-spin mx-auto text-brand-primary-500" />
                <p className="text-xs">{isRTL ? 'جاري تحميل قائمة المعيدين...' : 'Loading teaching assistants...'}</p>
              </div>
            ) : filteredTAs.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs italic bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700">
                {isRTL ? 'لم يتم العثور على معيدين مطابقين للبحث' : 'No teaching assistants found matching search'}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 max-h-56 overflow-y-auto pr-1">
                {filteredTAs.map((ta) => {
                  const isSelected = selectedTAId === String(ta.id);
                  const isCurrent = currentAssignedTAs.some((t) => t.id === ta.id);
                  const deptName = isRTL
                    ? ta.department?.nameAr || ta.department?.name
                    : ta.department?.name || ta.department?.nameAr;
                  const colName = isRTL
                    ? ta.department?.college?.nameAr || ta.department?.college?.name
                    : ta.department?.college?.name || ta.department?.college?.nameAr;

                  return (
                    <button
                      key={ta.id}
                      type="button"
                      onClick={() => setSelectedTAId(String(ta.id))}
                      className={`w-full p-3 rounded-2xl border text-start transition-all flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-brand-primary-500/10 border-brand-primary-500 text-slate-900 dark:text-white shadow-sm ring-1 ring-brand-primary-500'
                          : 'bg-slate-50/70 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                            isSelected
                              ? 'bg-brand-primary-500 text-white'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {ta.firstName?.[0] || ta.employeeId?.[0] || 'T'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs truncate">
                              م. {ta.firstName || ''} {ta.lastName || ''} ({ta.employeeId})
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] bg-brand-primary-100 dark:bg-brand-primary-950/40 text-brand-primary-700 dark:text-brand-primary-300 font-bold px-2 py-0.5 rounded-full">
                                {isRTL ? 'المُسند حالياً' : 'Current'}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 truncate mt-0.5">
                            {ta.specialization && <span>{ta.specialization}</span>}
                            {deptName && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Building2 size={11} />
                                  {deptName}
                                  {colName && ` (${colName})`}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {isSelected && (
                        <div className="w-6 h-6 rounded-full bg-brand-primary-500 text-white flex items-center justify-center shrink-0">
                          <CheckCircle2 size={16} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Schedule Slot Option */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  {isRTL ? 'إدراج موعد السكشن / المعمل في الجدول' : 'Include Weekly Lab/Tutorial Slot'}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {isRTL ? 'حجز موعد رسمي للسكشن/المعمل في جدول المعيد والمعمل' : 'Book official tutorial slot in TA and lab schedule'}
                </span>
              </div>
              <input
                type="checkbox"
                checked={includeScheduleSlot}
                onChange={(e) => setIncludeScheduleSlot(e.target.checked)}
                className="w-4 h-4 text-brand-primary-500 rounded border-slate-300 focus:ring-brand-primary-500"
              />
            </div>

            {includeScheduleSlot && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-700 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    {isRTL ? 'نوع الحصة' : 'Slot Type'}
                  </label>
                  <select
                    value={slotType}
                    onChange={(e) => setSlotType(e.target.value as any)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-medium"
                  >
                    <option value="TUTORIAL">{isRTL ? 'سكشن (تمارين)' : 'Tutorial (Section)'}</option>
                    <option value="LAB">{isRTL ? 'معمل (عملي)' : 'Lab / Practical'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    {isRTL ? 'اليوم' : 'Day of Week'}
                  </label>
                  <select
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-medium"
                  >
                    <option value="SATURDAY">{isRTL ? 'السبت' : 'Saturday'}</option>
                    <option value="SUNDAY">{isRTL ? 'الأحد' : 'Sunday'}</option>
                    <option value="MONDAY">{isRTL ? 'الإثنين' : 'Monday'}</option>
                    <option value="TUESDAY">{isRTL ? 'الثلاثاء' : 'Tuesday'}</option>
                    <option value="WEDNESDAY">{isRTL ? 'الأربعاء' : 'Wednesday'}</option>
                    <option value="THURSDAY">{isRTL ? 'الخميس' : 'Thursday'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    {isRTL ? 'المعمل / القاعة' : 'Room / Lab'}
                  </label>
                  <input
                    type="text"
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    placeholder="e.g. Lab 1, Computer Lab B"
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      {isRTL ? 'من' : 'Start'}
                    </label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-2 text-xs font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      {isRTL ? 'إلى' : 'End'}
                    </label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-2 text-xs font-medium"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-700/60">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="text-xs font-bold rounded-xl px-4 py-2"
            >
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              type="submit"
              disabled={loading || !selectedTAId}
              className="bg-brand-primary-500 hover:bg-brand-primary-600 text-white text-xs font-bold rounded-xl px-5 py-2 flex items-center gap-2 shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>{isRTL ? 'جاري الإسناد والتحقق...' : 'Assigning & Verifying...'}</span>
                </>
              ) : (
                <>
                  <Award size={15} />
                  <span>{isRTL ? 'تأكيد إسناد المعيد' : 'Confirm Assignment'}</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
