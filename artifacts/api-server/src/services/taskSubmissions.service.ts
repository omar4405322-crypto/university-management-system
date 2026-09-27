import prisma from "../utils/prismaClient";
import {
  AuthorizationError,
  NotFoundError,
} from "../utils/appError";
import { getScopeWhere } from "../utils/scope.utils";
import type { AuthActor } from "../types/auth.types";
import { Prisma } from "@prisma/client";

export interface GetTaskSubmissionsOptions {
  page?: number;
  limit?: number;
  search?: string;
  status?:
    | "ALL"
    | "SUBMITTED"
    | "GRADED"
    | "UNGRADED"
    | "LATE"
    | "NOT_SUBMITTED";
  studentYear?: number;
}

export interface TaskSubmissionUnifiedRow {
  key: string;
  student: Prisma.StudentGetPayload<Record<string, never>>;
  submission: Prisma.TaskSubmissionGetPayload<Record<string, never>> | null;
  isSubmitted: boolean;
  isGraded: boolean;
  isLate: boolean;
  notSubmitted: boolean;
}

export interface TaskSubmissionsResult {
  rows: TaskSubmissionUnifiedRow[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
  summary: {
    totalEnrolled: number;
    submitted: number;
    graded: number;
    ungraded: number;
    late: number;
    notSubmitted: number;
  };
  defaultCourseYear: number | null;
}

export class TaskSubmissionsService {
  static async getTaskSubmissions(
    user: AuthActor,
    taskId: number,
    opts?: GetTaskSubmissionsOptions,
  ): Promise<TaskSubmissionsResult> {
    const taskObj = await prisma.task.findUnique({
      where: { id: taskId, NOT: { isDeleted: true } },
      include: {
        course: {
          select: {
            id: true,
            name: true,
            year: true,
            department: true,
            departmentId: true,
          },
        },
      },
    });
    if (!taskObj) {
      throw new NotFoundError("Task not found");
    }

    if (user.role === "DOCTOR") {
      const doctor = await prisma.doctor.findUnique({ where: { userId: user.id } });
      if (!doctor) {
        throw new AuthorizationError("Only doctors can perform this action");
      }
      if (taskObj.doctorId !== doctor.id) {
        throw new AuthorizationError(
          "Access denied: You did not create this task",
        );
      }
    }

    const courseScope = getScopeWhere(user, "course") as {
      id?: number;
      department?: { collegeId?: number | null } | null;
      departmentId?: number | null;
    } | undefined;
    if (courseScope && Object.keys(courseScope).length) {
      if (courseScope.id === -1) {
        throw new AuthorizationError("Access denied");
      }
      if (
        courseScope.department &&
        taskObj.course.department?.collegeId !== courseScope.department.collegeId
      ) {
        throw new AuthorizationError("Access denied");
      }
      if (
        courseScope.departmentId &&
        taskObj.course.departmentId !== courseScope.departmentId
      ) {
        throw new AuthorizationError("Access denied");
      }
    }

    const page = Math.max(1, opts?.page ?? 1);
    const limitRaw = opts?.limit ?? 25;
    const limit = Math.min(Math.max(1, limitRaw), 100);
    const skip = (page - 1) * limit;
    const taskDueDate = taskObj.dueDate;
    const courseId = taskObj.course.id;
    const status = opts?.status ?? "ALL";
    const search = opts?.search?.trim();
    const studentYear = opts?.studentYear;

    // Student filter (search + year)
    const studentWhere: Prisma.StudentWhereInput = {};
    if (search) {
      studentWhere.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { studentId: { contains: search, mode: "insensitive" } },
      ];
    }
    if (studentYear != null && !Number.isNaN(studentYear)) {
      studentWhere.year = Number(studentYear);
    }

    // Shared summary counts
    const totalEnrolledPromise = prisma.enrollment.count({
      where: {
        courseId,
        academicYear: taskObj.academicYear,
        semester: taskObj.semester,
        status: "ENROLLED",
      },
    });
    const submittedPromise = prisma.taskSubmission.count({ where: { taskId } });
    const gradedPromise = prisma.taskSubmission.count({
      where: { taskId, score: { not: null } },
    });
    const latePromise = prisma.taskSubmission.count({
      where: { taskId, submittedAt: { gt: taskDueDate } },
    });

    const includeNotSubmitted = status === "NOT_SUBMITTED" || status === "ALL";

