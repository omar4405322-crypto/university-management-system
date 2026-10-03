import crypto from 'node:crypto';
import { z } from 'zod';
import prisma from '../utils/prismaClient';
import type { AuthActor } from '../types/auth.types';
import { TaskService } from './task.service';
import { TaskScopeService } from './task/taskScope.service';
import { getAdministrativeAnalyticsScopes } from '../utils/administrativeAnalyticsScope.utils';
import { toCairoTime, fromCairoTime, formatCairoDateTime } from '../utils/timezone.utils';
import { auditLog } from '../utils/audit.utils';
import { NotFoundError, ValidationError, ForbiddenError, ConflictError } from '../utils/appError';
import logger from '../utils/logger';

// ============================================================================
// 1. STRICT ACTION SCHEMAS (Server-Owned, Zero Model Bypass Flags)
// ============================================================================

export const CreateTaskActionSchema = z
  .object({
    courseId: z.number().int().positive({ message: 'courseId must be a positive integer' }),
    title: z.string().trim().min(3, { message: 'Title must be at least 3 characters' }).max(100),
    description: z.string().trim().max(1000).optional().default(''),
    dueDate: z.string().trim().min(1, { message: 'dueDate is required' }),
    maxScore: z.number().int().positive().max(1000).optional().default(100),
  })
  .strict();

export const MarkNotificationReadActionSchema = z
  .object({
    notificationId: z.number().int().positive({ message: 'notificationId must be a positive integer' }),
  })
  .strict();

export const CreateAnnouncementActionSchema = z
  .object({
    targetScope: z.enum(['GLOBAL', 'COLLEGE', 'DEPARTMENT']),
    collegeId: z.number().int().positive().optional(),
    departmentId: z.number().int().positive().optional(),
    title: z.string().trim().min(3, { message: 'Title must be at least 3 characters' }).max(100),
    message: z.string().trim().min(5, { message: 'Message must be at least 5 characters' }).max(1000),
    type: z.enum(['info', 'warning', 'success']).optional().default('info'),
  })
  .strict();

export type CreateTaskPayload = z.infer<typeof CreateTaskActionSchema>;
export type MarkNotificationReadPayload = z.infer<typeof MarkNotificationReadActionSchema>;
export type CreateAnnouncementPayload = z.infer<typeof CreateAnnouncementActionSchema>;

export type SupportedActionType = 'CREATE_TASK' | 'MARK_NOTIFICATION_READ' | 'CREATE_ANNOUNCEMENT';

// Expiry configuration: 15 minutes bounded lifetime for proposals
export const PROPOSAL_EXPIRATION_MS = 15 * 60 * 1000;

// Maximum recipients for announcement mass action protection
export const MAX_ANNOUNCEMENT_RECIPIENTS = 500;

// ============================================================================
// 2. CANONICAL HASH & IDEMPOTENCY KEY HELPERS
// ============================================================================

export function deterministicStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(deterministicStringify).join(',') + ']';
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = keys.map((k) => `${JSON.stringify(k)}:${deterministicStringify((obj as Record<string, unknown>)[k])}`);
  return '{' + pairs.join(',') + '}';
}

export function computePayloadHash(payload: Record<string, unknown>): string {
  return crypto.createHash('sha256').update(deterministicStringify(payload)).digest('hex');
}

export function computeIdempotencyKey(
  userId: number,
  conversationId: string | null | undefined,
  sourceUserMessageId: string | null | undefined,
  actionType: string,
  payloadHash: string,
): string {
  const convKey = conversationId?.trim() || 'standalone';
  const msgKey = sourceUserMessageId?.trim() || 'turn';
  return crypto
    .createHash('sha256')
    .update(`${userId}:${convKey}:${msgKey}:${actionType}:${payloadHash}`)
    .digest('hex');
}

async function resolveValidConversationId(conversationId?: string | null): Promise<string | null> {
  if (!conversationId) return null;
  const exists = await prisma.aIConversation.findUnique({
    where: { id: conversationId },
    select: { id: true },
  });
  return exists ? exists.id : null;
}

// ============================================================================
// 3. ACTION PROPOSAL CREATION (MODEL FACING, ZERO BUSINESS MUTATION)
// ============================================================================

export interface ProposalCreationOptions {
  conversationId?: string;
  sourceUserMessageId?: string;
}

export interface ProposalResult {
  [key: string]: unknown;
  proposalId: string;
  actionType: SupportedActionType;
  status: 'PROPOSED';
  humanReadableSummary: string;
  humanReadableSummaryAr: string;
  preview: Record<string, unknown>;
  requiresConfirmation: true;
  expiresAt: string;
  idempotentReplay?: boolean;
}

export async function proposeAction(
  actor: AuthActor,
  actionType: SupportedActionType,
  rawArgs: unknown,
  options: ProposalCreationOptions = {},
): Promise<ProposalResult> {
  // Model-facing proposal: validation, normalization, and persistence only
  switch (actionType) {
    case 'CREATE_TASK':
      return proposeCreateTask(actor, rawArgs, options);
    case 'MARK_NOTIFICATION_READ':
      return proposeMarkNotificationRead(actor, rawArgs, options);
    case 'CREATE_ANNOUNCEMENT':
      return proposeCreateAnnouncement(actor, rawArgs, options);
    default:
      throw new ValidationError(`Unsupported AI action type: ${actionType}`);
  }
}

