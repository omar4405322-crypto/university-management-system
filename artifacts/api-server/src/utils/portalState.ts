export enum PortalState {
  SCHEDULED = 'SCHEDULED',
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  MANUALLY_CLOSED = 'MANUALLY_CLOSED',
}

export interface PortalStateInput {
  startDate?: Date | string | null;
  dueDate: Date | string;
  isManuallyClosed?: boolean | null;
}

export function evaluatePortalState(
  task: PortalStateInput,
  now: Date = new Date()
): PortalState {
  if (task.isManuallyClosed) {
    return PortalState.MANUALLY_CLOSED;
  }

  const nowTime = now.getTime();

  if (task.startDate) {
    const startTime = new Date(task.startDate).getTime();
    if (nowTime < startTime) {
      return PortalState.SCHEDULED;
    }
  }

  const dueTime = new Date(task.dueDate).getTime();
  if (nowTime > dueTime) {
    return PortalState.CLOSED;
  }

  return PortalState.OPEN;
}
