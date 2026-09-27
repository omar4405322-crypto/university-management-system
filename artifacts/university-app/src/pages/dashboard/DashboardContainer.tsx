import React, { lazy } from 'react';
import { useAuth } from '../../context/AuthContext';
import { USER_ROLES } from '../../constants/roles';

const AdminDashboard = lazy(() => import('./AdminDashboard'));
const DoctorDashboard = lazy(() => import('./DoctorDashboard'));
const StudentDashboard = lazy(() => import('./StudentDashboard'));

const dashboardMap: Record<string, React.ComponentType> = {
  [USER_ROLES.SUPER_ADMIN]: AdminDashboard,
  [USER_ROLES.ADMIN]: AdminDashboard,
    [USER_ROLES.COLLEGE_ADMIN]: AdminDashboard,
    [USER_ROLES.DEPARTMENT_ADMIN]: AdminDashboard,
  [USER_ROLES.DOCTOR]: DoctorDashboard,
  [USER_ROLES.STUDENT]: StudentDashboard,
};

export default function DashboardContainer() {
  const { user } = useAuth();
  const Component = user?.role ? dashboardMap[user.role] : null;
  return Component ? <Component /> : null;
}
