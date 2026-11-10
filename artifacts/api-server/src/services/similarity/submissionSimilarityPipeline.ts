import path from 'node:path';
import { readFile as defaultReadFile } from 'node:fs/promises';
import defaultPrisma from '../../utils/prismaClient';
import defaultLogger from '../../utils/logger';
import { resolveSafeTaskSubmissionStoragePath } from '../../middleware/taskSubmissionUpload.middleware';
import { SubmissionIntegrityService } from '../submissionIntegrity.service';
import { extractText as defaultExtractText } from './textExtraction.runner';
import type { ExtractTextOptions, ExtractTextResult } from './textExtraction.runner';
import {
  normalizeSimilarityText,
  isEligibleForSimilarity,
  iterateWordShingles,
  computeMinHashSignatureAsync,
  estimateJaccardSimilarity,
} from './similarityPure';
import {
  SIMILARITY_PEER_CAP,
  SIMILARITY_ENABLED_EXTENSIONS,
  SIMILARITY_EMPTY_COUNT,
  SIMILARITY_EMPTY_COUNT as SIMILARITY_INITIAL_COUNT,
  SIMILARITY_DOT_OFFSET as SIMILARITY_INCREMENT_STEP,
  SIMILARITY_INDEX_NOT_FOUND,
  SIMILARITY_DOT_OFFSET,
} from './similarityPipeline.constants';

export type PipelineOutcome =
  | 'FINGERPRINT_READY'
  | 'FINGERPRINT_UNSUPPORTED'
  | 'FINGERPRINT_FAILED'
  | 'SKIPPED_NOT_FOUND'
  | 'SKIPPED_NO_FILE'
  | 'DISCARDED_STALE';

export interface PipelineResult {
  outcome: PipelineOutcome;
  flagsCreated: number;
  peersCompared: number;
}

export interface PipelineDeps {
  prisma?: any;
  extractText?: (options: ExtractTextOptions) => Promise<ExtractTextResult>;
  readFile?: (filePath: string) => Promise<Buffer>;
  getEffectivePolicy?: () => Promise<{
    exactDuplicateBlock: boolean;
    similarityThreshold: number | null;
    isDefault: boolean;
  }>;
  storageDir?: string;
  peerCap?: number;
  beforeWrite?: (submissionId: number) => Promise<void>;
  logger?: {
    warn: (msg: string, meta?: Record<string, unknown>) => void;
    error: (msg: string, meta?: Record<string, unknown>) => void;
    info?: (msg: string, meta?: Record<string, unknown>) => void;
  };
}

const defaultStorageBaseDir = path.resolve('uploads/tasks');

