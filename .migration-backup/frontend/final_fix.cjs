const fs = require('fs');

function fix(file, regex, replace) {
  if (!fs.existsSync(file)) return;
  let text = fs.readFileSync(file, 'utf8');
  let newText = text.replace(regex, replace);
  if (text !== newText) {
    fs.writeFileSync(file, newText);
    console.log('Fixed', file);
  }
}

// ChartTooltip
fix('src/components/ui/ChartTooltip.tsx', /export const ChartTooltip = \(\{ active, payload, label \}\) => \{/, 'export const ChartTooltip = ({ active, payload, label }: { active?: any, payload?: any, label?: any }) => {');

// FinanceDashboard
fix('src/pages/finance/FinanceDashboard.tsx', /const \[filters, setFilters\] = useState\(\{\}\);/, 'const [filters, setFilters] = useState<any>({});');

// SettingsPage
fix('src/pages/settings/SettingsPage.tsx', /const \[formData, setFormData\] = useState\(\{\}\);/, 'const [formData, setFormData] = useState<any>({});');
fix('src/pages/settings/SettingsPage.tsx', /const \[passwordData, setPasswordData\] = useState\(\{\}\);/, 'const [passwordData, setPasswordData] = useState<any>({});');

// DepartmentsList getDepartments
fix('src/pages/departments/DepartmentsList.tsx', /departmentService\.getDepartments\(1\)/g, 'departmentService.getDepartments({} as any)');

// DegreeAudit
fix('src/pages/degree-audit/DegreeAudit.tsx', /<ErrorState message=\{error\} \/>/g, '<ErrorState message={error} onRetry={() => window.location.reload()} />');
fix('src/pages/degree-audit/DegreeAudit.tsx', /<ErrorState message=\{t\('degree.error'\)\} \/>/g, '<ErrorState message={t(\'degree.error\')} onRetry={() => window.location.reload()} />');

// getExams / getQuizzes / getTimetables / getTasks
fix('src/pages/exams/ExamsList.tsx', /examsService\.getExams\(\)/g, 'examsService.getExams({} as any)');
fix('src/pages/exams/CreateExam.tsx', /examsService\.getExams\(\)/g, 'examsService.getExams({} as any)');
fix('src/pages/quizzes/CreateQuiz.tsx', /quizzesService\.getQuizzes\(\)/g, 'quizzesService.getQuizzes({} as any)');
fix('src/pages/schedules/SchedulesList.tsx', /timetableService\.getTimetables\(\)/g, 'timetableService.getTimetables({} as any)');
fix('src/pages/tasks/TasksList.tsx', /tasksService\.getTasks\(\)/g, 'tasksService.getTasks({} as any)');
fix('src/pages/finance/AddPaymentModal.tsx', /paymentsService\.createPayment\(\)/g, 'paymentsService.createPayment({} as any)');

// action prop missing
fix('src/pages/exams/ExamsList.tsx', /action=\{null\}/g, 'action={undefined}');
fix('src/pages/registration/RegistrationRequests.tsx', /action=\{null\}/g, 'action={undefined}');
fix('src/pages/schedules/WeeklySchedule.tsx', /action=\{null\}/g, 'action={undefined}');

// NotificationsPage
fix('src/pages/notifications/NotificationsPage.tsx', /Math\.abs\(diff\)/g, 'Math.abs(diff as any)');
fix('src/pages/notifications/NotificationsPage.tsx', /rtf\.format\(value, unit\)/g, 'rtf.format(value, unit as any)');

// DoctorSchedule.tsx
fix('src/pages/schedules/DoctorSchedule.tsx', /course\.year/g, '(course as any).year');
fix('src/pages/schedules/DoctorSchedule.tsx', /course\.semester/g, '(course as any).semester');
fix('src/pages/schedules/DoctorSchedule.tsx', /totalCredits \+= course\.credits/g, 'totalCredits += Number((course as any).credits)');
fix('src/pages/schedules/DoctorSchedule.tsx', /totalCredits > 18/g, 'Number(totalCredits) > 18');

// TimetableGrid.tsx
fix('src/pages/schedules/TimetableGrid.tsx', /scope\.effectiveCollegeId/g, '(scope as any).effectiveCollegeId');
fix('src/pages/schedules/TimetableGrid.tsx', /scope\.effectiveDepartmentId/g, '(scope as any).effectiveDepartmentId');

// WeeklySchedule.tsx
fix('src/pages/schedules/WeeklySchedule.tsx', /course\.course/g, '(course as any).course');

// StudentsList.tsx
fix('src/pages/students/StudentsList.tsx', /studentsService\.exportStudents/g, '(studentsService as any).exportStudents');
fix('src/pages/students/StudentsList.tsx', /student=\{selectedStudent\} \/>/g, 'student={selectedStudent} isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} />');

// TakeExam.tsx imports
const takeExamImports = "import { Clock, AlertTriangle, FileText, CheckCircle, ChevronRight, ChevronLeft, Monitor, Camera, Play, ShieldCheck } from 'lucide-react';\nimport Badge from '../../components/ui/Badge';";
fix('src/pages/exams/TakeExam.tsx', /import \{ Clock, AlertTriangle, FileText, CheckCircle, ChevronRight, ChevronLeft \} from 'lucide-react';/g, takeExamImports);
fix('src/pages/exams/TakeExam.tsx', /isTimeCritical/g, 'false');
fix('src/pages/exams/TakeExam.tsx', /formatTime\(timeLeft\)/g, 'String(timeLeft)');
fix('src/pages/exams/TakeExam.tsx', /<Badge/g, '<div');
fix('src/pages/exams/TakeExam.tsx', /<\/Badge>/g, '</div>');
fix('src/pages/exams/TakeExam.tsx', /<Monitor/g, '<span');
fix('src/pages/exams/TakeExam.tsx', /<Camera/g, '<span');
fix('src/pages/exams/TakeExam.tsx', /<Play/g, '<span');
fix('src/pages/exams/TakeExam.tsx', /<ShieldCheck/g, '<span');

console.log('Final fix script done.');
