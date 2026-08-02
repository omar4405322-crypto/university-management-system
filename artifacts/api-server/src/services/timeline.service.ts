import prisma from '../utils/prismaClient';
import { NotFoundError } from '../utils/appError';
import { IEventDispatcher } from '../dispatchers/eventDispatcher.interface';
import { LocalEventDispatcher } from '../dispatchers/localEventDispatcher';
import { ActivityRepository, CreateActivityEventData } from '../repositories/activity.repository';
import { serializeTimelineEvent } from '../serializers/timeline.serializer';
import { TimelineQuery } from '../types/timelineQuery';
import {
  ActivityEntityType,
  ActivityEventType,
  EventVisibility,
  EventSeverity,
} from '@prisma/client';

export class TimelineService {
  private static dispatcher: IEventDispatcher = new LocalEventDispatcher();

  /**
   * Set a custom event dispatcher (e.g. for testing mocks or queue dispatchers)
   */
  static setDispatcher(dispatcher: IEventDispatcher): void {
    TimelineService.dispatcher = dispatcher;
  }

  /**
   * Retrieve the active event dispatcher
   */
  static getDispatcher(): IEventDispatcher {
    return TimelineService.dispatcher;
  }

  /**
   * High-level service method to record an administrative activity event
   */
  static async recordEvent(eventData: CreateActivityEventData): Promise<void> {
    await TimelineService.dispatcher.dispatch(eventData);
  }

  /**
   * Record Assignment Created event
   */
  static async recordAssignmentCreated(
    task: { id: number; courseId: number; title: string },
    actorUser?: { id: number; role?: string }
  ): Promise<void> {
    await TimelineService.recordEvent({
      entityType: ActivityEntityType.TASK,
      entityId: task.id,
      courseId: task.courseId,
      eventType: ActivityEventType.ASSIGNMENT_CREATED,
      severity: EventSeverity.INFO,
      visibility: EventVisibility.STUDENTS,
      actorId: actorUser?.id ?? null,
      actorRole: actorUser?.role ?? 'SYSTEM',
      title: 'Assignment Created',
      summary: `Assignment "${task.title}" was created.`,
    });
  }

  /**
   * Record Deadline Extended event
   */
  static async recordDeadlineExtended(
    task: { id: number; courseId: number; title: string },
    previousDueDate: Date | string,
    newDueDate: Date | string,
    actorUser?: { id: number; role?: string }
  ): Promise<void> {
    const formattedPrev = new Date(previousDueDate).toISOString();
    const formattedNew = new Date(newDueDate).toISOString();

    await TimelineService.recordEvent({
      entityType: ActivityEntityType.TASK,
      entityId: task.id,
      courseId: task.courseId,
      eventType: ActivityEventType.DEADLINE_EXTENDED,
      severity: EventSeverity.IMPORTANT,
      visibility: EventVisibility.STUDENTS,
      actorId: actorUser?.id ?? null,
      actorRole: actorUser?.role ?? 'SYSTEM',
      title: 'Deadline Extended',
      summary: `Deadline extended from ${formattedPrev} to ${formattedNew}.`,
      diffPayload: {
        previousDueDate: formattedPrev,
        newDueDate: formattedNew,
      },
    });
  }

  /**
   * Record Portal Closed event
   */
  static async recordPortalClosed(
    task: { id: number; courseId: number; title: string },
    actorUser?: { id: number; role?: string }
  ): Promise<void> {
    await TimelineService.recordEvent({
      entityType: ActivityEntityType.TASK,
      entityId: task.id,
      courseId: task.courseId,
      eventType: ActivityEventType.PORTAL_CLOSED,
      severity: EventSeverity.WARNING,
      visibility: EventVisibility.STUDENTS,
      actorId: actorUser?.id ?? null,
      actorRole: actorUser?.role ?? 'SYSTEM',
      title: 'Portal Closed',
      summary: `Submission portal for "${task.title}" was manually closed.`,
    });
  }

  /**
   * Record Portal Reopened event
   */
  static async recordPortalReopened(
    task: { id: number; courseId: number; title: string },
    actorUser?: { id: number; role?: string }
  ): Promise<void> {
    await TimelineService.recordEvent({
      entityType: ActivityEntityType.TASK,
      entityId: task.id,
      courseId: task.courseId,
      eventType: ActivityEventType.PORTAL_OPENED,
      severity: EventSeverity.INFO,
      visibility: EventVisibility.STUDENTS,
      actorId: actorUser?.id ?? null,
      actorRole: actorUser?.role ?? 'SYSTEM',
      title: 'Portal Reopened',
      summary: `Submission portal for "${task.title}" was reopened.`,
    });
  }

