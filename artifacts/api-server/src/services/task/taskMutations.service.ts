import prisma from "../../utils/prismaClient";
import {
  NotFoundError,
  ConflictError,
  ValidationError,
} from "../../utils/appError";
import { notifyStudentsInCourse } from "../../utils/notification.utils";
import { auditLog } from "../../utils/audit.utils";
import { toZonedTime } from "date-fns-tz";
import type { AuthActor } from "../../types/auth.types";
import { Prisma } from "@prisma/client";
import { TaskScopeService } from "./taskScope.service";

const CAIRO_TZ = "Africa/Cairo";

export interface CreateTaskDTO {
  title: string;
  description: string;
  courseId: number;
  dueDate: Date;
  maxScore: number;
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
  ): Promise<TaskCreatedPayload> {
    const doctor = await TaskScopeService.getDoctorOrThrow(user.id);

    const course = await prisma.course.findUnique({
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

    const task = await prisma.task.create({
      data: {
        title: data.title,
        description: data.description,
        courseId: data.courseId,
        academicYear: toZonedTime(new Date(), CAIRO_TZ).getFullYear(),
        semester: course.semester || 1,
        doctorId: doctor.id,
        dueDate: data.dueDate,
        maxScore: data.maxScore,
      },
      include: {
        course: { select: { name: true } },
      },
    });

    await notifyStudentsInCourse({
      courseId: task.courseId,
      title: "New Assignment Posted",
      message: `A new assignment "${task.title}" has been posted for course ${task.course.name}.`,
      type: "info",
    });

    auditLog("CREATE_TASK", "Task", String(task.id), { userId: user.id });

    return task;
  }

  static async updateTask(
    user: AuthActor,
    taskId: number,
    data: UpdateTaskDTO,
  ): Promise<TaskUpdatedPayload> {
    const existing = await prisma.task.findUnique({
      where: { id: taskId, NOT: { isDeleted: true } },
      include: { course: { include: { department: true } } },
    });

    if (!existing) {
      throw new NotFoundError("Task not found");
    }

    await TaskScopeService.ensureCourseOwnershipOrScope(user, existing);

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

    auditLog("UPDATE_TASK", "Task", String(updated.id), { userId: user.id });

    return updated;
  }

  static async deleteTask(
    user: AuthActor,
    taskId: number,
    force: boolean = false,
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
      auditLog("DELETE_TASK", "Task", String(taskId), {
        userId: user.id,
        force: true,
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

    auditLog("DELETE_TASK", "Task", String(taskId), {
      userId: user.id,
      force: false,
    });

    return {
      success: true,
      hardDeleted: false,
      message: "Task soft-deleted.",
    };
  }
}
