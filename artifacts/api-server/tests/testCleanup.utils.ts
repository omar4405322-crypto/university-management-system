import type { PrismaClient } from '@prisma/client';

export interface CleanupEntities {
  attendanceIds?: number[];
  sessionIds?: number[];
  overrideIds?: number[];
  changeRequestIds?: number[];
  slotIds?: number[];
  enrollmentIds?: number[];
  timetableIds?: number[];
  studentIds?: number[];
  doctorIds?: number[];
  taIds?: (string | number)[];
  approvalIds?: number[];
  courseIds?: number[];
  groupIds?: number[];
  roomIds?: number[];
  userIds?: number[];
  departmentIds?: number[];
  collegeIds?: number[];
}

function dedupe<T>(items?: (T | null | undefined)[]): T[] {
  if (!items || items.length === 0) return [];
  const set = new Set<T>();
  for (const item of items) {
    if (item !== null && item !== undefined) {
      set.add(item);
    }
  }
  return Array.from(set);
}

/**
 * Robust hermetic test cleanup helper that purges created test records
 * in strict reverse topological order (children before parents) to guarantee
 * foreign key integrity and prevent database leakage.
 *
 * Rules:
 * - Only deletes by explicitly provided IDs (never prefix-based or id-less deleteMany).
 * - Deletes dependent children (AuditLog, Notification, RefreshToken, Profiles) before User.
 * - Deletes User before Department and College.
 * - Deletes ScheduleSlot before Timetable.
 * - Deletes Attendance and Session before ScheduleSlot.
 */
