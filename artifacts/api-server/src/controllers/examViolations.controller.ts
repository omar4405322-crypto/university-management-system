import { Request, Response, NextFunction } from "express";
import prisma from "../utils/prismaClient";
import catchAsync from "../utils/catchAsync";
import {
  NotFoundError,
  AuthorizationError,
  ValidationError,
} from "../utils/appError";
import { redis } from "../utils/redis.utils";
import logger from "../utils/logger";

/**
 * Extract client IP from an Express request.
 */
export function getClientIp(req: Request): string | null {
  return req.ip || req.get?.("x-forwarded-for")?.split(",")[0]?.trim() || null;
}

// ── Anti-Cheat Sequence Verification & Real-time Violation Ingestion (SEC-33) ──

// In-memory sequence tracking fallback when Redis is offline or unconfigured
const inMemoryViolationSequenceStore = new Map<number, number>();

/**
 * Clear test sequence tracking state (useful for automated tests)
 */
export const resetViolationSequenceForTest = async (
  submissionId?: number,
): Promise<void> => {
  if (submissionId !== undefined) {
    inMemoryViolationSequenceStore.delete(submissionId);
    if (redis && redis.status === "ready") {
      try {
        await redis.del(`exam_violation_seq:${submissionId}`);
      } catch (_e) {
        // ignore
      }
    }
  } else {
    inMemoryViolationSequenceStore.clear();
  }
};

/**
 * Retrieve the highest accepted violation sequence number for an exam submission
 */
export const getLastAcceptedViolationSequence = async (
  submissionId: number,
): Promise<number> => {
  if (redis && redis.status === "ready") {
    try {
      const val = await redis.get(`exam_violation_seq:${submissionId}`);
      if (val !== null) return parseInt(val, 10) || 0;
    } catch (_err) {
      // Fall through to in-memory store
    }
  }
  return inMemoryViolationSequenceStore.get(submissionId) || 0;
};

/**
 * Stateful sequence verification and advancement.
 * Enforces strictly sequential (seq === lastAccepted + 1) ingestion.
 * Rejects duplicate sequence numbers (seq <= lastAccepted) and out-of-order sequence numbers (seq > lastAccepted + 1).
 */
export const verifyAndAdvanceViolationSequence = async (
  submissionId: number,
  incomingSeq: number,
): Promise<{ valid: boolean; error?: string; expected?: number }> => {
  // If Redis is active and connected, use atomic Lua script for horizontal scaling
  if (redis && redis.status === "ready") {
    const key = `exam_violation_seq:${submissionId}`;
    const script = `
      local current = redis.call('GET', KEYS[1])
      local last = 0
      if current then
        last = tonumber(current)
      end
      local incoming = tonumber(ARGV[1])
      if incoming <= last then
        return { -1, last }
      elseif incoming ~= last + 1 then
        return { -2, last }
      else
        redis.call('SET', KEYS[1], incoming, 'EX', 86400)
        return { 1, incoming }
      end
    `;
    try {
      const result = (await redis.eval(
        script,
        1,
        key,
        incomingSeq.toString(),
      )) as [number, number];
      const status = result[0];
      const last = result[1];
      if (status === 1) {
        return { valid: true };
      } else if (status === -1) {
        return {
          valid: false,
          error: `Duplicate sequence number ${incomingSeq}: already processed up to sequence ${last}`,
          expected: last + 1,
        };
      } else {
        return {
          valid: false,
          error: `Out-of-order sequence number ${incomingSeq}: expected ${last + 1}`,
          expected: last + 1,
        };
      }
    } catch (err: any) {
      logger.warn(
        `[ANTI-CHEAT] Redis sequence check failed, falling back to memory: ${err.message}`,
      );
    }
  }

  // In-memory fallback
  const last = inMemoryViolationSequenceStore.get(submissionId) || 0;
  if (incomingSeq <= last) {
    return {
      valid: false,
      error: `Duplicate sequence number ${incomingSeq}: already processed up to sequence ${last}`,
      expected: last + 1,
    };
  }
  if (incomingSeq !== last + 1) {
    return {
      valid: false,
      error: `Out-of-order sequence number ${incomingSeq}: expected ${last + 1}`,
      expected: last + 1,
    };
  }
  inMemoryViolationSequenceStore.set(submissionId, incomingSeq);
  return { valid: true };
};

/**
 * Real-time violation ingestion endpoint (POST /api/exams/submissions/:submissionId/violations)
 */
export const ingestViolation = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const submissionId = parseInt(req.params.submissionId as string, 10);
    const { sequence, type, occurredAt, details } = req.body;

    const student = await prisma.student.findUnique({
      where: { userId: req.user!.id },
    });
    if (!student) {
      return next(
        new AuthorizationError("Only students can submit exam violations"),
      );
    }

    const submission = await prisma.examSubmission.findUnique({
      where: { id: submissionId },
    });

    if (!submission) {
      return next(new NotFoundError("Exam submission not found"));
    }

    if (submission.studentId !== student.id) {
      return next(
        new AuthorizationError(
          "Access denied: submission does not belong to you",
        ),
      );
    }

    // Verify submission belongs to parent exam if exam ID is in route
    if (
      req.params.id &&
      submission.examId !== parseInt(req.params.id as string, 10)
    ) {
      return next(
        new ValidationError("Submission does not belong to the specified exam"),
      );
    }

    // Stateful check: Exam submission must be in an active (PENDING) state
    if (submission.status !== "PENDING") {
      return next(
        new ValidationError("Exam submission is not in an active state"),
      );
    }

    // Stateful check: Sequence verification and advancement
    const seqCheck = await verifyAndAdvanceViolationSequence(
      submissionId,
      sequence,
    );
    if (!seqCheck.valid) {
      return next(
        new ValidationError(seqCheck.error || "Invalid sequence number"),
      );
    }

    const violation = await prisma.examViolation.create({
      data: {
        submissionId,
        type: type as any,
        occurredAt: new Date(occurredAt),
        receivedAt: new Date(),
        details: details ? String(details).slice(0, 500) : null,
        ipAddress: getClientIp(req),
      },
    });

    res.status(201).json({
      success: true,
      data: violation,
      sequence,
    });
  },
);

/**
 * Lightweight endpoint to retrieve authoritative highest accepted violation sequence (SEC-33)
 */
export const getViolationSequence = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const submissionId = parseInt(req.params.submissionId as string, 10);
    const student = await prisma.student.findUnique({
      where: { userId: req.user!.id },
    });
    if (!student) return next(new AuthorizationError("Access denied"));

    const submission = await prisma.examSubmission.findUnique({
      where: { id: submissionId },
    });
    if (!submission) return next(new NotFoundError("Submission not found"));
    if (submission.studentId !== student.id)
      return next(new AuthorizationError("Access denied"));

    if (
      req.params.id &&
      submission.examId !== parseInt(req.params.id as string, 10)
    ) {
      return next(
        new ValidationError("Submission does not belong to the specified exam"),
      );
    }

    const sequence = await getLastAcceptedViolationSequence(submissionId);
    res.json({ success: true, sequence });
  },
);
