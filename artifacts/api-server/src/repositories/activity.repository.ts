import prisma from '../utils/prismaClient';
import { TimelineQuery } from '../types/timelineQuery';
import {
  ActivityEntityType,
  ActivityEventType,
  EventVisibility,
  EventSeverity,
  Prisma,
} from '@prisma/client';

export interface CreateActivityEventData {
  entityType: ActivityEntityType;
  entityId: number;
  courseId: number;
  eventType: ActivityEventType;
  severity?: EventSeverity;
  visibility?: EventVisibility;
  actorId?: number | null;
  actorRole?: string;
  title: string;
  summary: string;
  diffPayload?: Record<string, any> | null;
  relatedVersionId?: number | null;
  relatedAttachmentId?: number | null;
  relatedCommentId?: number | null;
}

export class ActivityRepository {
  static async create(data: CreateActivityEventData) {
    return await prisma.activityTimelineEvent.create({
      data: {
        entityType: data.entityType,
        entityId: data.entityId,
        courseId: data.courseId,
        eventType: data.eventType,
        severity: data.severity ?? EventSeverity.INFO,
        visibility: data.visibility ?? EventVisibility.STUDENTS,
        actorId: data.actorId ?? null,
        actorRole: data.actorRole ?? 'SYSTEM',
        title: data.title,
        summary: data.summary,
        diffPayload: data.diffPayload
          ? (data.diffPayload as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        relatedVersionId: data.relatedVersionId ?? null,
        relatedAttachmentId: data.relatedAttachmentId ?? null,
        relatedCommentId: data.relatedCommentId ?? null,
      },
    });
  }

  static async findByQuery(query: TimelineQuery) {
    const where: any = {
      entityType: query.entityType,
      entityId: query.entityId,
    };

    if (query.visibilityFilter.length > 0) {
      where.visibility = { in: query.visibilityFilter };
    }

    if (query.eventType) {
      where.eventType = query.eventType;
    }

    if (query.severity) {
      where.severity = query.severity;
    }

    // Future-proof cursor pagination logic supporting composite cursors (createdAt + id)
    if (query.cursorCreatedAt && query.cursorId) {
      where.OR = [
        { createdAt: { lt: query.cursorCreatedAt } },
        { createdAt: query.cursorCreatedAt, id: { lt: query.cursorId } },
      ];
    } else if (query.cursorId) {
      where.id = { lt: query.cursorId };
    }

    const items = await prisma.activityTimelineEvent.findMany({
      where,
      take: query.limit + 1,
      orderBy: [{ id: 'desc' }],
      include: {
        actor: {
          select: {
            id: true,
            email: true,
            role: true,
            doctor: { select: { firstName: true, lastName: true } },
            student: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    let hasMore = false;
    let nextCursor: number | null = null;

    if (items.length > query.limit) {
      hasMore = true;
      items.pop();
      nextCursor = items[items.length - 1]?.id ?? null;
    }

    const result: any = items;
    result.events = items;
    result.hasMore = hasMore;
    result.nextCursor = nextCursor;
    result.limit = query.limit;

    return result;
  }

  /**
   * Facade for backward-compatibility with direct entity query invocations
   */
  static async findByEntity(
    entityType: ActivityEntityType,
    entityId: number,
    options?: {
      cursorId?: number;
      limit?: number;
      visibilityFilter?: EventVisibility[];
      eventType?: ActivityEventType;
      severity?: EventSeverity;
    }
  ) {
    const query = new TimelineQuery({
      entityType,
      entityId,
      cursorId: options?.cursorId,
      limit: options?.limit,
      visibilityFilter: options?.visibilityFilter,
      eventType: options?.eventType,
      severity: options?.severity,
    });
    return ActivityRepository.findByQuery(query);
  }

  static async findByCourse(courseId: number, query: TimelineQuery) {
    const where: any = {
      courseId,
    };

    if (query.visibilityFilter.length > 0) {
      where.visibility = { in: query.visibilityFilter };
    }

    if (query.eventType) {
      where.eventType = query.eventType;
    }

    if (query.severity) {
      where.severity = query.severity;
    }

    if (query.cursorCreatedAt && query.cursorId) {
      where.OR = [
        { createdAt: { lt: query.cursorCreatedAt } },
        { createdAt: query.cursorCreatedAt, id: { lt: query.cursorId } },
      ];
    } else if (query.cursorId) {
      where.id = { lt: query.cursorId };
    }

    const items = await prisma.activityTimelineEvent.findMany({
      where,
      take: query.limit + 1,
      orderBy: [{ id: 'desc' }],
      include: {
        actor: {
          select: {
            id: true,
            email: true,
            role: true,
            doctor: { select: { firstName: true, lastName: true } },
            student: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    let hasMore = false;
    let nextCursor: number | null = null;

    if (items.length > query.limit) {
      hasMore = true;
      items.pop();
      nextCursor = items[items.length - 1]?.id ?? null;
    }

    const result: any = items;
    result.events = items;
    result.hasMore = hasMore;
    result.nextCursor = nextCursor;
    result.limit = query.limit;

    return result;
  }
}
