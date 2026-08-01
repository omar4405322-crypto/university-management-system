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
import PageWrapper from './components/layout/PageWrapper';
// PERF: All page-level components are now lazy-loaded — excluded from initial bundle
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const DashboardContainer = lazy(() => import('./pages/dashboard/DashboardContainer'));
const CoursesList = lazy(() => import('./pages/courses/CoursesList'));
const CourseDetails = lazy(() => import('./pages/courses/CourseDetails'));
const DoctorsList = lazy(() => import('./pages/doctors/DoctorsList'));
const DoctorDetails = lazy(() => import('./pages/doctors/DoctorDetails'));
const TeachingAssistantsList = lazy(() => import('./pages/teaching-assistants/TeachingAssistantsList'));
const WeeklySchedule = lazy(() => import('./pages/schedules/WeeklySchedule'));
const DoctorSchedule = lazy(() => import('./pages/schedules/DoctorSchedule'));
const StudentSchedule = lazy(() => import('./pages/schedules/StudentSchedule'));
const TASchedule = lazy(() => import('./pages/schedules/TASchedule'));
const ExamsList = lazy(() => import('./pages/exams/ExamsList'));
const ExamDetails = lazy(() => import('./pages/exams/ExamDetails'));
const TakeExam = lazy(() => import('./pages/exams/TakeExam'));
const ExamSubmissions = lazy(() => import('./pages/exams/ExamSubmissions'));
const ExamResults = lazy(() => import('./pages/exams/ExamResults'));
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
import Button from './components/ui/button';

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
const StudentRecord = lazy(() => import('./pages/records/StudentRecord'));
const DegreeAudit = lazy(() => import('./pages/degree-audit/DegreeAudit'));
const GroupManagement = lazy(() => import('./pages/groups/GroupManagement'));
const StudentStatisticsPage = lazy(() => import('./pages/statistics/StudentStatisticsPage'));

const LazyRoute = ({ children }: { children: React.ReactNode }) => (
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
          variant="default"
          size="lg"
          className="rounded-2xl"
        >
          {t('common.goBack')}
        </Button>
      </div>
    </div>
  );
};

import DebugOverflowPanel from './components/ui/DebugOverflowPanel';

