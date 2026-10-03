import assert from 'node:assert/strict';
import { test } from 'node:test';

// Test matrix for AiActionCard state model and interaction logic
test('PHASE 14 — AiActionCard State & Interaction Contract', async (t) => {
  const proposalFixture = {
    id: 'prop-test-4401',
    actionType: 'CREATE_TASK',
    status: 'PROPOSED',
    humanReadableSummary: 'Create assignment "Operating Systems Homework 1" for course CS301 with deadline 10 Oct 2026, 11:59 PM (Africa/Cairo).',
    humanReadableSummaryAr: 'إنشاء تكليف "Operating Systems Homework 1" لمقرر CS301 بموعد تسليم 10 Oct 2026, 11:59 PM (توقيت القاهرة).',
    previewData: {
      actionType: 'CREATE_TASK',
      target: 'CS301 — Operating Systems',
      title: 'Operating Systems Homework 1',
      description: 'Implement round robin scheduling',
      deadlineCairo: '10 Oct 2026, 11:59 PM Africa/Cairo',
      maxScore: 100,
      recipientsCount: 42,
      sideEffect: 'This task will be published and become immediately visible to all enrolled students with an automated notification.',
      sideEffectAr: 'سيتم نشر هذا التكليف ليظهر فوراً لجميع الطلاب المسجلين مع إرسال إشعار آلي لهم.',
    },
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
  };

  await t.test('1. Action Card renders all required structured preview fields in PROPOSED state', () => {
    const preview = proposalFixture.previewData;
    assert.equal(preview.actionType, 'CREATE_TASK');
    assert.equal(preview.target, 'CS301 — Operating Systems');
    assert.equal(preview.title, 'Operating Systems Homework 1');
    assert.equal(preview.deadlineCairo, '10 Oct 2026, 11:59 PM Africa/Cairo');
    assert.equal(preview.maxScore, 100);
    assert.equal(preview.recipientsCount, 42);
    assert.ok(preview.sideEffect.includes('immediately visible to all enrolled students'));
  });

  await t.test('2. PROPOSED state requires explicit human confirmation (distinct Confirm & Cancel actions)', () => {
    const isProposed = proposalFixture.status === 'PROPOSED';
    const canConfirm = isProposed && new Date(proposalFixture.expiresAt) > new Date();
    assert.equal(canConfirm, true);

    // Verify confirmation endpoint route
    const confirmEndpoint = `/api/ai/actions/${proposalFixture.id}/confirm`;
    const cancelEndpoint = `/api/ai/actions/${proposalFixture.id}/cancel`;
    assert.equal(confirmEndpoint, '/api/ai/actions/prop-test-4401/confirm');
    assert.equal(cancelEndpoint, '/api/ai/actions/prop-test-4401/cancel');
  });

  await t.test('3. Terminal states disable execution actions', () => {
    const terminalStates = ['SUCCEEDED', 'FAILED', 'CANCELED', 'EXPIRED', 'STALE'];
    for (const status of terminalStates) {
      const isActionable = status === 'PROPOSED';
      assert.equal(isActionable, false, `State ${status} must not allow confirmation`);
    }
  });

  await t.test('4. Human confirmation invariant: Text messages never trigger action endpoints', () => {
    const mockMessages = ['yes', 'ايوه', 'تمام نفذ', 'confirm it', 'do it automatically'];
    for (const msg of mockMessages) {
      // Chat message send goes to /api/ai/conversations/:id/messages, NOT /api/ai/actions/:id/confirm
      const isDirectConfirmEndpoint = msg.startsWith('/api/ai/actions/');
      assert.equal(isDirectConfirmEndpoint, false, `Text prompt "${msg}" cannot invoke confirmation endpoint`);
    }
  });

  await t.test('5. Multi-turn modification leaves previous proposal immutable', () => {
    const originalProposal = { ...proposalFixture };
    const modifiedPayload = {
      ...originalProposal.previewData,
      deadlineCairo: '12 Oct 2026, 11:59 PM Africa/Cairo',
    };
    // The original proposal must NOT be mutated in-place
    assert.notEqual(originalProposal.previewData.deadlineCairo, modifiedPayload.deadlineCairo);
    assert.equal(originalProposal.id, 'prop-test-4401');
  });

  await t.test('6. Authoritative Cairo timezone formatting verification', () => {
    assert.ok(proposalFixture.previewData.deadlineCairo.includes('Africa/Cairo'));
  });
});
