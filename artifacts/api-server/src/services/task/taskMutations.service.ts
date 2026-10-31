import prisma from "../../utils/prismaClient";
import {
  NotFoundError,
  ConflictError,
  ValidationError,
} from "../../utils/appError";
import { notifyStudentsInCourse } from "../../utils/notification.utils";
import { auditLog } from "../../utils/audit.utils";
import { validateGuardedText } from "../../utils/quizInputGuard.utils";
import {
  MAX_TASK_TITLE_LENGTH,
  MAX_TASK_DESCRIPTION_LENGTH,
} from "../../utils/taskDeadline.utils";
import { toZonedTime } from "date-fns-tz";
import type { AuthActor } from "../../types/auth.types";
import { Prisma } from "@prisma/client";
import { TaskScopeService } from "./taskScope.service";

const CAIRO_TZ = "Africa/Cairo";

export type AuditRequestSource = Parameters<typeof auditLog>[3];

export interface CreateTaskDTO {
  title: string;
  description: string;
  courseId: number;
  dueDate: Date;
  maxScore: number;
  termId?: number | null;
}

export interface UpdateTaskDTO {
  title?: string;
  description?: string;
  dueDate?: Date;
  maxScore?: number;
}

export interface DeleteTaskResult {
  success: boolean;
  hardDeleted: boolean;
  message: string;
}

export type TaskCreatedPayload = Prisma.TaskGetPayload<{
  include: {
    course: { select: { name: true } };
  };
}>;

export type TaskUpdatedPayload = Prisma.TaskGetPayload<{
  include: {
    course: { select: { name: true; courseCode: true; year: true } };
    doctor: { select: { firstName: true; lastName: true; userId: true } };
    _count: { select: { submissions: true } };
  };
}>;

export class TaskMutationsService {
  static async createTask(
    user: AuthActor,
    data: CreateTaskDTO,
    txClient?: Prisma.TransactionClient,
    reqSource?: AuditRequestSource,
  ): Promise<TaskCreatedPayload> {
    validateGuardedText(data.title, "Title", MAX_TASK_TITLE_LENGTH, true);
    if (data.description !== undefined && data.description !== null) {
      validateGuardedText(data.description, "Description", MAX_TASK_DESCRIPTION_LENGTH, false);
    }

    const db = txClient ?? prisma;
    const doctor = await TaskScopeService.getDoctorOrThrow(user.id);

    const course = await db.course.findUnique({
      where: { id: data.courseId },
      include: { department: true },
    });
    if (!course) {
      throw new NotFoundError("Course not found");
    }

    if (user.role === "DOCTOR") {
      await TaskScopeService.ensureDoctorAssignedToCourse(doctor.id, course.id);
    }

    await TaskScopeService.validateCourseScope(user, course);

    const activeTerm = await db.academicTerm.findFirst({
      where: { isCurrent: true },
      include: { academicYear: true },
    });
    const targetTermId = data.termId !== undefined ? data.termId : activeTerm?.id ?? null;
    const yearMatch = activeTerm?.academicYear?.name.match(/\d{4}/);
    const resolvedAcademicYear = yearMatch
      ? parseInt(yearMatch[0], 10)
      : activeTerm?.startDate
        ? activeTerm.startDate.getFullYear()
        : toZonedTime(new Date(), CAIRO_TZ).getFullYear();
    const resolvedSemester = activeTerm?.semesterNumber ?? course.semester ?? 1;

    const taskData = {
      title: data.title,
      description: data.description,
      courseId: data.courseId,
      academicYear: resolvedAcademicYear,
      semester: resolvedSemester,
      termId: targetTermId,
      doctorId: doctor.id,
      dueDate: data.dueDate,
      maxScore: data.maxScore,
    };
    const taskInclude = {
      course: { select: { name: true } },
    };

    const task = txClient
      ? await txClient.task.create({
          data: taskData,
          include: taskInclude,
        })
      : await prisma.task.create({
          data: taskData,
          include: taskInclude,
        });

    await notifyStudentsInCourse(
      {
        courseId: task.courseId,
        title: "New Assignment Posted",
        message: `A new assignment "${task.title}" has been posted for course ${task.course.name}.`,
        type: "info",
      },
      txClient,
    );

    await auditLog(
      "CREATE_TASK",
      "Task",
      String(task.id),
      reqSource || { user },
      {
        after: {
          title: task.title,
          description: task.description,
          courseId: task.courseId,
          dueDate: task.dueDate,
          maxScore: task.maxScore,
        },
      },
      txClient,
    );

    return task;
  }

