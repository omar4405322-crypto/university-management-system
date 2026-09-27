import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(
  new URL('../src/pages/attendance/FacultyAttendanceDashboard.tsx', import.meta.url),
  'utf8'
);

assert.match(
  source,
  /const \[flaggedRes, rosterRes\] = await Promise\.all\(\[[\s\S]*getFlaggedRecords\(requestedSessionId\)[\s\S]*getSessionRoster\(requestedSessionId\)[\s\S]*\]\)/,
  'F4: flagged records and roster requests must start in parallel'
);
assert.match(
  source,
  /const isRosterPanelVisible = showRosterList \|\| activeTab === 'MANUAL'/,
  'F4: polling must be tied to the visible roster/manual panel'
);
assert.match(source, /document\.addEventListener\('visibilitychange', handleVisibilityChange\)/);
assert.match(
  source,
  /if \(activeSessionId && isRosterPanelVisible && isDocumentVisible\)/,
  'F4: hidden panels and hidden browser tabs must not start polling'
);
assert.match(
  source,
  /\[activeSessionId, fetchSessionData, isDocumentVisible, isRosterPanelVisible\]/,
  'F4: visibility changes must stop or restart the polling effect'
);

// --- Behavioral Test with Mock Document Visibility and Timers ---
{
  let currentTime = 0;
  let nextTimerId = 1;
  const activeTimers = new Map();

  const mockSetTimeout = (fn, delay) => {
    const id = nextTimerId++;
    activeTimers.set(id, { fn, runAt: currentTime + delay });
    return id;
  };

  const mockClearTimeout = (id) => {
    activeTimers.delete(id);
  };

  const advanceTimersByTime = async (ms) => {
    const targetTime = currentTime + ms;
    while (true) {
      let earliestId = null;
      let earliestTime = Infinity;
      for (const [id, timer] of activeTimers.entries()) {
        if (timer.runAt <= targetTime && timer.runAt < earliestTime) {
          earliestId = id;
          earliestTime = timer.runAt;
        }
      }
      if (earliestId === null) break;
      const timer = activeTimers.get(earliestId);
      activeTimers.delete(earliestId);
      currentTime = timer.runAt;
      await timer.fn();
    }
    currentTime = targetTime;
  };

  let docVisibilityState = 'visible';
  const visibilityListeners = new Set();
  const mockDocument = {
    get visibilityState() {
      return docVisibilityState;
    },
    addEventListener(event, handler) {
      if (event === 'visibilitychange') visibilityListeners.add(handler);
    },
    removeEventListener(event, handler) {
      if (event === 'visibilitychange') visibilityListeners.delete(handler);
    },
  };

  const setDocumentVisibility = (state) => {
    docVisibilityState = state;
    for (const listener of visibilityListeners) {
      listener();
    }
  };

  let activeSessionId = 101;
  let showRosterList = true;
  let activeTab = 'QR';
  let isDocumentVisible = mockDocument.visibilityState === 'visible';
  let isRosterPanelVisible = showRosterList || activeTab === 'MANUAL';

  const handleVisibilityChange = () => {
    isDocumentVisible = mockDocument.visibilityState === 'visible';
    updateEffect();
  };
  mockDocument.addEventListener('visibilitychange', handleVisibilityChange);

  let fetchCallCount = 0;
  const fetchSessionData = async () => {
    fetchCallCount++;
    return true;
  };

  const pollingRef = { current: null };
  let currentCleanup = null;

  const runEffect = () => {
    isRosterPanelVisible = showRosterList || activeTab === 'MANUAL';
    if (activeSessionId && isRosterPanelVisible && isDocumentVisible) {
      if (pollingRef.current) mockClearTimeout(pollingRef.current);
      let isMounted = true;
      let currentInterval = 3000;

      const poll = async () => {
        if (!isMounted) return;
        const success = await fetchSessionData();
        if (!isMounted) return;
        currentInterval = success ? 3000 : Math.min(currentInterval * 2, 30000);
        pollingRef.current = mockSetTimeout(poll, currentInterval);
      };

      fetchSessionData();
      pollingRef.current = mockSetTimeout(poll, currentInterval);

      return () => {
        isMounted = false;
        if (pollingRef.current) mockClearTimeout(pollingRef.current);
      };
    }
    return undefined;
  };

  const updateEffect = () => {
    if (currentCleanup) {
      currentCleanup();
      currentCleanup = null;
    }
    currentCleanup = runEffect();
  };

  // 1. Initial mount: visible tab and visible roster
  updateEffect();
  assert.equal(fetchCallCount, 1, 'Initial poll must fire immediately upon mount');
  assert.equal(activeTimers.size, 1, 'One timer should be scheduled for next poll');

  // Advance 3000ms: second poll
  await advanceTimersByTime(3000);
  assert.equal(fetchCallCount, 2, 'Poll must fire after 3000ms');

  // 2. Hide document tab (Page Visibility API)
  setDocumentVisibility('hidden');
  assert.equal(isDocumentVisible, false);
  assert.equal(activeTimers.size, 0, 'Polling timer must be cleared when document tab is hidden');

  // Advance 10000ms while hidden: NO fetch calls should occur
  await advanceTimersByTime(10000);
  assert.equal(fetchCallCount, 2, 'No fetch calls must occur while document is hidden');

  // 3. Make document tab visible again
  setDocumentVisibility('visible');
  assert.equal(isDocumentVisible, true);
  assert.equal(fetchCallCount, 3, 'Polling must immediately resume when document becomes visible');
  assert.equal(activeTimers.size, 1, 'Timer must be re-scheduled when document becomes visible');

  await advanceTimersByTime(3000);
  assert.equal(fetchCallCount, 4, 'Poll must fire after 3000ms of being visible');

  // 4. Hide panel (showRosterList = false, activeTab = 'QR')
  showRosterList = false;
  activeTab = 'QR';
  updateEffect();
  assert.equal(activeTimers.size, 0, 'Polling timer must be cleared when roster panel is hidden');

  await advanceTimersByTime(10000);
  assert.equal(fetchCallCount, 4, 'No fetch calls must occur while panel is hidden');

  // 5. Switch to MANUAL tab (panel visible again)
  activeTab = 'MANUAL';
  updateEffect();
  assert.equal(fetchCallCount, 5, 'Polling must immediately resume when switching to MANUAL tab');
  assert.equal(activeTimers.size, 1, 'Timer re-scheduled on MANUAL tab');

  await advanceTimersByTime(3000);
  assert.equal(fetchCallCount, 6, 'Poll must fire on MANUAL tab after 3000ms');

  // 6. Session ends (activeSessionId = null)
  activeSessionId = null;
  updateEffect();
  assert.equal(activeTimers.size, 0, 'Timer must be cleared when session ends');

  await advanceTimersByTime(10000);
  assert.equal(fetchCallCount, 6, 'No further fetch calls when session is null');

  mockDocument.removeEventListener('visibilitychange', handleVisibilityChange);
  assert.equal(visibilityListeners.size, 0, 'Visibility listener must be cleaned up');
}

console.log('F4 parallel and visibility-aware polling checks passed (static + behavioral simulation)');
