import prisma from '../utils/prismaClient';
import {
  NotFoundError,
  ConflictError,
  ValidationError,
} from '../utils/appError';
import { TaskScopeService } from './task/taskScope.service';
import type { AuthActor } from '../types/auth.types';
import { z } from 'zod';

export const MAX_SIMILARITY_FLAG_REVIEW_NOTE_LENGTH = 1000;

export const DecideSimilarityFlagSchema = z
  .object({
    decision: z.enum(['CONFIRMED', 'DISMISSED']),
    note: z
      .string()
      .max(
        MAX_SIMILARITY_FLAG_REVIEW_NOTE_LENGTH,
        `Note cannot exceed ${MAX_SIMILARITY_FLAG_REVIEW_NOTE_LENGTH} characters`
      )
      .optional(),
  })
  .strict();

export interface SimilaritySideDTO {
  submissionId: number;
  studentId: string;
  studentName: string;
  fileName: string | null;
  submittedAt: Date;
}

export interface SubmissionSimilarityFlagItemDTO {
  id: string;
  status: string;
  similarityScore: number;
  thresholdUsed: number;
  createdAt: Date;
  reviewedById: number | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
  submissionA: SimilaritySideDTO;
  submissionB: SimilaritySideDTO;
}

export class SubmissionSimilarityService {
  static async assertTaskScope(user: AuthActor, taskId: number) {
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
      throw new NotFoundError('Task not found');
    }

    await TaskScopeService.ensureCourseOwnershipOrScope(user, taskObj);
    return taskObj;
  }

  static async listFlags(
    user: AuthActor,
    taskId: number
  ): Promise<SubmissionSimilarityFlagItemDTO[]> {
    await SubmissionSimilarityService.assertTaskScope(user, taskId);

    const flags = await prisma.submissionSimilarityFlag.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
      include: {
        submissionA: {
          include: {
            student: {
              select: {
                studentId: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        submissionB: {
          include: {
            student: {
              select: {
                studentId: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    return flags.map((flag) => ({
      id: flag.id,
      status: flag.status,
      similarityScore: flag.similarityScore,
      thresholdUsed: flag.thresholdUsed,
      createdAt: flag.createdAt,
      reviewedById: flag.reviewedById,
      reviewedAt: flag.reviewedAt,
      reviewNote: flag.reviewNote,
      submissionA: {
        submissionId: flag.submissionAId,
        studentId: flag.submissionA.student.studentId,
        studentName: `${flag.submissionA.student.firstName} ${flag.submissionA.student.lastName}`.trim(),
        fileName: flag.submissionA.fileName,
        submittedAt: flag.submissionA.submittedAt,
      },
      submissionB: {
        submissionId: flag.submissionBId,
        studentId: flag.submissionB.student.studentId,
        studentName: `${flag.submissionB.student.firstName} ${flag.submissionB.student.lastName}`.trim(),
        fileName: flag.submissionB.fileName,
        submittedAt: flag.submissionB.submittedAt,
      },
    }));
  }

  static async decideFlag(
    user: AuthActor,
    taskId: number,
    flagId: string,
    rawBody: unknown
  ): Promise<SubmissionSimilarityFlagItemDTO> {
    // 1. Role: enforced by route authorize middleware
    // 2. Task scope check
    await SubmissionSimilarityService.assertTaskScope(user, taskId);

    // 3. Body validation (422)
    const parseResult = DecideSimilarityFlagSchema.safeParse(rawBody);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0];
      const message = firstIssue ? firstIssue.message : 'Validation failed';
      throw new ValidationError(message, parseResult.error.issues);
    }
    const { decision, note } = parseResult.data;

    // 4. Flag lookup scoped to taskId (404)
    const existingFlag = await prisma.submissionSimilarityFlag.findFirst({
      where: { id: flagId, taskId },
    });
    if (!existingFlag) {
      throw new NotFoundError('Similarity flag not found');
    }

    // 5. State check (409 if not PENDING)
    if (existingFlag.status !== 'PENDING') {
      throw new ConflictError('Similarity flag has already been decided');
    }

    // 6. Write in ONE transaction
    const updated = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.submissionSimilarityFlag.updateMany({
        where: {
          id: flagId,
          taskId,
          status: 'PENDING',
        },
        data: {
          status: decision,
          reviewedById: user.id,
          reviewedAt: new Date(),
          reviewNote: note ?? null,
        },
      });

      if (updateResult.count === 0) {
        throw new ConflictError('Similarity flag has already been decided');
      }

      await tx.auditLog.create({
        data: {
          userId: user.id,
          userEmail: user.email,
          userRole: user.role,
          action: 'REVIEW_SUBMISSION_SIMILARITY_FLAG',
          entity: 'SubmissionSimilarityFlag',
          entityId: flagId,
          details: {
            flagId,
            taskId,
            decision,
          },
        },
      });

      return tx.submissionSimilarityFlag.findUniqueOrThrow({
        where: { id: flagId },
        include: {
          submissionA: {
            include: {
              student: {
                select: {
                  studentId: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          submissionB: {
            include: {
              student: {
                select: {
                  studentId: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      });
    });

    return {
      id: updated.id,
      status: updated.status,
      similarityScore: updated.similarityScore,
      thresholdUsed: updated.thresholdUsed,
      createdAt: updated.createdAt,
      reviewedById: updated.reviewedById,
      reviewedAt: updated.reviewedAt,
      reviewNote: updated.reviewNote,
      submissionA: {
        submissionId: updated.submissionAId,
        studentId: updated.submissionA.student.studentId,
        studentName: `${updated.submissionA.student.firstName} ${updated.submissionA.student.lastName}`.trim(),
        fileName: updated.submissionA.fileName,
        submittedAt: updated.submissionA.submittedAt,
      },
      submissionB: {
        submissionId: updated.submissionBId,
        studentId: updated.submissionB.student.studentId,
        studentName: `${updated.submissionB.student.firstName} ${updated.submissionB.student.lastName}`.trim(),
        fileName: updated.submissionB.fileName,
        submittedAt: updated.submissionB.submittedAt,
      },
    };
  }
}
