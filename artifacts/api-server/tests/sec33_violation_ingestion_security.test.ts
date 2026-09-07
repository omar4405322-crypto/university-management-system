import assert from 'node:assert/strict';
import prisma from '../src/utils/prismaClient';
import {
  ingestViolation,
  getViolationSequence,
  verifyAndAdvanceViolationSequence,
  resetViolationSequenceForTest,
  getLastAcceptedViolationSequence,
} from '../src/controllers/exams.controller';
import { ValidationError, AuthorizationError } from '../src/utils/appError';

async function runSec33ViolationIngestionTests() {
  console.log('=== SEC-33: Anti-Cheat Violation Ingestion Security Suite ===');

  const testSubmissionId = 9901;
  await resetViolationSequenceForTest(testSubmissionId);

  // ── PART 1: Core Sequence Verification Logic ──────────────────────────────
  console.log('\n--- Part 1: Sequence Logic Verification ---');

  // Initial sequence check
  const initialSeq = await getLastAcceptedViolationSequence(testSubmissionId);
  assert.equal(initialSeq, 0, 'Initial sequence must be 0');

  // (a) Sequential events accepted in order (1, 2)
  const step1 = await verifyAndAdvanceViolationSequence(testSubmissionId, 1);
  assert.equal(step1.valid, true, 'Sequence 1 must be accepted');

  const step2 = await verifyAndAdvanceViolationSequence(testSubmissionId, 2);
  assert.equal(step2.valid, true, 'Sequence 2 must be accepted');
  console.log('✔ [PASS] Sequential events (1, 2) accepted in order');

  // (b) Duplicate sequence number rejected
  const dupStep = await verifyAndAdvanceViolationSequence(testSubmissionId, 2);
  assert.equal(dupStep.valid, false, 'Duplicate sequence 2 must be rejected');
  assert.match(dupStep.error || '', /Duplicate sequence number 2/);

  const oldDupStep = await verifyAndAdvanceViolationSequence(testSubmissionId, 1);
  assert.equal(oldDupStep.valid, false, 'Previous sequence 1 must be rejected as duplicate');
  console.log('✔ [PASS] Duplicate sequence numbers (2, 1) rejected');

  // (c) Out-of-order sequence number rejected
  const oooStep = await verifyAndAdvanceViolationSequence(testSubmissionId, 5);
  assert.equal(oooStep.valid, false, 'Sequence 5 must be rejected when expecting 3');
  assert.match(oooStep.error || '', /Out-of-order sequence number 5: expected 3/);
  console.log('✔ [PASS] Out-of-order sequence (5 instead of 3) rejected');

  // Continue valid sequence (3, then 4)
  const step3 = await verifyAndAdvanceViolationSequence(testSubmissionId, 3);
  assert.equal(step3.valid, true, 'Sequence 3 must be accepted');
  const step4 = await verifyAndAdvanceViolationSequence(testSubmissionId, 4);
  assert.equal(step4.valid, true, 'Sequence 4 must be accepted');
  console.log('✔ [PASS] Sequence resumed correctly after rejected out-of-order attempt');

  // ── PART 2: Full Controller End-to-End Handler Ingestion ─────────────────
  console.log('\n--- Part 2: Controller IngestViolation Handler Verification ---');

  const controllerSubmissionId = 9902;
  await resetViolationSequenceForTest(controllerSubmissionId);

  // Stubs for prisma calls
  const originalFindUniqueStudent = prisma.student.findUnique;
  const originalFindUniqueSubmission = prisma.examSubmission.findUnique;
  const originalCreateViolation = prisma.examViolation.create;

  let currentSubmissionStatus: 'PENDING' | 'GRADED' | 'CANCELLED_CHEATING' = 'PENDING';
  let createdViolations: any[] = [];

  try {
    (prisma.student as any).findUnique = async ({ where }: any) => {
      if (where.userId === 10) {
        return { id: 1, userId: 10, firstName: 'Alice', lastName: 'Student' };
      }
      return null;
    };

    (prisma.examSubmission as any).findUnique = async ({ where }: any) => {
      if (where.id === controllerSubmissionId) {
        return {
          id: controllerSubmissionId,
          examId: 55,
          studentId: 1, // Matches student id 1
          status: currentSubmissionStatus,
          answers: [],
          startedAt: new Date(),
        };
      }
      return null;
    };

    (prisma.examViolation as any).create = async ({ data }: any) => {
      const record = {
        id: createdViolations.length + 1,
        ...data,
        receivedAt: new Date(),
      };
      createdViolations.push(record);
      return record;
    };

    const callIngestViolation = (body: any, subId = controllerSubmissionId): Promise<{ status: number; body?: any; error?: any }> => {
      return new Promise((resolve) => {
        const req: any = {
          params: { submissionId: subId.toString() },
          body,
          user: { id: 10, role: 'STUDENT' },
          ip: '192.168.1.100',
        };
        const res: any = {
          statusCode: 200,
          status(code: number) {
            this.statusCode = code;
            return this;
          },
          json(payload: any) {
            resolve({ status: this.statusCode, body: payload });
          },
        };
        const next = (err?: any) => {
          resolve({ status: res.statusCode, error: err });
        };

        ingestViolation(req, res, next);
      });
    };

    // (a) Sequential events accepted in order via HTTP handler
    const resSeq1 = await callIngestViolation({
      sequence: 1,
      type: 'TAB_SWITCH',
      occurredAt: '2026-09-07T10:00:00.000Z',
      details: 'User switched tab',
    });
    assert.equal(resSeq1.status, 201, 'Sequence 1 should return HTTP 201');
    assert.equal(resSeq1.body?.success, true);
    assert.equal(resSeq1.body?.sequence, 1);
    assert.ok(resSeq1.body?.data?.receivedAt, 'Server-receipt timestamp receivedAt must be present');
    assert.equal(
      new Date(resSeq1.body.data.occurredAt).toISOString(),
      '2026-09-07T10:00:00.000Z',
      'Client-provided occurredAt must be stored'
    );

    const resSeq2 = await callIngestViolation({
      sequence: 2,
      type: 'BLUR',
      occurredAt: '2026-09-07T10:00:02.000Z',
      details: 'Window lost focus',
    });
    assert.equal(resSeq2.status, 201, 'Sequence 2 should return HTTP 201');
    assert.equal(resSeq2.body?.sequence, 2);
    console.log('✔ [PASS] Controller: sequential events 1 & 2 ingested with client & server timestamps');

    // (b) Duplicate sequence rejected via HTTP handler
    const resDup = await callIngestViolation({
      sequence: 2,
      type: 'BLUR',
      occurredAt: '2026-09-07T10:00:05.000Z',
      details: 'Window lost focus re-sent',
    });
    assert.ok(resDup.error instanceof ValidationError, 'Duplicate sequence must produce ValidationError');
    assert.match(resDup.error.message, /Duplicate sequence number 2/);
    console.log('✔ [PASS] Controller: duplicate sequence rejected with ValidationError');

    // (c) Out-of-order sequence rejected via HTTP handler
    const resOoo = await callIngestViolation({
      sequence: 4,
      type: 'FULLSCREEN_EXIT',
      occurredAt: '2026-09-07T10:00:10.000Z',
      details: 'Exited fullscreen mode',
    });
    assert.ok(resOoo.error instanceof ValidationError, 'Out-of-order sequence must produce ValidationError');
    assert.match(resOoo.error.message, /Out-of-order sequence number 4: expected 3/);
    console.log('✔ [PASS] Controller: out-of-order sequence rejected with ValidationError');

    // (d) Event rejected when submission is not in an active state (e.g. GRADED or CANCELLED)
    currentSubmissionStatus = 'GRADED';
    const resInactiveGraded = await callIngestViolation({
      sequence: 3,
      type: 'RIGHT_CLICK',
      occurredAt: '2026-09-07T10:00:12.000Z',
      details: 'Context menu attempted',
    });
    assert.ok(
      resInactiveGraded.error instanceof ValidationError,
      'Inactive GRADED submission must reject violation ingestion'
    );
    assert.match(resInactiveGraded.error.message, /Exam submission is not in an active state/);

    currentSubmissionStatus = 'CANCELLED_CHEATING';
    const resInactiveCancelled = await callIngestViolation({
      sequence: 3,
      type: 'DEVTOOLS',
      occurredAt: '2026-09-07T10:00:15.000Z',
      details: 'Devtools opened',
    });
    assert.ok(
      resInactiveCancelled.error instanceof ValidationError,
      'Inactive CANCELLED submission must reject violation ingestion'
    );
    assert.match(resInactiveCancelled.error.message, /Exam submission is not in an active state/);
    console.log('✔ [PASS] Controller: violation rejected when submission is not in active state (GRADED/CANCELLED)');

  } finally {
    // Restore prisma stubs
    (prisma.student as any).findUnique = originalFindUniqueStudent;
    (prisma.examSubmission as any).findUnique = originalFindUniqueSubmission;
    (prisma.examViolation as any).create = originalCreateViolation;
  }

  // ── PART 3: Sequence Resume After Refresh (Authoritative Server Seeding) ──
  console.log('\n--- Part 3: Sequence Resume After Refresh Verification ---');

  const refreshSubmissionId = 9903;
  await resetViolationSequenceForTest(refreshSubmissionId);

  // 1. Initial pre-refresh activity: client ingests events 1 and 2
  const pre1 = await verifyAndAdvanceViolationSequence(refreshSubmissionId, 1);
  assert.equal(pre1.valid, true, 'Pre-refresh event 1 accepted');
  const pre2 = await verifyAndAdvanceViolationSequence(refreshSubmissionId, 2);
  assert.equal(pre2.valid, true, 'Pre-refresh event 2 accepted');

  // Server state has recorded lastAccepted = 2
  const serverSeq = await getLastAcceptedViolationSequence(refreshSubmissionId);
  assert.equal(serverSeq, 2, 'Server state must hold sequence 2');

  // 2. Client simulates page refresh:
  // Without authoritative seeding, client counter would start at 0 and generate sequence 1
  const unseededAttempt = await verifyAndAdvanceViolationSequence(refreshSubmissionId, 1);
  assert.equal(
    unseededAttempt.valid,
    false,
    'Unseeded sequence 1 after refresh must be rejected as duplicate'
  );

  // 3. With authoritative server seeding:
  // Client queries server for last-known sequence (2) and sets local counter = 2
  let clientSequenceCounter = 0;
  const setLastKnownSequence = (seq: number) => {
    clientSequenceCounter = Math.max(clientSequenceCounter, seq);
  };

  // Seed from authoritative server value
  setLastKnownSequence(serverSeq);
  assert.equal(clientSequenceCounter, 2, 'Client counter successfully seeded to 2 from server');

  // 4. Next violation occurs on client after refresh: counter advances to 3
  clientSequenceCounter += 1;
  assert.equal(clientSequenceCounter, 3);
  const post1 = await verifyAndAdvanceViolationSequence(refreshSubmissionId, clientSequenceCounter);
  assert.equal(post1.valid, true, 'Post-refresh event 3 must be accepted seamlessly');

  // 5. Subsequent violation occurs: counter advances to 4
  clientSequenceCounter += 1;
  assert.equal(clientSequenceCounter, 4);
  const post2 = await verifyAndAdvanceViolationSequence(refreshSubmissionId, clientSequenceCounter);
  assert.equal(post2.valid, true, 'Post-refresh event 4 must be accepted seamlessly');

  console.log('✔ [PASS] Sequence seamlessly resumed after page refresh without data loss or duplicate rejection');

  console.log('\n=== All SEC-33 Anti-Cheat Ingestion Tests PASSED ===\n');
}

await runSec33ViolationIngestionTests();
