import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppShell from './components/layout/AppShell';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import StudentsList from './pages/students/StudentsList';
import StudentDetails from './pages/students/StudentDetails';
import CoursesList from './pages/courses/CoursesList';
import DoctorsList from './pages/doctors/DoctorsList';
import WeeklySchedule from './pages/schedules/WeeklySchedule';
import SchedulesList from './pages/schedules/SchedulesList';
import ExamsList from './pages/exams/ExamsList';
import FinanceDashboard from './pages/finance/FinanceDashboard';
import CollegesList from './pages/colleges/CollegesList';
import CollegeDetails from './pages/colleges/CollegeDetails';
import DepartmentsList from './pages/departments/DepartmentsList';
import RegistrationRequests from './pages/registration/RegistrationRequests';
import QuizzesList from './pages/quizzes/QuizzesList';
import CreateQuiz from './pages/quizzes/CreateQuiz';
import TakeQuiz from './pages/quizzes/TakeQuiz';
import TasksList from './pages/tasks/TasksList';
import Profile from './pages/profile/Profile';

const Unauthorized = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
    <div className="text-center">
      <h1 className="text-4xl font-bold text-red-600">403 - Unauthorized</h1>
      <p className="mt-4 text-gray-600 dark:text-gray-400">You do not have permission to access this page.</p>
      <button 
        onClick={() => window.history.back()}
        className="mt-6 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition duration-150"
      >
        Go Back
      </button>
    </div>
  </div>
);

import { useTranslation } from 'react-i18next';
import { useTheme } from './context/ThemeContext';

const AppContent = () => {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const { isDark } = useTheme();

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'dark bg-slate-900' : 'bg-slate-50'}`} dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/unauthorized" element={<Unauthorized />} />
        
        <Route 
          path="/*" 
          element={
            <ProtectedRoute>
              <AppShell>
                <Routes>
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="students" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}><StudentsList /></ProtectedRoute>} />
                  <Route path="students/:id" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}><StudentDetails /></ProtectedRoute>} />
                  <Route path="courses" element={<CoursesList />} />
                  <Route path="doctors" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}><DoctorsList /></ProtectedRoute>} />
                  <Route path="schedule" element={<WeeklySchedule />} />
                  <Route path="schedules-management" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}><SchedulesList /></ProtectedRoute>} />
                  <Route path="exams" element={<ExamsList />} />
                  <Route path="finance" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}><FinanceDashboard /></ProtectedRoute>} />
                  <Route path="colleges" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}><CollegesList /></ProtectedRoute>} />
                  <Route path="colleges/:id" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}><CollegeDetails /></ProtectedRoute>} />
                  <Route path="departments" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN']}><DepartmentsList /></ProtectedRoute>} />
                  <Route path="registration-requests" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN']}><RegistrationRequests /></ProtectedRoute>} />
                  <Route path="quizzes" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'STUDENT']}><QuizzesList /></ProtectedRoute>} />
                  <Route path="quizzes/create" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'DOCTOR']}><CreateQuiz /></ProtectedRoute>} />
                  <Route path="quizzes/:id/take" element={<ProtectedRoute allowedRoles={['STUDENT']}><TakeQuiz /></ProtectedRoute>} />
                  <Route path="tasks" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'STUDENT']}><TasksList /></ProtectedRoute>} />
                  <Route path="profile" element={<Profile />} />
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                </Routes>
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
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
            <AppContent />
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;