    if (includeNotSubmitted) {
      const enrollmentWhere: Prisma.EnrollmentWhereInput = {
        courseId,
        academicYear: taskObj.academicYear,
        semester: taskObj.semester,
        status: "ENROLLED",
      };
      if (Object.keys(studentWhere).length) {
        enrollmentWhere.student = studentWhere;
      }

      const enrollmentTotalCountPromise = prisma.enrollment.count({
        where: enrollmentWhere,
      });

      const enrollmentPagePromise = prisma.enrollment.findMany({
        where: enrollmentWhere,
        include: { student: true },
        orderBy: [
          { student: { lastName: "asc" } },
          { student: { firstName: "asc" } },
        ],
        skip,
        take: limit,
      });

      const [enrollmentPage, enrollmentTotalCount] = await Promise.all([
        enrollmentPagePromise,
        enrollmentTotalCountPromise,
      ]);

      const pageStudentIds = enrollmentPage.map((e) => e.studentId);
      const pageSubmissions = pageStudentIds.length
        ? await prisma.taskSubmission.findMany({
            where: {
              taskId,
              enrollmentId: {
                in: enrollmentPage.map((enrollment) => enrollment.id),
              },
            },
            include: { student: true },
          })
        : [];
      const subByStudentId = new Map<
        number,
        (typeof pageSubmissions)[number]
      >();
      for (const s of pageSubmissions) subByStudentId.set(s.studentId, s);

      const pageRows: TaskSubmissionUnifiedRow[] = [];

      for (const enrollment of enrollmentPage) {
        const stu = enrollment.student;
        const sub = subByStudentId.get(stu.id) ?? null;
        const isSubmitted = !!sub;
        const isGraded = !!(sub && sub.score != null);
        const isLate = !!(sub && new Date(sub.submittedAt) > taskDueDate);
        const notSubmitted = !isSubmitted;

        if (status === "NOT_SUBMITTED" && isSubmitted) continue;

        pageRows.push({
          key: `enrollment-${enrollment.id}`,
          student: stu,
          submission: sub,
          isSubmitted,
          isGraded,
          isLate,
          notSubmitted,
        });
      }

      let orphanRows: TaskSubmissionUnifiedRow[] = [];
      let orphanTotalCount = 0;
      if (status !== "NOT_SUBMITTED") {
        const orphanBaseWhere: Prisma.TaskSubmissionWhereInput = {
          taskId,
          student: {
            ...studentWhere,
            enrollments: {
              none: {
                courseId,
                academicYear: taskObj.academicYear,
                semester: taskObj.semester,
                status: "ENROLLED",
              },
            },
          },
        };

        orphanTotalCount = await prisma.taskSubmission.count({
          where: orphanBaseWhere,
        });
        const orphanSkip = Math.max(0, skip - enrollmentTotalCount);
        const orphanTake = Math.max(0, limit - pageRows.length);
        if (orphanSkip >= 0 && orphanTake > 0 && orphanTotalCount > 0) {
          const orphanPage = await prisma.taskSubmission.findMany({
            where: orphanBaseWhere,
            include: { student: true },
            orderBy: { submittedAt: "asc" },
            skip: orphanSkip,
            take: orphanTake,
          });
          for (const sub of orphanPage) {
            const stu = sub.student;
            if (search) {
              const hay =
                `${stu.firstName} ${stu.lastName} ${stu.studentId}`.toLowerCase();
              if (!hay.includes(search.toLowerCase())) continue;
            }
            if (
              studentYear != null &&
              !Number.isNaN(studentYear) &&
              stu.year !== Number(studentYear)
            )
              continue;
            orphanRows.push({
              key: `orphan-${sub.id}`,
              student: stu,
              submission: sub,
              isSubmitted: true,
              isGraded: sub.score != null,
              isLate: new Date(sub.submittedAt) > taskDueDate,
              notSubmitted: false,
            });
          }
        }
      }

      const finalRows = [...pageRows, ...orphanRows];
      const totalCount = enrollmentTotalCount + orphanTotalCount;
      const totalPages = Math.max(1, Math.ceil(totalCount / limit));

      const [totalEnrolled, submitted, graded, late] = await Promise.all([
        totalEnrolledPromise,
        submittedPromise,
        gradedPromise,
        latePromise,
      ]);

      return {
        rows: finalRows,
        pagination: { page, limit, totalCount, totalPages },
        summary: {
          totalEnrolled,
          submitted,
          graded,
          ungraded: submitted - graded,
          late,
          notSubmitted: totalEnrolled - submitted,
        },
        defaultCourseYear: taskObj.course.year ?? null,
      };
    }

    // Pure submission-only path
    const subWhere: Prisma.TaskSubmissionWhereInput = { taskId };
    if (Object.keys(studentWhere).length) {
      subWhere.student = studentWhere;
    }
    if (status === "GRADED") subWhere.score = { not: null };
    else if (status === "UNGRADED") subWhere.score = null;
    else if (status === "LATE") subWhere.submittedAt = { gt: taskDueDate };

    const totalCount = await prisma.taskSubmission.count({ where: subWhere });
    const submissionRows = await prisma.taskSubmission.findMany({
      where: subWhere,
      include: { student: true },
      orderBy: [
        { student: { lastName: "asc" } },
        { student: { firstName: "asc" } },
      ],
      skip,
      take: limit,
    });

    const rows: TaskSubmissionUnifiedRow[] = submissionRows.map((sub) => {
      const isLate = new Date(sub.submittedAt) > taskDueDate;
      return {
        key: `sub-${sub.id}`,
        student: sub.student,
        submission: sub,
        isSubmitted: true,
        isGraded: sub.score != null,
        isLate,
        notSubmitted: false,
      };
    });
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));

    const [totalEnrolled, submitted, graded, late] = await Promise.all([
      totalEnrolledPromise,
      submittedPromise,
      gradedPromise,
      latePromise,
    ]);

    return {
      rows,
      pagination: { page, limit, totalCount, totalPages },
      summary: {
        totalEnrolled,
        submitted,
        graded,
        ungraded: submitted - graded,
        late,
        notSubmitted: Math.max(0, totalEnrolled - submitted),
      },
      defaultCourseYear: taskObj.course.year ?? null,
    };
  }
}
