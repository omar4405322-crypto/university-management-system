import prisma from "../../utils/prismaClient";
import {
  AuthorizationError,
  NotFoundError,
  ConflictError,
  ValidationError,
} from "../../utils/appError";
import { auditLog } from "../../utils/audit.utils";
import { validateTaskSubmissionUrl } from "../../utils/taskSubmissionUrl.utils";
import { validateGuardedText } from "../../utils/quizInputGuard.utils";
import {
  isTaskPastDue,
  MAX_TASK_NOTES_LENGTH,
  MAX_TASK_FEEDBACK_LENGTH,
} from "../../utils/taskDeadline.utils";
import type { AuthActor } from "../../types/auth.types";
import { Prisma } from "@prisma/client";
import { TaskScopeService } from "./taskScope.service";


export interface SubmitTaskDTO {
  notes?: string;
  fileUrl?: string;
}

export type AuditRequestSource = Parameters<typeof auditLog>[3];

export interface ResubmitTaskResult {
  success: boolean;
  data: Prisma.TaskSubmissionGetPayload<Record<string, never>>;
  message: string;
}

export type SubmitTaskResult =
  | Prisma.TaskSubmissionGetPayload<Record<string, never>>
  | ResubmitTaskResult;

export class TaskGradingService {
  static async submitTask(
    user: AuthActor,
    taskId: number,
    data: SubmitTaskDTO,
    reqSource?: AuditRequestSource,
  ): Promise<SubmitTaskResult> {
    if (data.notes !== undefined && data.notes !== null) {
      validateGuardedText(data.notes, "Notes", MAX_TASK_NOTES_LENGTH, false);
    }

    const normalizedFileUrl = validateTaskSubmissionUrl(data.fileUrl);

    const trimmedNotes = typeof data.notes === "string" ? data.notes.trim() : "";
    if (!normalizedFileUrl && trimmedNotes.length === 0) {
      throw new ValidationError(
        "Submission must include either a valid fileUrl or notes",
      );
    }

    const student = await TaskScopeService.getStudentOrThrow(user.id);

    const taskObj = await prisma.task.findUnique({
      where: { id: taskId, NOT: { isDeleted: true } },
      include: { course: { include: { department: true } } },
    });
    if (!taskObj) {
      throw new NotFoundError("Task not found");
    }

    let enrollment = null;
    if (taskObj.termId) {
      enrollment = await prisma.enrollment.findFirst({
        where: {
          studentId: student.id,
          courseId: taskObj.courseId,
          termId: taskObj.termId,
        },
      });
    }

    if (!enrollment) {
      enrollment = await prisma.enrollment.findUnique({
        where: {
          studentId_courseId_semester_academicYear: {
            studentId: student.id,
            courseId: taskObj.courseId,
            academicYear: taskObj.academicYear,
            semester: taskObj.semester,
          },
        },
      });
    }
    if (!enrollment || enrollment.status !== "ENROLLED") {
      throw new AuthorizationError(
        enrollment?.status === "BLOCKED"
          ? "Access denied: your enrollment for this task offering is blocked"
          : "Access denied: You are not enrolled in this task offering",
      );
    }

    await TaskScopeService.validateCourseScope(user, taskObj.course);

    return prisma.$transaction(async (tx) => {
      const existingSubmission = await tx.taskSubmission.findUnique({
        where: { taskId_studentId: { taskId, studentId: student.id } },
      });

      if (taskObj.dueDate && isTaskPastDue(taskObj.dueDate)) {
        throw new ConflictError(
          existingSubmission
            ? "The deadline for this task has passed. Resubmission is not allowed."
            : "The deadline for this task has passed. Submission is not allowed.",
        );
      }

      if (existingSubmission) {
        if (existingSubmission.score !== null) {
          throw new ConflictError(
            "This task submission has already been graded and cannot be resubmitted.",
          );
        }

        const nextSubmittedAt = new Date(
          Math.max(Date.now(), existingSubmission.submittedAt.getTime() + 1),
        );
        const result = await tx.taskSubmission.updateMany({
          where: {
            id: existingSubmission.id,
            submittedAt: existingSubmission.submittedAt,
            score: existingSubmission.score,
            feedback: existingSubmission.feedback,
          },
          data: {
            notes: data.notes,
            fileUrl: normalizedFileUrl,
            submittedAt: nextSubmittedAt,
            score: null,
            feedback: null,
          },
        });
        if (result.count !== 1) {
          throw new ConflictError(
            "The task submission changed while the resubmission was being saved. Please retry.",
          );
        }
        const updated = await tx.taskSubmission.findUnique({
          where: { id: existingSubmission.id },
        });
        if (!updated) {
          throw new NotFoundError("Submission not found");
        }
        await auditLog(
          "RESUBMIT_TASK",
          "TaskSubmission",
          updated.id,
          reqSource || { user },
          {
            taskId,
            studentId: student.id,
            enrollmentId: enrollment.id,
            submittedAt: {
              from: existingSubmission.submittedAt,
              to: updated.submittedAt,
            },
            gradeCleared: existingSubmission.score !== null,
            feedbackCleared: existingSubmission.feedback !== null,
          },
          tx,
        );
        return {
          success: true,
          data: updated,
          message: "Task resubmitted successfully",
        };
      }

      const submission = await tx.taskSubmission.create({
        data: {
          taskId,
          studentId: student.id,
          enrollmentId: enrollment.id,
          notes: data.notes,
          fileUrl: normalizedFileUrl,
        },
      });

      await auditLog(
        "SUBMIT_TASK",
        "TaskSubmission",
        submission.id,
        reqSource || { user },
        {
          after: {
            taskId,
            studentId: student.id,
            submittedAt: submission.submittedAt,
          },
        },
        tx,
      );
      return submission;
    });
  }

