import prisma from "../../utils/prismaClient";
import { getScopeWhere } from "../../utils/scope.utils";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import type { AuthActor } from "../../types/auth.types";
import { Prisma } from "@prisma/client";

const CAIRO_TZ = "Africa/Cairo";

export interface GetTasksOptions {
  status?: "ACTIVE" | "OVERDUE";
  dueFrom?: Date;
  dueTo?: Date;
  sortBy?:
    | "DUE_DATE_ASC"
    | "DUE_DATE_DESC"
    | "CREATED_AT_ASC"
    | "CREATED_AT_DESC"
    | "SUBMISSIONS_COUNT_ASC"
    | "SUBMISSIONS_COUNT_DESC";
  search?: string;
  year?: number;
  page?: number;
  limit?: number;
}

export interface TaskPaginationMeta {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

export type TaskQueryResultItem = Prisma.TaskGetPayload<{
  include: {
    course: { select: { name: true; courseCode: true; year: true } };
    doctor: { select: { firstName: true; lastName: true; userId: true } };
    _count: { select: { submissions: true } };
  };
}> & {
  mySubmission?: Prisma.TaskSubmissionGetPayload<Record<string, never>> | null;
};

export interface TaskQueryResult {
  rows: TaskQueryResultItem[];
  pagination: TaskPaginationMeta;
}

export class TaskQueriesService {
  static async getTasks(
    user: AuthActor,
    courseId?: number,
    opts?: GetTasksOptions,
  ): Promise<TaskQueryResult> {
    const now = toZonedTime(new Date(), CAIRO_TZ);
    const where: Prisma.TaskWhereInput = { NOT: { isDeleted: true } };

    if (courseId) {
      where.courseId = courseId;
    }

    if (opts?.status === "ACTIVE") {
      where.dueDate = { gte: now };
    } else if (opts?.status === "OVERDUE") {
      where.dueDate = { lt: now };
    }

    if (opts?.dueFrom || opts?.dueTo) {
      const existingFilter =
        typeof where.dueDate === "object" &&
        where.dueDate !== null &&
        !(where.dueDate instanceof Date)
          ? (where.dueDate as Prisma.DateTimeFilter)
          : {};
      where.dueDate = {
        ...existingFilter,
        ...(opts.dueFrom ? { gte: fromZonedTime(opts.dueFrom, CAIRO_TZ) } : {}),
        ...(opts.dueTo ? { lte: fromZonedTime(opts.dueTo, CAIRO_TZ) } : {}),
      };
    }

    if (opts?.search?.trim()) {
      const q = opts.search.trim();
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ];
    }

    const courseWhere: Prisma.CourseWhereInput = {};

    if (opts?.year != null && !Number.isNaN(opts.year)) {
      courseWhere.year = Number(opts.year);
    }

    let requestingStudentId: number | undefined;

    if (user.role === "DOCTOR") {
      const doctor = await prisma.doctor.findUnique({
        where: { userId: user.id },
      });
      if (doctor) {
        where.doctorId = doctor.id;
      }
    } else if (user.role === "STUDENT") {
      const student = await prisma.student.findUnique({
        where: { userId: user.id },
      });
      if (student) {
        requestingStudentId = student.id;
        const offerings = await prisma.enrollment.findMany({
          where: { studentId: student.id, status: "ENROLLED" },
          select: { courseId: true, academicYear: true, semester: true },
        });
        const currentAnd = Array.isArray(where.AND)
          ? where.AND
          : where.AND
            ? [where.AND]
            : [];
        where.AND = [
          ...currentAnd,
          offerings.length
            ? {
                OR: offerings.map((offering) => ({
                  courseId: offering.courseId,
                  academicYear: offering.academicYear,
                  semester: offering.semester,
                })),
              }
            : { id: -1 },
        ];
      } else {
        where.id = -1;
      }
    }

    const courseScope = getScopeWhere(user, "course") as {
      id?: number;
      department?: { collegeId?: number | null } | null;
      departmentId?: number | null;
    } | undefined;
    if (courseScope && Object.keys(courseScope).length) {
      if (courseScope.department?.collegeId != null) {
        courseWhere.department = {
          is: { collegeId: courseScope.department.collegeId },
        };
      } else if (courseScope.departmentId) {
        courseWhere.departmentId = courseScope.departmentId;
      } else if (courseScope.id === -1) {
        courseWhere.id = -1;
      }
    }

    if (Object.keys(courseWhere).length > 0) {
      where.course = courseWhere;
    }

    let orderBy: Prisma.TaskOrderByWithRelationInput = { createdAt: "desc" };
    switch (opts?.sortBy) {
      case "DUE_DATE_ASC":
        orderBy = { dueDate: "asc" };
        break;
      case "DUE_DATE_DESC":
        orderBy = { dueDate: "desc" };
        break;
      case "CREATED_AT_ASC":
        orderBy = { createdAt: "asc" };
        break;
      case "CREATED_AT_DESC":
        orderBy = { createdAt: "desc" };
        break;
      case "SUBMISSIONS_COUNT_ASC":
        orderBy = { submissions: { _count: "asc" } };
        break;
      case "SUBMISSIONS_COUNT_DESC":
        orderBy = { submissions: { _count: "desc" } };
        break;
    }

    const page = Math.max(1, opts?.page ?? 1);
    const limit = Math.min(Math.max(1, opts?.limit ?? 50), 100);
    const skip = (page - 1) * limit;

    const [tasks, totalCount] = await Promise.all([
      prisma.task.findMany({
        where,
        include: {
          course: { select: { name: true, courseCode: true, year: true } },
          doctor: { select: { firstName: true, lastName: true, userId: true } },
          _count: { select: { submissions: true } },
          ...(requestingStudentId
            ? {
                submissions: {
                  where: { studentId: requestingStudentId },
                  orderBy: { submittedAt: "desc" as const },
                  take: 1,
                },
              }
            : {}),
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.task.count({ where }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    const rows: TaskQueryResultItem[] = tasks.map((task) => {
      if (!requestingStudentId) return task;
      const { submissions, ...taskWithoutSubmissions } = task;
      return {
        ...taskWithoutSubmissions,
        mySubmission: submissions?.[0] ?? null,
      };
    });

    return {
      rows,
      pagination: { page, limit, totalCount, totalPages },
    };
  }
}
