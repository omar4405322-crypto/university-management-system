import React, { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { StudentAttendanceDashboard } from './StudentAttendanceDashboard';
import { FacultyAttendanceDashboard } from './FacultyAttendanceDashboard';

export default function AttendancePage() {
  const { user } = useAuth();
  const isStudent = user?.role === 'STUDENT';

  // Background Effect
  useEffect(() => {
    const mainEl = document.querySelector('main');
    if (mainEl) mainEl.classList.add('bg-slate-50', 'dark:bg-slate-900');
    return () => {
      if (mainEl) mainEl.classList.remove('bg-slate-50', 'dark:bg-slate-900');
    };
  }, []);

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto min-h-[calc(100vh-100px)]">
      {isStudent ? (
        <StudentAttendanceDashboard />
      ) : (
        <FacultyAttendanceDashboard />
      )}
    </div>
  );
}
