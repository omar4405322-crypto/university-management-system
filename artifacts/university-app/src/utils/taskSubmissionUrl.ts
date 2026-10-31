import { MAX_TASK_NOTES_LENGTH } from './taskDeadline.utils.ts';

export const APPROVED_TASK_SUBMISSION_DOMAINS = [
  'drive.google.com',
  'docs.google.com',
  'github.com',
  'raw.githubusercontent.com',
  'dropbox.com',
  'onedrive.live.com',
  '1drv.ms',
] as const;

export function isApprovedHostname(hostname: string): boolean {
  return APPROVED_TASK_SUBMISSION_DOMAINS.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
  );
}

export function getSubmissionDestinationHostname(fileUrl: string): string | null {
  try {
    return new URL(fileUrl).hostname.toLowerCase().replace(/\.$/, '');
  } catch {
    return null;
  }
}

export interface SubmissionValidationResult {
  isValid: boolean;
  normalizedFileUrl?: string | null;
  normalizedNotes?: string;
  fileUrlErrorKey?: string;
  notesErrorKey?: string;
  formErrorKey?: string;
}

export function validateSubmissionInput(input: {
  fileUrl?: string | null;
  notes?: string | null;
}): SubmissionValidationResult {
  const rawFileUrl = input.fileUrl != null ? String(input.fileUrl).trim() : '';
  const rawNotes = input.notes != null ? String(input.notes) : '';
  const trimmedNotes = rawNotes.trim();

  let normalizedFileUrl: string | null = null;
  let fileUrlErrorKey: string | undefined;
  let notesErrorKey: string | undefined;

  if (rawNotes.length > MAX_TASK_NOTES_LENGTH) {
    notesErrorKey = 'tasks.notesTooLong';
  }

  if (rawFileUrl.length > 0) {
    if (rawFileUrl.length > 500) {
      fileUrlErrorKey = 'tasks.fileUrlTooLong';
    } else {
      let parsedUrl: URL | null = null;
      try {
        parsedUrl = new URL(rawFileUrl);
      } catch {
        fileUrlErrorKey = 'tasks.invalidUrl';
      }

      if (parsedUrl) {
        if (parsedUrl.protocol !== 'https:') {
          fileUrlErrorKey = 'tasks.fileUrlMustBeHttps';
        } else {
          const hostname = parsedUrl.hostname.toLowerCase().replace(/\.$/, '');
          if (!isApprovedHostname(hostname)) {
            fileUrlErrorKey = 'tasks.invalidUrl';
          } else {
            normalizedFileUrl = rawFileUrl;
          }
        }
      }
    }
  }

  if (!normalizedFileUrl && trimmedNotes.length === 0) {
    return {
      isValid: false,
      normalizedFileUrl: null,
      normalizedNotes: trimmedNotes,
      fileUrlErrorKey,
      notesErrorKey,
      formErrorKey: 'tasks.submissionContentRequired',
    };
  }

  if (fileUrlErrorKey || notesErrorKey) {
    return {
      isValid: false,
      normalizedFileUrl,
      normalizedNotes: trimmedNotes,
      fileUrlErrorKey,
      notesErrorKey,
    };
  }

  return {
    isValid: true,
    normalizedFileUrl,
    normalizedNotes: trimmedNotes,
  };
}