export async function cleanupTestEntities(prisma: PrismaClient, entities: CleanupEntities): Promise<void> {
  const attendanceIds = dedupe(entities.attendanceIds);
  const sessionIds = dedupe(entities.sessionIds);
  const overrideIds = dedupe(entities.overrideIds);
  const changeRequestIds = dedupe(entities.changeRequestIds);
  const slotIds = dedupe(entities.slotIds);
  const enrollmentIds = dedupe(entities.enrollmentIds);
  const timetableIds = dedupe(entities.timetableIds);
  const studentIds = dedupe(entities.studentIds);
  const doctorIds = dedupe(entities.doctorIds);
  const taIds = dedupe(entities.taIds?.map(String));
  const approvalIds = dedupe(entities.approvalIds);
  const courseIds = dedupe(entities.courseIds);
  const groupIds = dedupe(entities.groupIds);
  const roomIds = dedupe(entities.roomIds);
  const userIds = dedupe(entities.userIds);
  const departmentIds = dedupe(entities.departmentIds);
  const collegeIds = dedupe(entities.collegeIds);

  // 1. Attendance records (leaf of AttendanceSession & Student)
  if (attendanceIds.length > 0) {
    await prisma.attendance.deleteMany({ where: { id: { in: attendanceIds } } }).catch(() => {});
  }
  if (sessionIds.length > 0) {
    await prisma.attendance.deleteMany({ where: { sessionId: { in: sessionIds } } }).catch(() => {});
  }
  if (studentIds.length > 0) {
    await prisma.attendance.deleteMany({ where: { studentId: { in: studentIds } } }).catch(() => {});
  }

  // 2. AttendanceSessions (leaf of ScheduleSlot)
  if (sessionIds.length > 0) {
    await prisma.attendanceSession.deleteMany({ where: { id: { in: sessionIds } } }).catch(() => {});
  }
  if (slotIds.length > 0) {
    await prisma.attendanceSession.deleteMany({ where: { scheduleSlotId: { in: slotIds } } }).catch(() => {});
  }

  // 3. ScheduleOverrides (leaf of ScheduleSlot & Users)
  if (overrideIds.length > 0) {
    await prisma.scheduleOverride.deleteMany({ where: { id: { in: overrideIds } } }).catch(() => {});
  }
  if (slotIds.length > 0) {
    await prisma.scheduleOverride.deleteMany({ where: { scheduleSlotId: { in: slotIds } } }).catch(() => {});
  }

  // 4. ScheduleChangeRequests (leaf of ScheduleSlot, Course, User)
  if (changeRequestIds.length > 0) {
    await prisma.scheduleChangeRequest.deleteMany({ where: { id: { in: changeRequestIds } } }).catch(() => {});
  }
  if (slotIds.length > 0) {
    await prisma.scheduleChangeRequest.deleteMany({ where: { scheduleSlotId: { in: slotIds } } }).catch(() => {});
  }
  if (courseIds.length > 0) {
    await prisma.scheduleChangeRequest.deleteMany({ where: { courseId: { in: courseIds } } }).catch(() => {});
  }

  // 5. ScheduleSlots (depend on Timetable, Course, Doctor, TA, StudentGroup, Room)
  if (slotIds.length > 0) {
    await prisma.scheduleSlot.deleteMany({ where: { id: { in: slotIds } } }).catch(() => {});
  }
  if (timetableIds.length > 0) {
    await prisma.scheduleSlot.deleteMany({ where: { timetableId: { in: timetableIds } } }).catch(() => {});
  }
  if (courseIds.length > 0) {
    await prisma.scheduleSlot.deleteMany({ where: { courseId: { in: courseIds } } }).catch(() => {});
  }

  // 6. Submissions & Metrics on Students / Enrollments
  if (studentIds.length > 0) {
    await prisma.studentSuccessMetric.deleteMany({ where: { studentId: { in: studentIds } } }).catch(() => {});
    await prisma.submissionSimilarityFlag.deleteMany({
      where: {
        OR: [
          { submissionA: { studentId: { in: studentIds } } },
          { submissionB: { studentId: { in: studentIds } } },
        ],
      },
    }).catch(() => {});
    await prisma.taskSubmissionFingerprint.deleteMany({
      where: { submission: { studentId: { in: studentIds } } },
    }).catch(() => {});
    await prisma.taskSubmission.deleteMany({ where: { studentId: { in: studentIds } } }).catch(() => {});
    await prisma.quizSubmission.deleteMany({ where: { studentId: { in: studentIds } } }).catch(() => {});
    await prisma.examSubmission.deleteMany({ where: { studentId: { in: studentIds } } }).catch(() => {});
    await prisma.payment.deleteMany({ where: { studentId: { in: studentIds } } }).catch(() => {});
  }
  if (enrollmentIds.length > 0) {
    await prisma.submissionSimilarityFlag.deleteMany({
      where: {
        OR: [
          { submissionA: { enrollmentId: { in: enrollmentIds } } },
          { submissionB: { enrollmentId: { in: enrollmentIds } } },
        ],
      },
    }).catch(() => {});
    await prisma.taskSubmissionFingerprint.deleteMany({
      where: { submission: { enrollmentId: { in: enrollmentIds } } },
    }).catch(() => {});
    await prisma.taskSubmission.deleteMany({ where: { enrollmentId: { in: enrollmentIds } } }).catch(() => {});
    await prisma.quizSubmission.deleteMany({ where: { enrollmentId: { in: enrollmentIds } } }).catch(() => {});
    await prisma.examSubmission.deleteMany({ where: { enrollmentId: { in: enrollmentIds } } }).catch(() => {});
  }

  // 7. Enrollments (depend on Student, Course, AcademicTerm)
  if (enrollmentIds.length > 0) {
    await prisma.enrollment.deleteMany({ where: { id: { in: enrollmentIds } } }).catch(() => {});
  }
  if (courseIds.length > 0) {
    await prisma.enrollment.deleteMany({ where: { courseId: { in: courseIds } } }).catch(() => {});
  }
  if (studentIds.length > 0) {
    await prisma.enrollment.deleteMany({ where: { studentId: { in: studentIds } } }).catch(() => {});
  }

  // 8. Timetables (slots already removed)
  if (timetableIds.length > 0) {
    await prisma.timetable.deleteMany({ where: { id: { in: timetableIds } } }).catch(() => {});
  }

  // 8.5 TA Cross-Department Approvals (before TA, Course, and User profiles)
  if (approvalIds.length > 0) {
    await (prisma as any).tACrossDepartmentApproval.deleteMany({ where: { id: { in: approvalIds } } }).catch(() => {});
  }
  if (taIds.length > 0) {
    await (prisma as any).tACrossDepartmentApproval.deleteMany({ where: { teachingAssistantId: { in: taIds } } }).catch(() => {});
  }
  if (courseIds.length > 0) {
    await (prisma as any).tACrossDepartmentApproval.deleteMany({ where: { courseId: { in: courseIds } } }).catch(() => {});
  }

  // 9. Staff & Student Profiles (before User and Departments)
  if (studentIds.length > 0) {
    await prisma.student.deleteMany({ where: { id: { in: studentIds } } }).catch(() => {});
  }
  if (doctorIds.length > 0) {
    await prisma.doctor.deleteMany({ where: { id: { in: doctorIds } } }).catch(() => {});
  }
  if (taIds.length > 0) {
    await prisma.teachingAssistant.deleteMany({ where: { id: { in: taIds } } }).catch(() => {});
  }
  if (userIds.length > 0) {
    await prisma.student.deleteMany({ where: { userId: { in: userIds } } }).catch(() => {});
    await prisma.doctor.deleteMany({ where: { userId: { in: userIds } } }).catch(() => {});
    await prisma.teachingAssistant.deleteMany({ where: { userId: { in: userIds } } }).catch(() => {});
  }

  // 10. Student Groups & Courses
  if (groupIds.length > 0) {
    await prisma.studentGroup.deleteMany({ where: { id: { in: groupIds } } }).catch(() => {});
  }
  if (courseIds.length > 0) {
    await prisma.course.deleteMany({ where: { id: { in: courseIds } } }).catch(() => {});
  }

  // 11. Rooms
  if (roomIds.length > 0) {
    await prisma.room.deleteMany({ where: { id: { in: roomIds } } }).catch(() => {});
  }

  // 12. User side-effects (AuditLog, Notification, RefreshToken) MUST precede User deletion
  if (userIds.length > 0) {
    await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } }).catch(() => {});
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } }).catch(() => {});
    await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } }).catch(() => {});
    // Delete Users BEFORE Department and College because User has FKs to Department & College
    await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => {});
  }

  // 13. Registration Requests (before Department)
  if (departmentIds.length > 0) {
    await prisma.registrationRequest.deleteMany({ where: { departmentId: { in: departmentIds } } }).catch(() => {});
  }

  // 14. Departments (before College)
  if (departmentIds.length > 0) {
    await prisma.department.deleteMany({ where: { id: { in: departmentIds } } }).catch(() => {});
  }

  // 15. Colleges (root)
  if (collegeIds.length > 0) {
    await prisma.college.deleteMany({ where: { id: { in: collegeIds } } }).catch(() => {});
  }
}

