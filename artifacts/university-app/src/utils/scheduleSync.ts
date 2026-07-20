/**
 * scheduleSync.ts
 * Real-time event synchronization module between Tables Management and Tables Grid.
 */

export const notifyScheduleChange = () => {
  // 1. Broadcast custom DOM event for active components in current tab
  window.dispatchEvent(new CustomEvent('scheduleDataChanged'));

  // 2. Broadcast via localStorage for cross-tab or cross-window synchronization
  localStorage.setItem('schedule_last_updated', Date.now().toString());
};

export const subscribeToScheduleChanges = (callback: () => void) => {
  const handleStorage = (e: StorageEvent) => {
    if (e.key === 'schedule_last_updated') {
      callback();
    }
  };

  window.addEventListener('scheduleDataChanged', callback);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener('scheduleDataChanged', callback);
    window.removeEventListener('storage', handleStorage);
  };
};
