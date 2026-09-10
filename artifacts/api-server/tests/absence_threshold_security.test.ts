import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MAX_CUSTOM_ABSENCE_THRESHOLD_PERCENT,
  validateCustomAbsenceThreshold,
} from '../src/utils/absenceThreshold.utils';

assert.equal(validateCustomAbsenceThreshold(25), null);
assert.match(
  validateCustomAbsenceThreshold(25.01) ?? '',
  /between 0 and 25/
);

const routes = readFileSync(
  new URL('../src/routes/enrollment.routes.ts', import.meta.url),
  'utf8'
);
const routeStart = routes.indexOf("'/:id/absence-threshold'");
const validationIndex = routes.indexOf('validateCustomAbsenceThreshold', routeStart);
const persistenceIndex = routes.indexOf('setCustomAbsenceThreshold', routeStart);

assert.equal(MAX_CUSTOM_ABSENCE_THRESHOLD_PERCENT, 25);
assert.ok(routeStart >= 0, 'absence-threshold route must exist');
assert.ok(
  validationIndex > routeStart && validationIndex < persistenceIndex,
  'threshold validation must run before the persistence controller'
);

console.log('SEC-44 absence threshold validation checks passed (25 accepted; >25 rejected pre-persistence)');
