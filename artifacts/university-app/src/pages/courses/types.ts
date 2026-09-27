export interface CourseMaterialUploader {
  id: number;
  email: string;
  role: string;
  profilePicture?: string | null;
  doctor?: { firstName: string; lastName: string } | null;
  teachingAssistant?: { firstName: string; lastName: string } | null;
}

export interface CourseMaterial {
  id: number;
  title: string;
  description?: string | null;
  type: 'LECTURE' | 'TUTORIAL';
  fileUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  fileType?: string | null;
  isPublished?: boolean;
  createdAt: string;
  uploadedById?: number;
  uploadedBy?: CourseMaterialUploader;
}

export interface AssignedDoctorInfo {
  id: number;
  firstName: string;
  lastName: string;
  doctorId?: string;
  slots: Array<{
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    room?: string | null;
    slotType: string;
  }>;
}

export interface AssignedTAInfo {
  id: number | string;
  firstName: string;
  lastName: string;
  employeeId?: string;
  slots: Array<{
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    room?: string | null;
    slotType: string;
  }>;
}

export interface CourseScheduleSlot {
  id: number;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  room?: string | null;
  slotType: 'LECTURE' | 'TUTORIAL' | 'LAB' | string;
  doctor?: {
    id: number;
    firstName: string;
    lastName: string;
    doctorId?: string;
    user?: { id: number; email: string; profilePicture?: string | null };
  } | null;
  teachingAssistant?: {
    id: number | string;
    firstName: string;
    lastName: string;
    employeeId?: string;
    user?: { id: number; email: string; profilePicture?: string | null };
  } | null;
}

export interface CourseTask {
  id: number;
  title: string;
  description?: string | null;
  dueDate: string;
  maxScore: number;
  courseId: number;
  _count?: { submissions: number };
}

export interface CourseStudentSubmission {
  id: number;
  taskId: number;
  studentId: number;
  submittedAt: string;
  score?: number | null;
  feedback?: string | null;
  fileUrl?: string | null;
  content?: string | null;
}

export interface CourseEnrollmentRecord {
  id: number;
  studentId: number;
  courseId: number;
  status: string;
  student: {
    id: number;
    firstName: string;
    lastName: string;
    studentId: string;
    group?: { id: number; name: string } | null;
    user?: { id: number; email: string; profilePicture?: string | null } | null;
  };
}

export interface CourseDetailsData {
  id: number;
  courseCode: string;
  name: string;
  description?: string | null;
  credits: number;
  maxStudents: number;
  year: number;
  semester: number;
  isPublished: boolean;
  departmentId?: number | null;
  department?: {
    id: number;
    name: string;
    nameAr?: string | null;
    college?: { id: number; name: string; nameAr?: string | null };
  } | null;
  scheduleSlots?: CourseScheduleSlot[];
  tasks?: CourseTask[];
  materials?: CourseMaterial[];
  enrollments?: CourseEnrollmentRecord[];
  _count?: {
    enrollments: number;
    quizzes: number;
    tasks: number;
    exams: number;
    materials: number;
  };
}

export type TabType = 'overview' | 'lectures' | 'tutorials' | 'tasks' | 'roster';
