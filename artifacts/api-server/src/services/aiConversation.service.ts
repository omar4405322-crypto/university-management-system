import prisma from '../utils/prismaClient';
import { AppError } from '../utils/appError';
import type { AuthActor } from '../types/auth.types';
import { generateAiReply, generateAiReplyDetailed, type HistoryMessage } from './ai.service';
import type { AiProviderClient } from './aiProvider.service';
import { executeAiTool } from './aiTools.service';
import { getBoundedAttachmentContext, type AttachmentReference } from './aiAttachment.service';
import { getAiAttachmentStorage } from './aiAttachmentStorage.service';
import {
  recordQuickActionUsage,
  resolveActionKeyFromPrompt,
  resolveActionKeyFromTool,
} from './aiQuickAction.service';
import logger from '../utils/logger';

export const MAX_HISTORY_MESSAGES = 10;
export const MAX_HISTORY_CHARACTERS = 8000;
export const MAX_TITLE_LENGTH = 60;
export const MAX_SEARCH_LENGTH = 100;

export function deriveConversationTitle(message?: string): string {
  if (!message) return 'New Conversation';
  const clean = message.trim().replace(/\s+/g, ' ');
  if (!clean) return 'New Conversation';
  return clean.length > 40 ? clean.slice(0, 37) + '...' : clean;
}

export interface ListConversationsOptions {
  search?: string;
  isArchived?: boolean;
  page?: number;
  limit?: number;
}

export async function listConversations(userId: number, options: ListConversationsOptions = {}) {
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(options.limit) || 20));
  const skip = (page - 1) * limit;

  const where: any = { userId };

  if (options.isArchived) {
    where.archivedAt = { not: null };
  } else {
    where.archivedAt = null;
  }

  if (options.search?.trim()) {
    const sanitized = options.search.trim().slice(0, MAX_SEARCH_LENGTH);
    where.OR = [
      { title: { contains: sanitized, mode: 'insensitive' } },
      { messages: { some: { content: { contains: sanitized, mode: 'insensitive' } } } },
    ];
  }

  const [total, conversations] = await Promise.all([
    prisma.aIConversation.count({ where }),
    prisma.aIConversation.findMany({
      where,
      orderBy: options.isArchived
        ? { updatedAt: 'desc' }
        : [{ pinnedAt: { sort: 'desc', nulls: 'last' } }, { updatedAt: 'desc' }],
      skip,
      take: limit,
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        archivedAt: true,
        pinnedAt: true,
        _count: {
          select: { messages: true },
        },
        messages: {
          take: 1,
          orderBy: { sequence: 'desc' },
          select: {
            content: true,
            role: true,
            createdAt: true,
          },
        },
      },
    }),
  ]);

  const items = conversations.map((conv) => {
    const lastMsg = conv.messages[0];
    return {
      id: conv.id,
      title: conv.title,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      archivedAt: conv.archivedAt,
      pinnedAt: conv.pinnedAt,
      isPinned: Boolean(conv.pinnedAt),
      messageCount: conv._count.messages,
      lastMessagePreview: lastMsg ? lastMsg.content.slice(0, 100) : null,
      lastMessageRole: lastMsg?.role ?? null,
      lastMessageAt: lastMsg?.createdAt ?? conv.updatedAt,
    };
  });

  return {
    conversations: items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function getConversation(userId: number, conversationId: string) {
  const conversation = await prisma.aIConversation.findFirst({
    where: { id: conversationId, userId },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      archivedAt: true,
      pinnedAt: true,
      attachments: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          originalFilename: true,
          mimeType: true,
          byteSize: true,
          processingStatus: true,
          pageCount: true,
          createdAt: true,
        },
      },
      actionProposals: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          actionType: true,
          status: true,
          humanReadableSummary: true,
          humanReadableSummaryAr: true,
          previewData: true,
          expiresAt: true,
          confirmedAt: true,
          executedAt: true,
          canceledAt: true,
          failureCode: true,
          failureReason: true,
          executionResult: true,
          sourceUserMessageId: true,
          createdAt: true,
        },
      },
      messages: {
        orderBy: { sequence: 'asc' },
        select: {
          id: true,
          role: true,
          content: true,
          sequence: true,
          createdAt: true,
          attachments: {
            select: {
              id: true,
              originalFilename: true,
              mimeType: true,
              byteSize: true,
              pageCount: true,
            },
          },
          citations: {
            select: {
              id: true,
              documentTitle: true,
              documentTitleAr: true,
              version: true,
              pageNumber: true,
              sectionTitle: true,
              articleNumber: true,
              quote: true,
              documentVersionId: true,
              chunkId: true,
            },
          },
        },
      },
    },
  });

  if (!conversation) {
    throw new AppError('Conversation not found', 404);
  }

  const now = new Date();
  const mappedProposals = conversation.actionProposals.map((p) => {
    if (p.status === 'PROPOSED' && p.expiresAt <= now) {
      return { ...p, status: 'EXPIRED' as const };
    }
    return p;
  });

  return {
    ...conversation,
    isPinned: Boolean(conversation.pinnedAt),
    actionProposals: mappedProposals,
  };
}

