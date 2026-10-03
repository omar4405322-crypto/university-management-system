import assert from 'node:assert/strict';
import type { AuthActor } from '../src/types/auth.types';

process.env.AI_ASSISTANT_ENABLED = 'true';
process.env.AI_PROVIDER = 'openai';
process.env.OPENAI_API_KEY = 'mock-only-placeholder';

const { getAllowedAiTools, executeAiTool } = await import('../src/services/aiTools.service');
const { generateAiReply } = await import('../src/services/ai.service');

// Actors for testing all roles
const studentActor = { id: 101, role: 'STUDENT', student: { id: 201 } } as AuthActor;
const otherStudentActor = { id: 102, role: 'STUDENT', student: { id: 202 } } as AuthActor;
const doctorActor = { id: 103, role: 'DOCTOR', doctor: { id: 301 } } as AuthActor;
const otherDoctorActor = { id: 104, role: 'DOCTOR', doctor: { id: 302 } } as AuthActor;
const taActor = { id: 105, role: 'TEACHING_ASSISTANT', teachingAssistant: { id: 'ta-001' } } as AuthActor;
const collegeAdminActor = { id: 106, role: 'COLLEGE_ADMIN', managedCollegeId: 5 } as AuthActor;
const deptAdminActor = { id: 107, role: 'DEPARTMENT_ADMIN', managedDepartmentId: 12 } as AuthActor;
const superAdminActor = { id: 108, role: 'SUPER_ADMIN' } as AuthActor;
const unassignedStudentActor = { id: 109, role: 'STUDENT', student: null } as unknown as AuthActor;
const unscopedAdminActor = { id: 110, role: 'COLLEGE_ADMIN', managedCollegeId: null, collegeId: null } as unknown as AuthActor;

// 1. Capability Matrix & Tool Declarations
const expectedStudentTools = [
  'get_my_academic_summary',
  'get_my_courses',
  'get_my_attendance_summary',
  'get_my_schedule',
  'get_my_tasks',
  'get_my_exams',
  'get_my_payments',
  'get_my_priority_overview',
  'get_my_weekly_overview',
  'get_my_notifications',
  'search_university_regulations',
  'propose_mark_notification_read',
];
assert.deepEqual(getAllowedAiTools(studentActor).map((t) => t.name), expectedStudentTools);

const expectedDoctorTools = [
  'get_my_teaching_courses',
  'get_my_teaching_schedule',
  'get_my_teaching_workload',
  'get_my_course_attendance_overview',
  'get_my_course_roster',
  'get_my_teaching_insights',
  'propose_create_task',
  'get_my_notifications',
  'search_university_regulations',
  'propose_mark_notification_read',
];
assert.deepEqual(getAllowedAiTools(doctorActor).map((t) => t.name), expectedDoctorTools);

const expectedTaTools = [
  'get_my_assigned_sections',
  'get_my_ta_schedule',
  'get_my_ta_workload',
  'get_my_section_students',
  'get_my_section_insights',
  'get_my_notifications',
  'search_university_regulations',
  'propose_mark_notification_read',
];
assert.deepEqual(getAllowedAiTools(taActor).map((t) => t.name), expectedTaTools);

const expectedAdminTools = [
  'get_scoped_university_summary',
  'get_scoped_academic_analytics',
  'get_scoped_attendance_analytics',
  'get_scoped_schedule_summary',
  'get_scoped_payment_summary',
  'get_scoped_registration_summary',
  'search_scoped_students',
  'search_scoped_doctors',
  'search_scoped_courses',
  'get_scoped_course_details',
  'list_scoped_departments',
  'get_scoped_operational_insights',
  'compare_scoped_departments',
  'propose_scoped_announcement',
  'get_my_notifications',
  'search_university_regulations',
  'propose_mark_notification_read',
];
assert.deepEqual(getAllowedAiTools(collegeAdminActor).map((t) => t.name), expectedAdminTools);
assert.deepEqual(getAllowedAiTools(deptAdminActor).map((t) => t.name), expectedAdminTools);
assert.deepEqual(getAllowedAiTools(superAdminActor).map((t) => t.name), expectedAdminTools);

