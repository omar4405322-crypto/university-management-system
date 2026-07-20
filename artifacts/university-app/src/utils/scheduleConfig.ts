/**
 * Centralized schedule configuration utility.
 * Allows Super Admin to configure lecture start time (default 09:00 AM)
 * and time step interval (default 3 minutes or configurable).
 */

export const DEFAULT_START_TIME = '09:00';
export const DEFAULT_TIME_STEP_MINUTES = 3;

export function getScheduleStartTime(): string {
  try {
    return localStorage.getItem('schedule_start_time') || DEFAULT_START_TIME;
  } catch {
    return DEFAULT_START_TIME;
  }
}

export function setScheduleStartTime(time: string): void {
  try {
    localStorage.setItem('schedule_start_time', time);
    window.dispatchEvent(new Event('scheduleConfigChanged'));
  } catch (e) {
    console.error('Failed to save schedule_start_time', e);
  }
}

export function getScheduleTimeStep(): number {
  try {
    const val = localStorage.getItem('schedule_time_step');
    return val ? parseInt(val, 10) : DEFAULT_TIME_STEP_MINUTES;
  } catch {
    return DEFAULT_TIME_STEP_MINUTES;
  }
}

export function setScheduleTimeStep(minutes: number): void {
  try {
    localStorage.setItem('schedule_time_step', minutes.toString());
    window.dispatchEvent(new Event('scheduleConfigChanged'));
  } catch (e) {
    console.error('Failed to save schedule_time_step', e);
  }
}

/**
 * Generates 2-hour timetable grid slot strings starting from configured schedule start time.
 * Example with 09:00 start: ['09:00-11:00', '11:00-13:00', '13:00-15:00', '15:00-17:00', '17:00-19:00']
 */
export function generateTimeSlots(): string[] {
  const startTime = getScheduleStartTime();
  const [startHourStr] = startTime.split(':');
  let startHour = parseInt(startHourStr, 10);
  if (isNaN(startHour)) startHour = 9;

  const slots: string[] = [];
  for (let i = 0; i < 5; i++) {
    const currentStart = startHour + i * 2;
    const currentEnd = currentStart + 2;
    const fmtStart = `${currentStart.toString().padStart(2, '0')}:00`;
    const fmtEnd = `${currentEnd.toString().padStart(2, '0')}:00`;
    slots.push(`${fmtStart}-${fmtEnd}`);
  }
  return slots;
}

/**
 * Generates 1-hour time label strings starting from configured schedule start time.
 * Example with 09:00 start: ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00']
 */
export function generateHourlyTimes(): string[] {
  const startTime = getScheduleStartTime();
  const [startHourStr] = startTime.split(':');
  let startHour = parseInt(startHourStr, 10);
  if (isNaN(startHour)) startHour = 9;

  const times: string[] = [];
  for (let i = 0; i < 10; i++) {
    const hour = startHour + i;
    times.push(`${hour.toString().padStart(2, '0')}:00`);
  }
  return times;
}
