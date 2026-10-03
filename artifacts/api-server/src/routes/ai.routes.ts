import express, { type Request, type Response, type NextFunction } from 'express';
import { body, param, query } from 'express-validator';
import { createAiChatController, getAiQuickActionsController } from '../controllers/ai.controller';
import {
  createAiConversationController,
  listAiConversationsController,
  getAiConversationController,
  updateAiConversationController,
  deleteAiConversationController,
  addAiMessageController,
  type AiConversationControllerOptions,
} from '../controllers/aiConversation.controller';
import {
  getActionProposalController,
  confirmActionProposalController,
  cancelActionProposalController,
} from '../controllers/aiAction.controller';
import {
  uploadAiAttachmentController,
  listAiAttachmentsController,
  getAiAttachmentController,
  downloadAiAttachmentController,
  deleteAiAttachmentController,
} from '../controllers/aiAttachment.controller';
import { handleAiAttachmentUpload } from '../middleware/aiAttachmentUpload.middleware';
import { protect } from '../middleware/auth.middleware';
import { aiLimiter } from '../middleware/rateLimiter.middleware';
import validate from '../middleware/validate.middleware';
import { generateAiReply, getAiProviderHealth } from '../services/ai.service';
import { canAccessAiDiagnostics } from '../utils/aiConfig';
import { AppError } from '../utils/appError';

