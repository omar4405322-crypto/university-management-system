import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(
  new URL('../src/pages/attendance/FacultyAttendanceDashboard.tsx', import.meta.url),
  'utf8'
);

assert.match(source, /const activeSessionId = activeSession\?\.sessionId/);
assert.match(source, /activeSessionIdRef\.current = activeSessionId/);
assert.match(source, /const fetchSessionData = useCallback\(async \(\): Promise<boolean> => \{[\s\S]*const requestedSessionId = activeSessionId[\s\S]*getFlaggedRecords\(requestedSessionId\)[\s\S]*getSessionRoster\(requestedSessionId\)[\s\S]*activeSessionIdRef\.current !== requestedSessionId[\s\S]*\}, \[activeSessionId\]\)/);
assert.match(source, /\}, \[activeSessionId, fetchSessionData, isDocumentVisible, isRosterPanelVisible\]\)/);
assert.doesNotMatch(source, /getSessionRoster\(activeSession\.sessionId\)/);

console.log('F5 faculty dashboard polling stale-closure regression checks passed');
