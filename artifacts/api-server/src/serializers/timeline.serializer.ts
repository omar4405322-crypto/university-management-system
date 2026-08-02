export interface ActorDTO {
  id: number | null;
  name: string;
  role: string;
}

export interface ActivityEventDTO {
  id: number;
  eventType: string;
  severity: string;
  visibility: string;
  title: string;
  summary: string;
  actor: ActorDTO;
  diff: Record<string, any> | null;
  relatedEntityRefs: {
    versionId: number | null;
    attachmentId: number | null;
    commentId: number | null;
  };
  createdAt: string;
}

export function serializeTimelineEvent(eventRecord: any): ActivityEventDTO {
  let actorName = 'System';
  if (eventRecord.actor) {
    if (eventRecord.actor.doctor) {
      actorName = `Dr. ${eventRecord.actor.doctor.firstName} ${eventRecord.actor.doctor.lastName}`;
    } else if (eventRecord.actor.student) {
      actorName = `${eventRecord.actor.student.firstName} ${eventRecord.actor.student.lastName}`;
    } else if (eventRecord.actor.email) {
      actorName = eventRecord.actor.email;
    }
  }

  return {
    id: eventRecord.id,
    eventType: eventRecord.eventType,
    severity: eventRecord.severity,
    visibility: eventRecord.visibility,
    title: eventRecord.title,
    summary: eventRecord.summary,
    actor: {
      id: eventRecord.actorId ?? null,
      name: actorName,
      role: eventRecord.actorRole || 'SYSTEM',
    },
    diff: (eventRecord.diffPayload as Record<string, any>) ?? null,
    relatedEntityRefs: {
      versionId: eventRecord.relatedVersionId ?? null,
      attachmentId: eventRecord.relatedAttachmentId ?? null,
      commentId: eventRecord.relatedCommentId ?? null,
    },
    createdAt: new Date(eventRecord.createdAt).toISOString(),
  };
}
