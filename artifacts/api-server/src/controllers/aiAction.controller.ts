import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import {
  getProposalById,
  confirmAndExecuteProposal,
  cancelProposal,
} from '../services/aiActionProposal.service';

/**
 * GET /api/ai/actions/:id
 * Retrieve action proposal preview and live status (IDOR protected)
 */
export const getActionProposalController = catchAsync(async (req: Request, res: Response) => {
  const proposalId = String(req.params.id);
  const proposal = await getProposalById(proposalId, req.user!);

  return res.json({
    success: true,
    data: {
      id: proposal.id,
      actionType: proposal.actionType,
      status: proposal.status,
      humanReadableSummary: proposal.humanReadableSummary,
      humanReadableSummaryAr: proposal.humanReadableSummaryAr,
      preview: proposal.previewData,
      expiresAt: proposal.expiresAt,
      createdAt: proposal.createdAt,
      confirmedAt: proposal.confirmedAt,
      executedAt: proposal.executedAt,
      canceledAt: proposal.canceledAt,
      executionResult: proposal.executionResult,
      failureCode: proposal.failureCode,
      failureReason: proposal.failureReason,
    },
  });
});

/**
 * POST /api/ai/actions/:id/confirm
 * Explicit human confirmation to execute proposed business action (IDOR protected, exactly-once)
 */
export const confirmActionProposalController = catchAsync(async (req: Request, res: Response) => {
  const proposalId = String(req.params.id);
  const result = await confirmAndExecuteProposal(proposalId, req.user!);

  return res.json({
    success: true,
    data: result,
  });
});

/**
 * POST /api/ai/actions/:id/cancel
 * Explicit cancellation of a proposed action
 */
export const cancelActionProposalController = catchAsync(async (req: Request, res: Response) => {
  const proposalId = String(req.params.id);
  const result = await cancelProposal(proposalId, req.user!);

  return res.json({
    success: true,
    data: result,
  });
});