// Fail-closed checks for missing profiles/scopes
assert.deepEqual(getAllowedAiTools(unassignedStudentActor), []);
assert.deepEqual(getAllowedAiTools(unscopedAdminActor), []);
assert.deepEqual(getAllowedAiTools(undefined), []);

// Strict schema check on all tool definitions
for (const actor of [studentActor, doctorActor, taActor, collegeAdminActor, deptAdminActor, superAdminActor]) {
  for (const tool of getAllowedAiTools(actor)) {
    assert.equal(tool.strict, true);
    assert.equal(tool.parameters.type, 'object');
    assert.equal(tool.parameters.additionalProperties, false);
  }
}

// 2. Mocked Execution Verification
const calls: unknown[][] = [];
const mockDeps = {
  // Student
  studentAcademicSummary: async (...args: unknown[]) => {
    calls.push(['studentAcademicSummary', ...args]);
    return { cumulativeGpa: 3.85, totalCreditsEarned: 45, totalCreditsAttempted: 45, coursesCount: 15, year: 2, departmentName: 'CS', collegeName: 'Engineering', predictedRisk: 'LOW', attendanceRate: 96, recentCourses: [{ courseCode: 'CS201', courseName: 'Data Structures', finalGrade: 95, status: 'COMPLETED', passwordHash: 'secret' }] };
  },
  studentCourses: async (...args: unknown[]) => {
    calls.push(['studentCourses', ...args]);
    return { totalEnrolledCourses: 1, courses: [{ courseCode: 'CS201', courseName: 'Data Structures', credits: 3, year: 2, semester: 1, department: 'CS' }] };
  },
  attendance: async (...args: unknown[]) => {
    calls.push(['attendance', ...args]);
    return { stats: { PRESENT: 18, ABSENT: 1, LATE: 1, EXCUSED: 0, PENDING_REVIEW: 0, total: 20, attendancePercentage: 95 }, data: [{ tokenVersion: 99 }] };
  },
  studentSchedule: async (...args: unknown[]) => {
    calls.push(['studentSchedule', ...args]);
    return { totalSlots: 1, slots: [{ dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '11:00', room: 'Hall A', slotType: 'LECTURE', courseCode: 'CS201', courseName: 'Data Structures', instructor: 'Dr. Smith' }] };
  },
  tasks: async (...args: unknown[]) => {
    calls.push(['tasks', ...args]);
    return { rows: [{ title: 'Assignment 1', dueDate: new Date('2026-10-15'), course: { courseCode: 'CS201', name: 'Data Structures' }, rfidTag: 'rfid-priv' }], pagination: { totalCount: 1 } };
  },
  studentExams: async (...args: unknown[]) => {
    calls.push(['studentExams', ...args]);
    return { totalUpcomingExams: 1, upcomingExams: [{ title: 'Midterm', type: 'MIDTERM', date: '2026-11-01', startTime: '10:00', endTime: '12:00', room: 'Exam Hall 1', courseCode: 'CS201', courseName: 'Data Structures' }] };
  },
  studentPayments: async (...args: unknown[]) => {
    calls.push(['studentPayments', ...args]);
    return { totalPaid: 5000, totalPending: 0, totalOverdue: 0, pendingCount: 0, overdueCount: 0, recentPayments: [{ type: 'TUITION', amount: 5000, status: 'PAID', dueDate: null, paidAt: '2026-09-01' }] };
  },

  // Doctor
  doctorCourses: async (...args: unknown[]) => {
    calls.push(['doctorCourses', ...args]);
    return { totalTeachingCourses: 1, courses: [{ courseCode: 'CS201', courseName: 'Data Structures', credits: 3, year: 2, semester: 1, department: 'CS' }] };
  },
  doctorSchedule: async (...args: unknown[]) => {
    calls.push(['doctorSchedule', ...args]);
    return { totalSlots: 1, slots: [{ dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '11:00', room: 'Hall A', slotType: 'LECTURE', courseCode: 'CS201', courseName: 'Data Structures' }] };
  },
  doctorWorkload: async (...args: unknown[]) => {
    calls.push(['doctorWorkload', ...args]);
    return { totalAssignedSlots: 4, totalQuizzesCreated: 2, totalTasksCreated: 3, pendingSubmissionsToGrade: 5 };
  },
  doctorAttendance: async (...args: unknown[]) => {
    calls.push(['doctorAttendance', ...args]);
    return { totalRecordedSessions: 50, presentCount: 45, absentCount: 3, lateCount: 2, excusedCount: 0, overallAttendancePercentage: 94 };
  },
  doctorCourseRoster: async (...args: unknown[]) => {
    calls.push(['doctorCourseRoster', ...args]);
    return { courseCode: 'CS201', courseName: 'Data Structures', totalEnrolled: 1, students: [{ studentId: 'S101', fullName: 'Alice Johnson', year: 2, departmentName: 'CS' }] };
  },

  // TA
  taSections: async (...args: unknown[]) => {
    calls.push(['taSections', ...args]);
    return { totalAssignedCourses: 1, sections: [{ courseCode: 'CS201', courseName: 'Data Structures', department: 'CS', assignedGroups: ['Group 1'] }] };
  },
  taSchedule: async (...args: unknown[]) => {
    calls.push(['taSchedule', ...args]);
    return { totalSlots: 1, slots: [{ dayOfWeek: 'TUESDAY', startTime: '12:00', endTime: '14:00', room: 'Lab 3', slotType: 'LAB', courseCode: 'CS201', courseName: 'Data Structures', groupName: 'Group 1' }] };
  },
  taWorkload: async (...args: unknown[]) => {
    calls.push(['taWorkload', ...args]);
    return { totalAssignedSlots: 2 };
  },
  taSectionStudents: async (...args: unknown[]) => {
    calls.push(['taSectionStudents', ...args]);
    return { totalStudents: 1, students: [{ studentId: 'S101', fullName: 'Alice Johnson', year: 2, groupName: 'Group 1', departmentName: 'CS' }] };
  },

  // Admin
  adminSummary: async (...args: unknown[]) => {
    calls.push(['adminSummary', ...args]);
    return { totalColleges: 1, totalDepartments: 3, totalStudents: 450, totalDoctors: 20, totalCourses: 35 };
  },
  adminAcademic: async (...args: unknown[]) => {
    calls.push(['adminAcademic', ...args]);
    return { totalStudents: 450, totalCourses: 35, atRiskStudentsCount: 12, studentYearDistribution: [{ year: 1, studentsCount: 200 }, { year: 2, studentsCount: 250 }] };
  },
  adminAttendance: async (...args: unknown[]) => {
    calls.push(['adminAttendance', ...args]);
    return { totalAttendanceRecords: 2500, presentCount: 2200, absentCount: 150, lateCount: 100, excusedCount: 30, pendingReviewCount: 20, overallAttendancePercentage: 92 };
  },
  adminSchedule: async (...args: unknown[]) => {
    calls.push(['adminSchedule', ...args]);
    return { totalSlots: 60, slotsByDay: [{ dayOfWeek: 'SUNDAY', count: 12 }], slotsByType: [{ slotType: 'LECTURE', count: 40 }, { slotType: 'LAB', count: 20 }] };
  },
  adminPayments: async (...args: unknown[]) => {
    calls.push(['adminPayments', ...args]);
    return { totalCollected: 1500000, totalPending: 200000, totalOverdue: 50000, paidPaymentsCount: 300, pendingPaymentsCount: 40, overduePaymentsCount: 10 };
  },
  adminRegistrations: async (...args: unknown[]) => {
    calls.push(['adminRegistrations', ...args]);
    return { pendingRequestsCount: 5, approvedRequestsCount: 120, rejectedRequestsCount: 8, totalRequestsCount: 133 };
  },
  adminSearchStudents: async (...args: unknown[]) => {
    calls.push(['adminSearchStudents', ...args]);
    return { totalStudents: 1, students: [{ studentId: 'S101', fullName: 'Alice Johnson', year: 2, departmentName: 'CS', collegeName: 'Engineering', status: 'ACTIVE' }] };
  },
  adminSearchDoctors: async (...args: unknown[]) => {
    calls.push(['adminSearchDoctors', ...args]);
    return { totalDoctors: 1, doctors: [{ doctorId: 'DOC-001', fullName: 'Dr. John Smith', specialty: 'AI', departmentName: 'CS', collegeName: 'Engineering' }] };
  },
  adminSearchCourses: async (...args: unknown[]) => {
    calls.push(['adminSearchCourses', ...args]);
    return { totalCourses: 1, courses: [{ courseCode: 'CS201', name: 'Data Structures', credits: 3, year: 2, semester: 1, departmentName: 'CS', collegeName: 'Engineering', enrolledStudentsCount: 40 }] };
  },
  adminCourseDetails: async (...args: unknown[]) => {
    calls.push(['adminCourseDetails', ...args]);
    return { courseCode: 'CS201', name: 'Data Structures', credits: 3, year: 2, semester: 1, departmentName: 'CS', collegeName: 'Engineering', enrolledStudentsCount: 40, instructors: ['Dr. John Smith'] };
  },
  adminDepartments: async (...args: unknown[]) => {
    calls.push(['adminDepartments', ...args]);
    return { totalDepartments: 1, departments: [{ id: 12, name: 'Computer Science', nameAr: 'علوم الحاسب', collegeName: 'Engineering', studentsCount: 200, doctorsCount: 10, coursesCount: 15 }] };
  },

  // Cross-Domain Composite
  studentPriorityOverview: async (...args: unknown[]) => {
    calls.push(['studentPriorityOverview', ...args]);
    return { status: 'SUCCESS', hasData: true, priorityState: 'NORMAL', summary: 'Good standing' };
  },
  studentWeeklyOverview: async (...args: unknown[]) => {
    calls.push(['studentWeeklyOverview', ...args]);
    return { status: 'SUCCESS', hasData: true, totalWeeklyEvents: 3 };
  },
  doctorTeachingInsights: async (...args: unknown[]) => {
    calls.push(['doctorTeachingInsights', ...args]);
    return { status: 'SUCCESS', hasData: true, teachingCoursesCount: 1 };
  },
  taSectionInsights: async (...args: unknown[]) => {
    calls.push(['taSectionInsights', ...args]);
    return { status: 'SUCCESS', hasData: true, totalAssignedSections: 1 };
  },
  adminOperationalInsights: async (...args: unknown[]) => {
    calls.push(['adminOperationalInsights', ...args]);
    return { status: 'SUCCESS', hasData: true, crossDomainIndicators: {} };
  },
  compareScopedDepartments: async (...args: unknown[]) => {
    calls.push(['compareScopedDepartments', ...args]);
    return { status: 'SUCCESS', hasData: true, comparedDepartmentsCount: 1 };
  },

  // Shared
  notifications: async (...args: unknown[]) => {
    calls.push(['notifications', ...args]);
    return { totalRecent: 1, notifications: [{ title: 'Midterm schedule posted', message: 'Check exam dates', type: 'info', isRead: false, date: '2026-10-01' }] };
  },
};

