// FIXED: ErrorBoundary, Suspense lazy routes, department detail route, catch-all - Phase 1
import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import ProtectedRoute from './components/ProtectedRoute';
import SuperAdminGuard from './components/SuperAdminGuard';
import ErrorBoundary from './components/ErrorBoundary';
import RouteFallback from './components/RouteFallback';
import NotFoundPage from './components/NotFoundPage';
import AppShell from './components/layout/AppShell';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import StudentsList from './pages/students/StudentsList';
import StudentDetails from './pages/students/StudentDetails';
import CoursesList from './pages/courses/CoursesList';
import CourseDetails from './pages/courses/CourseDetails';
import DoctorsList from './pages/doctors/DoctorsList';
import WeeklySchedule from './pages/schedules/WeeklySchedule';
import ExamsList from './pages/exams/ExamsList';
import ExamDetails from './pages/exams/ExamDetails';
import TakeExam from './pages/exams/TakeExam';
import FinanceDashboard from './pages/finance/FinanceDashboard';
import AnalyticsDashboard from './pages/analytics/AnalyticsDashboard';
import CollegesList from './pages/colleges/CollegesList';
import CollegeDetails from './pages/colleges/CollegeDetails';
import DepartmentsList from './pages/departments/DepartmentsList';
import RegistrationRequests from './pages/registration/RegistrationRequests';
import NotificationsPage from './pages/notifications/NotificationsPage';
import AttendancePage from './pages/attendance/AttendancePage';
import QuizzesList from './pages/quizzes/QuizzesList';
import CreateQuiz from './pages/quizzes/CreateQuiz';
import TakeQuiz from './pages/quizzes/TakeQuiz';
import TasksList from './pages/tasks/TasksList';
import Profile from './pages/profile/Profile';
import { useTranslation } from 'react-i18next';
import { useLanguage } from './context/LanguageContext';

const TimetableManagement = lazy(() => import('./pages/schedules/TimetableManagement'));
const SchedulesList = lazy(() => import('./pages/schedules/SchedulesList'));
const CreateExam = lazy(() => import('./pages/exams/CreateExam'));
const DepartmentDetails = lazy(() => import('./pages/departments/DepartmentDetails'));
const AdminsList = lazy(() => import('./pages/registration/AdminsList'));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'));

const LazyRoute = ({ children }) => (
  <ErrorBoundary>
    <Suspense fallback={<RouteFallback />}>{children}</Suspense>
  </ErrorBoundary>
);

const Unauthorized = () => {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-red-600">{t('common.unauthorizedTitle')}</h1>
        <p className="mt-4 text-gray-600 dark:text-gray-400">{t('common.unauthorizedMessage')}</p>
        <button
          type="button"
          onClick={() => window.history.back()}
          className="mt-6 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition duration-150"
        >
          {t('common.goBack')}
        </button>
      </div>
    </div>
  );
};

const AppContent = () => {
  const { isRTL } = useLanguage();

  return (
    <div
      className="min-h-screen bg-brand-bg-page text-brand-text-main transition-colors duration-300"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/unauthorized" element={<Unauthorized />} />

        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AppShell>
                <SuperAdminGuard>
                <ErrorBoundary>
                  <Routes>
                    <Route path="dashboard" element={<div className="fade-in"><Dashboard /></div>} />
                    <Route path="students" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}><div className="fade-in"><StudentsList /></div></ProtectedRoute>} />
                    <Route path="students/:id" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}><div className="fade-in"><StudentDetails /></div></ProtectedRoute>} />
                    <Route path="courses" element={<div className="fade-in"><CoursesList /></div>} />
                    <Route path="courses/:id" element={<div className="fade-in"><CourseDetails /></div>} />
                    <Route path="doctors" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}><div className="fade-in"><DoctorsList /></div></ProtectedRoute>} />
                    <Route path="schedule" element={<div className="fade-in"><WeeklySchedule /></div>} />
                    <Route
                      path="timetables-management"
                      element={
                        <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN']}>
                          <div className="fade-in">
                            <LazyRoute><TimetableManagement /></LazyRoute>
                          </div>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="schedules-management"
                      element={
                        <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
                          <div className="fade-in">
                            <LazyRoute><SchedulesList /></LazyRoute>
                          </div>
                        </ProtectedRoute>
                      }
                    />
                    <Route path="exams" element={<div className="fade-in"><ExamsList /></div>} />
                    <Route
                      path="exams/create"
                      element={
                        <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'DOCTOR']}>
                          <div className="fade-in">
                            <LazyRoute><CreateExam /></LazyRoute>
                          </div>
                        </ProtectedRoute>
                      }
                    />
                    <Route path="exams/:id/take" element={<ProtectedRoute allowedRoles={['STUDENT']}><div className="fade-in"><TakeExam /></div></ProtectedRoute>} />
                    <Route path="exams/:id" element={<div className="fade-in"><ExamDetails /></div>} />
                    <Route path="finance" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}><div className="fade-in"><FinanceDashboard /></div></ProtectedRoute>} />
                    <Route path="analytics" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}><div className="fade-in"><AnalyticsDashboard /></div></ProtectedRoute>} />
                    <Route path="colleges" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}><div className="fade-in"><CollegesList /></div></ProtectedRoute>} />
                    <Route path="colleges/:id" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}><div className="fade-in"><CollegeDetails /></div></ProtectedRoute>} />
                    <Route
                      path="departments/:id"
                      element={
                        <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN']}>
                          <div className="fade-in">
                            <LazyRoute><DepartmentDetails /></LazyRoute>
                          </div>
                        </ProtectedRoute>
                      }
                    />
                    <Route path="departments" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN']}><div className="fade-in"><DepartmentsList /></div></ProtectedRoute>} />
                    <Route path="registration-requests" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN']}><div className="fade-in"><RegistrationRequests /></div></ProtectedRoute>} />
                    <Route
                      path="admins"
                      element={
                        <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
                          <div className="fade-in">
                            <LazyRoute><AdminsList /></LazyRoute>
                          </div>
                        </ProtectedRoute>
                      }
                    />
                    <Route path="quizzes" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'STUDENT']}><div className="fade-in"><QuizzesList /></div></ProtectedRoute>} />
                    <Route path="quizzes/create" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'DOCTOR']}><div className="fade-in"><CreateQuiz /></div></ProtectedRoute>} />
                    <Route path="quizzes/:id/take" element={<ProtectedRoute allowedRoles={['STUDENT']}><div className="fade-in"><TakeQuiz /></div></ProtectedRoute>} />
                    <Route path="tasks" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'STUDENT']}><div className="fade-in"><TasksList /></div></ProtectedRoute>} />
                    <Route path="notifications" element={<div className="fade-in"><NotificationsPage /></div>} />
                    <Route path="attendance" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'STUDENT']}><div className="fade-in"><AttendancePage /></div></ProtectedRoute>} />
                    <Route
                      path="settings"
                      element={
                        <div className="fade-in">
                          <LazyRoute><SettingsPage /></LazyRoute>
                        </div>
                      }
                    />
                    <Route path="profile" element={<div className="fade-in"><Profile /></div>} />
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                </ErrorBoundary>
                </SuperAdminGuard>
              </AppShell>
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <NotificationProvider>
          <AppContent />
        </NotificationProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
