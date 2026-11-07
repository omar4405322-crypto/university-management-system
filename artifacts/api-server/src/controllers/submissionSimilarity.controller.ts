import { Request, Response, NextFunction } from 'express';
import catchAsync from '../utils/catchAsync';
import { SubmissionSimilarityService } from '../services/submissionSimilarity.service';
import { ValidationError } from '../utils/appError';

export const getTaskSimilarityFlags = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    const taskId = Number(req.params.id);
    if (!Number.isSafeInteger(taskId) || taskId <= 0) {
      throw new ValidationError('Invalid task ID');
    }

    const flags = await SubmissionSimilarityService.listFlags(req.user!, taskId);
    return res.status(200).json({ success: true, data: flags });
  }
);

export const decideTaskSimilarityFlag = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    const taskId = Number(req.params.id);
    if (!Number.isSafeInteger(taskId) || taskId <= 0) {
      throw new ValidationError('Invalid task ID');
    }
    const flagId = String(req.params.flagId || '').trim();
    if (!flagId) {
      throw new ValidationError('Invalid flag ID');
    }

    const updated = await SubmissionSimilarityService.decideFlag(
      req.user!,
      taskId,
      flagId,
      req.body
    );
    return res.status(200).json({ success: true, data: updated });
  }
);
