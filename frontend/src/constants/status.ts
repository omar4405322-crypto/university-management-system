export const ENROLLMENT_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export type EnrollmentStatus = typeof ENROLLMENT_STATUS[keyof typeof ENROLLMENT_STATUS];

export const TIMETABLE_STATUS = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
} as const;

export type TimetableStatus = typeof TIMETABLE_STATUS[keyof typeof TIMETABLE_STATUS];

export const PAYMENT_STATUS = {
  PAID: 'PAID',
  PENDING: 'PENDING',
  OVERDUE: 'OVERDUE',
} as const;

export type PaymentStatus = typeof PAYMENT_STATUS[keyof typeof PAYMENT_STATUS];

export const EXAM_STATUS = {
  PREPARING: 'PREPARING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
} as const;

export type ExamStatus = typeof EXAM_STATUS[keyof typeof EXAM_STATUS];

export const ATTENDANCE_STATUS = {
  PRESENT: 'PRESENT',
  ABSENT: 'ABSENT',
  LATE: 'LATE',
} as const;

export type AttendanceStatus = typeof ATTENDANCE_STATUS[keyof typeof ATTENDANCE_STATUS];

export const COURSE_STATUS = {
  COMPLETED: 'completed',
  IN_PROGRESS: 'in_progress',
} as const;

export type CourseStatus = typeof COURSE_STATUS[keyof typeof COURSE_STATUS];
