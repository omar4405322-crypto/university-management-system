import prisma from '../utils/prismaClient';
import { auditLog } from '../utils/audit.utils';
import { ValidationError } from '../utils/appError';
import type { AuthActor } from '../types/auth.types';

export interface SubmissionIntegrityPolicyData {
  id?: number;
  exactDuplicateBlock: boolean;
  similarityThreshold: number | null;
  isDefault: boolean;
  updatedById?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class SubmissionIntegrityService {
  static async getEffectivePolicy(): Promise<SubmissionIntegrityPolicyData> {
    const row = await prisma.submissionIntegrityPolicy.findUnique({
      where: { id: 1 },
    });

    if (!row) {
      return {
        exactDuplicateBlock: true,
        similarityThreshold: null,
        isDefault: true,
      };
    }

    return {
      id: row.id,
      exactDuplicateBlock: row.exactDuplicateBlock,
      similarityThreshold: row.similarityThreshold,
      isDefault: false,
      updatedById: row.updatedById,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  static async updatePolicy(
    actor: AuthActor,
    body: unknown,
    req?: any
  ): Promise<SubmissionIntegrityPolicyData> {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new ValidationError('Policy payload must be an object');
    }

    const entries = Object.entries(body as Record<string, unknown>);
    if (entries.length === 0) {
      throw new ValidationError('At least one policy setting must be provided');
    }

    const allowedKeys = new Set(['exactDuplicateBlock', 'similarityThreshold']);
    for (const [key] of entries) {
      if (!allowedKeys.has(key)) {
        throw new ValidationError(`Unknown field '${key}' in submission integrity policy payload`);
      }
    }

    const payload = body as Record<string, unknown>;

    let exactDuplicateBlock: boolean | undefined = undefined;
    if ('exactDuplicateBlock' in payload) {
      if (typeof payload.exactDuplicateBlock !== 'boolean') {
        throw new ValidationError('exactDuplicateBlock must be a boolean');
      }
      exactDuplicateBlock = payload.exactDuplicateBlock;
    }

    let similarityThreshold: number | null | undefined = undefined;
    if ('similarityThreshold' in payload) {
      const val = payload.similarityThreshold;
      if (val === null) {
        similarityThreshold = null;
      } else if (typeof val !== 'number' || !Number.isFinite(val)) {
        throw new ValidationError('similarityThreshold must be a finite number or null');
      } else if (val <= 0 || val > 1) {
        throw new ValidationError('similarityThreshold must be greater than 0 and less than or equal to 1');
      } else if (/\.\d{5,}/.test(String(val)) || Math.abs(Math.round(val * 10000) - val * 10000) > 1e-6) {
        throw new ValidationError('similarityThreshold must have at most 4 decimal places');
      } else {
        similarityThreshold = Math.round(val * 10000) / 10000;
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.submissionIntegrityPolicy.findUnique({
        where: { id: 1 },
      });

      const before = existing
        ? {
            id: existing.id,
            exactDuplicateBlock: existing.exactDuplicateBlock,
            similarityThreshold: existing.similarityThreshold,
            updatedById: existing.updatedById,
          }
        : {
            exactDuplicateBlock: true,
            similarityThreshold: null,
            isDefault: true,
          };

      const newExactDuplicateBlock =
        exactDuplicateBlock !== undefined
          ? exactDuplicateBlock
          : (existing?.exactDuplicateBlock ?? true);

      const newSimilarityThreshold =
        similarityThreshold !== undefined
          ? similarityThreshold
          : (existing?.similarityThreshold ?? null);

      const updated = await tx.submissionIntegrityPolicy.upsert({
        where: { id: 1 },
        create: {
          id: 1,
          exactDuplicateBlock: newExactDuplicateBlock,
          similarityThreshold: newSimilarityThreshold,
          updatedById: actor.id,
        },
        update: {
          exactDuplicateBlock: newExactDuplicateBlock,
          similarityThreshold: newSimilarityThreshold,
          updatedById: actor.id,
        },
      });

      const after = {
        id: updated.id,
        exactDuplicateBlock: updated.exactDuplicateBlock,
        similarityThreshold: updated.similarityThreshold,
        updatedById: actor.id,
      };

      const auditReq = req || { user: actor };
      await auditLog(
        'UPDATE_SUBMISSION_INTEGRITY_POLICY',
        'SubmissionIntegrityPolicy',
        1,
        auditReq,
        {
          before,
          after,
          updatedById: actor.id,
        },
        tx
      );

      return {
        id: updated.id,
        exactDuplicateBlock: updated.exactDuplicateBlock,
        similarityThreshold: updated.similarityThreshold,
        isDefault: false,
        updatedById: updated.updatedById,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      };
    });

    return result;
  }
}

export default SubmissionIntegrityService;
