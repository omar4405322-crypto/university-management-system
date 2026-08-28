// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { X, Clock, MapPin, BookOpen, Calendar, AlertCircle, Users, User, Building2, GraduationCap } from 'lucide-react';
import Button from '../../components/ui/button';
import schedulesService from '../../services/schedules.service';
import studentGroupsService from '../../services/studentGroups.service';
import teachingAssistantsService from '../../services/teachingAssistants.service';
import collegeService from '../../services/college.service';
import departmentService from '../../services/department.service';
import coursesService from '../../services/courses.service';
import { useLanguage } from '../../context/LanguageContext';
import InstructorSelector from '../../components/timetable/InstructorSelector';
import SearchableSelect, { SelectOption } from '../../components/ui/SearchableSelect';
import { getScheduleStartTime } from '../../utils/scheduleConfig';
import { notifyScheduleChange } from '../../utils/scheduleSync';

const schema = z.object({
  courseId: z.string().min(1, 'Course is required'),
  groupId: z.string().optional(), // empty string means 'All Students' (department-wide)
  doctorId: z.string().min(1, 'Doctor is required'),
  slotType: z.string().min(1, 'Slot Type is required'),
  teachingAssistantId: z.string().optional(),
  dayOfWeek: z.string().min(1, 'Day of week is required'),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
  room: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const defaultStart = getScheduleStartTime();
const defaultStartHour = parseInt(defaultStart.split(':')[0], 10) || 9;
const defaultEnd = `${(defaultStartHour + 2).toString().padStart(2, '0')}:00`;

const ScheduleModal = ({ isOpen, onClose, schedule, courses = [], onSuccess }) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const [error, setError] = useState(null);
  
  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [fetchedCourses, setFetchedCourses] = useState([]);
  const [selectedCollegeId, setSelectedCollegeId] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  
  const [groups, setGroups] = useState([]);
  const [tas, setTas] = useState([]);
  const [loadingColleges, setLoadingColleges] = useState(false);
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      courseId: '',
      groupId: '',
      doctorId: '',
      slotType: 'LECTURE',
      teachingAssistantId: '',
      dayOfWeek: 'MONDAY',
      startTime: defaultStart,
      endTime: defaultEnd,
      room: ''
    }
  });

  const selectedCourseId = watch('courseId');
  const watchedSlotType = watch('slotType');

  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const slotTypes = ['LECTURE', 'SECTION', 'LAB'];

  // Load Initial Data when modal opens
  useEffect(() => {
    if (isOpen) {
      setLoadingColleges(true);
      collegeService.getColleges()
        .then(res => {
          if (res.success) {
            setColleges(Array.isArray(res.data) ? res.data : res.data?.data || []);
          }
        })
        .catch(err => console.error('Failed to load colleges', err))
        .finally(() => setLoadingColleges(false));

      setLoadingDepts(true);
      departmentService.getDepartments()
        .then(res => {
          if (res.success) {
            setDepartments(Array.isArray(res.data) ? res.data : res.data?.data || []);
          }
        })
        .catch(err => console.error('Failed to load departments', err))
        .finally(() => setLoadingDepts(false));

      setLoadingCourses(true);
      coursesService.getCourses()
        .then(res => {
          if (res.success) {
            const list = Array.isArray(res.data) ? res.data : res.data?.data?.courses || res.data?.courses || res.data?.data || [];
            setFetchedCourses(list);
          }
        })
        .catch(err => console.error('Failed to load courses', err))
        .finally(() => setLoadingCourses(false));

      teachingAssistantsService.getTeachingAssistants()
        .then(res => {
          if (res.success) setTas(res.data?.teachingAssistants || res.data || []);
        })
        .catch(err => console.error(err));
    }
  }, [isOpen]);

  // When college selection changes
  const handleCollegeChange = (collegeId: string) => {
    setSelectedCollegeId(collegeId);
    setSelectedDepartmentId('');
    setSelectedYear('');
    setSelectedSemester('');
    setValue('courseId', '');
    setValue('groupId', '');
    setValue('doctorId', '');
    setGroups([]);
  };

  // When department selection changes
  const handleDepartmentChange = (departmentId: string) => {
    setSelectedDepartmentId(departmentId);
    setSelectedYear('');
    setSelectedSemester('');
    setValue('courseId', '');
    setValue('groupId', '');
    setValue('doctorId', '');
    
    if (departmentId) {
      setLoadingGroups(true);
      // Pass selectedYear if already chosen; defaults to undefined (backend fetches all years)
      const yearParam = selectedYear ? parseInt(selectedYear) : undefined;
      studentGroupsService.getDepartmentGroups(departmentId, yearParam)
        .then(res => {
          if (res.success) {
            // Backend returns a tree array directly in res.data
            const rawGroups = Array.isArray(res.data) ? res.data : res.data?.groups || [];
            // Flatten tree: include root groups and all their children
            const flattenGroups = (nodes: any[]): any[] =>
              nodes.flatMap((n: any) => [n, ...flattenGroups(n.children || [])]);
            setGroups(flattenGroups(rawGroups));
          }
        })
        .catch(err => console.error('Failed to load groups', err))
        .finally(() => setLoadingGroups(false));
    } else {
      setGroups([]);
    }
  };

  // Fetch courses dynamically whenever Department, Academic Year, or Semester changes
  useEffect(() => {
    if (!selectedDepartmentId) {
      setFetchedCourses([]);
      return;
    }

    setLoadingCourses(true);
    const params: any = { departmentId: selectedDepartmentId };
    if (selectedYear) params.year = selectedYear;
    if (selectedSemester) params.semester = selectedSemester;

    coursesService.getCourses(params)
      .then(res => {
        if (res.success) {
          const list = Array.isArray(res.data) ? res.data : res.data?.data?.courses || res.data?.courses || res.data?.data || [];
          setFetchedCourses(list);
        }
      })
      .catch(err => console.error('Failed to load courses', err))
      .finally(() => setLoadingCourses(false));
  }, [selectedDepartmentId, selectedYear, selectedSemester]);

  // Filter departments based on selected College
  const availableDepartments = useMemo(() => {
    return departments.filter((d: any) => {
      if (!selectedCollegeId) return true;
      const colId = d.collegeId || d.college?.id;
      return colId && colId.toString() === selectedCollegeId.toString();
    });
  }, [departments, selectedCollegeId]);

  // Combine prop courses & fetched courses, and filter intelligently
  const availableCourses = useMemo(() => {
    const combined = [...(courses || []), ...fetchedCourses];
    const uniqueMap = new Map();
    combined.forEach(item => {
      if (item && item.id) uniqueMap.set(item.id.toString(), item);
    });
    const allUnique = Array.from(uniqueMap.values());

    return allUnique.filter((c: any) => {
      const deptId = c.departmentId ?? c.department?.id;
      const colId = c.collegeId ?? c.department?.collegeId ?? c.department?.college?.id;
      const yr = (c.year || 1).toString();
      const sem = (c.semester || 1).toString();

      if (selectedDepartmentId && deptId && deptId.toString() !== selectedDepartmentId.toString()) return false;
      if (selectedCollegeId && colId && colId.toString() !== selectedCollegeId.toString()) return false;
      if (selectedYear && yr !== selectedYear.toString()) return false;
      if (selectedSemester && sem !== selectedSemester.toString()) return false;
      return true;
    });
  }, [courses, fetchedCourses, selectedCollegeId, selectedDepartmentId, selectedYear, selectedSemester]);

  const collegeOptions: SelectOption[] = useMemo(() => {
    return colleges.map((c: any) => ({
      value: c.id.toString(),
      label: isRTL ? c.nameAr || c.name : c.name
    }));
  }, [colleges, isRTL]);

  const departmentOptions: SelectOption[] = useMemo(() => {
    return availableDepartments.map((d: any) => ({
      value: d.id.toString(),
      label: isRTL ? d.nameAr || d.name : d.name
    }));
  }, [availableDepartments, isRTL]);

  const courseOptions: SelectOption[] = useMemo(() => {
    return availableCourses.map((course: any) => {
      const code = course.code || course.courseCode ? `${course.code || course.courseCode} - ` : '';
      const name = isRTL ? course.nameAr || course.name : course.name;
      const deptName = course.department ? (isRTL ? course.department.nameAr || course.department.name : course.department.name) : '';
      const yearText = `${t('common.year', 'Year')} ${course.year || 1}`;
      const semText = `${t('schedule.sem', 'Sem')} ${course.semester || 1}`;
      const metaInfo = `${yearText} • ${semText}${deptName ? ` • ${deptName}` : ''}`;
      
      return {
        value: course.id.toString(),
        label: `${code}${name}`,
        sublabel: metaInfo
      };
    });
  }, [availableCourses, isRTL, t]);

  // Fetch groups when courseId changes directly
  useEffect(() => {
    if (!selectedCourseId) return;
    
    const allKnown = [...(courses || []), ...fetchedCourses];
    const course = allKnown.find((c: any) => c.id.toString() === selectedCourseId.toString());
    if (!course) return;

    const departmentId = (course.departmentId || course.department?.id)?.toString();
    const collegeId = (course.collegeId || course.department?.collegeId || course.department?.college?.id)?.toString();
    const courseYear = course.year ? parseInt(course.year) : undefined;

    if (collegeId && !selectedCollegeId) {
      setSelectedCollegeId(collegeId);
    }
    if (departmentId) {
      if (!selectedDepartmentId) setSelectedDepartmentId(departmentId);
      setLoadingGroups(true);
      studentGroupsService.getDepartmentGroups(departmentId, courseYear)
        .then(res => {
          if (res.success) {
            const rawGroups = Array.isArray(res.data) ? res.data : res.data?.groups || [];
            const flattenGroups = (nodes: any[]): any[] =>
              nodes.flatMap((n: any) => [n, ...flattenGroups(n.children || [])]);
            setGroups(flattenGroups(rawGroups));
          }
        })
        .catch(err => console.error('Failed to load groups', err))
        .finally(() => setLoadingGroups(false));
    }
  }, [selectedCourseId, courses, fetchedCourses]);

  useEffect(() => {
    if (schedule) {
      reset({
        courseId: schedule.courseId?.toString() || '',
        groupId: schedule.groupId?.toString() || '',
        doctorId: schedule.doctorId?.toString() || '',
        slotType: schedule.slotType || 'LECTURE',
        teachingAssistantId: schedule.teachingAssistantId?.toString() || '',
        dayOfWeek: schedule.dayOfWeek,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        room: schedule.room || ''
      });
      
      if (schedule.group) {
        setGroups([schedule.group]);
      }
    } else {
      reset({
        courseId: '',
        groupId: '',
        doctorId: '',
        slotType: 'LECTURE',
        teachingAssistantId: '',
        dayOfWeek: 'MONDAY',
        startTime: defaultStart,
        endTime: defaultEnd,
        room: ''
      });
      setSelectedCollegeId('');
      setSelectedDepartmentId('');
      setGroups([]);
    }
    setError(null);
  }, [schedule, isOpen, reset]);

  const onSubmit = async (data: FormData) => {
    setError(null);

    const payload = {
      ...data,
      courseId: parseInt(data.courseId),
      // Empty groupId means 'All Students' — send null for a department-wide slot
      groupId: data.groupId ? parseInt(data.groupId) : null,
      doctorId: parseInt(data.doctorId),
      slotType: data.slotType,
      teachingAssistantId: data.teachingAssistantId ? parseInt(data.teachingAssistantId) : null
    };

    try {
      let result;
      if (schedule) {
        result = await schedulesService.updateSchedule(schedule.id, payload);
      } else {
        result = await schedulesService.createSchedule(payload);
      }

      if (result.success) {
        notifyScheduleChange();
        onSuccess();
      } else {
        setError(result.message);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || t('schedules.conflictError', 'Conflict detected');
      setError(msg);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/10">
          <h2 className="text-lg font-bold text-brand-text-primary dark:text-brand-text-main">
            {schedule ? t('schedules.EDIT_TITLE', 'Edit Schedule') : t('schedules.CREATE_TITLE', 'Create New Schedule')}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-4 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl text-sm flex items-start gap-3 border border-rose-200 dark:border-rose-500/20">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <div className="flex flex-col">
                <span className="font-bold">{t('schedules.conflictError', 'Conflict detected')}</span>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* ── College & Department Searchable Selectors ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-brand-text-primary dark:text-brand-text-main flex items-center gap-2">
                <Building2 size={14} className="text-slate-400" /> {t('colleges.college', 'College')}
              </label>
              <SearchableSelect
                options={collegeOptions}
                value={selectedCollegeId}
                onChange={handleCollegeChange}
                placeholder={loadingColleges ? t('common.loading', 'Loading...') : t('timetables.selectCollege', 'All Colleges')}
                searchPlaceholder={t('common.searchCollege', 'common.searchCollege')}
                disabled={!!schedule || loadingColleges}
                isRTL={isRTL}
                icon={<Building2 size={16} />}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-brand-text-primary dark:text-brand-text-main flex items-center gap-2">
                <GraduationCap size={14} className="text-slate-400" /> {t('departments.department', 'Department')}
              </label>
              <SearchableSelect
                options={departmentOptions}
                value={selectedDepartmentId}
                onChange={handleDepartmentChange}
                placeholder={loadingDepts ? t('common.loading', 'Loading...') : t('timetables.selectDept', 'Select Department')}
                searchPlaceholder={t('common.searchDept', 'common.searchDept')}
                disabled={!selectedCollegeId || loadingDepts || !!schedule}
                isRTL={isRTL}
                icon={<GraduationCap size={16} />}
              />
            </div>
          </div>

          {/* ── Academic Year & Semester Selectors ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-brand-text-primary dark:text-brand-text-main flex items-center gap-2">
                <Calendar size={14} className="text-slate-400" /> {t('auth.year', 'Academic Year')}
              </label>
              <select
                value={selectedYear}
                disabled={!selectedDepartmentId}
                onChange={(e) => {
                  setSelectedYear(e.target.value);
                  setValue('courseId', '');
                }}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 transition-all cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">{t('common.allYears', 'All Years')}</option>
                {[1, 2, 3, 4, 5].map(y => (
                  <option key={y} value={y.toString()}>{t('common.year', 'Year')} {y}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-brand-text-primary dark:text-brand-text-main flex items-center gap-2">
                <Clock size={14} className="text-slate-400" /> {t('schedule.semester', 'Semester')}
              </label>
              <select
                value={selectedSemester}
                disabled={!selectedDepartmentId}
                onChange={(e) => {
                  setSelectedSemester(e.target.value);
                  setValue('courseId', '');
                }}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 transition-all cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">{t('schedule.allSemesters', 'Semester')}</option>
                <option value="1">{t('schedule.semester1', 'Semester 1')}</option>
                <option value="2">{t('schedule.semester2', 'Semester 2')}</option>
                <option value="3">{t('schedule.semester3', 'Summer')}</option>
              </select>
            </div>
          </div>

          {/* ── Course Searchable Selector ── */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-brand-text-primary dark:text-brand-text-main flex items-center gap-2">
              <BookOpen size={14} className="text-slate-400" /> {t('courses.course', 'Course')}
            </label>
            <SearchableSelect
              options={courseOptions}
              value={watch('courseId') || ''}
              onChange={(val) => {
                setValue('courseId', val);
                setValue('groupId', '');
                setValue('doctorId', '');
              }}
              placeholder={loadingCourses ? t('common.loading', 'Loading...') : t('courses.selectCourse', 'Select a course')}
              searchPlaceholder={t('common.searchCoursePlaceholder', 'common.searchCoursePlaceholder')}
              emptyText={t('courses.noCoursesFound', 'No matching courses found')}
              disabled={!selectedDepartmentId || loadingCourses || !!schedule}
              isRTL={isRTL}
              icon={<BookOpen size={16} />}
            />
            {errors.courseId && <p className="text-rose-500 text-xs mt-1">{errors.courseId.message}</p>}
          </div>

          {/* ── Group Selector ── */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-brand-text-primary dark:text-brand-text-main flex items-center gap-2">
              <Users size={14} className="text-slate-400" /> {t('common.group', 'Group')}
              <span className="text-[10px] font-normal text-slate-400 ml-1">({t('schedule.groupOptional', 'optional — empty = all students')})</span>
            </label>
            <select
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 transition-all cursor-pointer text-sm disabled:opacity-50"
              {...register('groupId')}
              disabled={!selectedCourseId || loadingGroups}
            >
              <option value="">
                {loadingGroups ? t('common.loading', 'Loading...') : t('schedule.allStudents', '📢 All Students (No Group)')}
              </option>
              {groups.map((g: any) => (
                <option key={g.id} value={g.id.toString()}>
                  {g.parentGroupId ? `↳ ${g.name}` : g.name}
                  {g.rangeStartName && g.rangeEndName ? ` (${g.rangeStartName} → ${g.rangeEndName})` : ''}
                </option>
              ))}
            </select>
            {groups.length === 0 && selectedCourseId && !loadingGroups && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                ⚠ {t('schedule.noGroupsFound', 'No groups found for this course year. Slot will apply to all students.')}
              </p>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-brand-text-primary dark:text-brand-text-main flex items-center gap-2">
                <BookOpen size={14} className="text-slate-400" /> {t('schedules.slotType', 'Slot Type')}
              </label>
              <select
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 transition-all cursor-pointer text-sm"
                {...register('slotType')}
              >
                {slotTypes.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
              {errors.slotType && <p className="text-rose-500 text-xs mt-1">{errors.slotType.message}</p>}
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-brand-text-primary dark:text-brand-text-main flex items-center gap-2">
                <Calendar size={14} className="text-slate-400" /> {t('timetables.day', 'Day of Week')}
              </label>
              <select
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 transition-all cursor-pointer text-sm"
                {...register('dayOfWeek')}
              >
                {days.map(day => (
                  <option key={day} value={day}>{t(`days.${day.toLowerCase()}`, day)}</option>
                ))}
              </select>
              {errors.dayOfWeek && <p className="text-rose-500 text-xs mt-1">{errors.dayOfWeek.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-brand-text-primary dark:text-brand-text-main flex items-center gap-2">
                <Clock size={14} className="text-slate-400" /> {t('timetables.startTime', 'Start Time')}
              </label>
              <input
                type="time"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 transition-all text-sm"
                {...register('startTime')}
              />
              {errors.startTime && <p className="text-rose-500 text-xs mt-1">{errors.startTime.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-brand-text-primary dark:text-brand-text-main flex items-center gap-2">
                <Clock size={14} className="text-slate-400" /> {t('timetables.endTime', 'End Time')}
              </label>
              <input
                type="time"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 transition-all text-sm"
                {...register('endTime')}
              />
              {errors.endTime && <p className="text-rose-500 text-xs mt-1">{errors.endTime.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-brand-text-primary dark:text-brand-text-main flex items-center gap-2">
              <MapPin size={14} className="text-slate-400" /> {t('schedules.room', 'Room / Location')}
            </label>
            <input
              type="text"
              placeholder={t('timetables.roomPlaceholder', 'e.g. Hall 302, Lab 105')}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 transition-all text-sm"
              {...register('room')}
            />
            {errors.room && <p className="text-rose-500 text-xs mt-1">{errors.room.message}</p>}
          </div>

          <div className="space-y-1.5">
            <InstructorSelector
              courseId={selectedCourseId}
              slotType="LECTURE"
              value={watch('doctorId') || ''}
              onChange={(val) => setValue('doctorId', val)}
              isRTL={isRTL}
              useIdAsValue={true}
              disabled={!selectedCourseId}
            />
            {errors.doctorId && <p className="text-rose-500 text-xs mt-1">{errors.doctorId.message}</p>}
          </div>

          {watchedSlotType !== 'LECTURE' && (
            <div className="space-y-1.5">
              <InstructorSelector
                courseId={selectedCourseId}
                slotType={watchedSlotType || 'LAB'}
                value={watch('teachingAssistantId') || ''}
                onChange={(val) => setValue('teachingAssistantId', val)}
                isRTL={isRTL}
                useIdAsValue={true}
                fallbackOptions={tas}
                disabled={!selectedCourseId}
              />
            </div>
          )}

          <div className="flex items-center gap-3 pt-4">
            <Button type="button" variant="ghost" className="flex-1 rounded-xl text-xs font-semibold" onClick={onClose}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button 
              type="submit" 
              className="flex-1 bg-brand-primary-500 hover:bg-brand-primary-600 active:scale-95 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed" 
              loading={isSubmitting}
            >
              {schedule ? t('common.update', 'Update Schedule') : t('schedules.CREATE', 'Create Schedule')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ScheduleModal;
