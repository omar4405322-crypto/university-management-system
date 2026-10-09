import React from 'react';
import WeeklySchedule from './WeeklySchedule';

/**
 * StudentSchedule — Dedicated schedule page for students (/schedules/student).
 * Matches the unified executive layout, visual hierarchy, 4 KPI cards, and compact filter toolbar
 * established across Doctor and TA schedule views.
 */
export function StudentSchedule() {
  return <WeeklySchedule isStudentView={true} />;
}

export default StudentSchedule;
