import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import { SubmissionIntegrityService } from '../services/submissionIntegrity.service';

export const getPolicy = catchAsync(async (_req: Request, res: Response) => {
  const data = await SubmissionIntegrityService.getEffectivePolicy();
  return res.json({ success: true, data });
});

export const updatePolicy = catchAsync(async (req: Request, res: Response) => {
  const data = await SubmissionIntegrityService.updatePolicy(req.user!, req.body, req);
  return res.json({ success: true, data });
});
