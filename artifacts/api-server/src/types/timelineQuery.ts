import {
  ActivityEntityType,
  ActivityEventType,
  EventVisibility,
  EventSeverity,
} from '@prisma/client';

export class TimelineQuery {
  public readonly entityType: ActivityEntityType;
  public readonly entityId: number;
  public readonly cursorId?: number;
  public readonly cursorCreatedAt?: Date;
  public readonly limit: number;
  public readonly visibilityFilter: EventVisibility[];
  public readonly eventType?: ActivityEventType;
  public readonly severity?: EventSeverity;

  constructor(params: {
    entityType: ActivityEntityType;
    entityId: number;
    cursorId?: number;
    cursorCreatedAt?: Date;
    limit?: number;
    visibilityFilter?: EventVisibility[];
    eventType?: ActivityEventType;
    severity?: EventSeverity;
  }) {
    this.entityType = params.entityType;
    this.entityId = params.entityId;
    this.cursorId = params.cursorId;
    this.cursorCreatedAt = params.cursorCreatedAt;
    this.limit = Math.min(Math.max(params.limit ?? 20, 1), 50);
    this.visibilityFilter = params.visibilityFilter ?? [];
    this.eventType = params.eventType;
    this.severity = params.severity;
  }
}