// Execute Student tools
const academicSummary = await executeAiTool('get_my_academic_summary', '{}', studentActor, mockDeps as any);
assert.equal(academicSummary.cumulativeGpa, 3.85);
assert.deepEqual(calls.pop(), ['studentAcademicSummary', 201]);

const studentCourses = await executeAiTool('get_my_courses', '{}', studentActor, mockDeps as any);
assert.equal(studentCourses.totalEnrolledCourses, 1);
assert.deepEqual(calls.pop(), ['studentCourses', 201]);

const attendanceSummary = await executeAiTool('get_my_attendance_summary', '{}', studentActor, mockDeps as any);
assert.equal(attendanceSummary.total, 20);
assert.equal(attendanceSummary.attendancePercentage, 95);
assert.deepEqual(calls.pop(), ['attendance', 101, { page: 1, limit: 1 }]);

const schedule = await executeAiTool('get_my_schedule', '{}', studentActor, mockDeps as any);
assert.equal(schedule.totalSlots, 1);
assert.deepEqual(calls.pop(), ['studentSchedule', studentActor, undefined]);

// Execute with optional dayOfWeek filter
await executeAiTool('get_my_schedule', '{"dayOfWeek":"MONDAY"}', studentActor, mockDeps as any);
assert.deepEqual(calls.pop(), ['studentSchedule', studentActor, 'MONDAY']);

