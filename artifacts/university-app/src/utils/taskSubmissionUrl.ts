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

export const TASK_SUBMISSION_MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

export const ALLOWED_TASK_EXTENSIONS = [
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'txt',
  'zip',
  'rar',
  '7z',
  'png',
  'jpg',
  'jpeg',
  'webp',
] as const;

export const DANGEROUS_EXTENSIONS = [
  'exe',
  'bat',
  'cmd',
  'com',
  'scr',
  'msi',
  'js',
  'mjs',
  'vbs',
  'ps1',
  'sh',
  'jar',
  'php',
  'asp',
  'aspx',
  'html',
  'htm',
  'svg',
  'dll',
  'lnk',
] as const;

const ALLOWED_EXT_SET = new Set<string>(ALLOWED_TASK_EXTENSIONS);
const DANGEROUS_EXT_SET = new Set<string>(DANGEROUS_EXTENSIONS);

export interface FileValidationResult {
  isValid: boolean;
  errorKey?: string;
  defaultMessage?: string;
}

export function validateSubmissionFile(file: {
  name: string;
  size: number;
  type?: string;
} | null | undefined): FileValidationResult {
  if (!file) {
    return {
      isValid: false,
      errorKey: 'tasks.fileRequiredHint',
      defaultMessage: 'Please select a file to submit',
    };
  }

  if (file.size === 0) {
    return {
      isValid: false,
      errorKey: 'tasks.fileEmptyError',
      defaultMessage: 'Selected file is empty',
    };
  }

  if (file.size > TASK_SUBMISSION_MAX_FILE_SIZE) {
    return {
      isValid: false,
      errorKey: 'tasks.fileTooLargeError',
      defaultMessage: 'File size exceeds maximum allowed limit of 25MB',
    };
  }

  const rawName = file.name || '';
  if (rawName.includes('\0') || rawName.includes('%00')) {
    return {
      isValid: false,
      errorKey: 'tasks.fileInvalidCharacters',
      defaultMessage: 'Filename contains invalid characters',
    };
  }

  if (rawName.endsWith('.') || rawName.replace(/\./g, '').trim().length === 0) {
    return {
      isValid: false,
      errorKey: 'tasks.fileNoExtension',
      defaultMessage: 'File must have an extension',
    };
  }

  const parts = rawName.split('.');
  if (parts.length < 2) {
    return {
      isValid: false,
      errorKey: 'tasks.fileNoExtension',
      defaultMessage: 'File must have an extension',
    };
  }

  const nonFinal = parts.slice(0, -1);
  if (nonFinal.every((seg) => seg.trim().length === 0)) {
    return {
      isValid: false,
      errorKey: 'tasks.fileNoExtension',
      defaultMessage: 'File must have an extension',
    };
  }

  const hasDangerous = nonFinal.some((seg) =>
    DANGEROUS_EXT_SET.has(seg.toLowerCase())
  );
  if (hasDangerous) {
    return {
      isValid: false,
      errorKey: 'tasks.fileDangerousPattern',
      defaultMessage: 'Filename contains a dangerous extension pattern',
    };
  }

  const ext = parts[parts.length - 1].toLowerCase();
  if (!ALLOWED_EXT_SET.has(ext)) {
    return {
      isValid: false,
      errorKey: 'tasks.fileExtensionNotAllowed',
      defaultMessage: `File extension .${ext} is not allowed`,
    };
  }

  return { isValid: true };
}

export function formatTaskFileSize(bytes: number): string {
  if (typeof bytes !== 'number' || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}


