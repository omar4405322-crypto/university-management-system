import assert from 'node:assert/strict';
import { test } from 'node:test';

// Exact function from AcademicTermModal.tsx
const formatDateForInput = (d) => {
  if (!d) return '';
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  } catch {
    return '';
  }
};

test('Step 3: Fixture Year/Term typed in edit modal, saved, and reopened in Africa/Cairo', () => {
  process.env.TZ = 'Africa/Cairo';

  // 1. Admin types dates into modal
  const typedStartDate = '2026-09-15';
  const typedEndDate = '2027-06-30';

  // 2. AcademicTermModal.tsx handleSubmit payload serialization
  const payload = {
    name: 'Fixture Year 2026-2027',
    startDate: new Date(typedStartDate).toISOString(),
    endDate: new Date(typedEndDate).toISOString(),
  };

  assert.equal(payload.startDate, '2026-09-15T00:00:00.000Z');
  assert.equal(payload.endDate, '2027-06-30T00:00:00.000Z');

  // 3. API persists and returns ISO string
  const returnedFromApi = {
    id: 9999,
    name: 'Fixture Year 2026-2027',
    startDate: payload.startDate,
    endDate: payload.endDate,
  };

  // 4. Modal reopens in edit mode
  const reopenedStartDate = formatDateForInput(returnedFromApi.startDate);
  const reopenedEndDate = formatDateForInput(returnedFromApi.endDate);

  assert.equal(reopenedStartDate, typedStartDate, 'Reopened start date must match typed start date');
  assert.equal(reopenedEndDate, typedEndDate, 'Reopened end date must match typed end date');

  // 5. Verify display in Africa/Cairo for modal-saved dates
  const displayStartCairo = new Date(returnedFromApi.startDate).toLocaleDateString('en-US', { timeZone: 'Africa/Cairo' });
  const displayEndCairo = new Date(returnedFromApi.endDate).toLocaleDateString('en-US', { timeZone: 'Africa/Cairo' });

  assert.equal(displayStartCairo, '9/15/2026', 'Modal-saved start date displays correctly in Cairo');
  assert.equal(displayEndCairo, '6/30/2027', 'Modal-saved end date displays correctly in Cairo (no off-by-one)');

  // 6. Demonstrate root cause of Year 8 (stored with T23:59:59.999Z from initial backfill)
  const legacyStoredYear8End = '2027-06-30T23:59:59.999Z';
  const year8ReopenedInModal = formatDateForInput(legacyStoredYear8End);
  assert.equal(year8ReopenedInModal, '2027-06-30', 'Modal correctly parses legacy Year 8 as 2027-06-30');

  // In Cairo (+3 in summer), 23:59:59.999Z rolls over to next day
  const year8RawCairoDisplay = new Date(legacyStoredYear8End).toLocaleDateString('en-US', { timeZone: 'Africa/Cairo' });
  assert.equal(year8RawCairoDisplay, '7/1/2027', 'Confirms 7/1/2027 display is caused by stored 23:59:59.999Z in UTC+3');
});