  static async gradeSubmission(
    user: AuthActor,
    taskId: number,
    submissionId: number,
    score: number,
    feedback?: string,
    expectedSubmittedAt?: string | Date,
    reqSource?: AuditRequestSource,
  ): Promise<Prisma.TaskSubmissionGetPayload<Record<string, never>>> {
    const expectedRevision = new Date(expectedSubmittedAt as string | Date);
    if (!expectedSubmittedAt || Number.isNaN(expectedRevision.getTime())) {
      throw new ValidationError(
        "A valid expectedSubmittedAt submission revision is required",
      );
    }

    if (feedback !== undefined && feedback !== null) {
      validateGuardedText(feedback, "Feedback", MAX_TASK_FEEDBACK_LENGTH, false);
    }

    const submission = await prisma.$transaction(async (tx) => {
      const existingSubmission = await tx.taskSubmission.findUnique({
        where: { id: submissionId, taskId },
        include: {
          task: { include: { course: { include: { department: true } } } },
        },
      });
      if (!existingSubmission) {
        throw new NotFoundError("Submission not found");
      }

      if (existingSubmission.task.isDeleted) {
        throw new NotFoundError("Task not found");
      }

      if (user.role === "DOCTOR") {
        const doctor = await TaskScopeService.getDoctorOrThrow(user.id);
        if (existingSubmission.task.doctorId !== doctor.id) {
          throw new AuthorizationError(
            "Access denied: You did not create this task",
          );
        }
      }

      await TaskScopeService.validateCourseScope(
        user,
        existingSubmission.task.course,
      );

      const numericScore = parseFloat(String(score));
      if (isNaN(numericScore)) {
        throw new ValidationError("Invalid score value");
      }
      if (numericScore < 0) {
        throw new ValidationError("Score cannot be negative");
      }
      if (numericScore > existingSubmission.task.maxScore) {
        throw new ValidationError(
          `Score ${numericScore} exceeds maximum allowed score ${existingSubmission.task.maxScore}`,
        );
      }

      const result = await tx.taskSubmission.updateMany({
        where: {
          id: submissionId,
          taskId,
          submittedAt: expectedRevision,
          score: existingSubmission.score,
          feedback: existingSubmission.feedback,
        },
        data: {
          score: numericScore,
          feedback: feedback != null ? String(feedback) : undefined,
        },
      });
      if (result.count !== 1) {
        throw new ConflictError(
          "The task submission changed while it was being graded. Reload the latest revision and retry.",
        );
      }
      const updated = await tx.taskSubmission.findUnique({
        where: { id: submissionId },
      });
      if (!updated) {
        throw new NotFoundError("Submission not found");
      }

      await auditLog(
        "UPDATE_GRADE",
        "TaskSubmission",
        String(submissionId),
        reqSource || { user },
        {
          score: { from: existingSubmission.score, to: numericScore },
          taskId: existingSubmission.taskId,
          studentId: existingSubmission.studentId,
        },
        tx,
      );

      return updated;
    });

    return submission;
  }

  static async getMySubmission(
    user: AuthActor,
    taskId: number,
  ): Promise<
    | (Prisma.TaskSubmissionGetPayload<Record<string, never>> & {
        task: {
          id: number;
          title: string;
          dueDate: Date;
          maxScore: number;
        };
      })
    | null
  > {
    const student = await TaskScopeService.getStudentOrThrow(user.id);

    const taskObj = await prisma.task.findUnique({
      where: { id: taskId, NOT: { isDeleted: true } },
      include: { course: true },
    });
    if (!taskObj) {
      throw new NotFoundError("Task not found");
    }

    let enrollment = null;
    if (taskObj.termId) {
      enrollment = await prisma.enrollment.findFirst({
        where: {
          studentId: student.id,
          courseId: taskObj.courseId,
          termId: taskObj.termId,
        },
      });
    }

    if (!enrollment) {
      enrollment = await prisma.enrollment.findUnique({
        where: {
          studentId_courseId_semester_academicYear: {
            studentId: student.id,
            courseId: taskObj.courseId,
            academicYear: taskObj.academicYear,
            semester: taskObj.semester,
          },
        },
      });
    }
    if (!enrollment || enrollment.status !== "ENROLLED") {
      throw new AuthorizationError(
        "Access denied: You are not enrolled in this task offering",
      );
    }

    const submission = await prisma.taskSubmission.findUnique({
      where: { taskId_studentId: { taskId, studentId: student.id } },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            dueDate: true,
            maxScore: true,
          },
        },
      },
    });

    if (!submission) {
      return null;
    }

    return submission;
  }
}