async function proposeCreateTask(
  actor: AuthActor,
  rawArgs: unknown,
  options: ProposalCreationOptions,
): Promise<ProposalResult> {
  const parsed = CreateTaskActionSchema.safeParse(rawArgs);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i: any) => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new ValidationError(`Invalid task action parameters: ${errorMsg}`);
  }
  const payload = parsed.data;

  // Authorization check at proposal time: only assigned course instructors (DOCTOR)
  const role = (actor.role || '').toUpperCase();
  if (role !== 'DOCTOR') {
    throw new ForbiddenError('Only course instructors (doctors) can propose course assignments.');
  }

  // Course verification
  const course = await prisma.course.findUnique({
    where: { id: payload.courseId },
    include: {
      department: true,
      enrollments: { where: { status: 'ENROLLED' } },
    },
  });
  if (!course) {
    throw new NotFoundError(`Course with ID ${payload.courseId} was not found.`);
  }

  // Doctor assignment check
  const doctor = await TaskScopeService.getDoctorOrThrow(actor.id);
  await TaskScopeService.ensureDoctorAssignedToCourse(doctor.id, course.id);

  // Date parsing & Cairo timezone resolution
  const resolvedDueDate = fromCairoTime(payload.dueDate);
  if (isNaN(resolvedDueDate.getTime())) {
    throw new ValidationError(`Invalid due date format: "${payload.dueDate}".`);
  }
  const now = new Date();
  if (resolvedDueDate.getTime() <= now.getTime()) {
    throw new ValidationError('Task deadline must be in the future.');
  }

  const dueDateFormattedCairo = formatCairoDateTime(resolvedDueDate, 'yyyy-MM-dd hh:mm a');
  const enrolledStudentsCount = course.enrollments.length;

  const normalizedPayload: CreateTaskPayload = {
    courseId: payload.courseId,
    title: payload.title,
    description: payload.description || '',
    dueDate: resolvedDueDate.toISOString(),
    maxScore: payload.maxScore || 100,
  };

  const payloadHash = computePayloadHash(normalizedPayload as any);
  const idempotencyKey = computeIdempotencyKey(
    actor.id,
    options.conversationId,
    options.sourceUserMessageId,
    'CREATE_TASK',
    payloadHash,
  );

  // Check for duplicate proposal in same turn
  const existing = await prisma.aIActionProposal.findUnique({
    where: { idempotencyKey },
  });

  if (existing && existing.status === 'PROPOSED' && existing.expiresAt > new Date()) {
    return {
      proposalId: existing.id,
      actionType: 'CREATE_TASK',
      status: 'PROPOSED',
      humanReadableSummary: existing.humanReadableSummary,
      humanReadableSummaryAr: existing.humanReadableSummaryAr || existing.humanReadableSummary,
      preview: existing.previewData as Record<string, unknown>,
      requiresConfirmation: true,
      expiresAt: existing.expiresAt.toISOString(),
      idempotentReplay: true,
    };
  }

  const humanReadableSummary = `Create assignment "${payload.title}" for course ${course.courseCode} (${course.name}) with deadline on ${dueDateFormattedCairo} (Africa/Cairo).`;
  const humanReadableSummaryAr = `إنشاء تكليف "${payload.title}" لمقرر ${course.courseCode} (${course.name}) بموعد تسليم ${dueDateFormattedCairo} (توقيت القاهرة).`;

  const preview = {
    actionType: 'CREATE_TASK',
    target: `${course.courseCode} — ${course.name}`,
    title: payload.title,
    description: payload.description || null,
    deadlineCairo: `${dueDateFormattedCairo} Africa/Cairo`,
    maxScore: payload.maxScore || 100,
    recipientsCount: enrolledStudentsCount,
    sideEffect: 'This task will be published and become immediately visible to all enrolled students with an automated notification.',
    sideEffectAr: 'سيتم نشر هذا التكليف ليظهر فوراً لجميع الطلاب المسجلين مع إرسال إشعار آلي لهم.',
  };

  const expiresAt = new Date(Date.now() + PROPOSAL_EXPIRATION_MS);
  const conversationId = await resolveValidConversationId(options.conversationId);

  const proposal = await prisma.aIActionProposal.upsert({
    where: { idempotencyKey },
    create: {
      userId: actor.id,
      conversationId,
      sourceUserMessageId: options.sourceUserMessageId || null,
      idempotencyKey,
      actionType: 'CREATE_TASK',
      normalizedPayload: normalizedPayload as any,
      payloadHash,
      humanReadableSummary,
      humanReadableSummaryAr,
      previewData: preview as any,
      status: 'PROPOSED',
      targetEntityId: String(course.id),
      expiresAt,
    },
    update: {
      // Re-propose if previous expired or canceled
      normalizedPayload: normalizedPayload as any,
      payloadHash,
      humanReadableSummary,
      humanReadableSummaryAr,
      previewData: preview as any,
      status: 'PROPOSED',
      failureCode: null,
      failureReason: null,
      expiresAt,
    },
  });

  auditLog('AI_ACTION_PROPOSED', 'AIActionProposal', proposal.id, {
    userId: actor.id,
    actionType: 'CREATE_TASK',
    targetCourseId: course.id,
    title: payload.title,
  });

  return {
    proposalId: proposal.id,
    actionType: 'CREATE_TASK',
    status: 'PROPOSED',
    humanReadableSummary,
    humanReadableSummaryAr,
    preview,
    requiresConfirmation: true,
    expiresAt: proposal.expiresAt.toISOString(),
  };
}

