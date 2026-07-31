// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import examsService from '../../services/exams.service';
import coursesService from '../../services/courses.service';
import collegeService from '../../services/college.service';
import departmentService from '../../services/department.service';
import studentGroupsService from '../../services/studentGroups.service';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Calendar,
  Clock,
  MapPin,
  Loader2,
  CalendarCheck,
  CheckCircle2,
  Timer,
  BookOpen,
  BookOpenCheck,
  Users,
  GraduationCap,
  Building2,
  Info,
  AlertCircle,
  Filter,
  Shield,
} from 'lucide-react';
import Button from '../../components/ui/button';
import Modal from '../../components/ui/Modal';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { calculateDuration, getDurationMinutes, DEFAULT_ANTI_CHEAT_SETTINGS } from './examUtils';

// ── Zod schema ───────────────────────────────────────────────────────────────
const schema = z.object({
  courseId: z.string().min(1, 'Course is required'),
  title: z.string().optional(),
  type: z.enum(['MIDTERM', 'FINAL', 'QUIZ']),
  date: z.string().min(1, 'Date is required'),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
  room: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface AddExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AddExamModal: React.FC<AddExamModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const [colleges, setColleges] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [fetchedGroups, setFetchedGroups] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState('');

  // Anti-cheat settings state
  const [antiCheatEnabled, setAntiCheatEnabled] = useState(DEFAULT_ANTI_CHEAT_SETTINGS.antiCheatEnabled);
  const [maxLeavesBeforeCancel, setMaxLeavesBeforeCancel] = useState(DEFAULT_ANTI_CHEAT_SETTINGS.maxLeavesBeforeCancel);
  const [leaveGraceSeconds, setLeaveGraceSeconds] = useState(DEFAULT_ANTI_CHEAT_SETTINGS.leaveGraceSeconds);
  const [leaveWarningMessage, setLeaveWarningMessage] = useState('');
  const [shuffleQuestions, setShuffleQuestions] = useState(DEFAULT_ANTI_CHEAT_SETTINGS.shuffleQuestions);
  const [requireGeolocation, setRequireGeolocation] = useState(DEFAULT_ANTI_CHEAT_SETTINGS.requireGeolocation);
  const [blockMultipleTabs, setBlockMultipleTabs] = useState(DEFAULT_ANTI_CHEAT_SETTINGS.blockMultipleTabs);

  // Geofencing state
  const [enableGeofencing, setEnableGeofencing] = useState(false);
  const [allowedLat, setAllowedLat] = useState<string>('');
  const [allowedLng, setAllowedLng] = useState<string>('');
  const [allowedRadiusMeters, setAllowedRadiusMeters] = useState<number>(200);
  const [gettingLocation, setGettingLocation] = useState(false);

  const handleDetectCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setAllowedLat(pos.coords.latitude.toFixed(6));
        setAllowedLng(pos.coords.longitude.toFixed(6));
        setGettingLocation(false);
      },
      () => {
        alert('Could not retrieve current location. Please enter manually.');
        setGettingLocation(false);
      }
    );
  };

  // Cascaded filter states
  const [selectedCollegeId, setSelectedCollegeId] = useState<string>('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedSemester, setSelectedSemester] = useState<string>('');
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { courseId: '', title: '', type: 'MIDTERM', date: '', startTime: '09:00', endTime: '11:00', room: '' },
  });

  const selectedCourseId = watch('courseId');
  const selectedType = watch('type');
  const startTime = watch('startTime');
  const endTime = watch('endTime');

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
      reset();
      setSelectedCollegeId('');
      setSelectedDepartmentId('');
      setSelectedYear('');
      setSelectedSemester('');
      setSelectedGroup('ALL');
    }
  }, [isOpen, reset]);

  const loadInitialData = async () => {
    try {
      setLoadingData(true);
      const [colRes, deptRes, crsRes] = await Promise.all([
        collegeService.getColleges(),
        departmentService.getDepartments(),
        coursesService.getCourses(),
      ]);

      if (colRes.success) setColleges(Array.isArray(colRes.data) ? colRes.data : colRes.data?.colleges || []);
      if (deptRes.success) setDepartments(Array.isArray(deptRes.data) ? deptRes.data : deptRes.data?.departments || []);
      if (crsRes.success) setCourses(Array.isArray(crsRes.data) ? crsRes.data : crsRes.data?.courses || []);
    } catch (err) {
      console.error('Failed to load metadata', err);
    } finally {
      setLoadingData(false);
    }
  };

  // Fetch groups dynamically when department or year changes
  useEffect(() => {
    if (selectedDepartmentId) {
      const yearParam = selectedYear ? parseInt(selectedYear) : undefined;
      studentGroupsService
        .getDepartmentGroups(selectedDepartmentId, yearParam)
        .then((res) => {
          if (res.success) {
            const rawNodes = Array.isArray(res.data) ? res.data : res.data?.groups || [];
            const flattenTree = (nodes: any[]): any[] =>
              nodes.flatMap((n: any) => [n, ...flattenTree(n.children || [])]);
            setFetchedGroups(flattenTree(rawNodes));
          }
        })
        .catch((err) => console.error('Failed to load department groups', err));
    } else {
      setFetchedGroups([]);
    }
  }, [selectedDepartmentId, selectedYear]);

  // Filtered departments list based on selected College
  const availableDepartments = useMemo(() => {
    if (!selectedCollegeId) return departments;
    return departments.filter((d) => String(d.collegeId) === String(selectedCollegeId));
  }, [departments, selectedCollegeId]);

  // Filtered courses based on College, Department, Year, Semester
  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      if (selectedCollegeId) {
        const dept = departments.find((d) => String(d.id) === String(c.departmentId));
        if (dept && String(dept.collegeId) !== String(selectedCollegeId)) return false;
      }
      if (selectedDepartmentId && String(c.departmentId) !== String(selectedDepartmentId)) return false;
      if (selectedYear && String(c.year) !== String(selectedYear)) return false;
      if (selectedSemester && String(c.semester) !== String(selectedSemester)) return false;
      return true;
    });
  }, [courses, departments, selectedCollegeId, selectedDepartmentId, selectedYear, selectedSemester]);

  // Selected course details
  const selectedCourse = useMemo(() => {
    if (!selectedCourseId) return null;
    return courses.find((c) => String(c.id) === String(selectedCourseId)) || null;
  }, [selectedCourseId, courses]);

  // Sync course selection back to filter fields if user picks course directly
  const handleCourseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cid = e.target.value;
    setValue('courseId', cid);
    if (cid) {
      const found = courses.find((c) => String(c.id) === String(cid));
      if (found) {
        if (found.departmentId) {
          setSelectedDepartmentId(String(found.departmentId));
          const dept = departments.find((d) => String(d.id) === String(found.departmentId));
          if (dept?.collegeId) setSelectedCollegeId(String(dept.collegeId));
        }
        if (found.year) setSelectedYear(String(found.year));
        if (found.semester) setSelectedSemester(String(found.semester));
      }
    }
  };

  // Duration calculation
  const durationInfo = useMemo(() => {
    return calculateDuration(startTime, endTime, t);
  }, [startTime, endTime, t]);

  const onSubmit = async (data: FormData) => {
    setError('');
    try {
      // Calculate durationMinutes from start/end time
      const durationMinutes = getDurationMinutes(data.startTime, data.endTime);

      const finalData: any = {
        ...data,
        durationMinutes,
        // Anti-cheat settings
        antiCheatEnabled,
        maxLeavesBeforeCancel,
        leaveGraceSeconds,
        leaveWarningMessage: leaveWarningMessage.trim() || undefined,
        shuffleQuestions,
        requireGeolocation: requireGeolocation || enableGeofencing, // Geofencing automatically requires geolocation
        blockMultipleTabs,
        enableGeofencing,
        allowedLat: allowedLat ? parseFloat(allowedLat) : null,
        allowedLng: allowedLng ? parseFloat(allowedLng) : null,
        allowedRadiusMeters,
      };

      // Append target group to room/location info if specific group is selected
      if (selectedGroup && selectedGroup !== 'ALL') {
        const roomInfo = finalData.room ? finalData.room.trim() : '';
        finalData.room = roomInfo ? `${roomInfo} [${selectedGroup}]` : `[${selectedGroup}]`;
      }

      const result = await examsService.createExam(finalData);
      if (result.success) {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || t('exams.createError'));
    }
  };

  const yearLabel = selectedCourse?.year
    ? t(`exams.yearLevel${selectedCourse.year}`, { defaultValue: `${t('exams.yearLevel')} ${selectedCourse.year}` })
    : selectedYear
    ? `${t('exams.yearLevel')} ${selectedYear}`
    : t('exams.allYears');

  const departmentName =
    selectedCourse?.department?.nameAr ||
    selectedCourse?.department?.name ||
    departments.find((d) => String(d.id) === String(selectedDepartmentId))?.nameAr ||
    departments.find((d) => String(d.id) === String(selectedDepartmentId))?.name ||
    t('exams.generalDepartment');

  const semesterLabel = selectedCourse?.semester
    ? selectedCourse.semester === 1
      ? t('exams.semester1')
      : t('exams.semester2')
    : selectedSemester
    ? selectedSemester === '1'
      ? t('exams.semester1')
      : t('exams.semester2')
    : t('exams.semester1');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title={
        <div className="flex items-center gap-3 text-brand-text-primary dark:text-white">
          <div className="p-2.5 rounded-2xl bg-brand-primary-500/10 text-brand-primary-600 dark:text-brand-primary-400 shrink-0">
            <CalendarCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold">{t('exams.scheduleNew')}</h2>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
              {t('exams.scheduleSubtitle')}
            </p>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-2">
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-600 text-sm font-bold flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Section 1: College, Department, Year, Semester, Group & Course Filters ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 ms-1">
              <Filter className="w-4 h-4 text-brand-primary-500" />
              {t('exams.filterTargetLabel')}
            </span>
            {loadingData && <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-primary-500" />}
          </div>

          {/* 5 Cascading Filters */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
            {/* 1. College */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-brand-primary-500" />
                {t('exams.selectCollege')}
              </label>
              <select
                value={selectedCollegeId}
                onChange={(e) => {
                  setSelectedCollegeId(e.target.value);
                  setSelectedDepartmentId('');
                  setValue('courseId', '');
                }}
                className="w-full h-9 px-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-brand-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 transition-all cursor-pointer"
              >
                <option value="">{t('exams.allColleges')}</option>
                {colleges.map((col: any) => (
                  <option key={col.id} value={col.id}>{col.nameAr || col.name}</option>
                ))}
              </select>
            </div>

            {/* 2. Department */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5 text-brand-primary-500" />
                {t('exams.selectDepartment')}
              </label>
              <select
                value={selectedDepartmentId}
                onChange={(e) => {
                  setSelectedDepartmentId(e.target.value);
                  setValue('courseId', '');
                }}
                className="w-full h-9 px-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-brand-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 transition-all cursor-pointer"
              >
                <option value="">{t('exams.allDepartments')}</option>
                {availableDepartments.map((dept: any) => (
                  <option key={dept.id} value={dept.id}>{dept.nameAr || dept.name}</option>
                ))}
              </select>
            </div>

            {/* 3. Year */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-brand-primary-500" />
                {t('exams.selectYear')}
              </label>
              <select
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(e.target.value);
                  setValue('courseId', '');
                }}
                className="w-full h-9 px-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-brand-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 transition-all cursor-pointer"
              >
                <option value="">{t('exams.allYears')}</option>
                {[1, 2, 3, 4, 5].map((y) => (
                  <option key={y} value={String(y)}>{t(`exams.yearLevel${y}`, { defaultValue: `${t('exams.yearLevel')} ${y}` })}</option>
                ))}
              </select>
            </div>

            {/* 4. Semester */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-brand-primary-500" />
                {t('exams.selectSemester')}
              </label>
              <select
                value={selectedSemester}
                onChange={(e) => {
                  setSelectedSemester(e.target.value);
                  setValue('courseId', '');
                }}
                className="w-full h-9 px-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-brand-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 transition-all cursor-pointer"
              >
                <option value="">{t('exams.allSemesters')}</option>
                <option value="1">{t('exams.semester1')}</option>
                <option value="2">{t('exams.semester2')}</option>
              </select>
            </div>

            {/* 5. Group / Section Selection */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-emerald-500" />
                {t('exams.selectGroup')}
              </label>
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="w-full h-9 px-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-brand-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 transition-all cursor-pointer"
              >
                <option value="ALL">{t('exams.allGroups')}</option>
                {fetchedGroups.map((g: any) => (
                  <option key={g.id} value={g.name}>
                    {g.parentGroupId ? `  └─ ${t('exams.section')} ${g.name}` : `${t('exams.group')} ${g.name}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Course Selection Dropdown */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 ms-1">
                <BookOpen className="w-4 h-4 text-brand-primary-500" />
                {t('exams.selectCourse')} *
              </label>
              <span className="text-[11px] font-semibold text-brand-primary-600 dark:text-brand-primary-400">
                {t('exams.matchingCoursesCount', { count: filteredCourses.length })}
              </span>
            </div>
            <select
              className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-brand-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 transition-all cursor-pointer"
              value={selectedCourseId}
              onChange={handleCourseChange}
            >
              <option value="">{t('exams.chooseCourse')}</option>
              {filteredCourses.map((c: any) => {
                const yearStr = c.year ? ` — ${t('exams.yearLevel')} ${c.year}` : '';
                const deptStr = c.department?.nameAr || c.department?.name ? ` (${c.department.nameAr || c.department.name})` : '';
                return (
                  <option key={c.id} value={c.id}>
                    {c.courseCode} — {c.name} {deptStr} {yearStr}
                  </option>
                );
              })}
            </select>
            {errors.courseId && <p className="text-rose-500 text-xs mt-1 font-bold">{errors.courseId.message}</p>}
            {filteredCourses.length === 0 && (
              <p className="text-amber-600 dark:text-amber-400 text-xs font-semibold mt-1">
                {t('exams.noCoursesFoundFilter')}
              </p>
            )}
          </div>

          {/* Dynamic Target Audience Summary Card */}
          {selectedCourse ? (
            <div className="bg-brand-primary-500/5 dark:bg-brand-primary-500/10 border border-brand-primary-500/20 rounded-2xl p-4 space-y-3 text-xs animate-in fade-in duration-300">
              <div className="flex items-center justify-between border-b border-brand-primary-500/10 pb-2.5">
                <span className="flex items-center gap-2 font-extrabold text-brand-primary-700 dark:text-brand-primary-300 text-sm">
                  <Users className="w-4 h-4 text-brand-primary-500" />
                  {t('exams.targetAudience')}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-extrabold text-[11px]">
                  🎯 {selectedGroup === 'ALL' ? t('exams.allGroupsShort') : `${t('exams.customTarget')}: ${selectedGroup}`}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-white/60 dark:bg-slate-800/60 p-2 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                  <span className="text-slate-400 block font-semibold text-[10px] mb-0.5">{t('exams.targetDepartment')}</span>
                  <span className="font-extrabold text-brand-text-primary dark:text-white truncate block">{departmentName}</span>
                </div>
                <div className="bg-white/60 dark:bg-slate-800/60 p-2 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                  <span className="text-slate-400 block font-semibold text-[10px] mb-0.5">{t('exams.targetYear')}</span>
                  <span className="font-extrabold text-brand-primary-600 dark:text-brand-primary-400 block">{yearLabel}</span>
                </div>
                <div className="bg-white/60 dark:bg-slate-800/60 p-2 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                  <span className="text-slate-400 block font-semibold text-[10px] mb-0.5">{t('exams.targetSemester')}</span>
                  <span className="font-extrabold text-brand-text-primary dark:text-white block">{semesterLabel}</span>
                </div>
                <div className="bg-white/60 dark:bg-slate-800/60 p-2 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                  <span className="text-slate-400 block font-semibold text-[10px] mb-0.5">{t('exams.targetGroupLabel')}</span>
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400 block truncate">
                    {selectedGroup === 'ALL' ? t('exams.allGroupsShort') : selectedGroup}
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-2 text-brand-primary-800 dark:text-brand-primary-200 bg-brand-primary-500/10 p-2.5 rounded-xl font-medium leading-relaxed">
                <Info className="w-4 h-4 mt-0.5 shrink-0 text-brand-primary-500" />
                <p>
                  {selectedGroup === 'ALL'
                    ? t('exams.targetNotice')
                    : t('exams.targetGroupNotice', { group: selectedGroup })}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700/60 rounded-2xl p-3.5 text-xs text-slate-500 flex items-center gap-2.5">
              <GraduationCap className="w-4 h-4 text-slate-400 shrink-0" />
              <span>{t('exams.selectCourseNotice')}</span>
            </div>
          )}
        </div>

        {/* ── Section 2: Exam Assessment Type & Custom Title ────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 ms-1">
              <BookOpenCheck className="w-4 h-4 text-brand-primary-500" />
              {t('exams.examTypeTitle') || 'نوع ومسمى الامتحان'} *
            </label>
            <span className="text-[10px] font-semibold text-brand-text-secondary">
              {t('exams.customTypeHint') || 'اكتب مسمى مخصص أو اختر فئة جاهزة'}
            </span>
          </div>

          {/* Custom Title Input */}
          <div>
            <input
              type="text"
              placeholder={t('exams.customTypePlaceholder') || 'اكتب مسمى الامتحان هنا (مثال: اختبار شهر أكتوبر، امتحان عملي برمجة...)'}
              {...register('title')}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-brand-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 transition-all placeholder:font-medium placeholder:text-slate-400"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            {/* MIDTERM */}
            <div
              onClick={() => {
                setValue('type', 'MIDTERM');
                if (!watch('title')) setValue('title', t('exams.midterm') || 'امتحان منتصف الفصل');
              }}
              className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all duration-200 flex flex-col justify-between space-y-2 ${
                selectedType === 'MIDTERM'
                  ? 'border-amber-500 bg-amber-500/5 ring-2 ring-amber-500/20 shadow-sm'
                  : 'border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded-lg">
                  {t('exams.typeMidterm')}
                </span>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedType === 'MIDTERM' ? 'border-amber-500 bg-amber-500' : 'border-slate-300'}`}>
                  {selectedType === 'MIDTERM' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
              </div>
              <div>
                <h4 className="font-extrabold text-xs text-slate-800 dark:text-white">{t('exams.midterm')}</h4>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{t('exams.midtermDesc')}</p>
              </div>
            </div>

            {/* FINAL */}
            <div
              onClick={() => {
                setValue('type', 'FINAL');
                if (!watch('title')) setValue('title', t('exams.final') || 'الامتحان النهائي');
              }}
              className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all duration-200 flex flex-col justify-between space-y-2 ${
                selectedType === 'FINAL'
                  ? 'border-rose-500 bg-rose-500/5 ring-2 ring-rose-500/20 shadow-sm'
                  : 'border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/40 px-2 py-0.5 rounded-lg">
                  {t('exams.typeFinal')}
                </span>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedType === 'FINAL' ? 'border-rose-500 bg-rose-500' : 'border-slate-300'}`}>
                  {selectedType === 'FINAL' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
              </div>
              <div>
                <h4 className="font-extrabold text-xs text-slate-800 dark:text-white">{t('exams.final')}</h4>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{t('exams.finalDesc')}</p>
              </div>
            </div>

            {/* QUIZ */}
            <div
              onClick={() => {
                setValue('type', 'QUIZ');
                if (!watch('title')) setValue('title', t('exams.quiz') || 'اختبار قصير');
              }}
              className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all duration-200 flex flex-col justify-between space-y-2 ${
                selectedType === 'QUIZ'
                  ? 'border-sky-500 bg-sky-500/5 ring-2 ring-sky-500/20 shadow-sm'
                  : 'border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-sky-700 dark:text-sky-400 bg-sky-100 dark:bg-sky-900/40 px-2 py-0.5 rounded-lg">
                  {t('exams.typeQuiz')}
                </span>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedType === 'QUIZ' ? 'border-sky-500 bg-sky-500' : 'border-slate-300'}`}>
                  {selectedType === 'QUIZ' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
              </div>
              <div>
                <h4 className="font-extrabold text-xs text-slate-800 dark:text-white">{t('exams.quiz')}</h4>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{t('exams.quizDesc')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 3: Timing, Room & Duration ───────────────────────────── */}
        <div className="space-y-3 pt-1 border-t border-slate-100 dark:border-slate-800">
          <div className="grid grid-cols-2 gap-4">
            {/* Exam Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 ms-1">
                <Calendar className="w-4 h-4 text-brand-primary-500" />
                {t('exams.examDate')} *
              </label>
              <input
                type="date"
                className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-brand-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 transition-all"
                {...register('date')}
              />
              {errors.date && <p className="text-rose-500 text-xs mt-1 font-bold">{errors.date.message}</p>}
            </div>

            {/* Room */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 ms-1">
                <MapPin className="w-4 h-4 text-brand-primary-500" />
                {t('exams.room')}
              </label>
              <input
                type="text"
                placeholder={t('exams.roomPlaceholder')}
                className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-brand-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 transition-all"
                {...register('room')}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Start Time */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 ms-1">
                <Clock className="w-4 h-4 text-brand-primary-500" />
                {t('exams.startTime')} *
              </label>
              <input
                type="time"
                className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-brand-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 transition-all"
                {...register('startTime')}
              />
              {errors.startTime && <p className="text-rose-500 text-xs mt-1 font-bold">{errors.startTime.message}</p>}
            </div>

            {/* End Time */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 ms-1">
                <Clock className="w-4 h-4 text-brand-primary-500" />
                {t('exams.endTime')} *
              </label>
              <input
                type="time"
                className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-brand-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 transition-all"
                {...register('endTime')}
              />
              {errors.endTime && <p className="text-rose-500 text-xs mt-1 font-bold">{errors.endTime.message}</p>}
            </div>
          </div>

          {/* Calculated Duration Indicator */}
          {durationInfo ? (
            durationInfo.isValid ? (
              <div className="flex items-center justify-between px-4 py-2.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-400">
                <span className="flex items-center gap-2">
                  <Timer className="w-4 h-4 text-emerald-500" />
                  {t('exams.calculatedDuration')}
                </span>
                <span className="bg-emerald-500 text-white px-3 py-0.5 rounded-full font-black text-xs">
                  {durationInfo.text}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{t('exams.endAfterStart')}</span>
              </div>
            )
          ) : null}
        </div>

        {/* ── Section 4: Anti-Cheat Protection Settings ────────────────────── */}
        <div className="space-y-3 pt-1 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 pt-2">
            <Shield className="w-4 h-4 text-rose-500" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {t('exams.antiCheatSettingsTitle')}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 font-semibold ms-1">
            {t('exams.antiCheatSettingsDesc')}
          </p>

          {/* Master Toggle */}
          <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 cursor-pointer">
            <div className="flex-1 me-3">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 block">{t('exams.settingAntiCheatEnabled')}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">{t('exams.settingAntiCheatEnabledDesc')}</span>
            </div>
            <input type="checkbox" checked={antiCheatEnabled} onChange={(e) => setAntiCheatEnabled(e.target.checked)} className="w-5 h-5 rounded accent-brand-primary-500 cursor-pointer" />
          </label>

          {antiCheatEnabled && (
            <div className="space-y-2.5 animate-in fade-in duration-300">
              {/* Max Leaves */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">{t('exams.settingMaxLeaves')}</label>
                  <input type="number" min={0} max={10} value={maxLeavesBeforeCancel} onChange={(e) => setMaxLeavesBeforeCancel(parseInt(e.target.value) || 1)} className="w-full h-8 px-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-brand-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20" />
                  <span className="text-[9px] text-slate-400 mt-0.5 block">{t('exams.settingMaxLeavesDesc')}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">{t('exams.settingGraceSeconds')}</label>
                  <input type="number" min={3} max={60} value={leaveGraceSeconds} onChange={(e) => setLeaveGraceSeconds(parseInt(e.target.value) || 5)} className="w-full h-8 px-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-brand-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20" />
                  <span className="text-[9px] text-slate-400 mt-0.5 block">{t('exams.settingGraceSecondsDesc')}</span>
                </div>
              </div>

              {/* Custom Warning Message */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <label className="text-[10px] font-bold text-slate-500 block mb-1">{t('exams.settingWarningMessage')}</label>
                <textarea rows={2} value={leaveWarningMessage} onChange={(e) => setLeaveWarningMessage(e.target.value)} placeholder={t('exams.settingWarningPlaceholder')} className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-brand-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 resize-none placeholder:text-slate-400" />
                <span className="text-[9px] text-slate-400 mt-0.5 block">{t('exams.settingWarningMessageDesc')}</span>
              </div>

              {/* Toggle Settings */}
              <div className="grid grid-cols-1 gap-2">
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 cursor-pointer">
                  <div className="flex-1 me-3">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 block">{t('exams.settingShuffleQuestions')}</span>
                    <span className="text-[9px] text-slate-400 block">{t('exams.settingShuffleQuestionsDesc')}</span>
                  </div>
                  <input type="checkbox" checked={shuffleQuestions} onChange={(e) => setShuffleQuestions(e.target.checked)} className="w-4 h-4 rounded accent-brand-primary-500 cursor-pointer" />
                </label>
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 cursor-pointer">
                  <div className="flex-1 me-3">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 block">{t('exams.settingRequireGeolocation')}</span>
                    <span className="text-[9px] text-slate-400 block">{t('exams.settingRequireGeolocationDesc')}</span>
                  </div>
                  <input type="checkbox" checked={requireGeolocation} onChange={(e) => setRequireGeolocation(e.target.checked)} className="w-4 h-4 rounded accent-brand-primary-500 cursor-pointer" />
                </label>
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 cursor-pointer">
                  <div className="flex-1 me-3">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 block">{t('exams.settingBlockMultipleTabs')}</span>
                    <span className="text-[9px] text-slate-400 block">{t('exams.settingBlockMultipleTabsDesc')}</span>
                  </div>
                  <input type="checkbox" checked={blockMultipleTabs} onChange={(e) => setBlockMultipleTabs(e.target.checked)} className="w-4 h-4 rounded accent-brand-primary-500 cursor-pointer" />
                </label>

                {/* Geofencing Location Restriction Toggle */}
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 cursor-pointer">
                  <div className="flex-1 me-3">
                    <span className="text-[11px] font-bold font-emerald-600 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {t('exams.settingEnableGeofencing') || 'تقييد الامتحان بمبنى / نطاق جغرافي محدد'}
                    </span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">
                      {t('exams.settingEnableGeofencingDesc') || 'السماح للطلاب في قاعة الامتحان / المبنى فقط بدخول الامتحان عن طريق الـ GPS'}
                    </span>
                  </div>
                  <input type="checkbox" checked={enableGeofencing} onChange={(e) => setEnableGeofencing(e.target.checked)} className="w-4 h-4 rounded accent-emerald-500 cursor-pointer" />
                </label>

                {/* Geofencing Fields */}
                {enableGeofencing && (
                  <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-300">
                        {t('exams.geofenceCoordinatesTitle') || 'إحداثيات المبنى والنطاق المسموح'}
                      </span>
                      <button
                        type="button"
                        onClick={handleDetectCurrentLocation}
                        disabled={gettingLocation}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500 text-white text-[10px] font-bold hover:bg-emerald-600 transition-all flex items-center gap-1 disabled:opacity-50"
                      >
                        {gettingLocation ? <Loader2 className="w-3 h-3 animate-spin" /> : <MapPin className="w-3 h-3" />}
                        {t('exams.useCurrentLocation') || 'تحديد موقعي الحالي كمبنى الامتحان'}
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 block mb-1">{t('exams.latitude') || 'خط العرض (Lat)'}</label>
                        <input
                          type="text"
                          placeholder="30.0444"
                          value={allowedLat}
                          onChange={(e) => setAllowedLat(e.target.value)}
                          className="w-full h-8 px-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-brand-text-primary dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 block mb-1">{t('exams.longitude') || 'خط الطول (Lng)'}</label>
                        <input
                          type="text"
                          placeholder="31.2357"
                          value={allowedLng}
                          onChange={(e) => setAllowedLng(e.target.value)}
                          className="w-full h-8 px-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-brand-text-primary dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 block mb-1">{t('exams.allowedRadius') || 'النطاق المسموح (متر)'}</label>
                        <input
                          type="number"
                          min={20}
                          max={5000}
                          value={allowedRadiusMeters}
                          onChange={(e) => setAllowedRadiusMeters(parseInt(e.target.value) || 200)}
                          className="w-full h-8 px-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-brand-text-primary dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="!bg-brand-primary-500 hover:!bg-brand-primary-600 text-white font-extrabold px-6 h-11 rounded-xl shadow-md shadow-brand-primary-500/20 flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('common.saving')}
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                {t('exams.scheduleExamSubmit')}
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AddExamModal;