const tasks = await executeAiTool('get_my_tasks', '{}', studentActor, mockDeps as any);
assert.equal(tasks.totalCount, 1);
assert.deepEqual(calls.pop(), ['tasks', studentActor, undefined, { page: 1, limit: 10 }]);

const exams = await executeAiTool('get_my_exams', '{}', studentActor, mockDeps as any);
assert.equal(exams.totalUpcomingExams, 1);
assert.deepEqual(calls.pop(), ['studentExams', 201]);

const payments = await executeAiTool('get_my_payments', '{}', studentActor, mockDeps as any);
assert.equal(payments.totalPaid, 5000);
assert.deepEqual(calls.pop(), ['studentPayments', 201]);

const priorityOverview = await executeAiTool('get_my_priority_overview', '{}', studentActor, mockDeps as any);
assert.equal(priorityOverview.status, 'SUCCESS');
assert.deepEqual(calls.pop(), ['studentPriorityOverview', studentActor]);

const weeklyOverview = await executeAiTool('get_my_weekly_overview', '{}', studentActor, mockDeps as any);
assert.equal(weeklyOverview.totalWeeklyEvents, 3);
assert.deepEqual(calls.pop(), ['studentWeeklyOverview', studentActor]);

const notifications = await executeAiTool('get_my_notifications', '{}', studentActor, mockDeps as any);
assert.equal(notifications.totalRecent, 1);
assert.deepEqual(calls.pop(), ['notifications', 101]);

