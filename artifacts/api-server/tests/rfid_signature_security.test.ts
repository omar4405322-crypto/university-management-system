import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { isValidRfidSignature } from '../src/attendance/drivers/RfidDriver';

const digest = crypto.createHmac('sha256', 'test-key').update('message').digest();
assert.equal(isValidRfidSignature(digest.toString('hex'), digest), true);
assert.equal(isValidRfidSignature(digest.toString('hex').toUpperCase(), digest), true);
assert.equal(isValidRfidSignature(digest.toString('base64'), digest), true);
assert.equal(isValidRfidSignature(`${digest.toString('hex')}zz`, digest), false);
assert.equal(isValidRfidSignature(`${digest.toString('base64').slice(0, -2)}xx`, digest), false);
assert.equal(isValidRfidSignature('not-a-signature', digest), false);

console.log('RFID signature comparison security checks passed');