export async function processSubmissionSimilarity(
  submissionId: number,
  deps?: PipelineDeps
): Promise<PipelineResult> {
  const prismaClient = deps?.prisma ?? defaultPrisma;
  const pipelineLogger = deps?.logger ?? defaultLogger;
  const storageDir = deps?.storageDir ?? defaultStorageBaseDir;
  const peerCap = deps?.peerCap ?? SIMILARITY_PEER_CAP;
  const extractTextFn = deps?.extractText ?? defaultExtractText;
  const readFileFn = deps?.readFile ?? defaultReadFile;
  const getEffectivePolicyFn =
    deps?.getEffectivePolicy ?? (() => SubmissionIntegrityService.getEffectivePolicy());

  try {
    // Step a: Load submission with explicit select
    const submission = await prismaClient.taskSubmission.findUnique({
      where: { id: submissionId },
      select: {
        id: true,
        taskId: true,
        studentId: true,
        fileName: true,
        fileHash: true,
        storageKey: true,
        task: {
          select: {
            courseId: true,
          },
        },
      },
    });

    if (!submission) {
      return {
        outcome: 'SKIPPED_NOT_FOUND',
        flagsCreated: SIMILARITY_INITIAL_COUNT,
        peersCompared: SIMILARITY_INITIAL_COUNT,
      };
    }

    if (!submission.fileHash || !submission.storageKey) {
      return {
        outcome: 'SKIPPED_NO_FILE',
        flagsCreated: SIMILARITY_INITIAL_COUNT,
        peersCompared: SIMILARITY_INITIAL_COUNT,
      };
    }

    // Step b: Extension from fileName (last dot segment, lower-case)
    const rawFileName = submission.fileName ?? '';
    const dotIndex = rawFileName.lastIndexOf('.');
    const ext =
      dotIndex !== SIMILARITY_INDEX_NOT_FOUND
        ? rawFileName.slice(dotIndex + SIMILARITY_DOT_OFFSET).toLowerCase()
        : '';

    const isEnabled = (SIMILARITY_ENABLED_EXTENSIONS as readonly string[]).includes(ext);

    let status: 'READY' | 'UNSUPPORTED' | 'FAILED';
    let computedSignature: Buffer | null = null;
    let computedShingleCount = SIMILARITY_INITIAL_COUNT;

    if (!isEnabled) {
      status = 'UNSUPPORTED';
    } else {
      // Step c: Read ONLY this submission's own file
      const candidatePath = path.join(storageDir, submission.storageKey);
      const safePath = resolveSafeTaskSubmissionStoragePath(storageDir, candidatePath);

      if (!safePath) {
        status = 'FAILED';
      } else {
        let fileBuffer: Buffer | null = null;
        try {
          fileBuffer = await readFileFn(safePath);
        } catch {
          status = 'FAILED';
        }

        if (fileBuffer) {
          // Step d: Extract text (never throws)
          const extractResult = await extractTextFn({
            buffer: fileBuffer,
            extension: ext,
          });

          if (extractResult.status === 'UNSUPPORTED') {
            status = 'UNSUPPORTED';
          } else if (extractResult.status === 'FAILED') {
            status = 'FAILED';
          } else {
            // Step e: Normalize, eligibility check, MinHash signature
            const normalized = normalizeSimilarityText(extractResult.text);
            if (!isEligibleForSimilarity(normalized)) {
              status = 'UNSUPPORTED';
            } else {
              const { signature, shingleCount } = await computeMinHashSignatureAsync(
                iterateWordShingles(normalized)
              );
              status = 'READY';
              computedSignature = signature;
              computedShingleCount = shingleCount;
            }
          }
        } else {
          status = 'FAILED';
        }
      }
    }

    // Step f: Read policy once before write
    const policy = await getEffectivePolicyFn();
    const threshold = policy.similarityThreshold;

    // Optional beforeWrite hook right before write transaction
    if (deps?.beforeWrite) {
      await deps.beforeWrite(submissionId);
    }

    // Step g: ONE prisma.$transaction
    return await prismaClient.$transaction(async (tx: any) => {
      // Re-read submission to check freshness
      const currentSub = await tx.taskSubmission.findUnique({
        where: { id: submissionId },
        select: {
          id: true,
          fileHash: true,
        },
      });

      if (!currentSub) {
        return {
          outcome: 'SKIPPED_NOT_FOUND',
          flagsCreated: SIMILARITY_INITIAL_COUNT,
          peersCompared: SIMILARITY_INITIAL_COUNT,
        };
      }

      if (currentSub.fileHash !== submission.fileHash) {
        return {
          outcome: 'DISCARDED_STALE',
          flagsCreated: SIMILARITY_INITIAL_COUNT,
          peersCompared: SIMILARITY_INITIAL_COUNT,
        };
      }

      // Upsert fingerprint
      await tx.taskSubmissionFingerprint.upsert({
        where: { submissionId },
        create: {
          submissionId,
          fileHash: submission.fileHash,
          status,
          signature: status === 'READY' ? computedSignature : null,
          shingleCount: status === 'READY' ? computedShingleCount : SIMILARITY_INITIAL_COUNT,
        },
        update: {
          fileHash: submission.fileHash,
          status,
          signature: status === 'READY' ? computedSignature : null,
          shingleCount: status === 'READY' ? computedShingleCount : SIMILARITY_INITIAL_COUNT,
        },
      });

      // Purge PENDING flags involving this submission
      await tx.submissionSimilarityFlag.deleteMany({
        where: {
          status: 'PENDING',
          OR: [
            { submissionAId: submissionId },
            { submissionBId: submissionId },
          ],
        },
      });

      let flagsCreated = SIMILARITY_INITIAL_COUNT;
      let peersCompared = SIMILARITY_INITIAL_COUNT;

      if (status === 'READY' && threshold !== null) {
        // Hash-level template exclusion
        const matchingMaterial = await tx.courseMaterial.findFirst({
          where: {
            courseId: submission.task.courseId,
            fileHash: submission.fileHash,
          },
          select: { id: true },
        });

        if (!matchingMaterial) {
          const peerFingerprints = await tx.taskSubmissionFingerprint.findMany({
            where: {
              status: 'READY',
              signature: { not: null },
              submissionId: { not: submissionId },
              submission: {
                taskId: submission.taskId,
                studentId: { not: submission.studentId },
              },
            },
            select: {
              id: true,
              submissionId: true,
              fileHash: true,
              signature: true,
              submission: {
                select: {
                  fileHash: true,
                },
              },
            },
            orderBy: [
              { createdAt: 'desc' },
              { id: 'desc' },
            ],
            take: peerCap,
          });

          if (peerFingerprints.length >= peerCap) {
            pipelineLogger.warn('Similarity peer cap reached', {
              taskId: submission.taskId,
              peerCap,
            });
          }

          const flagsToInsert: Array<{
            taskId: number;
            submissionAId: number;
            submissionBId: number;
            fileHashA: string;
            fileHashB: string;
            similarityScore: number;
            thresholdUsed: number;
            status: string;
          }> = [];

          for (const peer of peerFingerprints) {
            // Skip peer if its fingerprint fileHash differs from its submission current fileHash
            if (peer.fileHash !== peer.submission.fileHash) {
              continue;
            }
            if (!peer.signature || !computedSignature) {
              continue;
            }

            peersCompared += SIMILARITY_INCREMENT_STEP;
            const score = estimateJaccardSimilarity(computedSignature, peer.signature);

            if (score >= threshold) {
              const isSubMin = submissionId < peer.submissionId;
              const subAId = isSubMin ? submissionId : peer.submissionId;
              const subBId = isSubMin ? peer.submissionId : submissionId;
              const hashA = isSubMin ? submission.fileHash : peer.fileHash;
              const hashB = isSubMin ? peer.fileHash : submission.fileHash;

              flagsToInsert.push({
                taskId: submission.taskId,
                submissionAId: subAId,
                submissionBId: subBId,
                fileHashA: hashA,
                fileHashB: hashB,
                similarityScore: score,
                thresholdUsed: threshold,
                status: 'PENDING',
              });
            }
          }

          if (flagsToInsert.length > SIMILARITY_EMPTY_COUNT) {
            const insertResult = await tx.submissionSimilarityFlag.createMany({
              data: flagsToInsert,
              skipDuplicates: true,
            });
            flagsCreated = insertResult.count;
          }
        }
      }

      let outcome: PipelineOutcome;
      if (status === 'READY') {
        outcome = 'FINGERPRINT_READY';
      } else if (status === 'UNSUPPORTED') {
        outcome = 'FINGERPRINT_UNSUPPORTED';
      } else {
        outcome = 'FINGERPRINT_FAILED';
      }

      return {
        outcome,
        flagsCreated,
        peersCompared,
      };
    });
  } catch (error: any) {
    const errorCode = error?.code;
    pipelineLogger.error('Similarity pipeline error', {
      submissionId,
      code: errorCode ?? error?.name ?? 'UNKNOWN_ERROR',
    });

    if (errorCode === 'P2003' || errorCode === 'P2025') {
      return {
        outcome: 'SKIPPED_NOT_FOUND',
        flagsCreated: SIMILARITY_INITIAL_COUNT,
        peersCompared: SIMILARITY_INITIAL_COUNT,
      };
    }

    return {
      outcome: 'FINGERPRINT_FAILED',
      flagsCreated: SIMILARITY_INITIAL_COUNT,
      peersCompared: SIMILARITY_INITIAL_COUNT,
    };
  }
}
