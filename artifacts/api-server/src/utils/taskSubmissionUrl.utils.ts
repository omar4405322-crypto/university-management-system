import { ValidationError } from './appError';

export const APPROVED_TASK_SUBMISSION_DOMAINS = [
  'drive.google.com',
  'docs.google.com',
  'github.com',
  'raw.githubusercontent.com',
  'dropbox.com',
  'onedrive.live.com',
  '1drv.ms',
] as const;

function isApprovedHostname(hostname: string): boolean {
  return APPROVED_TASK_SUBMISSION_DOMAINS.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
  );
}

export function validateTaskSubmissionUrl(
  fileUrl: unknown
): string | null | undefined {
  if (fileUrl === undefined || fileUrl === null) return fileUrl;
  if (typeof fileUrl !== 'string') {
    throw new ValidationError('Task submission link must be a valid URL', [], 'TASK_SUBMISSION_LINK_INVALID_TYPE');
  }

  const normalizedUrl = fileUrl.trim();
  if (!normalizedUrl) return null;
  if (normalizedUrl.length > 500) {
    throw new ValidationError('Task submission link is too long', [], 'TASK_SUBMISSION_LINK_TOO_LONG');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(normalizedUrl);
  } catch {
    throw new ValidationError('Task submission link must be a valid HTTP(S) URL', [], 'TASK_SUBMISSION_LINK_MALFORMED');
  }

  if (parsedUrl.protocol !== 'https:') {
    throw new ValidationError('Task submission link must use HTTPS', [], 'TASK_SUBMISSION_LINK_HTTPS_REQUIRED');
  }

  const hostname = parsedUrl.hostname.toLowerCase().replace(/\.$/, '');
  if (!isApprovedHostname(hostname)) {
    throw new ValidationError(
      `Task submission links must use an approved domain: ${APPROVED_TASK_SUBMISSION_DOMAINS.join(', ')}`,
      [],
      'TASK_SUBMISSION_LINK_DOMAIN_NOT_ALLOWED'
    );
  }

  return normalizedUrl;
}
