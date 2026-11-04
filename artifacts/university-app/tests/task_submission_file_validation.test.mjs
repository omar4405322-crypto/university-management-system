import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ALLOWED_TASK_EXTENSIONS,
  DANGEROUS_EXTENSIONS,
  TASK_SUBMISSION_MAX_FILE_SIZE,
  validateSubmissionFile,
  formatTaskFileSize,
} from '../src/utils/taskSubmissionUrl.ts';

describe('WP5-T5b-2b: Task Submission File Validation & Formatting Unit Suite', () => {
  it('exports expected constants matching backend limits', () => {
    assert.equal(TASK_SUBMISSION_MAX_FILE_SIZE, 25 * 1024 * 1024, 'Max size must be 25MB');
    assert.ok(ALLOWED_TASK_EXTENSIONS.includes('pdf'), 'pdf must be allowed');
    assert.ok(ALLOWED_TASK_EXTENSIONS.includes('docx'), 'docx must be allowed');
    assert.ok(ALLOWED_TASK_EXTENSIONS.includes('zip'), 'zip must be allowed');
    assert.ok(ALLOWED_TASK_EXTENSIONS.includes('png'), 'png must be allowed');
    assert.ok(DANGEROUS_EXTENSIONS.includes('exe'), 'exe must be dangerous');
    assert.ok(DANGEROUS_EXTENSIONS.includes('sh'), 'sh must be dangerous');
    assert.ok(DANGEROUS_EXTENSIONS.includes('php'), 'php must be dangerous');
  });

  it('validates file size correctly', () => {
    // 0 byte file is rejected
    const emptyFile = validateSubmissionFile({ name: 'assignment.pdf', size: 0 });
    assert.equal(emptyFile.isValid, false);
    assert.equal(emptyFile.errorKey, 'tasks.fileEmptyError');

    // Exactly 25MB is accepted
    const exactMax = validateSubmissionFile({
      name: 'assignment.pdf',
      size: 25 * 1024 * 1024,
    });
    assert.equal(exactMax.isValid, true);

    // 25MB + 1 byte is rejected
    const tooLarge = validateSubmissionFile({
      name: 'assignment.pdf',
      size: 25 * 1024 * 1024 + 1,
    });
    assert.equal(tooLarge.isValid, false);
    assert.equal(tooLarge.errorKey, 'tasks.fileTooLargeError');
  });

  it('validates allowed extensions case-insensitively', () => {
    for (const ext of ['pdf', 'PDF', 'Docx', 'XLSX', 'ZIP', 'png', 'JpEg']) {
      const res = validateSubmissionFile({ name: `my_work.${ext}`, size: 1024 });
      assert.equal(res.isValid, true, `Expected .${ext} to be valid`);
    }

    for (const badExt of ['exe', 'bat', 'sh', 'tar', 'iso', 'bin', 'mp4', 'mkv']) {
      const res = validateSubmissionFile({ name: `bad_file.${badExt}`, size: 1024 });
      assert.equal(res.isValid, false, `Expected .${badExt} to be invalid`);
      assert.equal(res.errorKey, 'tasks.fileExtensionNotAllowed');
    }
  });

  it('rejects dangerous patterns and malformed filenames', () => {
    // Multi-dot safe filename is accepted
    const safeMultiDot = validateSubmissionFile({
      name: 'cs101.assignment.final.v2.pdf',
      size: 1024,
    });
    assert.equal(safeMultiDot.isValid, true);

    // Multi-dot with dangerous segment is rejected
    const dangerousSegment = validateSubmissionFile({
      name: 'homework.exe.pdf',
      size: 1024,
    });
    assert.equal(dangerousSegment.isValid, false);
    assert.equal(dangerousSegment.errorKey, 'tasks.fileDangerousPattern');

    const dangerousSh = validateSubmissionFile({
      name: 'submission.sh.zip',
      size: 1024,
    });
    assert.equal(dangerousSh.isValid, false);
    assert.equal(dangerousSh.errorKey, 'tasks.fileDangerousPattern');

    // Trailing dot is rejected
    const trailingDot = validateSubmissionFile({ name: 'assignment.pdf.', size: 1024 });
    assert.equal(trailingDot.isValid, false);
    assert.equal(trailingDot.errorKey, 'tasks.fileNoExtension');

    // No extension
    const noExt = validateSubmissionFile({ name: 'assignment', size: 1024 });
    assert.equal(noExt.isValid, false);
    assert.equal(noExt.errorKey, 'tasks.fileNoExtension');

    // Null byte
    const nullByte = validateSubmissionFile({ name: 'assignment\0.pdf', size: 1024 });
    assert.equal(nullByte.isValid, false);
    assert.equal(nullByte.errorKey, 'tasks.fileInvalidCharacters');
  });

  it('formats file sizes accurately into human-readable strings', () => {
    assert.equal(formatTaskFileSize(0), '0 B');
    assert.equal(formatTaskFileSize(500), '500 B');
    assert.equal(formatTaskFileSize(1024), '1.0 KB');
    assert.equal(formatTaskFileSize(1536), '1.5 KB');
    assert.equal(formatTaskFileSize(1048576), '1.0 MB');
    assert.equal(formatTaskFileSize(25 * 1024 * 1024), '25.0 MB');
  });
});
