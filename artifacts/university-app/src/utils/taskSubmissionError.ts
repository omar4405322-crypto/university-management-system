export interface TaskSubmissionErrorResult {
  status?: number;
  error?: unknown;
}

export function getTaskSubmissionConflictKey(
  result: TaskSubmissionErrorResult | null | undefined
): 'tasks.duplicateSubmissionBlocked' | 'tasks.conflictAlreadySubmitted' | undefined {
  if (!result || result.status !== 409) {
    return undefined;
  }

  const errorObj = result.error as { data?: { code?: unknown } } | undefined;
  if (errorObj?.data?.code === 'DUPLICATE_SUBMISSION') {
    return 'tasks.duplicateSubmissionBlocked';
  }

  return 'tasks.conflictAlreadySubmitted';
}