export interface ConversationMessageOptions {
  signal?: AbortSignal;
  delayFn?: (ms: number) => Promise<void>;
  attachmentIds?: string[];
  streaming?: {
    onMeta?: (meta: { conversationId: string; userMessageId: string; sequence: number }) => void;
    onStatus?: (status: { phase: 'thinking' | 'tools' | 'answering'; message?: string }) => void;
    onDelta?: (delta: string) => void;
    onCitation?: (citation: unknown) => void;
    onAction?: (actionProposal: unknown) => void;
  };
}

export async function createConversation(
  userId: number,
  options: {
    title?: string;
    initialMessage?: string;
    actor?: AuthActor;
    client?: AiProviderClient;
    runTool?: typeof executeAiTool;
    attachmentIds?: string[];
    signal?: AbortSignal;
    delayFn?: (ms: number) => Promise<void>;
    streaming?: ConversationMessageOptions['streaming'];
  } = {}
) {
  const title = (options.title?.trim() || deriveConversationTitle(options.initialMessage)).slice(0, MAX_TITLE_LENGTH);

  const conversation = await prisma.aIConversation.create({
    data: {
      userId,
      title,
    },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      archivedAt: true,
      pinnedAt: true,
    },
  });

  logger.info('[AI] conversation created', {
    userId,
    conversationId: conversation.id,
  });

  if (options.initialMessage?.trim()) {
    const replyResult = await addMessageToConversation(
      userId,
      conversation.id,
      options.initialMessage.trim(),
      options.actor,
      options.client,
      options.runTool,
      {
        signal: options.signal,
        delayFn: options.delayFn,
        attachmentIds: options.attachmentIds,
        streaming: options.streaming,
      },
    );
    return {
      conversation: {
        ...conversation,
        isPinned: Boolean(conversation.pinnedAt),
      },
      userMessage: replyResult.userMessage,
      assistantMessage: replyResult.assistantMessage,
      reply: replyResult.reply,
      citations: replyResult.citations,
      actionProposals: replyResult.actionProposals || [],
      attachmentReferences: replyResult.attachmentReferences || [],
    };
  }

  return {
    conversation: {
      ...conversation,
      isPinned: Boolean(conversation.pinnedAt),
    },
  };
}

export async function updateConversation(
  userId: number,
  conversationId: string,
  updates: { title?: string; isArchived?: boolean; isPinned?: boolean }
) {
  const existing = await prisma.aIConversation.findFirst({
    where: { id: conversationId, userId },
  });

  if (!existing) {
    throw new AppError('Conversation not found', 404);
  }

  const data: any = {};
  if (typeof updates.title === 'string') {
    const trimmed = updates.title.trim();
    if (!trimmed) throw new AppError('Conversation title cannot be empty', 400);
    data.title = trimmed.slice(0, MAX_TITLE_LENGTH);
  }

  if (typeof updates.isArchived === 'boolean') {
    data.archivedAt = updates.isArchived ? new Date() : null;
    if (updates.isArchived) {
      // Invariant: ARCHIVED conversation => pinnedAt = null
      data.pinnedAt = null;
    }
  }

  if (typeof updates.isPinned === 'boolean') {
    if (existing.archivedAt && !updates.isArchived && updates.isPinned) {
      throw new AppError('Cannot pin an archived conversation', 400);
    }
    // Only set if not archiving in the same update (archiving clears pin)
    if (!updates.isArchived) {
      data.pinnedAt = updates.isPinned ? new Date() : null;
    }
  }

  const updated = await prisma.aIConversation.update({
    where: { id: conversationId },
    data,
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      archivedAt: true,
      pinnedAt: true,
    },
  });

  logger.info('[AI] conversation updated', {
    userId,
    conversationId,
    archived: Boolean(updated.archivedAt),
    pinned: Boolean(updated.pinnedAt),
  });

  return {
    ...updated,
    isPinned: Boolean(updated.pinnedAt),
  };
}