  /**
   * Retrieve timeline feed for a task with visibility filtering, cursor pagination, and filters
   */
  static async getTaskTimeline(
    user: any,
    taskId: number,
    options?: {
      cursorId?: number;
      cursorCreatedAt?: Date;
      limit?: number;
      eventType?: ActivityEventType;
      severity?: EventSeverity;
    }
  ) {
    const task = await prisma.task.findUnique({
      where: { id: taskId, NOT: { isDeleted: true } },
      select: { id: true, courseId: true },
    });

    if (!task) {
      throw new NotFoundError('Task not found');
    }

    let visibilityFilter: EventVisibility[] = [
      EventVisibility.STUDENTS,
      EventVisibility.PUBLIC,
    ];

    const isInstructor = ['DOCTOR', 'TEACHING_ASSISTANT'].includes(user.role);
    const isAdmin = [
      'ADMIN',
      'COLLEGE_ADMIN',
      'DEPARTMENT_ADMIN',
      'SUPER_ADMIN',
    ].includes(user.role);

    if (isAdmin) {
      visibilityFilter = [
        EventVisibility.ADMIN_ONLY,
        EventVisibility.INSTRUCTORS,
        EventVisibility.STUDENTS,
        EventVisibility.PUBLIC,
      ];
    } else if (isInstructor) {
      visibilityFilter = [
        EventVisibility.INSTRUCTORS,
        EventVisibility.STUDENTS,
        EventVisibility.PUBLIC,
      ];
    }

    const query = new TimelineQuery({
      entityType: ActivityEntityType.TASK,
      entityId: taskId,
      cursorId: options?.cursorId,
      cursorCreatedAt: options?.cursorCreatedAt,
      limit: options?.limit,
      visibilityFilter,
      eventType: options?.eventType,
      severity: options?.severity,
    });

    const result = await ActivityRepository.findByQuery(query);

    const serializedEvents = result.events.map(serializeTimelineEvent);

    return {
      events: serializedEvents,
      pagination: {
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
        limit: result.limit,
      },
      filters: {
        eventType: options?.eventType ?? null,
        severity: options?.severity ?? null,
      },
    };
  }

  /**
   * Retrieve global activity feed for a course with visibility filtering, cursor pagination, and filters
   */
  static async getCourseTimeline(
    user: any,
    courseId: number,
    options?: {
      cursorId?: number;
      cursorCreatedAt?: Date;
      limit?: number;
      eventType?: ActivityEventType;
      severity?: EventSeverity;
    }
  ) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, name: true },
    });

    if (!course) {
      throw new NotFoundError('Course not found');
    }

    let visibilityFilter: EventVisibility[] = [
      EventVisibility.STUDENTS,
      EventVisibility.PUBLIC,
    ];

    const isInstructor = ['DOCTOR', 'TEACHING_ASSISTANT'].includes(user.role);
    const isAdmin = [
      'ADMIN',
      'COLLEGE_ADMIN',
      'DEPARTMENT_ADMIN',
      'SUPER_ADMIN',
    ].includes(user.role);

    if (isAdmin) {
      visibilityFilter = [
        EventVisibility.ADMIN_ONLY,
        EventVisibility.INSTRUCTORS,
        EventVisibility.STUDENTS,
        EventVisibility.PUBLIC,
      ];
    } else if (isInstructor) {
      visibilityFilter = [
        EventVisibility.INSTRUCTORS,
        EventVisibility.STUDENTS,
        EventVisibility.PUBLIC,
      ];
    }

    const query = new TimelineQuery({
      entityType: ActivityEntityType.TASK,
      entityId: courseId,
      cursorId: options?.cursorId,
      cursorCreatedAt: options?.cursorCreatedAt,
      limit: options?.limit,
      visibilityFilter,
      eventType: options?.eventType,
      severity: options?.severity,
    });

    const result = await ActivityRepository.findByCourse(courseId, query);

    const serializedEvents = result.events.map(serializeTimelineEvent);

    return {
      events: serializedEvents,
      pagination: {
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
        limit: result.limit,
      },
      filters: {
        eventType: options?.eventType ?? null,
        severity: options?.severity ?? null,
      },
    };
  }
}

export default TimelineService;