export function createAiRouter(
  chat: typeof generateAiReply = generateAiReply,
  conversationOptions: AiConversationControllerOptions = {},
) {
  const router = express.Router();
  router.use(protect);

  // GET /api/ai/status - Safe provider health status
  router.get('/status', (req: Request, res: Response) => {
    const health = getAiProviderHealth();
    const hasDiagnosticAccess = canAccessAiDiagnostics(req.user);

    if (!hasDiagnosticAccess) {
      return res.json({
        success: true,
        data: {
          status: health.status,
        },
      });
    }

    // Platform administrative access receives sanitized diagnostic provider health
    return res.json({
      success: true,
      data: health,
    });
  });

  // GET /api/ai/quick-actions - Personalized quick actions for the authorized actor
  router.get('/quick-actions', getAiQuickActionsController);

  // Existing chat route
  router.post(
    '/chat',
    aiLimiter,
    (req: Request, _res: Response, next: NextFunction) => req.is('application/json')
      ? next()
      : next(new AppError('Content-Type must be application/json', 415)),
    [
      body().custom((value) =>
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        Object.keys(value).length === 1 &&
        Object.hasOwn(value, 'message')
      ).withMessage('Request must contain only message'),
      body('message').isString().withMessage('Message must be a string')
        .trim().notEmpty().withMessage('Message is required')
        .isLength({ max: 4000 }).withMessage('Message must not exceed 4000 characters'),
    ],
    validate,
    createAiChatController(chat),
  );

  // POST /api/ai/conversations
  router.post(
    ['/conversations', '/conversations/stream'],
    aiLimiter,
    (req: Request, _res: Response, next: NextFunction) => req.is('application/json')
      ? next()
      : next(new AppError('Content-Type must be application/json', 415)),
    [
      body('title').optional().isString().trim().isLength({ max: 100 }).withMessage('Title must not exceed 100 characters'),
      body('message').optional().isString().trim().isLength({ max: 4000 }).withMessage('Message must not exceed 4000 characters'),
      body('attachmentIds').optional().isArray().withMessage('attachmentIds must be an array'),
      body('attachmentIds.*').optional().isString().withMessage('attachmentId must be a string'),
      body('stream').optional().isBoolean().withMessage('stream must be a boolean'),
    ],
    validate,
    createAiConversationController(conversationOptions),
  );

  // GET /api/ai/conversations
  router.get(
    '/conversations',
    [
      query('search').optional().isString().trim().isLength({ max: 100 }),
      query('archived').optional().isString(),
      query('page').optional().isInt({ min: 1 }),
      query('limit').optional().isInt({ min: 1, max: 50 }),
    ],
    validate,
    listAiConversationsController,
  );

  // GET /api/ai/conversations/:id
  router.get(
    '/conversations/:id',
    [param('id').isString().trim().notEmpty().withMessage('Conversation ID is required')],
    validate,
    getAiConversationController,
  );

  // PATCH /api/ai/conversations/:id
  router.patch(
    '/conversations/:id',
    (req: Request, _res: Response, next: NextFunction) => req.is('application/json')
      ? next()
      : next(new AppError('Content-Type must be application/json', 415)),
    [
      param('id').isString().trim().notEmpty().withMessage('Conversation ID is required'),
      body('title').optional().isString().trim().notEmpty().withMessage('Title cannot be empty').isLength({ max: 100 }),
      body('isArchived').optional().isBoolean().withMessage('isArchived must be a boolean'),
      body('isPinned').optional().isBoolean().withMessage('isPinned must be a boolean'),
    ],
    validate,
    updateAiConversationController,
  );

  // DELETE /api/ai/conversations/:id
  router.delete(
    '/conversations/:id',
    [param('id').isString().trim().notEmpty().withMessage('Conversation ID is required')],
    validate,
    deleteAiConversationController,
  );

  // ==========================================================================
  // PHASE 15: USER CONVERSATION ATTACHMENTS
  // ==========================================================================

  // POST /api/ai/conversations/:id/attachments
  router.post(
    '/conversations/:id/attachments',
    aiLimiter,
    [param('id').isString().trim().notEmpty().withMessage('Conversation ID is required')],
    validate,
    handleAiAttachmentUpload,
    uploadAiAttachmentController,
  );

  // GET /api/ai/conversations/:id/attachments
  router.get(
    '/conversations/:id/attachments',
    [param('id').isString().trim().notEmpty().withMessage('Conversation ID is required')],
    validate,
    listAiAttachmentsController,
  );

  // GET /api/ai/conversations/:id/attachments/:attachmentId
  router.get(
    '/conversations/:id/attachments/:attachmentId',
    [
      param('id').isString().trim().notEmpty().withMessage('Conversation ID is required'),
      param('attachmentId').isString().trim().notEmpty().withMessage('Attachment ID is required'),
    ],
    validate,
    getAiAttachmentController,
  );

  // GET /api/ai/conversations/:id/attachments/:attachmentId/download
  router.get(
    '/conversations/:id/attachments/:attachmentId/download',
    [
      param('id').isString().trim().notEmpty().withMessage('Conversation ID is required'),
      param('attachmentId').isString().trim().notEmpty().withMessage('Attachment ID is required'),
    ],
    validate,
    downloadAiAttachmentController,
  );

  // DELETE /api/ai/conversations/:id/attachments/:attachmentId
  router.delete(
    '/conversations/:id/attachments/:attachmentId',
    [
      param('id').isString().trim().notEmpty().withMessage('Conversation ID is required'),
      param('attachmentId').isString().trim().notEmpty().withMessage('Attachment ID is required'),
    ],
    validate,
    deleteAiAttachmentController,
  );

  // POST /api/ai/conversations/:id/messages (and /stream)
  router.post(
    ['/conversations/:id/messages', '/conversations/:id/messages/stream'],
    aiLimiter,
    (req: Request, _res: Response, next: NextFunction) => req.is('application/json')
      ? next()
      : next(new AppError('Content-Type must be application/json', 415)),
    [
      param('id').isString().trim().notEmpty().withMessage('Conversation ID is required'),
      body('message').isString().withMessage('Message must be a string')
        .trim().notEmpty().withMessage('Message is required')
        .isLength({ max: 4000 }).withMessage('Message must not exceed 4000 characters'),
      body('attachmentIds').optional().isArray().withMessage('attachmentIds must be an array'),
      body('attachmentIds.*').optional().isString().withMessage('attachmentId must be a string'),
      body('stream').optional().isBoolean().withMessage('stream must be a boolean'),
    ],
    validate,
    addAiMessageController(conversationOptions),
  );

  // ==========================================================================
  // PHASE 14: SAFE AI ACTION PROPOSALS & CONFIRMATION
  // ==========================================================================

  // GET /api/ai/actions/:id - Retrieve action proposal and preview
  router.get(
    '/actions/:id',
    [param('id').isString().trim().notEmpty().withMessage('Action proposal ID is required')],
    validate,
    getActionProposalController,
  );

  // POST /api/ai/actions/:id/confirm - Explicit human confirmation
  router.post(
    '/actions/:id/confirm',
    [param('id').isString().trim().notEmpty().withMessage('Action proposal ID is required')],
    validate,
    confirmActionProposalController,
  );

  // POST /api/ai/actions/:id/cancel - Explicit cancellation
  router.post(
    '/actions/:id/cancel',
    [param('id').isString().trim().notEmpty().withMessage('Action proposal ID is required')],
    validate,
    cancelActionProposalController,
  );

  return router;
}

export default createAiRouter();