async function proposeMarkNotificationRead(
  actor: AuthActor,
  rawArgs: unknown,
  options: ProposalCreationOptions,
): Promise<ProposalResult> {
  const parsed = MarkNotificationReadActionSchema.safeParse(rawArgs);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i: any) => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new ValidationError(`Invalid notification action parameters: ${errorMsg}`);
  }
  const payload = parsed.data;

  const notification = await prisma.notification.findFirst({
    where: {
      id: payload.notificationId,
      userId: actor.id,
    },
  });

  if (!notification) {
    throw new NotFoundError(`Notification ID ${payload.notificationId} was not found for your account.`);
  }

  const normalizedPayload: MarkNotificationReadPayload = {
    notificationId: payload.notificationId,
  };

  const payloadHash = computePayloadHash(normalizedPayload as any);
  const idempotencyKey = computeIdempotencyKey(
    actor.id,
    options.conversationId,
    options.sourceUserMessageId,
    'MARK_NOTIFICATION_READ',
    payloadHash,
  );

  const existing = await prisma.aIActionProposal.findUnique({
    where: { idempotencyKey },
  });

  if (existing && existing.status === 'PROPOSED' && existing.expiresAt > new Date()) {
    return {
      proposalId: existing.id,
      actionType: 'MARK_NOTIFICATION_READ',
      status: 'PROPOSED',
      humanReadableSummary: existing.humanReadableSummary,
      humanReadableSummaryAr: existing.humanReadableSummaryAr || existing.humanReadableSummary,
      preview: existing.previewData as Record<string, unknown>,
      requiresConfirmation: true,
      expiresAt: existing.expiresAt.toISOString(),
      idempotentReplay: true,
    };
  }

  const humanReadableSummary = `Mark notification "${notification.title}" as read.`;
  const humanReadableSummaryAr = `تحديد الإشعار "${notification.title}" كمقروء.`;

  const preview = {
    actionType: 'MARK_NOTIFICATION_READ',
    notificationId: notification.id,
    title: notification.title,
    messageExcerpt: notification.message.slice(0, 100),
    currentStatus: notification.isRead ? 'Already Read' : 'Unread',
    sideEffect: 'This notification will be marked as read.',
    sideEffectAr: 'سيتم تحديث حالة الإشعار إلى مقروء.',
  };

  const expiresAt = new Date(Date.now() + PROPOSAL_EXPIRATION_MS);
  const conversationId = await resolveValidConversationId(options.conversationId);

  const proposal = await prisma.aIActionProposal.upsert({
    where: { idempotencyKey },
    create: {
      userId: actor.id,
      conversationId,
      sourceUserMessageId: options.sourceUserMessageId || null,
      idempotencyKey,
      actionType: 'MARK_NOTIFICATION_READ',
      normalizedPayload: normalizedPayload as any,
      payloadHash,
      humanReadableSummary,
      humanReadableSummaryAr,
      previewData: preview as any,
      status: 'PROPOSED',
      targetEntityId: String(notification.id),
      expiresAt,
    },
    update: {
      normalizedPayload: normalizedPayload as any,
      payloadHash,
      humanReadableSummary,
      humanReadableSummaryAr,
      previewData: preview as any,
      status: 'PROPOSED',
      failureCode: null,
      failureReason: null,
      expiresAt,
    },
  });

  auditLog('AI_ACTION_PROPOSED', 'AIActionProposal', proposal.id, {
    userId: actor.id,
    actionType: 'MARK_NOTIFICATION_READ',
    notificationId: notification.id,
  });

  return {
    proposalId: proposal.id,
    actionType: 'MARK_NOTIFICATION_READ',
    status: 'PROPOSED',
    humanReadableSummary,
    humanReadableSummaryAr,
    preview,
    requiresConfirmation: true,
    expiresAt: proposal.expiresAt.toISOString(),
  };
}

