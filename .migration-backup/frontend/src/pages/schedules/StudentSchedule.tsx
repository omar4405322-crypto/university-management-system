import React from 'react';
import WeeklySchedule from './WeeklySchedule';

/**
 * StudentSchedule — Dedicated schedule page for students.
 * Wraps the existing WeeklySchedule component which already:
 *  - Fetches the logged-in user's schedule via schedulesService.getWeeklyTimetable()
 *  - Filters data server-side to enrolled courses (role-scoped on backend)
 *  - Supports Arabic / English (useTranslation hook + RTL)
 *  - Responsive (desktop grid + mobile single-day view)
 *  - Shows loading skeleton and empty state
 */
const StudentSchedule = () => {
  return <WeeklySchedule />;
};

export default StudentSchedule;