// Execute Doctor tools
const docCourses = await executeAiTool('get_my_teaching_courses', '{}', doctorActor, mockDeps as any);
assert.equal(docCourses.totalTeachingCourses, 1);
assert.deepEqual(calls.pop(), ['doctorCourses', 301]);

const docSchedule = await executeAiTool('get_my_teaching_schedule', '{}', doctorActor, mockDeps as any);
assert.equal(docSchedule.totalSlots, 1);
assert.deepEqual(calls.pop(), ['doctorSchedule', 301, undefined]);

const docWorkload = await executeAiTool('get_my_teaching_workload', '{}', doctorActor, mockDeps as any);
assert.equal(docWorkload.totalAssignedSlots, 4);
assert.deepEqual(calls.pop(), ['doctorWorkload', 301]);

const docAttendance = await executeAiTool('get_my_course_attendance_overview', '{}', doctorActor, mockDeps as any);
assert.equal(docAttendance.totalRecordedSessions, 50);
assert.deepEqual(calls.pop(), ['doctorAttendance', 103, 301]);

const docRoster = await executeAiTool('get_my_course_roster', '{"courseCode":"CS201"}', doctorActor, mockDeps as any);
assert.equal(docRoster.totalEnrolled, 1);
assert.deepEqual(calls.pop(), ['doctorCourseRoster', 301, 'CS201', 1, 15]);

const docInsights = await executeAiTool('get_my_teaching_insights', '{}', doctorActor, mockDeps as any);
assert.equal(docInsights.status, 'SUCCESS');
assert.deepEqual(calls.pop(), ['doctorTeachingInsights', doctorActor]);