export async function deleteConversation(userId: number, conversationId: string) {
  const existing = await prisma.aIConversation.findFirst({
    where: { id: conversationId, userId },
    include: { attachments: { select: { id: true, storageKey: true } } },
  });

  if (!existing) {
    throw new AppError('Conversation not found', 404);
  }

  const attachmentsToClean = existing.attachments || [];

  await prisma.aIConversation.delete({
    where: { id: conversationId },
  });

  if (attachmentsToClean.length > 0) {
    const storage = getAiAttachmentStorage();
    for (const att of attachmentsToClean) {
      try {
        const remaining = await prisma.aIConversationAttachment.count({
          where: { storageKey: att.storageKey },
        });
        if (remaining === 0) {
          await storage.delete(att.storageKey).catch(() => {});
        }
      } catch {
        // Safe fail-through on file deletion
      }
    }
  }

  logger.info('[AI] conversation deleted', {
    userId,
    conversationId,
  });

  return { success: true };
}

export async function addMessageToConversation(
  userId: number,
  conversationId: string,
  message: string,
  actor?: AuthActor,
  client?: AiProviderClient,
  runTool: typeof executeAiTool = executeAiTool,
  conversationOptions?: ConversationMessageOptions,
) {
  const trimmed = message.trim();
  if (!trimmed) throw new AppError('Message cannot be empty', 400);

  const conversation = await prisma.aIConversation.findFirst({
    where: { id: conversationId, userId },
  });

  if (!conversation) {
    throw new AppError('Conversation not found', 404);
  }

  if (conversation.archivedAt) {
    throw new AppError('Cannot send messages to an archived conversation', 400);
  }

  const lastMessage = await prisma.aIMessage.findFirst({
    where: { conversationId },
    orderBy: { sequence: 'desc' },
  });

  let userMessage: {
    id: string;
    role: 'USER' | 'ASSISTANT';
    content: string;
    sequence: number;
    createdAt: Date;
  };
  let userSeq: number;

  if (lastMessage && lastMessage.role === 'USER') {
    // Previous turn was a user message that never received an assistant reply
    // (e.g. transient provider failure). Safe retry reuses or updates this turn
    // without creating orphaned duplicate user messages or 409 collisions.
    if (lastMessage.content !== trimmed) {
      userMessage = await prisma.aIMessage.update({
        where: { id: lastMessage.id },
        data: { content: trimmed, createdAt: new Date() },
        select: {
          id: true,
          role: true,
          content: true,
          sequence: true,
          createdAt: true,
        },
      });
    } else {
      userMessage = lastMessage;
    }
    userSeq = userMessage.sequence;
  } else {
    // Normal new turn: verify 2000ms double-click duplicate guard against last answered user turn
    const lastUserMessage = await prisma.aIMessage.findFirst({
      where: { conversationId, role: 'USER' },
      orderBy: { sequence: 'desc' },
    });

    if (
      lastUserMessage &&
      lastUserMessage.content === trimmed &&
      Date.now() - new Date(lastUserMessage.createdAt).getTime() < 2000
    ) {
      throw new AppError('Duplicate message detected. Please wait before submitting again.', 409);
    }

    userSeq = (lastMessage?.sequence ?? 0) + 1;

    userMessage = await prisma.aIMessage.create({
      data: {
        conversationId,
        role: 'USER',
        content: trimmed,
        sequence: userSeq,
      },
      select: {
        id: true,
        role: true,
        content: true,
        sequence: true,
        createdAt: true,
      },
    });
  }

  // Bounded context retrieval: fetch most recent N messages prior to the current user turn
  const rawHistory = await prisma.aIMessage.findMany({
    where: {
      conversationId,
      id: { not: userMessage.id },
    },
    orderBy: { sequence: 'desc' },
    take: MAX_HISTORY_MESSAGES,
    select: {
      role: true,
      content: true,
      sequence: true,
    },
  });

  // Re-order ascending
  rawHistory.reverse();

  // Apply character budget
  const historyMessages: HistoryMessage[] = [];
  let charCount = 0;
  // Iterate backwards (newest first) to preserve the most recent context within budget
  const candidates: HistoryMessage[] = [];
  for (let i = rawHistory.length - 1; i >= 0; i--) {
    const item = rawHistory[i];
    if (charCount + item.content.length > MAX_HISTORY_CHARACTERS && candidates.length > 0) {
      break;
    }
    charCount += item.content.length;
    candidates.unshift({
      role: item.role === 'USER' ? 'user' : 'assistant',
      content: item.content,
    });
  }
  historyMessages.push(...candidates);

  // Link user attachments if provided
  let attachmentReferences: AttachmentReference[] = [];
  let attachmentContextPrompt = '';

  if (conversationOptions?.attachmentIds && conversationOptions.attachmentIds.length > 0) {
    await prisma.aIConversationAttachment.updateMany({
      where: {
        id: { in: conversationOptions.attachmentIds },
        userId,
        conversationId,
      },
      data: { messageId: userMessage.id },
    });

    const attContext = await getBoundedAttachmentContext(
      conversationOptions.attachmentIds,
      userId,
      conversationId,
    );
    attachmentContextPrompt = attContext.contextPrompt;
    attachmentReferences = attContext.references;
  }

  // Emit SSE meta event as early as user turn is committed
  conversationOptions?.streaming?.onMeta?.({
    conversationId,
    userMessageId: userMessage.id,
    sequence: userSeq,
  });

  try {
    const effectivePrompt = attachmentContextPrompt
      ? `${trimmed}\n\n${attachmentContextPrompt}`
      : trimmed;

    // Generate AI assistant reply with bounded multi-turn context
    const detailedReply = await generateAiReplyDetailed(
      effectivePrompt,
      client,
      actor,
      runTool,
      historyMessages,
      {
        signal: conversationOptions?.signal,
        delayFn: conversationOptions?.delayFn,
        onDelta: conversationOptions?.streaming?.onDelta,
        onStatus: (phase: 'thinking' | 'tools' | 'answering', msg?: string) =>
          conversationOptions?.streaming?.onStatus?.({ phase, message: msg }),
        onCitation: (c: unknown) => conversationOptions?.streaming?.onCitation?.(c),
        toolContext: {
          conversationId,
          sourceUserMessageId: userMessage.id,
        },
      } as any,
    );
    const reply = detailedReply.reply;

    // Persist assistant message
    const assistantMessage = await prisma.aIMessage.create({
      data: {
        conversationId,
        role: 'ASSISTANT',
        content: reply,
        sequence: userSeq + 1,
      },
      select: {
        id: true,
        role: true,
        content: true,
        sequence: true,
        createdAt: true,
      },
    });

    // Persist citations if any
    let savedCitations: any[] = [];
    if (detailedReply.citations && detailedReply.citations.length > 0) {
      await prisma.aIMessageCitation.createMany({
        data: detailedReply.citations.map((c) => ({
          messageId: assistantMessage.id,
          documentVersionId: c.documentVersionId,
          chunkId: c.chunkId || null,
          documentTitle: c.documentTitle,
          documentTitleAr: c.documentTitleAr || null,
          version: c.version || null,
          pageNumber: c.pageNumber || null,
          sectionTitle: c.sectionTitle || null,
          articleNumber: c.articleNumber || null,
          quote: c.quote || null,
        })),
      });

      savedCitations = await prisma.aIMessageCitation.findMany({
        where: { messageId: assistantMessage.id },
        select: {
          id: true,
          documentTitle: true,
          documentTitleAr: true,
          version: true,
          pageNumber: true,
          sectionTitle: true,
          articleNumber: true,
          quote: true,
          documentVersionId: true,
          chunkId: true,
        },
      });
    }

    // Touch conversation updatedAt
    await prisma.aIConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Record canonical quick action usage once for this user turn
    const canonicalKeyFromTool = detailedReply.invokedTools?.[0]
      ? resolveActionKeyFromTool(detailedReply.invokedTools[0])
      : null;
    const resolvedActionKey =
      canonicalKeyFromTool ?? resolveActionKeyFromPrompt(trimmed, actor);

    if (resolvedActionKey) {
      await recordQuickActionUsage(userId, resolvedActionKey);
    }

    // Fetch any action proposals created during this turn
    const turnProposals = await prisma.aIActionProposal.findMany({
      where: {
        conversationId,
        sourceUserMessageId: userMessage.id,
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        actionType: true,
        status: true,
        humanReadableSummary: true,
        humanReadableSummaryAr: true,
        previewData: true,
        expiresAt: true,
        confirmedAt: true,
        executedAt: true,
        canceledAt: true,
        failureCode: true,
        failureReason: true,
        executionResult: true,
        sourceUserMessageId: true,
        createdAt: true,
      },
    });

    if (conversationOptions?.streaming?.onAction) {
      for (const proposal of turnProposals) {
        conversationOptions.streaming.onAction(proposal);
      }
    }

    return {
      reply,
      userMessage,
      assistantMessage: {
        ...assistantMessage,
        citations: savedCitations,
      },
      citations: savedCitations,
      actionProposals: turnProposals,
      attachmentReferences,
    };
  } catch (err) {
    // If AI provider call fails or is aborted, user message remains persisted so draft/history is not lost,
    // but NO fake assistant answer is stored.
    logger.warn('[AI] message reply failed', {
      userId,
      conversationId,
      userMessageId: userMessage.id,
    });
    throw err;
  }
}
