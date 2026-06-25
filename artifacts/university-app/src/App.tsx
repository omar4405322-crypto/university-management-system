// FIXED: ErrorBoundary, Suspense lazy routes, department detail route, catch-all - Phase 1
import React, { Suspense, lazy } from 'react';
import {
  createBrowserRouter,
  RouterProvider,
  createRoutesFromElements,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import SuperAdminGuard from './components/SuperAdminGuard';
import ErrorBoundary from './components/ErrorBoundary';
import RouteFallback from './components/RouteFallback';
import NotFoundPage from './components/NotFoundPage';
import AppShell from './components/layout/AppShell';
// PERF: All page-level components are now lazy-loaded — excluded from initial bundle
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const DashboardContainer = lazy(() => import('./pages/dashboard/DashboardContainer'));
const CoursesList = lazy(() => import('./pages/courses/CoursesList'));
const CourseDetails = lazy(() => import('./pages/courses/CourseDetails'));
const DoctorsList = lazy(() => import('./pages/doctors/DoctorsList'));
const WeeklySchedule = lazy(() => import('./pages/schedules/WeeklySchedule'));
const DoctorSchedule = lazy(() => import('./pages/schedules/DoctorSchedule'));
const StudentSchedule = lazy(() => import('./pages/schedules/StudentSchedule'));
const ExamsList = lazy(() => import('./pages/exams/ExamsList'));
const ExamDetails = lazy(() => import('./pages/exams/ExamDetails'));
const TakeExam = lazy(() => import('./pages/exams/TakeExam'));
const CollegesList = lazy(() => import('./pages/colleges/CollegesList'));
const CollegeDetails = lazy(() => import('./pages/colleges/CollegeDetails'));
const DepartmentsList = lazy(() => import('./pages/departments/DepartmentsList'));
const RegistrationRequests = lazy(() => import('./pages/registration/RegistrationRequests'));
const NotificationsPage = lazy(() => import('./pages/notifications/NotificationsPage'));
const CreateQuiz = lazy(() => import('./pages/quizzes/CreateQuiz'));
const TakeQuiz = lazy(() => import('./pages/quizzes/TakeQuiz'));
const TasksList = lazy(() => import('./pages/tasks/TasksList'));
const Profile = lazy(() => import('./pages/profile/Profile'));
import { useTranslation } from 'react-i18next';
import { useLanguage } from './context/LanguageContext';
import { ShieldOff } from 'lucide-react';
import Button from './components/ui/Button';

const TimetableGrid = lazy(() => import('./pages/schedules/TimetableGrid'));
const TimetableManagement = lazy(() => import('./pages/schedules/TimetableManagement'));
const SchedulesList = lazy(() => import('./pages/schedules/SchedulesList'));
const CreateExam = lazy(() => import('./pages/exams/CreateExam'));
const DepartmentDetails = lazy(() => import('./pages/departments/DepartmentDetails'));
const AdminsList = lazy(() => import('./pages/registration/AdminsList'));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'));
const StudentsList = lazy(() => import('./pages/students/StudentsList'));
const StudentDetails = lazy(() => import('./pages/students/StudentDetails'));
const FinanceDashboard = lazy(() => import('./pages/finance/FinanceDashboard'));
const AnalyticsDashboard = lazy(() => import('./pages/analytics/AnalyticsDashboard'));
const AttendancePage = lazy(() => import('./pages/attendance/AttendancePage'));
const QuizzesList = lazy(() => import('./pages/quizzes/QuizzesList'));
const DegreeAudit = lazy(() => import('./pages/degree-audit/DegreeAudit'));

const LazyRoute = ({ children }) => (
  <ErrorBoundary>
    <Suspense fallback={<RouteFallback />}>{children}</Suspense>
  </ErrorBoundary>
);

const Unauthorized = () => {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg-page transition-colors duration-300">
      <div className="text-center max-w-md px-6">
        <div className="w-20 h-20 rounded-3xl bg-error/10 flex items-center justify-center mx-auto mb-6">
          <ShieldOff size={36} className="text-error" />
        </div>
        <h1 className="text-3xl font-black text-brand-text-primary dark:text-brand-text-main mb-3">
          {t('common.unauthorizedTitle')}
        </h1>
        <p className="text-brand-text-secondary font-medium mb-8">
          {t('common.unauthorizedMessage')}
        </p>
        <Button
          onClick={() => window.history.back()}
          variant="primary"
          size="lg"
          className="rounded-2xl"
        >
          {t('common.goBack')}
        </Button>
      </div>
    </div>
  );
};

