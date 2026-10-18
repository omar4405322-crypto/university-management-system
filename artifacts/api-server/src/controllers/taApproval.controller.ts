import { Request, Response, NextFunction } from 'express';
import catchAsync from '../utils/catchAsync';
import { AppError } from '../utils/appError';
import { TAApprovalService } from '../services/taApproval.service';

export const approveTA = catchAsync(async (req: Request, res: Response) => {
  const result = await TAApprovalService.approve(req.body, req);

  const statusCode = result.isCreated ? 201 : 200;
  res.status(statusCode).json({
    success: true,
    data: result.approval,
  });
});

export const revokeTA = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const approvalId = Number(rawId);
  if (!Number.isSafeInteger(approvalId) || approvalId <= 0) {
    return next(new AppError('Approval ID must be a positive integer', 400));
  }

  const revoked = await TAApprovalService.revoke(approvalId, req);

  res.json({
    success: true,
    data: revoked,
  });
});

export const listApprovals = catchAsync(async (req: Request, res: Response) => {
  const { page, limit, status } = req.query as Record<string, string>;

  const result = await TAApprovalService.list({ page, limit, status }, req);

  res.json({
    success: true,
    data: result,
  });
});