// Execute TA tools
const taSections = await executeAiTool('get_my_assigned_sections', '{}', taActor, mockDeps as any);
assert.equal(taSections.totalAssignedCourses, 1);
assert.deepEqual(calls.pop(), ['taSections', 'ta-001']);

const taSchedule = await executeAiTool('get_my_ta_schedule', '{}', taActor, mockDeps as any);
assert.equal(taSchedule.totalSlots, 1);
assert.deepEqual(calls.pop(), ['taSchedule', 'ta-001', undefined]);

const taWorkload = await executeAiTool('get_my_ta_workload', '{}', taActor, mockDeps as any);
assert.equal(taWorkload.totalAssignedSlots, 2);
assert.deepEqual(calls.pop(), ['taWorkload', 'ta-001']);

const taStudents = await executeAiTool('get_my_section_students', '{"courseCode":"CS201"}', taActor, mockDeps as any);
assert.equal(taStudents.totalStudents, 1);
assert.deepEqual(calls.pop(), ['taSectionStudents', 'ta-001', 'CS201', 1, 15]);

const taInsights = await executeAiTool('get_my_section_insights', '{}', taActor, mockDeps as any);
assert.equal(taInsights.status, 'SUCCESS');
assert.deepEqual(calls.pop(), ['taSectionInsights', taActor]);

// Execute Admin tools
const adminSummary = await executeAiTool('get_scoped_university_summary', '{}', collegeAdminActor, mockDeps as any);
assert.equal(adminSummary.totalStudents, 450);
assert.deepEqual(calls.pop(), ['adminSummary', collegeAdminActor]);

const adminAcademic = await executeAiTool('get_scoped_academic_analytics', '{}', collegeAdminActor, mockDeps as any);
assert.equal(adminAcademic.totalStudents, 450);
assert.equal(calls.pop()![0], 'adminAcademic');

const adminAttendance = await executeAiTool('get_scoped_attendance_analytics', '{}', collegeAdminActor, mockDeps as any);
assert.equal(adminAttendance.totalAttendanceRecords, 2500);
assert.equal(calls.pop()![0], 'adminAttendance');

const adminSchedule = await executeAiTool('get_scoped_schedule_summary', '{}', collegeAdminActor, mockDeps as any);
assert.equal(adminSchedule.totalSlots, 60);
assert.equal(calls.pop()![0], 'adminSchedule');

const adminPayments = await executeAiTool('get_scoped_payment_summary', '{}', collegeAdminActor, mockDeps as any);
assert.equal(adminPayments.totalCollected, 1500000);
assert.equal(calls.pop()![0], 'adminPayments');

const adminRegistrations = await executeAiTool('get_scoped_registration_summary', '{}', collegeAdminActor, mockDeps as any);
assert.equal(adminRegistrations.pendingRequestsCount, 5);
assert.deepEqual(calls.pop(), ['adminRegistrations', collegeAdminActor]);

const adminStudents = await executeAiTool('search_scoped_students', '{"query":"Alice"}', collegeAdminActor, mockDeps as any);
assert.equal(adminStudents.totalStudents, 1);
assert.deepEqual(calls.pop(), ['adminSearchStudents', collegeAdminActor, { query: 'Alice' }]);

const adminDoctors = await executeAiTool('search_scoped_doctors', '{"query":"Smith"}', collegeAdminActor, mockDeps as any);
assert.equal(adminDoctors.totalDoctors, 1);
assert.deepEqual(calls.pop(), ['adminSearchDoctors', collegeAdminActor, { query: 'Smith' }]);

const adminCourses = await executeAiTool('search_scoped_courses', '{"query":"CS201"}', collegeAdminActor, mockDeps as any);
assert.equal(adminCourses.totalCourses, 1);
assert.deepEqual(calls.pop(), ['adminSearchCourses', collegeAdminActor, { query: 'CS201' }]);