async function proposeCreateAnnouncement(
  actor: AuthActor,
  rawArgs: unknown,
  options: ProposalCreationOptions,
): Promise<ProposalResult> {
  const parsed = CreateAnnouncementActionSchema.safeParse(rawArgs);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i: any) => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new ValidationError(`Invalid announcement action parameters: ${errorMsg}`);
  }
  const payload = parsed.data;

  // Authorization check for administrative scope
  const scopes = getAdministrativeAnalyticsScopes(actor);
  if (!scopes) {
    throw new ForbiddenError('You do not have administrative authority to broadcast announcements.');
  }

  const role = (actor.role || '').toUpperCase();
  const adminRole = (actor.adminRole || '').toUpperCase();
  const isPlatformSuperAdmin = (role === 'SUPER_ADMIN' || (role === 'ADMIN' && adminRole === 'SUPER_ADMIN')) && scopes.cacheScope === 'global';

  // Target scope validation against user's administrative boundaries
  if (payload.targetScope === 'GLOBAL' && !isPlatformSuperAdmin) {
    throw new ForbiddenError('Only global platform administrators may broadcast university-wide announcements.');
  }

  let targetName = 'University-Wide (Global)';
  let targetNameAr = 'شامل للجامعة';
  let estimatedRecipients = 0;

  if (payload.targetScope === 'DEPARTMENT') {
    if (!payload.departmentId) {
      throw new ValidationError('departmentId is required when targetScope is DEPARTMENT.');
    }
    const dept = await prisma.department.findUnique({
      where: { id: payload.departmentId },
      select: { id: true, name: true, nameAr: true, collegeId: true },
    });
    if (!dept) {
      throw new NotFoundError(`Department ID ${payload.departmentId} was not found.`);
    }

    // Verify department is within admin's authorized scope
    if (!isPlatformSuperAdmin) {
      if (scopes.cacheScope.startsWith('department:')) {
        const managedDeptId = parseInt(scopes.cacheScope.split(':')[1], 10);
        if (managedDeptId !== dept.id) {
          throw new ForbiddenError(`Department ${dept.name} is outside your managed department scope.`);
        }
      } else if (scopes.cacheScope.startsWith('college:')) {
        const managedCollegeId = parseInt(scopes.cacheScope.split(':')[1], 10);
        if (dept.collegeId !== managedCollegeId) {
          throw new ForbiddenError(`Department ${dept.name} does not belong to your managed college.`);
        }
      }
    }

    targetName = `Department: ${dept.name}`;
    targetNameAr = `قسم: ${dept.nameAr || dept.name}`;
    estimatedRecipients = await prisma.user.count({
      where: { departmentId: dept.id, isActive: true },
    });
  } else if (payload.targetScope === 'COLLEGE') {
    if (!payload.collegeId) {
      throw new ValidationError('collegeId is required when targetScope is COLLEGE.');
    }
    const col = await prisma.college.findUnique({
      where: { id: payload.collegeId },
      select: { id: true, name: true, nameAr: true },
    });
    if (!col) {
      throw new NotFoundError(`College ID ${payload.collegeId} was not found.`);
    }

    if (!isPlatformSuperAdmin) {
      if (scopes.cacheScope.startsWith('college:')) {
        const managedCollegeId = parseInt(scopes.cacheScope.split(':')[1], 10);
        if (managedCollegeId !== col.id) {
          throw new ForbiddenError(`College ${col.name} is outside your managed college scope.`);
        }
      } else {
        throw new ForbiddenError('Department administrators cannot broadcast college-wide announcements.');
      }
    }

    targetName = `College: ${col.name}`;
    targetNameAr = `كلية: ${col.nameAr || col.name}`;
    estimatedRecipients = await prisma.user.count({
      where: { collegeId: col.id, isActive: true },
    });
  } else {
    estimatedRecipients = await prisma.user.count({
      where: { isActive: true },
    });
  }

  // Mass action safety guard
  if (estimatedRecipients > MAX_ANNOUNCEMENT_RECIPIENTS) {
    throw new ValidationError(
      `Announcement targets ${estimatedRecipients} users, exceeding the single AI action safety limit of ${MAX_ANNOUNCEMENT_RECIPIENTS} recipients. Please use dedicated admin broadcasting tools.`,
    );
  }

  const normalizedPayload: CreateAnnouncementPayload = {
    targetScope: payload.targetScope,
    collegeId: payload.collegeId,
    departmentId: payload.departmentId,
    title: payload.title,
    message: payload.message,
    type: payload.type || 'info',
  };

  const payloadHash = computePayloadHash(normalizedPayload as any);
  const idempotencyKey = computeIdempotencyKey(
    actor.id,
    options.conversationId,
    options.sourceUserMessageId,
    'CREATE_ANNOUNCEMENT',
    payloadHash,
  );

  const existing = await prisma.aIActionProposal.findUnique({
    where: { idempotencyKey },
  });

  if (existing && existing.status === 'PROPOSED' && existing.expiresAt > new Date()) {
    return {
      proposalId: existing.id,
      actionType: 'CREATE_ANNOUNCEMENT',
      status: 'PROPOSED',
      humanReadableSummary: existing.humanReadableSummary,
      humanReadableSummaryAr: existing.humanReadableSummaryAr || existing.humanReadableSummary,
      preview: existing.previewData as Record<string, unknown>,
      requiresConfirmation: true,
      expiresAt: existing.expiresAt.toISOString(),
      idempotentReplay: true,
    };
  }

  const humanReadableSummary = `Publish announcement "${payload.title}" to ${targetName} (${estimatedRecipients} recipients).`;
  const humanReadableSummaryAr = `نشر إعلان "${payload.title}" إلى ${targetNameAr} (${estimatedRecipients} مستلم).`;

  const preview = {
    actionType: 'CREATE_ANNOUNCEMENT',
    targetScope: payload.targetScope,
    targetName,
    title: payload.title,
    message: payload.message,
    type: payload.type || 'info',
    estimatedRecipientsCount: estimatedRecipients,
    sideEffect: `Immediate notification will be dispatched to ${estimatedRecipients} active user(s) in this scope.`,
    sideEffectAr: `سيتم إرسال إشعار فوري لـ ${estimatedRecipients} مستخدم نشط ضمن هذا النطاق.`,
  };

  const expiresAt = new Date(Date.now() + PROPOSAL_EXPIRATION_MS);
  const conversationId = await resolveValidConversationId(options.conversationId);

  const proposal = await prisma.aIActionProposal.upsert({
    where: { idempotencyKey },
    create: {
      userId: actor.id,
      conversationId,
      sourceUserMessageId: options.sourceUserMessageId || null,
      idempotencyKey,
      actionType: 'CREATE_ANNOUNCEMENT',
      normalizedPayload: normalizedPayload as any,
      payloadHash,
      humanReadableSummary,
      humanReadableSummaryAr,
      previewData: preview as any,
      status: 'PROPOSED',
      targetEntityId: payload.departmentId ? String(payload.departmentId) : payload.collegeId ? String(payload.collegeId) : 'GLOBAL',
      expiresAt,
    },
    update: {
      normalizedPayload: normalizedPayload as any,
      payloadHash,
      humanReadableSummary,
      humanReadableSummaryAr,
      previewData: preview as any,
      status: 'PROPOSED',
      failureCode: null,
      failureReason: null,
      expiresAt,
    },
  });

  auditLog('AI_ACTION_PROPOSED', 'AIActionProposal', proposal.id, {
    userId: actor.id,
    actionType: 'CREATE_ANNOUNCEMENT',
    targetScope: payload.targetScope,
    estimatedRecipients,
  });

  return {
    proposalId: proposal.id,
    actionType: 'CREATE_ANNOUNCEMENT',
    status: 'PROPOSED',
    humanReadableSummary,
    humanReadableSummaryAr,
    preview,
    requiresConfirmation: true,
    expiresAt: proposal.expiresAt.toISOString(),
  };
}

