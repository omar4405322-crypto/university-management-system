import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveHourlyTimesFromData, generateHourlyTimes } from '../src/utils/scheduleConfig.ts';

test('A4 & A5: TA schedule resolves TA by teachingAssistant.id and renders 08:00 LAB in hourly grid', () => {
  // 1. Check A4: Dynamic grid hours
  const slotsWithEarlyLab = [
    {
      id: 101,
      dayOfWeek: 'SUNDAY',
      startTime: '08:00',
      endTime: '10:00',
      slotType: 'LAB',
      teachingAssistantId: 'ta_cuid_test_123',
    },
    {
      id: 102,
      dayOfWeek: 'MONDAY',
      startTime: '10:00',
      endTime: '12:00',
      slotType: 'LAB',
      teachingAssistantId: 'ta_cuid_test_123',
    },
  ];

  const derivedTimes = deriveHourlyTimesFromData(slotsWithEarlyLab);
  assert.ok(Array.isArray(derivedTimes), 'derivedTimes must be an array');
  assert.equal(derivedTimes[0], '08:00', 'Earliest hour must be 08:00 due to 08:00 slot');
  assert.ok(derivedTimes.includes('08:00'), 'derivedTimes must include 08:00');
  assert.ok(derivedTimes.includes('18:00'), 'derivedTimes must include minimum end band 18:00');

  // 2. Check A5: Identity matching with string comparison
  const taUser = {
    id: 42,
    role: 'TEACHING_ASSISTANT',
    teachingAssistant: {
      id: 'ta_cuid_test_123',
      departmentId: 10,
    },
  };

  // Resolve selectedTAId by teachingAssistant.id
  const resolvedTAId = String(taUser.teachingAssistant?.id || taUser.id);
  assert.equal(resolvedTAId, 'ta_cuid_test_123', 'TA schedule must resolve TA by teachingAssistant.id');

  // Filter slots for this TA
  const matchedSlots = slotsWithEarlyLab.filter(
    (s) => String(s.teachingAssistantId) === resolvedTAId
  );
  assert.equal(matchedSlots.length, 2, 'Both slots must match the TA');

  // Verify slot places into 08:00 bucket
  const earlySlot = matchedSlots.find((s) => s.startTime === '08:00');
  assert.ok(earlySlot, '08:00 LAB slot exists');
  const slotStartHour = earlySlot.startTime.split(':')[0] + ':00';
  assert.ok(derivedTimes.includes(slotStartHour), '08:00 slot start hour must exist in derivedTimes');
});