const adminCourseDet = await executeAiTool('get_scoped_course_details', '{"courseCode":"CS201"}', collegeAdminActor, mockDeps as any);
assert.equal(adminCourseDet.courseCode, 'CS201');
assert.deepEqual(calls.pop(), ['adminCourseDetails', collegeAdminActor, 'CS201']);

const adminDepts = await executeAiTool('list_scoped_departments', '{}', collegeAdminActor, mockDeps as any);
assert.equal(adminDepts.totalDepartments, 1);
assert.deepEqual(calls.pop(), ['adminDepartments', collegeAdminActor]);

const adminInsights = await executeAiTool('get_scoped_operational_insights', '{}', collegeAdminActor, mockDeps as any);
assert.equal(adminInsights.status, 'SUCCESS');
assert.deepEqual(calls.pop(), ['adminOperationalInsights', collegeAdminActor]);

const adminComparison = await executeAiTool('compare_scoped_departments', '{"departmentIds":[12]}', collegeAdminActor, mockDeps as any);
assert.equal(adminComparison.comparedDepartmentsCount, 1);
assert.deepEqual(calls.pop(), ['compareScopedDepartments', collegeAdminActor, [12]]);

// 3. Security & Cross-Role Access Rejections
// Student trying to call doctor / admin / arbitrary tools
await assert.rejects(executeAiTool('get_my_teaching_courses', '{}', studentActor, mockDeps as any), /AI tool unavailable/);
await assert.rejects(executeAiTool('get_my_teaching_insights', '{}', studentActor, mockDeps as any), /AI tool unavailable/);
await assert.rejects(executeAiTool('get_scoped_operational_insights', '{}', studentActor, mockDeps as any), /AI tool unavailable/);
await assert.rejects(executeAiTool('compare_scoped_departments', '{}', studentActor, mockDeps as any), /AI tool unavailable/);
await assert.rejects(executeAiTool('get_scoped_university_summary', '{}', studentActor, mockDeps as any), /AI tool unavailable/);
await assert.rejects(executeAiTool('search_scoped_students', '{}', studentActor, mockDeps as any), /AI tool unavailable/);
await assert.rejects(executeAiTool('run_sql', '{}', studentActor, mockDeps as any), /AI tool unavailable/);

// Doctor trying to call student / admin tools
await assert.rejects(executeAiTool('get_my_academic_summary', '{}', doctorActor, mockDeps as any), /AI tool unavailable/);
await assert.rejects(executeAiTool('get_my_priority_overview', '{}', doctorActor, mockDeps as any), /AI tool unavailable/);
await assert.rejects(executeAiTool('get_my_weekly_overview', '{}', doctorActor, mockDeps as any), /AI tool unavailable/);
await assert.rejects(executeAiTool('get_scoped_payment_summary', '{}', doctorActor, mockDeps as any), /AI tool unavailable/);
await assert.rejects(executeAiTool('get_scoped_operational_insights', '{}', doctorActor, mockDeps as any), /AI tool unavailable/);
await assert.rejects(executeAiTool('search_scoped_students', '{}', doctorActor, mockDeps as any), /AI tool unavailable/);

// TA trying to call doctor workload / admin tools
await assert.rejects(executeAiTool('get_my_teaching_workload', '{}', taActor, mockDeps as any), /AI tool unavailable/);
await assert.rejects(executeAiTool('get_my_priority_overview', '{}', taActor, mockDeps as any), /AI tool unavailable/);
await assert.rejects(executeAiTool('compare_scoped_departments', '{}', taActor, mockDeps as any), /AI tool unavailable/);
await assert.rejects(executeAiTool('get_scoped_registration_summary', '{}', taActor, mockDeps as any), /AI tool unavailable/);

