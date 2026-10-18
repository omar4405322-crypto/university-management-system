import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Users, Building, GraduationCap, Calendar, AlertCircle } from 'lucide-react';
import { WizardSlotForm, SlotType } from './types';
import { flattenGroupTree } from './builderUtils';
import collegeService from '../../../services/college.service';
import departmentService from '../../../services/department.service';
import coursesService from '../../../services/courses.service';
import studentGroupsService from '../../../services/studentGroups.service';
import SearchableSelect, { SelectOption } from '../../ui/SearchableSelect';
import type { College, Department, Course } from '../../../types/timetable.types';

export interface Step1CourseGroupProps {
  form: WizardSlotForm;
  onChange: (fields: Partial<WizardSlotForm>) => void;
  userRole?: string;
  userDepartmentId?: number | string | null;
  userCollegeId?: number | string | null;
  slotTypeSelectId?: string;
  isRTL?: boolean;
}

export const Step1CourseGroup: React.FC<Step1CourseGroupProps> = ({
  form,
  onChange,
  userRole,
  userDepartmentId,
  userCollegeId,
  slotTypeSelectId = 'schedule-slot-type-select',
  isRTL = false,
}) => {
  const { t } = useTranslation();

  const isDeptLocked = userRole === 'DEPARTMENT_ADMIN' && Boolean(userDepartmentId);

  const [colleges, setColleges] = useState<College[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [groups, setGroups] = useState<Array<{ id: number | string; name: string }>>([]);
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);

  // 1. Fetch colleges
  useEffect(() => {
    let mounted = true;
    collegeService.getColleges().then((res) => {
      if (mounted && res.success && res.data) {
        setColleges(res.data);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // 2. Fetch departments when college changes or on mount
  useEffect(() => {
    let mounted = true;
    setLoadingDepts(true);
    const params = form.collegeId ? { collegeId: form.collegeId } : undefined;
    departmentService.getDepartments(params).then((res) => {
      if (mounted && res.success && res.data) {
        setDepartments(res.data);
      }
      if (mounted) setLoadingDepts(false);
    });
    return () => {
      mounted = false;
    };
  }, [form.collegeId]);

  // 3. Fetch courses when department, year, semester change
  useEffect(() => {
    if (!form.departmentId) {
      setCourses([]);
      return;
    }
    let mounted = true;
    setLoadingCourses(true);
    const params: Record<string, unknown> = {
      departmentId: form.departmentId,
    };
    if (form.academicYear) params.year = form.academicYear;
    if (form.semester) params.semester = form.semester;

    coursesService.getCourses(params).then((res) => {
      if (mounted && res.success && res.data) {
        const raw = Array.isArray(res.data) ? res.data : (res.data as any)?.courses || [];
        setCourses(raw);
      }
      if (mounted) setLoadingCourses(false);
    });
    return () => {
      mounted = false;
    };
  }, [form.departmentId, form.academicYear, form.semester]);

  // 4. Fetch student groups when department or year changes
  useEffect(() => {
    if (!form.departmentId) {
      setGroups([]);
      return;
    }
    let mounted = true;
    setLoadingGroups(true);

    studentGroupsService
      .getDepartmentGroups(form.departmentId, form.academicYear ? Number(form.academicYear) : undefined)
      .then((data: any) => {
        if (mounted && data) {
          const list = Array.isArray(data) ? data : data.data || data.groups || [];
          setGroups(flattenGroupTree(list));
        }
        if (mounted) setLoadingGroups(false);
      })
      .catch(() => {
        if (mounted) setGroups([]);
        if (mounted) setLoadingGroups(false);
      });
    return () => {
      mounted = false;
    };
  }, [form.departmentId, form.academicYear]);

  // Course options for SearchableSelect
  const courseOptions: SelectOption[] = useMemo(() => {
    return courses.map((c) => ({
      value: String(c.id),
      label: c.name,
      sublabel: c.code || (c as any).courseCode,
    }));
  }, [courses]);

  return (
    <div className="space-y-4">
      {/* Scope: College & Department */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {!isDeptLocked && (
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Building size={14} className="text-brand-primary-500" />
              <span>{t('common.college', 'College')}</span>
            </label>
            <select
              id="wizard-college-select"
              value={form.collegeId}
              onChange={(e) => {
                const cId = e.target.value;
                onChange({ collegeId: cId, departmentId: '', courseId: '', courseName: '', groupId: '', groupName: '' });
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500"
            >
              <option value="">{t('common.allColleges', 'Select College...')}</option>
              {colleges.map((col) => (
                <option key={col.id} value={col.id}>
                  {isRTL ? col.nameAr || col.name : col.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className={isDeptLocked ? 'sm:col-span-2' : ''}>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
            <GraduationCap size={14} className="text-brand-primary-500" />
            <span>{t('common.department', 'Department')} *</span>
          </label>
          <select
            id="wizard-dept-select"
            value={form.departmentId}
            disabled={isDeptLocked || loadingDepts}
            onChange={(e) => {
              const dId = e.target.value;
              onChange({ departmentId: dId, courseId: '', courseName: '', groupId: '', groupName: '' });
            }}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 disabled:opacity-60"
          >
            <option value="">{t('common.selectDepartment', 'Select Department...')}</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {isRTL ? dept.nameAr || dept.name : dept.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Academic Year, Semester, and Slot Type */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
            <Calendar size={14} className="text-brand-primary-500" />
            <span>{t('common.year', 'Academic Year')} *</span>
          </label>
          <select
            id="wizard-year-select"
            value={form.academicYear}
            onChange={(e) => onChange({ academicYear: e.target.value, courseId: '', courseName: '', groupId: '', groupName: '' })}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500"
          >
            <option value="">{t('common.selectYear', 'Select Year...')}</option>
            <option value="1">{t('years.firstYear', 'Year 1')}</option>
            <option value="2">{t('years.secondYear', 'Year 2')}</option>
            <option value="3">{t('years.thirdYear', 'Year 3')}</option>
            <option value="4">{t('years.fourthYear', 'Year 4')}</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
            <Calendar size={14} className="text-brand-primary-500" />
            <span>{t('timetables.semester', 'Semester')} *</span>
          </label>
          <select
            id="wizard-semester-select"
            value={form.semester}
            onChange={(e) => onChange({ semester: e.target.value, courseId: '', courseName: '' })}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500"
          >
            <option value="">{t('common.selectSemester', 'Select Semester...')}</option>
            <option value="1">{t('semesters.firstSemester', 'Semester 1')}</option>
            <option value="2">{t('semesters.secondSemester', 'Semester 2')}</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
            <BookOpen size={14} className="text-brand-primary-500" />
            <span>{t('schedules.sessionType', 'Session Type')} *</span>
          </label>
          {/* Strictly 2 slot types: LECTURE and LAB */}
          <select
            id={slotTypeSelectId}
            data-testid="slot-type-select"
            value={form.slotType}
            onChange={(e) => {
              const nextType = e.target.value as SlotType;
              onChange({
                slotType: nextType,
                doctorId: nextType === 'LECTURE' ? form.doctorId : '',
                doctorName: nextType === 'LECTURE' ? form.doctorName : '',
                teachingAssistantId: nextType === 'LAB' ? form.teachingAssistantId : '',
                teachingAssistantName: nextType === 'LAB' ? form.teachingAssistantName : '',
              });
            }}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-800 dark:text-slate-100 font-bold focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500"
          >
            <option value="LECTURE">{isRTL ? 'محاضرة' : 'Lecture'}</option>
            <option value="LAB">{isRTL ? 'معمل' : 'Lab'}</option>
          </select>
        </div>
      </div>

      {/* Course Selection with SearchableSelect */}
      <div>
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
          <BookOpen size={14} className="text-brand-primary-500" />
          <span>{t('schedules.course', 'Course')} *</span>
        </label>
        <SearchableSelect
          id="wizard-course-select"
          options={courseOptions}
          value={form.courseId}
          placeholder={
            loadingCourses
              ? t('common.loading', 'Loading courses...')
              : !form.departmentId
              ? t('schedules.selectDeptFirst', 'Select department first')
              : t('schedules.selectCourse', 'Select Course...')
          }
          searchPlaceholder={t('schedules.searchCoursePlaceholder', 'Search course by name or code...')}
          emptyText={t('schedules.noCoursesFound', 'No courses found')}
          disabled={!form.departmentId || loadingCourses}
          isRTL={isRTL}
          onChange={(val) => {
            const found = courses.find((c) => String(c.id) === String(val));
            onChange({
              courseId: val,
              courseName: found?.name || '',
            });
          }}
        />
      </div>

      {/* Student Group Selection */}
      <div>
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
          <Users size={14} className="text-brand-primary-500" />
          <span>{t('schedules.studentGroup', 'Student Group / Section')}</span>
        </label>
        <select
          id="wizard-group-select"
          value={form.groupId}
          disabled={!form.departmentId || loadingGroups}
          onChange={(e) => {
            const gId = e.target.value;
            const found = groups.find((g) => String(g.id) === String(gId));
            onChange({
              groupId: gId,
              groupName: found ? found.name : '',
            });
          }}
          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 disabled:opacity-60"
        >
          <option value="">{t('schedules.allStudents', 'All Students (Department-wide)')}</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default Step1CourseGroup;