const AppContent = () => {
  const { isRTL } = useLanguage();
  const { user } = useAuth();

  return (
    <div
      className="min-h-screen bg-brand-bg-page text-brand-text-main transition-colors duration-300"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* PERF: Single top-level Suspense catches all newly lazy-loaded pages */}
      <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
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
                      <Route
                        path="dashboard"
                        element={
                          <div className="animate-page">
                            <DashboardContainer />
                          </div>
                        }
                      />
                      <Route
                        path="students"
                        element={
                          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN']}>
                            <div className="animate-page">
                              <LazyRoute>
                                <StudentsList />
                              </LazyRoute>
                            </div>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="students/:id"
                        element={
                          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN']}>
                            <div className="animate-page">
                              <LazyRoute>
                                <StudentDetails />
                              </LazyRoute>
                            </div>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="courses"
                        element={
                          <div className="animate-page">
                            <CoursesList />
                          </div>
                        }
                      />
                      <Route
                        path="courses/:id"
                        element={
                          <div className="animate-page">
                            <CourseDetails />
                          </div>
                        }
                      />
                      <Route
                        path="doctors"
                        element={
                          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN']}>
                            <div className="animate-page">
                              <DoctorsList />
                            </div>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="schedule"
                        element={
                          <div className="animate-page">
                            <WeeklySchedule />
                          </div>
                        }
                      />
                      <Route
                        path="schedules/doctor"
                        element={
                          <ProtectedRoute allowedRoles={['DOCTOR']}>
                            <div className="animate-page">
                              <DoctorSchedule />
                            </div>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="schedules/student"
                        element={
                          <ProtectedRoute allowedRoles={['STUDENT']}>
                            <div className="animate-page">
                              <StudentSchedule />
                            </div>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="timetables-management"
                        element={
                          <ProtectedRoute
                            allowedRoles={[
                              'SUPER_ADMIN',
                              'ADMIN',
                              'COLLEGE_ADMIN',
                              'DEPARTMENT_ADMIN',
                            ]}
                          >
                            <div className="animate-page">
                              <LazyRoute>
                                <TimetableManagement />
                              </LazyRoute>
                            </div>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="schedules-management"
                        element={
                          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN']}>
                            <div className="animate-page">
                              <LazyRoute>
                                <SchedulesList />
                              </LazyRoute>
                            </div>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="schedules/timetable"
                        element={
                          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN']}>
                            <div className="animate-page">
                              <LazyRoute>
                                <TimetableGrid />
                              </LazyRoute>
                            </div>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="exams"
                        element={
                          <div className="animate-page">
                            <ExamsList />
                          </div>
                        }
                      />
                      <Route
                        path="exams/create"
                        element={
                          <ProtectedRoute
                            allowedRoles={['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'COLLEGE_ADMIN']}
                          >
                            <div className="animate-page">
                              <LazyRoute>
                                <CreateExam />
                              </LazyRoute>
                            </div>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="exams/:id/take"
                        element={
                          <ProtectedRoute allowedRoles={['STUDENT']}>
                            <div className="animate-page">
                              <TakeExam />
                            </div>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="exams/:id"
                        element={
                          <div className="animate-page">
                            <ExamDetails />
                          </div>
                        }
                      />
                      <Route
                        path="finance"
                        element={
                          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
                            <div className="animate-page">
                              <LazyRoute>
                                <FinanceDashboard />
                              </LazyRoute>
                            </div>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="analytics"
                        element={
                          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
                            <div className="animate-page">
                              <LazyRoute>
                                <AnalyticsDashboard />
                              </LazyRoute>
                            </div>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="colleges"
                        element={
                          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN']}>
                            <div className="animate-page">
                              <CollegesList />
                            </div>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="colleges/:id"
                        element={
                          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN']}>
                            <div className="animate-page">
                              <CollegeDetails />
                            </div>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="departments/:id"
                        element={
                          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN']}>
                            <div className="animate-page">
                              <LazyRoute>
                                <DepartmentDetails />
                              </LazyRoute>
                            </div>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="departments"
                        element={
                          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN']}>
                            <div className="animate-page">
                              <DepartmentsList />
                            </div>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="registration-requests"
                        element={
                          <ProtectedRoute
                            allowedRoles={[
                              'SUPER_ADMIN',
                              'ADMIN',
                              'COLLEGE_ADMIN',
                              'DEPARTMENT_ADMIN',
                            ]}
                          >
                            <div className="animate-page">
                              <RegistrationRequests />
                            </div>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="admins"
                        element={
                          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
                            <div className="animate-page">
                              <LazyRoute>
                                <AdminsList />
                              </LazyRoute>
                            </div>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="quizzes"
                        element={
                          <ProtectedRoute
                            allowedRoles={[
                              'SUPER_ADMIN',
                              'ADMIN',
                              'DOCTOR',
                              'STUDENT',
                              'COLLEGE_ADMIN',
                            ]}
                          >
                            <div className="animate-page">
                              <LazyRoute>
                                <QuizzesList />
                              </LazyRoute>
                            </div>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="degree-audit/:studentId"
                        element={
                          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'STUDENT']}>
                            <div className="animate-page">
                              <LazyRoute>
                                <DegreeAudit />
                              </LazyRoute>
                            </div>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="quizzes/create"
                        element={
                          <ProtectedRoute
                            allowedRoles={['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'COLLEGE_ADMIN']}
                          >
                            <div className="animate-page">
                              <CreateQuiz />
                            </div>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="quizzes/:id/take"
                        element={
                          <ProtectedRoute allowedRoles={['STUDENT']}>
                            <div className="animate-page">
                              <TakeQuiz />
                            </div>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="tasks"
                        element={
                          <ProtectedRoute
                            allowedRoles={[
                              'SUPER_ADMIN',
                              'ADMIN',
                              'DOCTOR',
                              'STUDENT',
                              'COLLEGE_ADMIN',
                            ]}
                          >
                            <div className="animate-page">
                              <TasksList />
                            </div>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="notifications"
                        element={
                          <div className="animate-page">
                            <NotificationsPage />
                          </div>
                        }
                      />
                      <Route
                        path="attendance"
                        element={
                          <ProtectedRoute
                            allowedRoles={[
                              'SUPER_ADMIN',
                              'ADMIN',
                              'DOCTOR',
                              'STUDENT',
                              'COLLEGE_ADMIN',
                            ]}
                          >
                            <div className="animate-page">
                              <LazyRoute>
                                <AttendancePage />
                              </LazyRoute>
                            </div>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="settings"
                        element={
                          <div className="animate-page">
                            <LazyRoute>
                              <SettingsPage />
                            </LazyRoute>
                          </div>
                        }
                      />
                      <Route
                        path="profile"
                        element={
                          <div className="animate-page">
                            <Profile />
                          </div>
                        }
                      />
                      <Route path="*" element={<NotFoundPage />} />
                    </Routes>
                  </ErrorBoundary>
                </SuperAdminGuard>
              </AppShell>
            </ProtectedRoute>
          }
        />
      </Routes>
      </Suspense>
    </div>
  );
};

const router = createBrowserRouter(
  createRoutesFromElements(<Route path="*" element={<AppContent />} />)
);

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
