import prisma from '../utils/prismaClient';
import type { AuthActor } from '../types/auth.types';
import { getAdministrativeAnalyticsScopes } from '../utils/administrativeAnalyticsScope.utils';
import logger from '../utils/logger';

export interface CanonicalQuickActionDefinition {
  key: string;
  category: string;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  prompt: string;
  promptEn: string;
  promptKey: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  allowedRoles: string[];
  toolNames: string[];
  isAllowed: (actor?: AuthActor) => boolean;
}

export const CANONICAL_QUICK_ACTIONS: Record<string, CanonicalQuickActionDefinition> = {
  // --- Student Actions ---
  student_academic_summary: {
    key: 'student_academic_summary',
    category: 'ACADEMIC',
    title: 'المعدل التراكمي والسجل الأكاديمي',
    titleEn: 'Academic Standing & GPA',
    description: 'عرض ملخص السجل الأكاديمي والمعدل التراكمي والدرجات.',
    descriptionEn: 'View cumulative GPA, registered courses, and academic standing.',
    prompt: 'لخص مستواي الأكاديمي',
    promptEn: 'Summarize my academic standing and GPA',
    promptKey: 'aiAssistant.starters.studentAcademicSummary',
    icon: 'FileText',
    iconBg: 'bg-blue-50 dark:bg-blue-950/60',
    iconColor: 'text-blue-600 dark:text-blue-400',
    allowedRoles: ['STUDENT'],
    toolNames: ['get_my_academic_summary'],
    isAllowed: (actor) => Boolean(actor?.role === 'STUDENT' && actor.student?.id),
  },
  student_courses: {
    key: 'student_courses',
    category: 'COURSES',
    title: 'المقررات المسجلة',
    titleEn: 'Enrolled Courses',
    description: 'عرض المقررات والمواد المسجلة في الفصل الدراسي الحالي.',
    descriptionEn: 'List current semester courses and enrolled subjects.',
    prompt: 'ما المقررات المسجلة لدي هذا الفصل؟',
    promptEn: 'What courses am I enrolled in this semester?',
    promptKey: 'aiAssistant.starters.studentCourses',
    icon: 'ClipboardList',
    iconBg: 'bg-indigo-50 dark:bg-indigo-950/60',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
    allowedRoles: ['STUDENT'],
    toolNames: ['get_my_courses'],
    isAllowed: (actor) => Boolean(actor?.role === 'STUDENT' && actor.student?.id),
  },
  attendance_summary: {
    key: 'attendance_summary',
    category: 'ATTENDANCE',
    title: 'سجل ونسبة الحضور',
    titleEn: 'Attendance Record',
    description: 'الإطلاع على سجلات الحضور والغياب ونسب الغياب.',
    descriptionEn: 'View personal attendance statistics and absence rates.',
    prompt: 'كيف هو حضوري؟',
    promptEn: 'How is my attendance record?',
    promptKey: 'aiAssistant.starters.attendance',
    icon: 'Calendar',
    iconBg: 'bg-brand-primary-50 dark:bg-brand-primary-950/60',
    iconColor: 'text-brand-primary-700 dark:text-brand-primary-300',
    allowedRoles: ['STUDENT'],
    toolNames: ['get_my_attendance_summary'],
    isAllowed: (actor) => Boolean(actor?.role === 'STUDENT' && actor.student?.id),
  },
  schedule_summary: {
    key: 'schedule_summary',
    category: 'SCHEDULE',
    title: 'جدول المحاضرات',
    titleEn: 'Class Timetable',
    description: 'عرض جدول المحاضرات الأسبوعي ومواعيد اليوم والقاعات.',
    descriptionEn: 'View weekly lecture timetable and room locations.',
    prompt: 'اعرض جدولي',
    promptEn: 'Show my weekly lecture timetable',
    promptKey: 'aiAssistant.starters.schedule',
    icon: 'Calendar',
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/60',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    allowedRoles: ['STUDENT'],
    toolNames: ['get_my_schedule'],
    isAllowed: (actor) => Boolean(actor?.role === 'STUDENT' && actor.student?.id),
  },
  tasks_summary: {
    key: 'tasks_summary',
    category: 'TASKS',
    title: 'المهام والتكليفات',
    titleEn: 'Tasks & Assignments',
    description: 'متابعة المهام والتكاليف الدراسية ومواعيد تسليمها.',
    descriptionEn: 'Track assignments, due dates, and pending submissions.',
    prompt: 'ما المهام المطلوبة مني؟',
    promptEn: 'What tasks and assignments are due?',
    promptKey: 'aiAssistant.starters.tasks',
    icon: 'ClipboardList',
    iconBg: 'bg-amber-50 dark:bg-amber-950/60',
    iconColor: 'text-amber-600 dark:text-amber-400',
    allowedRoles: ['STUDENT'],
    toolNames: ['get_my_tasks'],
    isAllowed: (actor) => Boolean(actor?.role === 'STUDENT' && actor.student?.id),
  },
  exams_summary: {
    key: 'exams_summary',
    category: 'EXAMS',
    title: 'جدول الامتحانات',
    titleEn: 'Upcoming Exams',
    description: 'عرض جدول ومواعيد الامتحانات القادمة والقاعات.',
    descriptionEn: 'View upcoming midterm and final examination schedule.',
    prompt: 'ما الاختبارات القادمة؟',
    promptEn: 'What upcoming exams do I have?',
    promptKey: 'aiAssistant.starters.exams',
    icon: 'BarChart2',
    iconBg: 'bg-purple-50 dark:bg-purple-950/60',
    iconColor: 'text-purple-600 dark:text-purple-400',
    allowedRoles: ['STUDENT'],
    toolNames: ['get_my_exams'],
    isAllowed: (actor) => Boolean(actor?.role === 'STUDENT' && actor.student?.id),
  },
  payments_summary: {
    key: 'payments_summary',
    category: 'PAYMENTS',
    title: 'المصروفات والرسوم',
    titleEn: 'Tuition & Fees',
    description: 'عرض تفاصيل الرسوم والمصروفات المسددة والمتبقية.',
    descriptionEn: 'View tuition payment status and outstanding balances.',
    prompt: 'ما الرسوم والمدفوعات المستحقة علي؟',
    promptEn: 'What are my outstanding tuition fees?',
    promptKey: 'aiAssistant.starters.payments',
    icon: 'FileText',
    iconBg: 'bg-teal-50 dark:bg-teal-950/60',
    iconColor: 'text-teal-600 dark:text-teal-400',
    allowedRoles: ['STUDENT'],
    toolNames: ['get_my_payments'],
    isAllowed: (actor) => Boolean(actor?.role === 'STUDENT' && actor.student?.id),
  },

  // --- Doctor Actions ---
  doctor_courses: {
    key: 'doctor_courses',
    category: 'COURSES',
    title: 'المقررات المكلف بها',
    titleEn: 'Teaching Courses',
    description: 'المقررات التي أدرسها وعبء العمل المسند.',
    descriptionEn: 'View assigned courses and enrollment counts.',
    prompt: 'ما المقررات التي أدرسها؟',
    promptEn: 'What courses am I assigned to teach?',
    promptKey: 'aiAssistant.starters.doctorCourses',
    icon: 'FileText',
    iconBg: 'bg-blue-50 dark:bg-blue-950/60',
    iconColor: 'text-blue-600 dark:text-blue-400',
    allowedRoles: ['DOCTOR'],
    toolNames: ['get_my_teaching_courses'],
    isAllowed: (actor) => Boolean(actor?.role === 'DOCTOR' && actor.doctor?.id),
  },
  doctor_schedule: {
    key: 'doctor_schedule',
    category: 'SCHEDULE',
    title: 'جدول التدريس الأسبوعي',
    titleEn: 'Teaching Schedule',
    description: 'عرض جدول التدريس والمحاضرات ومواعيد القاعات.',
    descriptionEn: 'View weekly teaching schedule and lecture slots.',
    prompt: 'اعرض جدولي التدريسي',
    promptEn: 'Show my weekly teaching timetable',
    promptKey: 'aiAssistant.starters.doctorSchedule',
    icon: 'Calendar',
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/60',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    allowedRoles: ['DOCTOR'],
    toolNames: ['get_my_teaching_schedule'],
    isAllowed: (actor) => Boolean(actor?.role === 'DOCTOR' && actor.doctor?.id),
  },
  doctor_workload: {
    key: 'doctor_workload',
    category: 'WORKLOAD',
    title: 'العبء التدريسي',
    titleEn: 'Teaching Workload',
    description: 'لخص عبء التدريس والساعات التدريسية الأسبوعية.',
    descriptionEn: 'Summarize weekly contact hours and course workload.',
    prompt: 'لخص عبء التدريس الخاص بي',
    promptEn: 'Summarize my teaching workload and contact hours',
    promptKey: 'aiAssistant.starters.doctorWorkload',
    icon: 'BarChart2',
    iconBg: 'bg-brand-primary-50 dark:bg-brand-primary-950/60',
    iconColor: 'text-brand-primary-700 dark:text-brand-primary-300',
    allowedRoles: ['DOCTOR'],
    toolNames: ['get_my_teaching_workload'],
    isAllowed: (actor) => Boolean(actor?.role === 'DOCTOR' && actor.doctor?.id),
  },
  doctor_attendance_overview: {
    key: 'doctor_attendance_overview',
    category: 'ATTENDANCE',
    title: 'حضور طلاب المقررات',
    titleEn: 'Course Attendance',
    description: 'عرض إحصائيات ونسب حضور وغياب الطلاب في المقررات.',
    descriptionEn: 'View student attendance rates in your courses.',
    prompt: 'عرض إحصائيات حضور مقرراتي',
    promptEn: 'Show attendance statistics for my courses',
    promptKey: 'aiAssistant.starters.doctorAttendanceOverview',
    icon: 'Calendar',
    iconBg: 'bg-brand-primary-50 dark:bg-brand-primary-950/60',
    iconColor: 'text-brand-primary-700 dark:text-brand-primary-300',
    allowedRoles: ['DOCTOR'],
    toolNames: ['get_my_course_attendance_overview'],
    isAllowed: (actor) => Boolean(actor?.role === 'DOCTOR' && actor.doctor?.id),
  },
  doctor_course_roster: {
    key: 'doctor_course_roster',
    category: 'ROSTER',
    title: 'كشف أسماء الطلاب',
    titleEn: 'Course Student Roster',
    description: 'عرض كشف أسماء وبيانات الطلاب المسجلين بالمقرر.',
    descriptionEn: 'Retrieve student roster for courses you teach.',
    prompt: 'عرض كشف أسماء طلاب المقرر',
    promptEn: 'Show the student roster for my course',
    promptKey: 'aiAssistant.starters.doctorCourseRoster',
    icon: 'User',
    iconBg: 'bg-brand-primary-50 dark:bg-brand-primary-950/60',
    iconColor: 'text-brand-primary-700 dark:text-brand-primary-300',
    allowedRoles: ['DOCTOR'],
    toolNames: ['get_my_course_roster'],
    isAllowed: (actor) => Boolean(actor?.role === 'DOCTOR' && actor.doctor?.id),
  },

  // --- Teaching Assistant Actions ---
  ta_sections: {
    key: 'ta_sections',
    category: 'COURSES',
    title: 'السكاشن والمعامل المسندة',
    titleEn: 'Assigned Lab Sections',
    description: 'عرض السكاشن والمعامل والمجموعات العملية المكلف بها.',
    descriptionEn: 'View practical lab sections and tutorial groups.',
    prompt: 'ما الشعب والمعامل المسندة إلي؟',
    promptEn: 'What lab sections am I assigned to assist?',
    promptKey: 'aiAssistant.starters.taSections',
    icon: 'FileText',
    iconBg: 'bg-blue-50 dark:bg-blue-950/60',
    iconColor: 'text-blue-600 dark:text-blue-400',
    allowedRoles: ['TEACHING_ASSISTANT'],
    toolNames: ['get_my_assigned_sections'],
    isAllowed: (actor) => Boolean(actor?.role === 'TEACHING_ASSISTANT' && actor.teachingAssistant?.id),
  },
  ta_schedule: {
    key: 'ta_schedule',
    category: 'SCHEDULE',
    title: 'جدول مواعيد السكاشن',
    titleEn: 'TA Section Schedule',
    description: 'مواعيد وجدول الشُعب الدراسية والمختبرات والقاعات.',
    descriptionEn: 'Weekly practical lab timetable and room locations.',
    prompt: 'اعرض جدول المعامل الخاص بي',
    promptEn: 'Show my weekly lab and tutorial timetable',
    promptKey: 'aiAssistant.starters.taSchedule',
    icon: 'Calendar',
    iconBg: 'bg-brand-primary-50 dark:bg-brand-primary-950/60',
    iconColor: 'text-brand-primary-700 dark:text-brand-primary-300',
    allowedRoles: ['TEACHING_ASSISTANT'],
    toolNames: ['get_my_ta_schedule'],
    isAllowed: (actor) => Boolean(actor?.role === 'TEACHING_ASSISTANT' && actor.teachingAssistant?.id),
  },
  ta_workload: {
    key: 'ta_workload',
    category: 'WORKLOAD',
    title: 'العبء الأسبوعي للمعيد',
    titleEn: 'TA Workload & Hours',
    description: 'الحصول على إحصائيات عبء العمل وساعات السكاشن.',
    descriptionEn: 'Weekly section contact hours and assigned workload.',
    prompt: 'لخص عبء العمل المسند إلي',
    promptEn: 'Summarize my weekly section contact hours',
    promptKey: 'aiAssistant.starters.taWorkload',
    icon: 'BarChart2',
    iconBg: 'bg-brand-primary-50 dark:bg-brand-primary-950/60',
    iconColor: 'text-brand-primary-700 dark:text-brand-primary-300',
    allowedRoles: ['TEACHING_ASSISTANT'],
    toolNames: ['get_my_ta_workload'],
    isAllowed: (actor) => Boolean(actor?.role === 'TEACHING_ASSISTANT' && actor.teachingAssistant?.id),
  },
  ta_section_students: {
    key: 'ta_section_students',
    category: 'ROSTER',
    title: 'قائمة طلاب السكشن',
    titleEn: 'Section Student Roster',
    description: 'عرض كشف بأسماء وبيانات الطلاب في السكشن أو المعمل.',
    descriptionEn: 'View students enrolled in your practical sections.',
    prompt: 'عرض أسماء طلاب السكشن',
    promptEn: 'Show students enrolled in my practical sections',
    promptKey: 'aiAssistant.starters.taSectionStudents',
    icon: 'User',
    iconBg: 'bg-brand-primary-50 dark:bg-brand-primary-950/60',
    iconColor: 'text-brand-primary-700 dark:text-brand-primary-300',
    allowedRoles: ['TEACHING_ASSISTANT'],
    toolNames: ['get_my_section_students'],
    isAllowed: (actor) => Boolean(actor?.role === 'TEACHING_ASSISTANT' && actor.teachingAssistant?.id),
  },

  // --- Administrative Actions ---
  admin_university_summary: {
    key: 'admin_university_summary',
    category: 'ANALYTICS',
    title: 'ملخص الجامعة الإداري',
    titleEn: 'University Overview',
    description: 'عرض ملخص شامل لبيانات الجامعة ضمن صلاحياتك الإدارية.',
    descriptionEn: 'Overview of student, faculty, and college totals within scope.',
    prompt: 'اعرض ملخص الجامعة ضمن صلاحياتي',
    promptEn: 'Show university summary counts within my scope',
    promptKey: 'aiAssistant.starters.adminSummary',
    icon: 'FileText',
    iconBg: 'bg-blue-50 dark:bg-blue-950/60',
    iconColor: 'text-blue-600 dark:text-blue-400',
    allowedRoles: ['SUPER_ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'ADMIN'],
    toolNames: ['get_scoped_university_summary'],
    isAllowed: (actor) => Boolean(getAdministrativeAnalyticsScopes(actor)),
  },
  admin_academic_analytics: {
    key: 'admin_academic_analytics',
    category: 'ANALYTICS',
    title: 'التحليلات الأكاديمية والمعدلات',
    titleEn: 'Academic Analytics & GPA',
    description: 'الحصول على إحصائيات وأرقام أكاديمية وتوزيع المعدلات بدقة.',
    descriptionEn: 'Academic performance indicators, GPA distribution, and risk factors.',
    prompt: 'أعطني إحصائيات أكاديمية ضمن صلاحياتي',
    promptEn: 'Show academic analytics and GPA distribution within my scope',
    promptKey: 'aiAssistant.starters.adminAcademic',
    icon: 'BarChart2',
    iconBg: 'bg-brand-primary-50 dark:bg-brand-primary-950/60',
    iconColor: 'text-brand-primary-700 dark:text-brand-primary-300',
    allowedRoles: ['SUPER_ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'ADMIN'],
    toolNames: ['get_scoped_academic_analytics'],
    isAllowed: (actor) => Boolean(getAdministrativeAnalyticsScopes(actor)),
  },
  admin_attendance_analytics: {
    key: 'admin_attendance_analytics',
    category: 'ANALYTICS',
    title: 'تحليلات الحضور والغياب',
    titleEn: 'Attendance Analytics',
    description: 'الإطلاع على مؤشرات ونسب الحضور والغياب والطلاب المهددين بالحرمان.',
    descriptionEn: 'Scope-wide attendance trends and absence warning statistics.',
    prompt: 'لخص الحضور ضمن نطاق صلاحياتي',
    promptEn: 'Summarize attendance analytics within my scope',
    promptKey: 'aiAssistant.starters.adminAttendance',
    icon: 'Calendar',
    iconBg: 'bg-brand-primary-50 dark:bg-brand-primary-950/60',
    iconColor: 'text-brand-primary-700 dark:text-brand-primary-300',
    allowedRoles: ['SUPER_ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'ADMIN'],
    toolNames: ['get_scoped_attendance_analytics'],
    isAllowed: (actor) => Boolean(getAdministrativeAnalyticsScopes(actor)),
  },
  admin_search_students: {
    key: 'admin_search_students',
    category: 'DIRECTORY_STUDENTS',
    title: 'البحث عن طالب',
    titleEn: 'Search Students Directory',
    description: 'البحث عن طالب بالاسم أو الرقم الأكاديمي وعرض معلوماته.',
    descriptionEn: 'Search students within administrative scope by name or ID.',
    prompt: 'البحث عن الطلاب ضمن صلاحياتي',
    promptEn: 'Search for students within my authorized scope',
    promptKey: 'aiAssistant.starters.adminSearchStudents',
    icon: 'User',
    iconBg: 'bg-brand-primary-50 dark:bg-brand-primary-950/60',
    iconColor: 'text-brand-primary-700 dark:text-brand-primary-300',
    allowedRoles: ['SUPER_ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'ADMIN'],
    toolNames: ['search_scoped_students'],
    isAllowed: (actor) => Boolean(getAdministrativeAnalyticsScopes(actor)),
  },
  admin_search_doctors: {
    key: 'admin_search_doctors',
    category: 'DIRECTORY_DOCTORS',
    title: 'البحث في دليل أعضاء التدريس',
    titleEn: 'Search Faculty Directory',
    description: 'البحث في دليل أعضاء هيئة التدريس بالاسم أو القسم أو التخصص.',
    descriptionEn: 'Look up professors and faculty members by department or specialty.',
    prompt: 'البحث عن أعضاء هيئة التدريس',
    promptEn: 'Search for faculty members within my scope',
    promptKey: 'aiAssistant.starters.adminSearchDoctors',
    icon: 'User',
    iconBg: 'bg-purple-50 dark:bg-purple-950/60',
    iconColor: 'text-purple-600 dark:text-purple-400',
    allowedRoles: ['SUPER_ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'ADMIN'],
    toolNames: ['search_scoped_doctors'],
    isAllowed: (actor) => Boolean(getAdministrativeAnalyticsScopes(actor)),
  },
  admin_search_courses: {
    key: 'admin_search_courses',
    category: 'DIRECTORY_COURSES',
    title: 'دليل المقررات الدراسية',
    titleEn: 'Search Course Catalog',
    description: 'البحث في دليل المقررات الدراسية وأعداد الطلاب المسجلين.',
    descriptionEn: 'Search courses by code or title and view enrollment counts.',
    prompt: 'البحث عن المقررات الدراسية',
    promptEn: 'Search the course catalog within my scope',
    promptKey: 'aiAssistant.starters.adminSearchCourses',
    icon: 'ClipboardList',
    iconBg: 'bg-amber-50 dark:bg-amber-950/60',
    iconColor: 'text-amber-600 dark:text-amber-400',
    allowedRoles: ['SUPER_ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'ADMIN'],
    toolNames: ['search_scoped_courses'],
    isAllowed: (actor) => Boolean(getAdministrativeAnalyticsScopes(actor)),
  },

  // --- General Fallback Actions ---
  study_help: {
    key: 'study_help',
    category: 'GENERAL',
    title: 'تنظيم خطة دراسية',
    titleEn: 'Study Planning',
    description: 'المساعدة في تنظيم وإعداد خطة دراسية فعالة للمذاكرة.',
    descriptionEn: 'Guidance on structuring a balanced, effective study timetable.',
    prompt: 'كيف أنظم خطة للمذاكرة؟',
    promptEn: 'How do I organize an effective study schedule?',
    promptKey: 'aiAssistant.starters.studyHelp',
    icon: 'Calendar',
    iconBg: 'bg-blue-50 dark:bg-blue-950/60',
    iconColor: 'text-blue-600 dark:text-blue-400',
    allowedRoles: ['STUDENT', 'DOCTOR', 'TEACHING_ASSISTANT', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'SUPER_ADMIN'],
    toolNames: [],
    isAllowed: () => true,
  },
  explain_concept: {
    key: 'explain_concept',
    category: 'GENERAL',
    title: 'شرح مفاهيم دراسية',
    titleEn: 'Explain Concepts',
    description: 'تبسيط وشرح المفاهيم والموضوعات الأكاديمية للطلاب.',
    descriptionEn: 'Simple, intuitive explanations for challenging academic topics.',
    prompt: 'اشرح مفهوماً أكاديمياً ببساطة',
    promptEn: 'Explain an academic concept simply',
    promptKey: 'aiAssistant.starters.explainConcept',
    icon: 'Sparkles',
    iconBg: 'bg-brand-primary-50 dark:bg-brand-primary-950/60',
    iconColor: 'text-brand-primary-700 dark:text-brand-primary-300',
    allowedRoles: ['STUDENT', 'DOCTOR', 'TEACHING_ASSISTANT', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'SUPER_ADMIN'],
    toolNames: [],
    isAllowed: () => true,
  },
};

// Map tool name to canonical action key
const TOOL_TO_ACTION_KEY: Record<string, string> = {};
for (const [actionKey, def] of Object.entries(CANONICAL_QUICK_ACTIONS)) {
  for (const toolName of def.toolNames) {
    TOOL_TO_ACTION_KEY[toolName] = actionKey;
  }
}

/**
 * Resolves a capability tool name to its canonical quick action key.
 */
export function resolveActionKeyFromTool(toolName?: string): string | null {
  if (!toolName) return null;
  return TOOL_TO_ACTION_KEY[toolName] ?? null;
}

/**
 * Resolves a user prompt to a canonical action key if it matches synonymous phrasing or a starter prompt.
 * Guaranteed never to save raw user prompt arguments.
 */
export function resolveActionKeyFromPrompt(prompt?: string, actor?: AuthActor): string | null {
  if (!prompt || typeof prompt !== 'string') return null;
  const clean = prompt.trim().toLowerCase();
  if (!clean) return null;

  // Exact starter prompt matching first
  for (const [key, def] of Object.entries(CANONICAL_QUICK_ACTIONS)) {
    if (def.isAllowed(actor)) {
      if (clean === def.prompt.toLowerCase() || clean === def.promptEn.toLowerCase()) {
        return key;
      }
    }
  }

  // Synonymous capability regex patterns (role-aware)
  if (actor?.role === 'STUDENT') {
    if (/معدل|سجل أكاديمي|درجاتي|gpa|academic standing/i.test(clean)) return 'student_academic_summary';
    if (/مقررات مسجلة|موادي|مواد مسجلة|enrolled courses/i.test(clean)) return 'student_courses';
    if (/حضور|غياب|نسبة الحضور|attendance/i.test(clean)) return 'attendance_summary';
    if (/جدول المحاضرات|جدولي|مواعيد المحاضرات|timetable|schedule/i.test(clean)) return 'schedule_summary';
    if (/واجب|تكليف|tasks|assignments/i.test(clean)) return 'tasks_summary';
    if (/امتحان|اختبار|exams/i.test(clean)) return 'exams_summary';
    if (/مصروفات|رسوم|مدفوعات|tuition|payments/i.test(clean)) return 'payments_summary';
  } else if (actor?.role === 'DOCTOR') {
    if (/مقررات مكلف|المقررات التي أدرسها|teaching courses/i.test(clean)) return 'doctor_courses';
    if (/جدول التدريس|جدولي التدريسي|teaching schedule/i.test(clean)) return 'doctor_schedule';
    if (/عبء التدريس|ساعات التدريس|teaching workload/i.test(clean)) return 'doctor_workload';
    if (/حضور الطلاب|حضور مقرراتي|course attendance/i.test(clean)) return 'doctor_attendance_overview';
    if (/كشف أسماء|طلاب المقرر|course roster/i.test(clean)) return 'doctor_course_roster';
  } else if (actor?.role === 'TEACHING_ASSISTANT') {
    if (/سكاشن|شعب|معامل مسندة|assigned sections/i.test(clean)) return 'ta_sections';
    if (/جدول السكاشن|جدول المعامل|ta schedule/i.test(clean)) return 'ta_schedule';
    if (/عبء العمل|ساعات السكاشن|ta workload/i.test(clean)) return 'ta_workload';
    if (/طلاب السكشن|طلاب المعمل|section students/i.test(clean)) return 'ta_section_students';
  } else if (['SUPER_ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'ADMIN'].includes(actor?.role ?? '')) {
    if (/ملخص الجامعة|إحصائيات الجامعة|إحصائيات الكلية|university summary/i.test(clean)) return 'admin_university_summary';
    if (/إحصائيات أكاديمية|توزيع المعدلات|academic analytics/i.test(clean)) return 'admin_academic_analytics';
    if (/حضور وغياب|تحليلات الحضور|attendance analytics/i.test(clean)) return 'admin_attendance_analytics';
    if (/طالب|طلاب|search student/i.test(clean)) return 'admin_search_students';
    if (/دكتور|دكاترة|أعضاء التدريس|أعضاء هيئة التدريس|search doctor|search faculty/i.test(clean)) return 'admin_search_doctors';
    if (/مقرر|مقررات|دليل المقررات|search course/i.test(clean)) return 'admin_search_courses';
  }

  // General fallbacks
  if (/خطة للمذاكرة|تنظيم خطة|study plan|study help/i.test(clean)) return 'study_help';
  if (/اشرح مفهوما|شرح مفاهيم|explain concept/i.test(clean)) return 'explain_concept';

  return null;
}

/**
 * Normalizes a date to UTC midnight representing the calendar date bucket.
 */
export function getUsageDateKey(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Safely and atomically increments usage for a canonical quick action inside a daily bucket.
 * Guaranteed to run ONCE per user turn regardless of internal tool loops or retries.
 */
export async function recordQuickActionUsage(
  userId: number,
  actionKey: string,
  usedAt = new Date(),
): Promise<void> {
  if (!userId || !actionKey || !CANONICAL_QUICK_ACTIONS[actionKey]) {
    return;
  }

  try {
    const usageDate = getUsageDateKey(usedAt);

    await prisma.aIQuickActionUsage.upsert({
      where: {
        userId_actionKey_usageDate: {
          userId,
          actionKey,
          usageDate,
        },
      },
      create: {
        userId,
        actionKey,
        usageDate,
        count: 1,
        lastUsedAt: usedAt,
      },
      update: {
        count: { increment: 1 },
        lastUsedAt: usedAt,
      },
    });

    logger.info('[AI-QUICK-ACTION] Recorded action usage bucket', {
      userId,
      actionKey,
      usageDate: usageDate.toISOString().slice(0, 10),
    });
  } catch (err: unknown) {
    logger.warn('[AI-QUICK-ACTION] Failed to record usage (non-fatal)', {
      userId,
      actionKey,
      error: (err as any)?.message,
    });
  }
}

export interface QuickActionPresentationItem {
  key: string;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  prompt: string;
  promptEn: string;
  promptKey: string;
  icon: string;
  iconBg: string;
  iconColor: string;
}

export const REPEAT_USAGE_THRESHOLD = 2;
export const HORIZON_DAYS = 60;
export const MAX_QUICK_ACTIONS = 4;

/**
 * Calculates a deterministic frequency + recency score.
 * Ranking algorithm:
 * - Frequency: recentUsageCount * 10 (strictly computed from inside the 60-day window)
 * - Recency Boost:
 *   - <= 7 days: +30
 *   - <= 14 days: +20
 *   - <= 30 days: +10
 *   - <= 60 days: 0
 *   - > 60 days: -9999 (decayed)
 */
export function calculateRankingScore(recentUsageCount: number, lastUsedAt: Date, now = new Date()): number {
  const daysAgo = (now.getTime() - lastUsedAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysAgo > HORIZON_DAYS) return -9999;

  let recencyBoost = 0;
  if (daysAgo <= 7) {
    recencyBoost = 30;
  } else if (daysAgo <= 14) {
    recencyBoost = 20;
  } else if (daysAgo <= 30) {
    recencyBoost = 10;
  }

  return recentUsageCount * 10 + recencyBoost;
}

/**
 * Deterministic role-appropriate default action when user has zero usage history.
 * Always passes authoritative RBAC.
 */
export function getRoleDefaultActionKey(actor?: AuthActor): string {
  const role = actor?.role;
  if (role === 'STUDENT') {
    return actor?.student?.id ? 'student_academic_summary' : 'study_help';
  }
  if (role === 'DOCTOR') {
    return actor?.doctor?.id ? 'doctor_courses' : 'study_help';
  }
  if (role === 'TEACHING_ASSISTANT') {
    return actor?.teachingAssistant?.id ? 'ta_sections' : 'study_help';
  }
  if (['SUPER_ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'ADMIN'].includes(role ?? '')) {
    return Boolean(getAdministrativeAnalyticsScopes(actor)) ? 'admin_university_summary' : 'study_help';
  }
  return 'study_help';
}

/**
 * Formats a canonical quick action definition into the minimal safe presentation object.
 * Strictly never exposes private prompts, conversation content, or internal scores.
 */
export function formatQuickActionItem(def: CanonicalQuickActionDefinition): QuickActionPresentationItem {
  return {
    key: def.key,
    title: def.title,
    titleEn: def.titleEn,
    description: def.description,
    descriptionEn: def.descriptionEn,
    prompt: def.prompt,
    promptEn: def.promptEn,
    promptKey: def.promptKey,
    icon: def.icon,
    iconBg: def.iconBg,
    iconColor: def.iconColor,
  };
}

/**
 * Retrieves personalized quick actions for the authorized actor:
 * 1. Checks daily bucket DB usage records for this user (strictly isolated to actor.id).
 * 2. Filters strictly through CURRENT authoritative RBAC (actor capabilities/roles).
 * 3. Aggregates count within the true 60-day window. Old usage outside the window does NOT count.
 * 4. Requires repeat threshold: recentUsageCountWithinWindow >= 2.
 * 5. Ranks by deterministic frequency + recency score.
 * 6. Returns 1 to 4 cards:
 *    - If 4+ qualify: top 4
 *    - If 3 qualify: 3 cards
 *    - If 2 qualify: 2 cards
 *    - If 1 qualifies: 1 card
 *    - If 0 qualify: exactly 1 fallback card (most recently used permitted, or role default).
 */
export async function getPersonalizedQuickActions(
  actor: AuthActor,
  now = new Date(),
): Promise<QuickActionPresentationItem[]> {
  const userId = actor?.id;
  if (!userId) {
    const fallbackDef = CANONICAL_QUICK_ACTIONS[getRoleDefaultActionKey(actor)] || CANONICAL_QUICK_ACTIONS.study_help;
    return [formatQuickActionItem(fallbackDef)];
  }

  try {
    const cutoffTime = now.getTime() - HORIZON_DAYS * 24 * 60 * 60 * 1000;
    const cutoffDate = getUsageDateKey(new Date(cutoffTime));

    // Fetch user's usage records within the true 60-day personalization window
    const windowRecords = await prisma.aIQuickActionUsage.findMany({
      where: {
        userId,
        usageDate: {
          gte: cutoffDate,
        },
      },
      orderBy: {
        lastUsedAt: 'desc',
      },
    });

    // 1. Authoritative RBAC Filter & True Window Aggregation
    interface ActionWindowStats {
      actionKey: string;
      recentUsageCount: number;
      lastUsedAt: Date;
      def: CanonicalQuickActionDefinition;
    }

    const statsMap = new Map<string, ActionWindowStats>();

    for (const record of windowRecords) {
      const def = CANONICAL_QUICK_ACTIONS[record.actionKey];
      // Discard unpermitted actions immediately
      if (!def || !def.isAllowed(actor)) {
        continue;
      }

      const existing = statsMap.get(record.actionKey);
      if (existing) {
        existing.recentUsageCount += record.count;
        if (record.lastUsedAt.getTime() > existing.lastUsedAt.getTime()) {
          existing.lastUsedAt = record.lastUsedAt;
        }
      } else {
        statsMap.set(record.actionKey, {
          actionKey: record.actionKey,
          recentUsageCount: record.count,
          lastUsedAt: record.lastUsedAt,
          def,
        });
      }
    }

    // 2. Filter for repeated actions within the 60-day window (recentUsageCount >= 2)
    const qualifyingRepeated = Array.from(statsMap.values()).filter((item) => {
      return item.recentUsageCount >= REPEAT_USAGE_THRESHOLD;
    });

    if (qualifyingRepeated.length > 0) {
      // 3. Rank qualifying actions using frequency + recency score
      const scored = qualifyingRepeated.map((item) => {
        const score = calculateRankingScore(item.recentUsageCount, item.lastUsedAt, now);
        return {
          ...item,
          score,
        };
      });

      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const timeDiff = b.lastUsedAt.getTime() - a.lastUsedAt.getTime();
        if (timeDiff !== 0) return timeDiff;
        return a.actionKey.localeCompare(b.actionKey);
      });

      // Cap at MAX_QUICK_ACTIONS (4)
      const topActions = scored.slice(0, MAX_QUICK_ACTIONS);
      return topActions.map((item) => formatQuickActionItem(item.def));
    }

    // Zero-repeat fallback (Rule 13):
    // 1. If user has any permitted action in the recent window, use the most recently used permitted action
    const anyPermittedInWindow = Array.from(statsMap.values()).sort(
      (a, b) => b.lastUsedAt.getTime() - a.lastUsedAt.getTime()
    );
    if (anyPermittedInWindow.length > 0) {
      return [formatQuickActionItem(anyPermittedInWindow[0].def)];
    }

    // If not in recent window, check if user has older permitted usage history in DB
    const olderRecords = await prisma.aIQuickActionUsage.findMany({
      where: {
        userId,
      },
      orderBy: {
        lastUsedAt: 'desc',
      },
      take: 10,
    });
    for (const older of olderRecords) {
      const def = CANONICAL_QUICK_ACTIONS[older.actionKey];
      if (def && def.isAllowed(actor)) {
        return [formatQuickActionItem(def)];
      }
    }

    // 2. If user has no permitted usage history at all: show one role-appropriate default action
    const defaultKey = getRoleDefaultActionKey(actor);
    const defaultDef = CANONICAL_QUICK_ACTIONS[defaultKey] || CANONICAL_QUICK_ACTIONS.study_help;
    return [formatQuickActionItem(defaultDef)];
  } catch (err: unknown) {
    logger.warn('[AI-QUICK-ACTION] Failed to retrieve personalized actions, returning safe fallback', {
      userId,
      error: (err as any)?.message,
    });
    const defaultKey = getRoleDefaultActionKey(actor);
    const defaultDef = CANONICAL_QUICK_ACTIONS[defaultKey] || CANONICAL_QUICK_ACTIONS.study_help;
    return [formatQuickActionItem(defaultDef)];
  }
}