// ============================================================================
// 4. ACTION CONFIRMATION & EXACTLY-ONCE EXECUTION (SERVER-AUTHENTICATED ONLY)
// ============================================================================

export interface ExecutionSuccessResult {
  success: true;
  status: 'SUCCEEDED';
  alreadyExecuted?: boolean;
  actionType: SupportedActionType;
  proposalId: string;
  executionResult: Record<string, unknown>;
  executedAt: string;
  summary: string;
  summaryAr: string;
}

export async function confirmAndExecuteProposal(
  proposalId: string,
  actor: AuthActor,
): Promise<ExecutionSuccessResult> {
  const proposal = await prisma.aIActionProposal.findUnique({
    where: { id: proposalId },
  });

  // Strict IDOR isolation: Proposal must belong to current user
  if (!proposal || proposal.userId !== actor.id) {
    throw new NotFoundError('Action proposal was not found.');
  }

  // Idempotent return if already succeeded
  if (proposal.status === 'SUCCEEDED') {
    return {
      success: true,
      status: 'SUCCEEDED',
      alreadyExecuted: true,
      actionType: proposal.actionType as SupportedActionType,
      proposalId: proposal.id,
      executionResult: (proposal.executionResult as Record<string, unknown>) || {},
      executedAt: proposal.executedAt ? proposal.executedAt.toISOString() : new Date().toISOString(),
      summary: proposal.humanReadableSummary,
      summaryAr: proposal.humanReadableSummaryAr || proposal.humanReadableSummary,
    };
  }

  if (proposal.status === 'CANCELED') {
    throw new ValidationError('This action proposal was canceled and cannot be executed.');
  }

  if (proposal.status === 'STALE') {
    throw new ValidationError('This action proposal is stale due to university state changes and cannot be executed.');
  }

  if (proposal.status === 'EXPIRED' || proposal.expiresAt <= new Date()) {
    if (proposal.status !== 'EXPIRED') {
      await prisma.aIActionProposal.update({
        where: { id: proposal.id },
        data: { status: 'EXPIRED' },
      });
    }
    throw new ValidationError('This action proposal has expired. Please create a new action proposal.');
  }

  if (proposal.status === 'EXECUTING') {
    throw new ConflictError('Action proposal is currently executing.');
  }

  if (proposal.status !== 'PROPOSED') {
    throw new ValidationError(`Action proposal cannot be executed in "${proposal.status}" status.`);
  }

  // ==========================================================================
  // REVALIDATION AT EXECUTION TIME (Fresh DB State Check)
  // ==========================================================================
  const freshUser = await prisma.user.findUnique({
    where: { id: actor.id },
    include: { doctor: true, student: true },
  });
  if (!freshUser || !freshUser.isActive || freshUser.deactivatedAt) {
    await markProposalStale(proposal.id, 'USER_INACTIVE', 'User account is inactive or was deactivated.');
    throw new ForbiddenError('Your account is no longer active.');
  }

  const freshActor: AuthActor = {
    ...freshUser,
    doctor: freshUser.doctor
      ? {
          id: freshUser.doctor.id,
          firstName: freshUser.doctor.firstName,
          lastName: freshUser.doctor.lastName,
          doctorId: freshUser.doctor.doctorId,
          departmentId: freshUser.doctor.departmentId,
        }
      : null,
    student: freshUser.student
      ? {
          id: freshUser.student.id,
          firstName: freshUser.student.firstName,
          lastName: freshUser.student.lastName,
          studentId: freshUser.student.studentId,
          year: freshUser.student.year,
          departmentId: freshUser.student.departmentId,
        }
      : null,
  };

  // Type-specific revalidation
  if (proposal.actionType === 'CREATE_TASK') {
    const payload = proposal.normalizedPayload as CreateTaskPayload;
    const freshCourse = await prisma.course.findUnique({
      where: { id: payload.courseId },
      include: { department: true },
    });
    if (!freshCourse) {
      await markProposalStale(proposal.id, 'COURSE_NOT_FOUND', 'Target course no longer exists.');
      throw new ValidationError('The target course no longer exists. Proposal marked as stale.');
    }

    if (freshActor.role !== 'DOCTOR') {
      await markProposalStale(proposal.id, 'ROLE_INVALID', 'Only assigned course doctors can execute task creation.');
      throw new ForbiddenError('Only assigned course doctors can execute task creation.');
    }

    const doctor = await TaskScopeService.getDoctorOrThrow(freshActor.id);
    try {
      await TaskScopeService.ensureDoctorAssignedToCourse(doctor.id, freshCourse.id);
    } catch (err: any) {
      await markProposalStale(proposal.id, 'DOCTOR_UNASSIGNED', err.message);
      throw new ValidationError('You are no longer assigned to teach this course. Proposal marked as stale.');
    }

    // Verify deadline is still in the future
    const dueDate = new Date(payload.dueDate);
    if (dueDate.getTime() <= Date.now()) {
      await markProposalStale(proposal.id, 'DEADLINE_PASSED', 'The proposed deadline has already passed.');
      throw new ValidationError('The proposed deadline has already passed. Proposal marked as stale.');
    }
  } else if (proposal.actionType === 'MARK_NOTIFICATION_READ') {
    const payload = proposal.normalizedPayload as MarkNotificationReadPayload;
    const freshNotification = await prisma.notification.findFirst({
      where: { id: payload.notificationId, userId: freshActor.id },
    });
    if (!freshNotification) {
      await markProposalStale(proposal.id, 'NOTIFICATION_NOT_FOUND', 'Notification no longer exists.');
      throw new ValidationError('Notification no longer exists. Proposal marked as stale.');
    }
  } else if (proposal.actionType === 'CREATE_ANNOUNCEMENT') {
    const payload = proposal.normalizedPayload as CreateAnnouncementPayload;
    const freshScopes = getAdministrativeAnalyticsScopes(freshActor);
    if (!freshScopes) {
      await markProposalStale(proposal.id, 'SCOPE_REVOKED', 'Administrative permissions have changed.');
      throw new ForbiddenError('Administrative authority is no longer configured. Proposal marked as stale.');
    }

    if (payload.targetScope === 'GLOBAL' && freshScopes.cacheScope !== 'global') {
      await markProposalStale(proposal.id, 'GLOBAL_SCOPE_LOST', 'Global broadcast authority no longer exists.');
      throw new ForbiddenError('Global announcement authority is no longer available. Proposal marked as stale.');
    }

    if (payload.targetScope === 'COLLEGE' && payload.collegeId) {
      if (freshScopes.cacheScope !== 'global') {
        const managedColId = freshScopes.cacheScope.startsWith('college:')
          ? parseInt(freshScopes.cacheScope.split(':')[1], 10)
          : null;
        if (managedColId !== payload.collegeId) {
          await markProposalStale(proposal.id, 'COLLEGE_SCOPE_LOST', 'College is outside your current managed scope.');
          throw new ForbiddenError('Target college is outside your current managed scope. Proposal marked as stale.');
        }
      }
    } else if (payload.targetScope === 'DEPARTMENT' && payload.departmentId) {
      if (freshScopes.cacheScope !== 'global') {
        if (freshScopes.cacheScope.startsWith('department:')) {
          const managedDeptId = parseInt(freshScopes.cacheScope.split(':')[1], 10);
          if (managedDeptId !== payload.departmentId) {
            await markProposalStale(proposal.id, 'DEPARTMENT_SCOPE_LOST', 'Department is outside your current managed scope.');
            throw new ForbiddenError('Target department is outside your current managed scope. Proposal marked as stale.');
          }
        } else if (freshScopes.cacheScope.startsWith('college:')) {
          const managedColId = parseInt(freshScopes.cacheScope.split(':')[1], 10);
          const dept = await prisma.department.findUnique({
            where: { id: payload.departmentId },
            select: { collegeId: true },
          });
          if (!dept || dept.collegeId !== managedColId) {
            await markProposalStale(proposal.id, 'DEPARTMENT_NOT_IN_COLLEGE', 'Department does not belong to your managed college.');
            throw new ForbiddenError('Department is outside your managed college scope. Proposal marked as stale.');
          }
        } else {
          await markProposalStale(proposal.id, 'SCOPE_INVALID', 'Scope is no longer authorized.');
          throw new ForbiddenError('Administrative scope is no longer valid. Proposal marked as stale.');
        }
      }
    }
  }

  // ==========================================================================
  // ATOMIC DATABASE LOCK & BUSINESS TRANSACTION
  // All writes (state transition, business mutation, audit) commit atomically.
  // Any error or crash rolls back everything to prior confirmable state.
  // ==========================================================================
  try {
    return await prisma.$transaction(async (tx) => {
      // Atomic state transition & row lock: PROPOSED -> EXECUTING
      const lock = await tx.aIActionProposal.updateMany({
        where: {
          id: proposal.id,
          userId: actor.id,
          status: 'PROPOSED',
          expiresAt: { gt: new Date() },
        },
        data: {
          status: 'EXECUTING',
          confirmedAt: new Date(),
        },
      });

      if (lock.count === 0) {
        const current = await tx.aIActionProposal.findUnique({ where: { id: proposal.id } });
        if (current?.status === 'SUCCEEDED') {
          return {
            success: true,
            status: 'SUCCEEDED',
            alreadyExecuted: true,
            actionType: current.actionType as SupportedActionType,
            proposalId: current.id,
            executionResult: (current.executionResult as Record<string, unknown>) || {},
            executedAt: current.executedAt ? current.executedAt.toISOString() : new Date().toISOString(),
            summary: current.humanReadableSummary,
            summaryAr: current.humanReadableSummaryAr || current.humanReadableSummary,
          };
        }
        throw new ConflictError('Action proposal is already being executed or status was changed concurrently.');
      }

      let executionResult: Record<string, unknown> = {};
      let targetEntityId: string | undefined;

      if (proposal.actionType === 'CREATE_TASK') {
        const payload = proposal.normalizedPayload as CreateTaskPayload;
        // Delegate to canonical business service inside the SAME transaction
        const task = await TaskService.createTask(
          freshActor,
          {
            title: payload.title,
            description: payload.description || '',
            courseId: payload.courseId,
            dueDate: new Date(payload.dueDate),
            maxScore: payload.maxScore || 100,
          },
          tx,
        );

        targetEntityId = String(task.id);
        executionResult = {
          actionType: 'CREATE_TASK',
          taskId: task.id,
          courseId: task.courseId,
          title: task.title,
          dueDate: task.dueDate.toISOString(),
          summary: `Task "${task.title}" created successfully.`,
          summaryAr: `تم إنشاء التكليف "${task.title}" بنجاح.`,
        };
      } else if (proposal.actionType === 'MARK_NOTIFICATION_READ') {
        const payload = proposal.normalizedPayload as MarkNotificationReadPayload;
        const updatedNotification = await tx.notification.update({
          where: { id: payload.notificationId },
          data: { isRead: true },
        });

        targetEntityId = String(updatedNotification.id);
        executionResult = {
          actionType: 'MARK_NOTIFICATION_READ',
          notificationId: updatedNotification.id,
          isRead: true,
          summary: 'Notification marked as read successfully.',
          summaryAr: 'تم تحديد الإشعار كمقروء بنجاح.',
        };
      } else if (proposal.actionType === 'CREATE_ANNOUNCEMENT') {
        const payload = proposal.normalizedPayload as CreateAnnouncementPayload;
        let targetUserIds: number[] = [];

        if (payload.targetScope === 'DEPARTMENT' && payload.departmentId) {
          const users = await tx.user.findMany({
            where: { departmentId: payload.departmentId, isActive: true },
            select: { id: true },
            take: MAX_ANNOUNCEMENT_RECIPIENTS,
          });
          targetUserIds = users.map((u) => u.id);
        } else if (payload.targetScope === 'COLLEGE' && payload.collegeId) {
          const users = await tx.user.findMany({
            where: { collegeId: payload.collegeId, isActive: true },
            select: { id: true },
            take: MAX_ANNOUNCEMENT_RECIPIENTS,
          });
          targetUserIds = users.map((u) => u.id);
        } else {
          const users = await tx.user.findMany({
            where: { isActive: true },
            select: { id: true },
            take: MAX_ANNOUNCEMENT_RECIPIENTS,
          });
          targetUserIds = users.map((u) => u.id);
        }

        if (targetUserIds.length > 0) {
          await tx.notification.createMany({
            data: targetUserIds.map((uId) => ({
              userId: uId,
              title: payload.title,
              message: payload.message,
              type: payload.type || 'info',
            })),
          });
        }

        targetEntityId = payload.departmentId ? String(payload.departmentId) : payload.collegeId ? String(payload.collegeId) : 'GLOBAL';
        executionResult = {
          actionType: 'CREATE_ANNOUNCEMENT',
          targetScope: payload.targetScope,
          sentCount: targetUserIds.length,
          title: payload.title,
          summary: `Announcement broadcast to ${targetUserIds.length} users successfully.`,
          summaryAr: `تم بث الإعلان إلى ${targetUserIds.length} مستخدم بنجاح.`,
        };
      } else {
        throw new Error(`Unhandled action type: ${proposal.actionType}`);
      }

      // Transition to SUCCEEDED with durable executionResult in the SAME transaction
      const completedProposal = await tx.aIActionProposal.update({
        where: { id: proposal.id },
        data: {
          status: 'SUCCEEDED',
          executedAt: new Date(),
          executionResult: executionResult as any,
          targetEntityId,
        },
      });

      // Record AI_ACTION_EXECUTED in the EXACT SAME transaction
      await auditLog(
        'AI_ACTION_EXECUTED',
        'AIActionProposal',
        proposal.id,
        { userId: actor.id },
        { actionType: proposal.actionType, targetEntityId, executionResult },
        tx,
      );

      return {
        success: true,
        status: 'SUCCEEDED',
        actionType: completedProposal.actionType as SupportedActionType,
        proposalId: completedProposal.id,
        executionResult,
        executedAt: completedProposal.executedAt!.toISOString(),
        summary: completedProposal.humanReadableSummary,
        summaryAr: completedProposal.humanReadableSummaryAr || completedProposal.humanReadableSummary,
      };
    });
  } catch (err: any) {
    if (
      err instanceof ConflictError ||
      err instanceof NotFoundError ||
      err instanceof ValidationError ||
      err instanceof ForbiddenError
    ) {
      throw err;
    }
    try {
      await auditLog(
        'AI_ACTION_FAILED',
        'AIActionProposal',
        proposal.id,
        { userId: actor.id },
        { actionType: proposal.actionType, error: err.message },
      );
    } catch {
      // Best-effort audit logging
    }
    throw err;
  }
}