  static async updateTask(
    user: AuthActor,
    taskId: number,
    data: UpdateTaskDTO,
    reqSource?: AuditRequestSource,
  ): Promise<TaskUpdatedPayload> {
    const existing = await prisma.task.findUnique({
      where: { id: taskId, NOT: { isDeleted: true } },
      include: { course: { include: { department: true } } },
    });

    if (!existing) {
      throw new NotFoundError("Task not found");
    }

    await TaskScopeService.ensureCourseOwnershipOrScope(user, existing);

    if (data.title !== undefined) {
      validateGuardedText(data.title, "Title", MAX_TASK_TITLE_LENGTH, true);
    }
    if (data.description !== undefined && data.description !== null) {
      validateGuardedText(data.description, "Description", MAX_TASK_DESCRIPTION_LENGTH, false);
    }

    const updateData: Prisma.TaskUpdateInput = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined)
      updateData.description = data.description;
    if (data.dueDate !== undefined) {
      const newDueDate = new Date(data.dueDate);
      const earliestSubmission = await prisma.taskSubmission.findFirst({
        where: { taskId },
        orderBy: { submittedAt: "asc" },
        select: { submittedAt: true },
      });
      if (
        earliestSubmission &&
        newDueDate.getTime() < earliestSubmission.submittedAt.getTime()
      ) {
        throw new ValidationError(
          "Cannot set due date earlier than existing submissions",
        );
      }
      updateData.dueDate = newDueDate;
    }
    if (data.maxScore !== undefined) updateData.maxScore = data.maxScore;

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: updateData,
      include: {
        course: { select: { name: true, courseCode: true, year: true } },
        doctor: { select: { firstName: true, lastName: true, userId: true } },
        _count: { select: { submissions: true } },
      },
    });

    if (
      data.dueDate !== undefined &&
      existing.dueDate.getTime() !== data.dueDate.getTime()
    ) {
      const newDueDate = data.dueDate;
      if (newDueDate.getTime() > existing.dueDate.getTime()) {
        const formattedNewDate = newDueDate.toLocaleString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        await notifyStudentsInCourse({
          courseId: updated.courseId,
          title: "Assignment Deadline Extended",
          message: `The deadline for "${updated.title}" has been extended to ${formattedNewDate}. You now have additional time to submit.`,
          type: "info",
        });
      }
    }

    await auditLog(
      "UPDATE_TASK",
      "Task",
      String(updated.id),
      reqSource || { user },
      {
        before: {
          title: existing.title,
          description: existing.description,
          dueDate: existing.dueDate,
          maxScore: existing.maxScore,
        },
        after: {
          title: updated.title,
          description: updated.description,
          dueDate: updated.dueDate,
          maxScore: updated.maxScore,
        },
      },
    );

    return updated;
  }

  static async deleteTask(
    user: AuthActor,
    taskId: number,
    force: boolean = false,
    reqSource?: AuditRequestSource,
  ): Promise<DeleteTaskResult> {
    const existing = await prisma.task.findUnique({
      where: { id: taskId, NOT: { isDeleted: true } },
      include: {
        course: { include: { department: true } },
        _count: { select: { submissions: true } },
      },
    });

    if (!existing) {
      throw new NotFoundError("Task not found");
    }

    await TaskScopeService.ensureCourseOwnershipOrScope(user, existing);

    if (force) {
      if (existing._count.submissions > 0) {
        throw new ConflictError(
          `Cannot permanently delete task: has ${existing._count.submissions} existing submission(s). Use soft-delete instead.`,
        );
      }
      await prisma.task.delete({
        where: { id: taskId },
      });
      await auditLog("DELETE_TASK", "Task", String(taskId), reqSource || { user }, {
        force: true,
        before: {
          title: existing.title,
          courseId: existing.courseId,
        },
      });
      return {
        success: true,
        hardDeleted: true,
        message: "Task permanently deleted.",
      };
    }

    await prisma.task.update({
      where: { id: taskId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    await auditLog("DELETE_TASK", "Task", String(taskId), reqSource || { user }, {
      force: false,
      before: {
        title: existing.title,
        courseId: existing.courseId,
      },
    });

    return {
      success: true,
      hardDeleted: false,
      message: "Task soft-deleted.",
    };
  }
}