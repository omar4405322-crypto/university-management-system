import path from "path";
import fs from "fs";
import prisma from "../../utils/prismaClient";
import {
  AuthorizationError,
  NotFoundError,
  ConflictError,
  DuplicateSubmissionError,
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
import {
  cleanupTaskFile,
  resolveSafeTaskSubmissionStoragePath,
} from "../../middleware/taskSubmissionUpload.middleware";
import type { AuthActor } from "../../types/auth.types";
import { Prisma } from "@prisma/client";
import { TaskScopeService } from "./taskScope.service";
import { SubmissionIntegrityService } from "../submissionIntegrity.service";
import logger from "../../utils/logger";

export interface TaskFileMetadata {
  fileName: string;
  fileSize: number;
  fileType: string;
  fileHash: string;
  storageKey: string;
}

export interface SubmitTaskDTO {
  notes?: string;
  fileUrl?: string;
  linkUrl?: string;
  fileMetadata?: TaskFileMetadata;
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

    // Threat S-G: link alongside file or standalone link must be validated
    let validatedLink: string | null | undefined = null;
    if (data.linkUrl !== undefined && data.linkUrl !== null) {
      validatedLink = validateTaskSubmissionUrl(data.linkUrl);
    } else if (!data.fileMetadata && data.fileUrl !== undefined && data.fileUrl !== null) {
      validatedLink = validateTaskSubmissionUrl(data.fileUrl);
    }

    const trimmedNotes = typeof data.notes === "string" ? data.notes.trim() : "";
    if (!validatedLink && !data.fileMetadata && trimmedNotes.length === 0) {
      throw new ValidationError(
        "Submission must include either a valid file upload, fileUrl, or notes",
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

    // Threat S-A: Course must be published and not archived
    if (taskObj.course.isPublished === false) {
      throw new NotFoundError("Task not found");
    }

    const activeSlot = await prisma.scheduleSlot.findFirst({
      where: { courseId: taskObj.courseId, isArchived: false },
    });
    const anySlot = await prisma.scheduleSlot.findFirst({
      where: { courseId: taskObj.courseId },
    });
    if (anySlot && !activeSlot) {
      throw new AuthorizationError("Access denied: Course offering is archived");
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

    const policy = await SubmissionIntegrityService.getEffectivePolicy();
    let oldFileToRemove: string | null = null;

    let result: SubmitTaskResult;
    try {
      result = await prisma.$transaction(async (tx) => {
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
        }

        if (data.fileMetadata?.fileHash && policy.exactDuplicateBlock) {
          // C3: pg_advisory_xact_lock keyed by (taskId, hash) inside submit transaction
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(${taskId}::int, hashtext(${data.fileMetadata.fileHash}))`;

          // C6: A file whose hash equals a CourseMaterial.fileHash of the task's course is never blocked
          const isCourseMaterial = await tx.courseMaterial.findFirst({
            where: {
              courseId: taskObj.courseId,
              fileHash: data.fileMetadata.fileHash,
            },
            select: { id: true },
          });

          if (!isCourseMaterial) {
            // C1, C2, C4, C5, C7: check for duplicate submission by another student for this task
            const duplicateSubmission = await tx.taskSubmission.findFirst({
              where: {
                taskId,
                fileHash: data.fileMetadata.fileHash,
                studentId: { not: student.id },
              },
              select: { id: true },
            });

            if (duplicateSubmission) {
              throw new DuplicateSubmissionError();
            }
          }
        }

        if (existingSubmission) {
          // Threat S-B: parallel double submit / rapid duplicate submit -> 409 Conflict
        if (Date.now() - existingSubmission.submittedAt.getTime() < 150) {
          throw new ConflictError(
            "You have already submitted this task. Only one submission per task is allowed."
          );
        }

        // Threat S-C: track old file to unlink only after new row commits
        if (
          data.fileMetadata &&
          existingSubmission.storageKey &&
          existingSubmission.storageKey !== data.fileMetadata.storageKey
        ) {
          oldFileToRemove = existingSubmission.storageKey;
        }

        const nextSubmittedAt = new Date(
          Math.max(Date.now(), existingSubmission.submittedAt.getTime() + 1),
        );

        const derivedFileUrl = data.fileMetadata
          ? `/api/tasks/${taskId}/submissions/${existingSubmission.id}/download`
          : validatedLink ?? existingSubmission.fileUrl;

        const updateResult = await tx.taskSubmission.updateMany({
          where: {
            id: existingSubmission.id,
            submittedAt: existingSubmission.submittedAt,
            score: existingSubmission.score,
            feedback: existingSubmission.feedback,
          },
          data: {
            notes: data.notes ?? existingSubmission.notes,
            fileUrl: derivedFileUrl,
            fileName: data.fileMetadata ? data.fileMetadata.fileName : existingSubmission.fileName,
            fileSize: data.fileMetadata ? data.fileMetadata.fileSize : existingSubmission.fileSize,
            fileType: data.fileMetadata ? data.fileMetadata.fileType : existingSubmission.fileType,
            fileHash: data.fileMetadata ? data.fileMetadata.fileHash : existingSubmission.fileHash,
            storageKey: data.fileMetadata ? data.fileMetadata.storageKey : existingSubmission.storageKey,
            submittedAt: nextSubmittedAt,
            score: null,
            feedback: null,
          },
        });
        if (updateResult.count !== 1) {
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
            fileName: updated.fileName,
            fileSize: updated.fileSize,
            fileHash: updated.fileHash,
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

      // Initial submit
      const submission = await tx.taskSubmission.create({
        data: {
          taskId,
          studentId: student.id,
          enrollmentId: enrollment.id,
          notes: data.notes,
          fileUrl: validatedLink || (data.fileMetadata ? `/api/tasks/${taskId}/submissions/pending/download` : null),
          fileName: data.fileMetadata?.fileName,
          fileSize: data.fileMetadata?.fileSize,
          fileType: data.fileMetadata?.fileType,
          fileHash: data.fileMetadata?.fileHash,
          storageKey: data.fileMetadata?.storageKey,
        },
      });

      let finalSubmission = submission;
      if (data.fileMetadata) {
        finalSubmission = await tx.taskSubmission.update({
          where: { id: submission.id },
          data: {
            fileUrl: `/api/tasks/${taskId}/submissions/${submission.id}/download`,
          },
        });
      }

      await auditLog(
        "SUBMIT_TASK",
        "TaskSubmission",
        finalSubmission.id,
        reqSource || { user },
        {
          after: {
            taskId,
            studentId: student.id,
            fileName: finalSubmission.fileName,
            fileSize: finalSubmission.fileSize,
            fileHash: finalSubmission.fileHash,
            submittedAt: finalSubmission.submittedAt,
          },
        },
        tx,
      );
      return finalSubmission;
    });
    } catch (txError) {
      if ((txError as any)?.code === "DUPLICATE_SUBMISSION") {
        try {
          await auditLog(
            "SUBMISSION_DUPLICATE_BLOCKED",
            "TaskSubmission",
            String(taskId),
            reqSource || { user },
            {
              taskId,
              fileHash: data.fileMetadata?.fileHash,
              studentId: student.id,
            }
          );
        } catch (auditErr) {
          logger.warn("Failed to write audit log for blocked duplicate submission", { error: auditErr });
        }
      }
      throw txError;
    }

    // Threat S-C: unlink old file after successful commit
    if (oldFileToRemove) {
      const allowedDir = path.resolve(process.cwd(), "uploads/tasks");
      cleanupTaskFile(path.join(allowedDir, oldFileToRemove));
    }

    return result;
  }

  static async authorizeSubmissionDownload(
    user: AuthActor,
    taskId: number,
    submissionId: number,
  ): Promise<{
    submission: Prisma.TaskSubmissionGetPayload<{
      include: {
        task: { include: { course: { include: { department: true } } } };
        student: true;
      };
    }>;
    filePath: string;
  }> {
    const submission = await prisma.taskSubmission.findUnique({
      where: { id: submissionId },
      include: {
        task: {
          include: {
            course: {
              include: {
                department: true,
              },
            },
          },
        },
        student: true,
      },
    });

    if (!submission || submission.taskId !== taskId || submission.task.isDeleted) {
      throw new NotFoundError("Submission not found");
    }

    if (!submission.storageKey) {
      throw new NotFoundError("No file associated with this submission");
    }

    const allowedDir = path.resolve(process.cwd(), "uploads/tasks");
    const resolvedPath = resolveSafeTaskSubmissionStoragePath(
      allowedDir,
      path.join(allowedDir, submission.storageKey)
    );
    if (!resolvedPath || !fs.existsSync(resolvedPath)) {
      throw new NotFoundError("File not found on disk");
    }

    // Threat S-F: download authorization matrix
    if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") {
      return { submission, filePath: resolvedPath };
    }

    if (user.role === "COLLEGE_ADMIN") {
      const userCollegeId = user.managedCollegeId ?? user.collegeId;
      const courseCollegeId = submission.task.course.department?.collegeId;
      if (!userCollegeId || userCollegeId !== courseCollegeId) {
        throw new AuthorizationError("Access denied: Course is outside your college scope");
      }
      return { submission, filePath: resolvedPath };
    }

    if (user.role === "DEPARTMENT_ADMIN") {
      const userDeptId = user.managedDepartmentId ?? user.departmentId;
      const courseDeptId = submission.task.course.departmentId;
      if (!userDeptId || userDeptId !== courseDeptId) {
        throw new AuthorizationError("Access denied: Course is outside your department scope");
      }
      return { submission, filePath: resolvedPath };
    }

    if (user.role === "STUDENT") {
      const student = await TaskScopeService.getStudentOrThrow(user.id);
      if (student.id !== submission.studentId) {
        throw new AuthorizationError("Access denied: You can only download your own submissions");
      }
      return { submission, filePath: resolvedPath };
    }

    if (user.role === "DOCTOR") {
      const doctor = await TaskScopeService.getDoctorOrThrow(user.id);
      const slot = await prisma.scheduleSlot.findFirst({
        where: {
          courseId: submission.task.courseId,
          doctorId: doctor.id,
          isArchived: false,
        },
      });
      if (!slot) {
        throw new AuthorizationError("Access denied: You are not assigned to this course");
      }
      return { submission, filePath: resolvedPath };
    }

    if (user.role === "TEACHING_ASSISTANT") {
      const ta = await prisma.teachingAssistant.findUnique({
        where: { userId: user.id },
      });
      if (!ta) {
        throw new AuthorizationError("Access denied: Only teaching assistants can perform this action");
      }
      const slots = await prisma.scheduleSlot.findMany({
        where: {
          courseId: submission.task.courseId,
          teachingAssistantId: ta.id,
          isArchived: false,
        },
      });
      if (slots.length === 0) {
        throw new AuthorizationError("Access denied: You are not assigned to this course");
      }

      // OD-74: if a TA slot has a groupId only those groups
      const hasCourseWideSlot = slots.some((s) => s.groupId === null);
      if (!hasCourseWideSlot) {
        const allowedGroupIds = slots
          .map((s) => s.groupId)
          .filter((gid): gid is number => gid !== null);
        if (!submission.student.groupId || !allowedGroupIds.includes(submission.student.groupId)) {
          throw new AuthorizationError(
            "Access denied: Submission belongs to a student outside your assigned groups"
          );
        }
      }
      return { submission, filePath: resolvedPath };
    }

    throw new AuthorizationError("Access denied");
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
