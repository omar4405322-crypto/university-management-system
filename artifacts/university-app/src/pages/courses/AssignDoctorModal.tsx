import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import {
  X,
  GraduationCap,
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

interface AssignDoctorModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: any;
  currentAssignedDoctors?: any[];
  onSuccess: () => void;
}

export default function AssignDoctorModal({
  isOpen,
  onClose,
  course,
  currentAssignedDoctors = [],
  onSuccess,
}: AssignDoctorModalProps) {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { showToast } = useToast();

  const [doctors, setDoctors] = useState<any[]>([]);
  const [fetchingDoctors, setFetchingDoctors] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Time & Room config
  const [dayOfWeek, setDayOfWeek] = useState('SUNDAY');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('11:00');
  const [room, setRoom] = useState('Main Hall');
  const [includeScheduleSlot, setIncludeScheduleSlot] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchDoctors();
      if (currentAssignedDoctors.length > 0) {
        setSelectedDoctorId(String(currentAssignedDoctors[0].id));
      } else {
        setSelectedDoctorId('');
      }
      setError(null);
    }
  }, [isOpen, currentAssignedDoctors]);

  const fetchDoctors = async () => {
    try {
      setFetchingDoctors(true);
      setError(null);
      // Fetch all professors across the university
      const res = await api.get('/doctors', { params: { limit: 200 } });
      const list = res.data?.data?.doctors || [];
      setDoctors(list);
    } catch (err: any) {
      console.error('Failed to fetch doctors list:', err);
      setError(isRTL ? 'تعذر جلب قائمة أعضاء هيئة التدريس' : 'Failed to load faculty list');
    } finally {
      setFetchingDoctors(false);
    }
  };

  const filteredDoctors = useMemo(() => {
    if (!searchQuery.trim()) return doctors;
    const q = searchQuery.toLowerCase().trim();
    return doctors.filter((doc) => {
      const fullName = `${doc.firstName || ''} ${doc.lastName || ''}`.toLowerCase();
      const docId = (doc.doctorId || '').toLowerCase();
      const specialty = (doc.specialty || '').toLowerCase();
      const deptName = (doc.department?.name || doc.department?.nameAr || '').toLowerCase();
      const colName = (doc.department?.college?.name || doc.department?.college?.nameAr || '').toLowerCase();
      return (
        fullName.includes(q) ||
        docId.includes(q) ||
        specialty.includes(q) ||
        deptName.includes(q) ||
        colName.includes(q)
      );
    });
  }, [doctors, searchQuery]);

  const selectedDoctor = useMemo(() => {
    return doctors.find((d) => String(d.id) === selectedDoctorId);
  }, [doctors, selectedDoctorId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctorId) {
      setError(isRTL ? 'الرجاء اختيار الدكتور المسؤول' : 'Please select a professor');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await api.post(`/doctors/${selectedDoctorId}/assign-course`, {
        courseId: Number(course.id),
        dayOfWeek: includeScheduleSlot ? dayOfWeek : undefined,
        startTime: includeScheduleSlot ? startTime : undefined,
        endTime: includeScheduleSlot ? endTime : undefined,
        room: includeScheduleSlot ? (room || 'Main Hall') : undefined,
      });

      showToast(
        isRTL
          ? `تم إسناد مقرر (${course.name}) إلى د. ${selectedDoctor?.firstName} ${selectedDoctor?.lastName} بنجاح`
          : `Successfully assigned ${course.name} to Dr. ${selectedDoctor?.firstName} ${selectedDoctor?.lastName}`,
        'success'
      );

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error assigning doctor to course:', err);
      const msg =
        err.response?.data?.message ||
        (isRTL ? 'فشل إسناد الدكتور للمقرر' : 'Failed to assign professor to course');
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
              <GraduationCap size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                {isRTL ? 'إسناد أستاذ للمقرر الدراسي' : 'Assign Professor to Course'}
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
              {isRTL ? 'البحث عن عضو هيئة التدريس' : 'Search Faculty Member'}
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

          {/* Doctor Selection List */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {isRTL ? 'اختر الدكتور المسؤول' : 'Select Lead Professor'} <span className="text-rose-500">*</span>
            </label>

            {fetchingDoctors ? (
              <div className="py-8 text-center text-slate-400 space-y-2">
                <Loader2 size={24} className="animate-spin mx-auto text-brand-primary-500" />
                <p className="text-xs">{isRTL ? 'جاري تحميل قائمة الدكاترة...' : 'Loading faculty...'}</p>
              </div>
            ) : filteredDoctors.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs italic bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700">
                {isRTL ? 'لم يتم العثور على دكاترة مطابقين للبحث' : 'No professors found matching search'}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 max-h-56 overflow-y-auto pr-1">
                {filteredDoctors.map((doc) => {
                  const isSelected = selectedDoctorId === String(doc.id);
                  const isCurrent = currentAssignedDoctors.some((d) => d.id === doc.id);
                  const deptName = isRTL
                    ? doc.department?.nameAr || doc.department?.name
                    : doc.department?.name || doc.department?.nameAr;
                  const colName = isRTL
                    ? doc.department?.college?.nameAr || doc.department?.college?.name
                    : doc.department?.college?.name || doc.department?.college?.nameAr;

                  return (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => setSelectedDoctorId(String(doc.id))}
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
                          {doc.firstName?.[0] || 'D'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs truncate">
                              د. {doc.firstName} {doc.lastName}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-full">
                                {isRTL ? 'المُسند حالياً' : 'Current'}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 truncate mt-0.5">
                            {doc.specialty && <span>{doc.specialty}</span>}
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
                  {isRTL ? 'إدراج موعد في الجدول الأسبوعي' : 'Include Weekly Schedule Slot'}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {isRTL ? 'حجز موعد رسمي للمحاضرة في جدول الدكتور والقاعة' : 'Book official lecture slot in professor and room schedule'}
                </span>
              </div>
              <input
                type="checkbox"
                checked={includeScheduleSlot}
                onChange={(e) => setIncludeScheduleSlot(e.target.checked)}
                className="w-4 h-4 text-brand-primary-600 rounded border-slate-300 focus:ring-brand-primary-500"
              />
            </div>

            {includeScheduleSlot && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-700 text-xs">
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
                    {isRTL ? 'القاعة / المدرج' : 'Room / Hall'}
                  </label>
                  <input
                    type="text"
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    placeholder="e.g. Hall 1, Lab 3"
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    {isRTL ? 'وقت البدء' : 'Start Time'}
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    {isRTL ? 'وقت الانتهاء' : 'End Time'}
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-medium"
                  />
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
              disabled={loading || !selectedDoctorId}
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
                  <span>{isRTL ? 'تأكيد إسناد الدكتور' : 'Confirm Assignment'}</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