/**
 * Fluent registry class to conveniently collect IDs during test execution
 * and tear them down reliably in a single finally block call.
 */
export class TestCleanupRegistry {
  private entities: CleanupEntities = {
    attendanceIds: [],
    sessionIds: [],
    overrideIds: [],
    changeRequestIds: [],
    slotIds: [],
    enrollmentIds: [],
    timetableIds: [],
    studentIds: [],
    doctorIds: [],
    taIds: [],
    approvalIds: [],
    courseIds: [],
    groupIds: [],
    roomIds: [],
    userIds: [],
    departmentIds: [],
    collegeIds: [],
  };

  trackAttendance(...ids: (number | null | undefined)[]) {
    for (const id of ids) if (id) this.entities.attendanceIds!.push(id);
  }
  trackSession(...ids: (number | null | undefined)[]) {
    for (const id of ids) if (id) this.entities.sessionIds!.push(id);
  }
  trackOverride(...ids: (number | null | undefined)[]) {
    for (const id of ids) if (id) this.entities.overrideIds!.push(id);
  }
  trackChangeRequest(...ids: (number | null | undefined)[]) {
    for (const id of ids) if (id) this.entities.changeRequestIds!.push(id);
  }
  trackSlot(...ids: (number | null | undefined)[]) {
    for (const id of ids) if (id) this.entities.slotIds!.push(id);
  }
  trackEnrollment(...ids: (number | null | undefined)[]) {
    for (const id of ids) if (id) this.entities.enrollmentIds!.push(id);
  }
  trackTimetable(...ids: (number | null | undefined)[]) {
    for (const id of ids) if (id) this.entities.timetableIds!.push(id);
  }
  trackStudent(...ids: (number | null | undefined)[]) {
    for (const id of ids) if (id) this.entities.studentIds!.push(id);
  }
  trackDoctor(...ids: (number | null | undefined)[]) {
    for (const id of ids) if (id) this.entities.doctorIds!.push(id);
  }
  trackTA(...ids: (string | number | null | undefined)[]) {
    for (const id of ids) if (id) this.entities.taIds!.push(id);
  }
  trackTAApproval(...ids: (number | null | undefined)[]) {
    for (const id of ids) if (id) this.entities.approvalIds!.push(id);
  }
  trackCourse(...ids: (number | null | undefined)[]) {
    for (const id of ids) if (id) this.entities.courseIds!.push(id);
  }
  trackGroup(...ids: (number | null | undefined)[]) {
    for (const id of ids) if (id) this.entities.groupIds!.push(id);
  }
  trackRoom(...ids: (number | null | undefined)[]) {
    for (const id of ids) if (id) this.entities.roomIds!.push(id);
  }
  trackUser(...ids: (number | null | undefined)[]) {
    for (const id of ids) if (id) this.entities.userIds!.push(id);
  }
  trackDepartment(...ids: (number | null | undefined)[]) {
    for (const id of ids) if (id) this.entities.departmentIds!.push(id);
  }
  trackCollege(...ids: (number | null | undefined)[]) {
    for (const id of ids) if (id) this.entities.collegeIds!.push(id);
  }

  getEntities(): CleanupEntities {
    return this.entities;
  }

  async teardown(prisma: PrismaClient): Promise<void> {
    await cleanupTestEntities(prisma, this.entities);
  }
}