// Admin trying to call student / doctor personal tools
await assert.rejects(executeAiTool('get_my_academic_summary', '{}', collegeAdminActor, mockDeps as any), /AI tool unavailable/);
await assert.rejects(executeAiTool('get_my_priority_overview', '{}', collegeAdminActor, mockDeps as any), /AI tool unavailable/);
await assert.rejects(executeAiTool('get_my_weekly_overview', '{}', collegeAdminActor, mockDeps as any), /AI tool unavailable/);
await assert.rejects(executeAiTool('get_my_teaching_courses', '{}', collegeAdminActor, mockDeps as any), /AI tool unavailable/);
await assert.rejects(executeAiTool('get_my_teaching_insights', '{}', collegeAdminActor, mockDeps as any), /AI tool unavailable/);

// 4. Argument Injection Defense (rejects undeclared arguments)
await assert.rejects(executeAiTool('get_my_attendance_summary', '{"studentId":99}', studentActor, mockDeps as any), /Invalid AI tool arguments/);
await assert.rejects(executeAiTool('get_my_attendance_summary', '{"userId":99}', studentActor, mockDeps as any), /Invalid AI tool arguments/);
await assert.rejects(executeAiTool('get_my_attendance_summary', '{"where":{"id":1}}', studentActor, mockDeps as any), /Invalid AI tool arguments/);
await assert.rejects(executeAiTool('get_my_attendance_summary', 'null', studentActor, mockDeps as any), /Invalid AI tool arguments/);
await assert.rejects(executeAiTool('get_my_attendance_summary', '["bad"]', studentActor, mockDeps as any), /Invalid AI tool arguments/);
await assert.rejects(executeAiTool('get_my_attendance_summary', 'malformed json', studentActor, mockDeps as any), /Invalid AI tool arguments/);
await assert.rejects(executeAiTool('search_scoped_students', '{"sqlInjection":"DROP TABLE"}', collegeAdminActor, mockDeps as any), /Invalid AI tool arguments/);

// 5. Data Minimization check
const stringifiedAcademic = JSON.stringify(academicSummary);
assert.equal(stringifiedAcademic.includes('secret'), false);
assert.equal(stringifiedAcademic.includes('password'), false);

const stringifiedAttendance = JSON.stringify(attendanceSummary);
assert.equal(stringifiedAttendance.includes('tokenVersion'), false);

const stringifiedTasks = JSON.stringify(tasks);
assert.equal(stringifiedTasks.includes('rfidTag'), false);

const stringifiedAdminStudents = JSON.stringify(adminStudents);
assert.equal(stringifiedAdminStudents.includes('phone'), false);
assert.equal(stringifiedAdminStudents.includes('password'), false);
assert.equal(stringifiedAdminStudents.includes('address'), false);

// 6. Mock AI Reply Generation across English & Arabic flows
const clientRequests: any[] = [];
let roundCounter = 0;
const mockedClient = {
  responses: {
    create: async (params: any) => {
      clientRequests.push(params);
      roundCounter++;
      if (roundCounter === 1) {
        return {
          output: [{ type: 'function_call', name: 'get_my_academic_summary', arguments: '{}', call_id: 'call_acad_1' }],
          output_text: '',
        };
      }
      return {
        output: [{ type: 'message', content: [{ type: 'output_text', text: 'معدلك التراكمي هو 3.85 وحالتك الأكاديمية ممتازة.' }] }],
        output_text: 'معدلك التراكمي هو 3.85 وحالتك الأكاديمية ممتازة.',
      };
    },
  },
} as any;

const arabicReply = await generateAiReply('لخص مستواي الأكاديمي', mockedClient, studentActor, (name, args, user) => executeAiTool(name, args, user, mockDeps as any));
assert.equal(arabicReply, 'معدلك التراكمي هو 3.85 وحالتك الأكاديمية ممتازة.');
assert.equal(clientRequests.length, 2);
assert.equal(clientRequests[0].store, false);
assert.equal(clientRequests[1].input.at(-1).type, 'function_call_output');
assert.equal(clientRequests[1].input.at(-1).call_id, 'call_acad_1');

console.log('All Phase 10 AI tool unit tests passed successfully (mocked only, no real API calls).');