// ============================================================================
// 5. ACTION CANCELLATION
// ============================================================================

export async function cancelProposal(
  proposalId: string,
  actor: AuthActor,
): Promise<{ success: boolean; status: 'CANCELED'; message: string }> {
  const proposal = await prisma.aIActionProposal.findUnique({
    where: { id: proposalId },
  });

  if (!proposal || proposal.userId !== actor.id) {
    throw new NotFoundError('Action proposal was not found.');
  }

  if (proposal.status === 'SUCCEEDED') {
    throw new ValidationError('Cannot cancel an action that has already succeeded.');
  }

  if (proposal.status === 'EXECUTING') {
    throw new ConflictError('Cannot cancel an action that is currently executing.');
  }

  if (proposal.status === 'CANCELED') {
    return { success: true, status: 'CANCELED', message: 'Action proposal was already canceled.' };
  }

  await prisma.aIActionProposal.update({
    where: { id: proposalId },
    data: {
      status: 'CANCELED',
      canceledAt: new Date(),
    },
  });

  auditLog('AI_ACTION_CANCELED', 'AIActionProposal', proposal.id, {
    userId: actor.id,
    actionType: proposal.actionType,
  });

  return {
    success: true,
    status: 'CANCELED',
    message: 'Action proposal has been canceled.',
  };
}

// ============================================================================
// 6. ACTION PROPOSAL RETRIEVAL (IDOR PROTECTED)
// ============================================================================

export async function getProposalById(proposalId: string, actor: AuthActor) {
  const proposal = await prisma.aIActionProposal.findUnique({
    where: { id: proposalId },
  });

  if (!proposal || proposal.userId !== actor.id) {
    throw new NotFoundError('Action proposal was not found.');
  }

  // Automatic expiration update on fetch
  if (proposal.status === 'PROPOSED' && proposal.expiresAt <= new Date()) {
    return await prisma.aIActionProposal.update({
      where: { id: proposalId },
      data: { status: 'EXPIRED' },
    });
  }

  return proposal;
}

// Helper: mark proposal STALE
async function markProposalStale(proposalId: string, failureCode: string, failureReason: string) {
  try {
    await prisma.aIActionProposal.update({
      where: { id: proposalId },
      data: {
        status: 'STALE',
        failureCode,
        failureReason,
      },
    });
    auditLog('AI_ACTION_STALE', 'AIActionProposal', proposalId, {
      failureCode,
      failureReason,
    });
  } catch (err: any) {
    logger.warn('[AIAction] Failed to mark proposal stale', { proposalId, error: err.message });
  }
}