const AppContent = () => {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  
  const isDebugMode = new URLSearchParams(window.location.search).get('debug') === '1';

  return (
    <div
      className="min-h-screen bg-brand-bg-page text-brand-text-main transition-colors duration-300 relative"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {isDebugMode && <DebugOverflowPanel />}
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
                          <PageWrapper>
                            <DashboardContainer />
                          </PageWrapper>
                        }
                      />
                      <Route
                        path="students"
                        element={
                          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN']}>
                            <PageWrapper>
                              <LazyRoute>
                                <StudentsList />
                              </LazyRoute>
                            </PageWrapper>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="students/:id"
                        element={
                          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN']}>
                            <PageWrapper>
                              <LazyRoute>
                                <StudentDetails />
                              </LazyRoute>
                            </PageWrapper>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="courses"
                        element={
                          <PageWrapper>
                            <CoursesList />
                          </PageWrapper>
                        }
                      />
                      <Route
                        path="courses/:id"
                        element={
                          <PageWrapper>
                            <CourseDetails />
                          </PageWrapper>
                        }
                      />
                      <Route
                        path="doctors"
                        element={
                          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN']}>
                            <PageWrapper>
                              <LazyRoute>
                                <DoctorsList />
                              </LazyRoute>
                            </PageWrapper>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="doctors/:id"
                        element={
                          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN']}>
                            <PageWrapper>
                              <LazyRoute>
                                <DoctorDetails />
                              </LazyRoute>
                            </PageWrapper>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="teaching-assistants"
                        element={
                          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN']}>
                            <PageWrapper>
                              <LazyRoute>
                                <TeachingAssistantsList />
                              </LazyRoute>
                            </PageWrapper>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="schedules/doctor"
                        element={
                          <ProtectedRoute allowedRoles={['DOCTOR', 'SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN']}>
                            <PageWrapper>
                              <DoctorSchedule />
                            </PageWrapper>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="schedules/student"
                        element={
                          <ProtectedRoute allowedRoles={['STUDENT']}>
                            <PageWrapper>
                              <StudentSchedule />
                            </PageWrapper>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="schedules/ta"
                        element={
                          <ProtectedRoute allowedRoles={['TEACHING_ASSISTANT', 'SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN']}>
                            <PageWrapper>
                              <LazyRoute>
                                <TASchedule />
                              </LazyRoute>
                            </PageWrapper>
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
                            <PageWrapper>
                              <LazyRoute>
                                <TimetableManagement />
                              </LazyRoute>
                            </PageWrapper>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="schedules-management"
                        element={
                          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN']}>
                            <PageWrapper>
                              <LazyRoute>
                                <SchedulesList />
                              </LazyRoute>
                            </PageWrapper>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="exams"
                        element={
                          <PageWrapper>
                            <ExamsList />
                          </PageWrapper>
                        }
                      />
                      <Route
                        path="exams/create"
                        element={
                          <ProtectedRoute
                            allowedRoles={['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'COLLEGE_ADMIN']}
                          >
                            <PageWrapper>
                              <LazyRoute>
                                <CreateExam />
                              </LazyRoute>
                            </PageWrapper>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="exams/:id/take"
                        element={
                          <ProtectedRoute allowedRoles={['STUDENT']}>
                            <PageWrapper>
                              <TakeExam />
                            </PageWrapper>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="exams/:id/submissions"
                        element={
                          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'DOCTOR']}>
                            <PageWrapper>
                              <LazyRoute>
                                <ExamSubmissions />
                              </LazyRoute>
                            </PageWrapper>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="exams/:id/results"
                        element={
                          <ProtectedRoute allowedRoles={['STUDENT']}>
                            <PageWrapper>
                              <LazyRoute>
                                <ExamResults />
                              </LazyRoute>
                            </PageWrapper>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="exams/:id"
                        element={
                          <PageWrapper>
                            <ExamDetails />
                          </PageWrapper>
                        }
                      />
                      <Route
                        path="finance"
                        element={
                          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
                            <PageWrapper>
                              <LazyRoute>
                                <FinanceDashboard />
                              </LazyRoute>
                            </PageWrapper>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="analytics"
                        element={
                          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
                            <PageWrapper>
                              <LazyRoute>
                                <AnalyticsDashboard />
                              </LazyRoute>
                            </PageWrapper>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="colleges"
                        element={
                          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN']}>
                            <PageWrapper>
                              <CollegesList />
                            </PageWrapper>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="colleges/:id"
                        element={
                          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN']}>
                            <PageWrapper>
                              <CollegeDetails />
                            </PageWrapper>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="departments/:id"
                        element={
                          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN']}>
                            <PageWrapper>
                              <LazyRoute>
                                <DepartmentDetails />
                              </LazyRoute>
                            </PageWrapper>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="departments"
                        element={
                          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN']}>
                            <PageWrapper>
                              <DepartmentsList />
                            </PageWrapper>
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
                            <PageWrapper>
                              <RegistrationRequests />
                            </PageWrapper>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="admins"
                        element={
                          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
                            <PageWrapper>
                              <LazyRoute>
                                <AdminsList />
                              </LazyRoute>
                            </PageWrapper>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="groups"
                        element={
                          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN']}>
                            <PageWrapper>
                              <LazyRoute>
                                <GroupManagement />
                              </LazyRoute>
                            </PageWrapper>
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
                            <PageWrapper>
                              <LazyRoute>
                                <QuizzesList />
                              </LazyRoute>
                            </PageWrapper>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="record"
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
                            <PageWrapper>
                              <LazyRoute>
                                <StudentRecord />
                              </LazyRoute>
                            </PageWrapper>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="degree-audit/:studentId"
                        element={
                          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'STUDENT']}>
                            <PageWrapper>
                              <LazyRoute>
                                <DegreeAudit />
                              </LazyRoute>
                            </PageWrapper>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="quizzes/create"
                        element={
                          <ProtectedRoute
                            allowedRoles={['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'COLLEGE_ADMIN']}
                          >
                            <PageWrapper>
                              <CreateQuiz />
                            </PageWrapper>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="quizzes/:id/take"
                        element={
                          <ProtectedRoute allowedRoles={['STUDENT']}>
                            <PageWrapper>
                              <TakeQuiz />
                            </PageWrapper>
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
                            <PageWrapper>
                              <TasksList />
                            </PageWrapper>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="notifications"
                        element={
                          <PageWrapper>
                            <NotificationsPage />
                          </PageWrapper>
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
                            <PageWrapper>
                              <LazyRoute>
                                <AttendancePage />
                              </LazyRoute>
                            </PageWrapper>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="statistics"
                        element={
                          <ProtectedRoute
                            allowedRoles={[
                              'SUPER_ADMIN',
                              'ADMIN',
                              'DOCTOR',
                              'STUDENT',
                              'COLLEGE_ADMIN',
                              'DEPARTMENT_ADMIN',
                            ]}
                          >
                            <PageWrapper>
                              <LazyRoute>
                                <StudentStatisticsPage />
                              </LazyRoute>
                            </PageWrapper>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="statistics/:studentId"
                        element={
                          <ProtectedRoute
                            allowedRoles={[
                              'SUPER_ADMIN',
                              'ADMIN',
                              'DOCTOR',
                              'COLLEGE_ADMIN',
                              'DEPARTMENT_ADMIN',
                            ]}
                          >
                            <PageWrapper>
                              <LazyRoute>
                                <StudentStatisticsPage isAdvisorView={true} />
                              </LazyRoute>
                            </PageWrapper>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="settings"
                        element={
                          <PageWrapper>
                            <LazyRoute>
                              <SettingsPage />
                            </LazyRoute>
                          </PageWrapper>
                        }
                      />
                      <Route
                        path="profile"
                        element={
                          <PageWrapper>
                            <Profile />
                          </PageWrapper>
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
