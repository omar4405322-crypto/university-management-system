import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  MAX_TASK_TITLE_LENGTH,
  MAX_TASK_DESCRIPTION_LENGTH,
  MAX_TASK_NOTES_LENGTH,
  MAX_TASK_FEEDBACK_LENGTH,
  isTaskPastDue,
} from '../src/utils/taskDeadline.utils.ts';
import {
  validateSubmissionInput,
  APPROVED_TASK_SUBMISSION_DOMAINS,
} from '../src/utils/taskSubmissionUrl.ts';

describe('Task Technical Constants & Deadline Utils Alignment', () => {
  it('matches backend validation constants from taskDeadline.utils.ts', async () => {
    const backendContent = await readFile(
      new URL('../../api-server/src/utils/taskDeadline.utils.ts', import.meta.url),
      'utf8'
    );

    const titleMatch = backendContent.match(/export\s+const\s+MAX_TASK_TITLE_LENGTH\s*=\s*(\d+);/);
    assert.ok(titleMatch, 'Backend must export MAX_TASK_TITLE_LENGTH');
    assert.equal(MAX_TASK_TITLE_LENGTH, Number(titleMatch[1]));
    assert.equal(MAX_TASK_TITLE_LENGTH, 255);

    const descMatch = backendContent.match(/export\s+const\s+MAX_TASK_DESCRIPTION_LENGTH\s*=\s*(\d+);/);
    assert.ok(descMatch, 'Backend must export MAX_TASK_DESCRIPTION_LENGTH');
    assert.equal(MAX_TASK_DESCRIPTION_LENGTH, Number(descMatch[1]));
    assert.equal(MAX_TASK_DESCRIPTION_LENGTH, 5000);

    const notesMatch = backendContent.match(/export\s+const\s+MAX_TASK_NOTES_LENGTH\s*=\s*(\d+);/);
    assert.ok(notesMatch, 'Backend must export MAX_TASK_NOTES_LENGTH');
    assert.equal(MAX_TASK_NOTES_LENGTH, Number(notesMatch[1]));
    assert.equal(MAX_TASK_NOTES_LENGTH, 5000);

    const feedbackMatch = backendContent.match(/export\s+const\s+MAX_TASK_FEEDBACK_LENGTH\s*=\s*(\d+);/);
    assert.ok(feedbackMatch, 'Backend must export MAX_TASK_FEEDBACK_LENGTH');
    assert.equal(MAX_TASK_FEEDBACK_LENGTH, Number(feedbackMatch[1]));
    assert.equal(MAX_TASK_FEEDBACK_LENGTH, 5000);
  });

  it('evaluates isTaskPastDue with fixed dates and pure instant comparison', () => {
    const pastDueDate = '2020-01-01T00:00:00.000Z';
    const futureDueDate = '2099-01-01T00:00:00.000Z';

    // With default nowMs (current time is well past 2020 and before 2099)
    assert.equal(isTaskPastDue(pastDueDate), true);
    assert.equal(isTaskPastDue(futureDueDate), false);

    // With explicit injectable nowMs
    const anchorMs = new Date('2025-06-01T12:00:00.000Z').getTime();
    assert.equal(isTaskPastDue('2025-06-01T11:59:59.000Z', anchorMs), true);
    assert.equal(isTaskPastDue('2025-06-01T12:00:00.000Z', anchorMs), false); // exact instant is not past due
    assert.equal(isTaskPastDue('2025-06-01T12:00:01.000Z', anchorMs), false);

    // Date object inputs
    assert.equal(isTaskPastDue(new Date('2020-01-01T00:00:00.000Z'), anchorMs), true);
    assert.equal(isTaskPastDue(new Date('2099-01-01T00:00:00.000Z'), anchorMs), false);

    // Edge cases: null, undefined, invalid
    assert.equal(isTaskPastDue(null), false);
    assert.equal(isTaskPastDue(undefined), false);
    assert.equal(isTaskPastDue('invalid-date'), false);
  });

  it('validates client-side task submission inputs matching backend rules', () => {
    // Blank submission (neither link nor non-blank notes) is rejected
    assert.equal(validateSubmissionInput({ fileUrl: '', notes: '' }).isValid, false);
    assert.equal(validateSubmissionInput({ fileUrl: '   ', notes: '   ' }).isValid, false);
    assert.equal(validateSubmissionInput({ fileUrl: null, notes: undefined }).isValid, false);

    // Notes only is accepted
    const notesOnly = validateSubmissionInput({ notes: 'Here is my notes submission', fileUrl: '' });
    assert.equal(notesOnly.isValid, true);
    assert.equal(notesOnly.normalizedNotes, 'Here is my notes submission');

    // HTTPS link only is accepted
    const linkOnly = validateSubmissionInput({ fileUrl: 'https://drive.google.com/file/d/123/view', notes: '' });
    assert.equal(linkOnly.isValid, true);
    assert.equal(linkOnly.normalizedFileUrl, 'https://drive.google.com/file/d/123/view');

    // HTTP link is rejected (HTTPS required)
    const httpLink = validateSubmissionInput({ fileUrl: 'http://drive.google.com/file/d/123', notes: '' });
    assert.equal(httpLink.isValid, false);
    assert.equal(httpLink.fileUrlErrorKey, 'tasks.fileUrlMustBeHttps');

    // Non-approved domain is rejected
    const unapproved = validateSubmissionInput({ fileUrl: 'https://evil.com/malware.exe', notes: '' });
    assert.equal(unapproved.isValid, false);
    assert.equal(unapproved.fileUrlErrorKey, 'tasks.invalidUrl');

    // Notes exceeding MAX_TASK_NOTES_LENGTH is rejected
    const longNotes = 'a'.repeat(MAX_TASK_NOTES_LENGTH + 1);
    const notesExceeded = validateSubmissionInput({ notes: longNotes, fileUrl: '' });
    assert.equal(notesExceeded.isValid, false);
    assert.equal(notesExceeded.notesErrorKey, 'tasks.notesTooLong');

    // Approved domains check
    assert.ok(APPROVED_TASK_SUBMISSION_DOMAINS.includes('drive.google.com'));
    assert.ok(APPROVED_TASK_SUBMISSION_DOMAINS.includes('github.com'));
    assert.ok(APPROVED_TASK_SUBMISSION_DOMAINS.includes('onedrive.live.com'));
  });
});
