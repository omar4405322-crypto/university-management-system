/**
 * Phase 11 — Tables / Data UX Regression Contracts.
 *
 * Static source and semantic accessibility contracts for table surfaces.
 * Validates table semantics (scope, caption, aria-sort, button controls, RTL alignment, i18n parity).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_SRC = resolve(__dirname, '../src');
const src = (rel) => readFileSync(resolve(APP_SRC, rel), 'utf-8');

describe('Phase 11 — Group A: table.tsx primitive (TAB-02)', () => {
  it('TableHead has default scope="col" and preserves overridable scope prop', () => {
    const code = src('components/ui/table.tsx');
    assert.match(
      code,
      /scope\s*=\s*\{?\s*(?:props\.)?scope\s*\?\?\s*["']col["']\}?/,
      'TableHead must set scope to props.scope ?? "col"'
    );
  });

  it('TableHead does not introduce an unapproved sort API into the primitive', () => {
    const code = src('components/ui/table.tsx');
    assert.doesNotMatch(
      code,
      /sortable|onSort|sortOrder/i,
      'TableHead primitive must not contain sort API'
    );
  });
});

describe('Phase 11 — Group B: FinanceDashboard (TAB-01)', () => {
  it('FinanceDashboard includes Pagination component and passes page/limit to admin getPayments', () => {
    const code = src('pages/finance/FinanceDashboard.tsx');
    assert.match(code, /import\s+.*Pagination.*from/, 'FinanceDashboard must import Pagination');
    assert.match(code, /<Pagination\s+/, 'FinanceDashboard must render Pagination');
    assert.match(code, /params\.page\s*=\s*page/, 'FinanceDashboard must pass page param to getPayments');
    assert.match(code, /params\.limit\s*=\s*limit/, 'FinanceDashboard must pass limit param to getPayments');
  });

  it('FinanceDashboard has sr-only TableCaption and row-specific action labels', () => {
    const code = src('pages/finance/FinanceDashboard.tsx');
    assert.match(
      code,
      /<TableCaption\s+className=["']sr-only["']>\s*\{t\(['"]tables\.caption\.financeDashboard['"]/,
      'FinanceDashboard must render sr-only TableCaption with tables.caption.financeDashboard'
    );
    assert.match(
      code,
      /aria-label=.*payment\.id/,
      'FinanceDashboard action buttons must include payment ID row context in aria-label'
    );
  });

  it('FinanceDashboard batches search debounce and setPage(1) in the same effect', () => {
    const code = src('pages/finance/FinanceDashboard.tsx');
    assert.doesNotMatch(
      code,
      /useEffect\s*\(\s*\(\)\s*=>\s*\{?\s*setPage\(1\)/,
      'FinanceDashboard must not have a standalone useEffect resetting page to 1'
    );
    assert.match(
      code,
      /setDebouncedSearch\(filters\.search\);\s*setPage\(1\);/,
      'Search debounce and setPage(1) must happen in the same state update block'
    );
  });

  it('FinanceDashboard implements fetch-once logic and stats separation', () => {
    const code = src('pages/finance/FinanceDashboard.tsx');
    assert.match(
      code,
      /if\s*\(!isRefresh\s*&&\s*hasFetchedStudent\.current\)\s*\{\s*return;\s*\}/,
      'Student mode must bypass fetch if already fetched and not refreshing'
    );
    assert.match(
      code,
      /if\s*\(isRefresh\s*\|\|\s*!hasFetchedStudent\.current\)\s*\{\s*fetchStats\(\)/,
      'Admin mode must only fetch stats on refresh or initial load'
    );
  });

  it('FinanceDashboard uses activeTotalCount > 10 for Pagination visibility', () => {
    const code = src('pages/finance/FinanceDashboard.tsx');
    assert.match(
      code,
      /\{activeTotalCount > 10 && \(/,
      'Pagination must only show when activeTotalCount > 10'
    );
  });

  it('FinanceDashboard renders correct empty state for student search', () => {
    const code = src('pages/finance/FinanceDashboard.tsx');
    assert.match(
      code,
      /subtitle=\{\s*hasActiveFilters\s*\?\s*t\(['"]finance\.noPaymentsDesc['"]/,
      'Student empty state must use noPaymentsDesc when filters are active'
    );
  });

  it('FinanceDashboard filters student payments before pagination slicing and clamps page to totalPages', () => {
    const code = src('pages/finance/FinanceDashboard.tsx');
    assert.match(
      code,
      /filteredStudentPayments\s*=\s*useMemo\(\(\)\s*=>\s*\{[\s\S]*?allStudentPayments\.filter/,
      'Student mode must filter allStudentPayments before pagination'
    );
    assert.match(
      code,
      /displayedPayments\s*=\s*useMemo\(\(\)\s*=>\s*\{[\s\S]*?filteredStudentPayments\.slice\(\(page\s*-\s*1\)\s*\*\s*limit,\s*page\s*\*\s*limit\)/,
      'Student mode must slice filteredStudentPayments'
    );
    assert.match(
      code,
      /useEffect\(\(\)\s*=>\s*\{\s*if\s*\(page\s*>\s*totalPages\s*&&\s*totalPages\s*>\s*0\)\s*\{\s*setPage\(totalPages\);\s*\}\s*\}, \[\s*page,\s*totalPages\s*\]\)/,
      'FinanceDashboard must clamp page when exceeding totalPages'
    );
  });
});

describe('Phase 11 — Group C: StudentsList sortable headers (TAB-03)', () => {
  it('StudentsList sortable headers use button inside TableHead with conditional aria-sort on th', () => {
    const code = src('pages/students/StudentsList.tsx');
    assert.match(
      code,
      /aria-sort\s*=\s*\{\s*sortBy\s*===\s*["']firstName["']\s*\?\s*\(?\s*sortOrder\s*===\s*["']asc["']\s*\?\s*["']ascending["']\s*:\s*["']descending["']\s*\)?\s*:\s*undefined\s*\}/,
      'TableHead firstName must set aria-sort ascending/descending conditionally or undefined'
    );
    assert.match(
      code,
      /<button\s+[^>]*type=["']button["'][^>]*onClick=\{\(\)\s*=>\s*handleHeaderSort\(['"]firstName['"]\)\}/,
      'TableHead firstName must contain a native button type="button" with onClick'
    );
    assert.match(
      code,
      /<button\s+[^>]*type=["']button["'][^>]*onClick=\{\(\)\s*=>\s*handleHeaderSort\(['"]year['"]\)\}/,
      'TableHead year must contain a native button type="button" with onClick'
    );
  });

  it('StudentsList has sr-only TableCaption', () => {
    const code = src('pages/students/StudentsList.tsx');
    assert.match(
      code,
      /<TableCaption\s+className=["']sr-only["']>\s*\{t\(['"]tables\.caption\.studentsList['"]/,
      'StudentsList must render sr-only TableCaption with tables.caption.studentsList'
    );
  });
});

describe('Phase 11 — Group D: RTL and localization (TAB-04, TAB-05)', () => {
  it('DegreeAudit uses text-start (not text-left), scope="col", and sr-only caption', () => {
    const code = src('pages/degree-audit/DegreeAudit.tsx');
    assert.doesNotMatch(code, /<table[^>]*text-left/, 'DegreeAudit must not use physical text-left');
    assert.match(code, /<table[^>]*text-start/, 'DegreeAudit must use logical text-start');
    assert.match(
      code,
      /<caption\s+className=["']sr-only["']>\s*\{t\(['"]tables\.caption\.degreeAuditCategory['"]/,
      'DegreeAudit must render sr-only caption with tables.caption.degreeAuditCategory'
    );
    assert.match(code, /<th[^>]*scope=["']col["']/, 'DegreeAudit headers must have scope="col"');
  });

  it('FacultyAttendanceDashboard uses t(...) for table headers with byte-identical Arabic strings and sr-only caption', () => {
    const code = src('pages/attendance/FacultyAttendanceDashboard.tsx');
    assert.match(
      code,
      /<TableCaption\s+className=["']sr-only["']>\s*\{t\(['"]tables\.caption\.facultyAttendance['"]/,
      'FacultyAttendanceDashboard must render sr-only TableCaption with tables.caption.facultyAttendance'
    );
    assert.doesNotMatch(code, />كود<\/TableHead>/, 'Code header must not be hardcoded literal');
    assert.doesNotMatch(code, />اسم المقرر<\/TableHead>/, 'Course header must not be hardcoded literal');
    assert.match(code, /t\(['"]facultyAttendance\.thCode['"]/, 'Code header must use t(facultyAttendance.thCode)');
    assert.match(code, /t\(['"]facultyAttendance\.thCourseName['"]/, 'Course header must use t(facultyAttendance.thCourseName)');
  });
});

describe('Phase 11 — Group E: matrices (TAB-09 TimetableGrid, TAB-23 ScheduleView)', () => {
  it('TimetableGrid has sr-only caption, scope="col" on day headers, and th scope="row" on time cells', () => {
    const code = src('pages/schedules/TimetableGrid.tsx');
    assert.match(
      code,
      /<caption\s+className=["']sr-only["']>\s*\{t\(['"]tables\.caption\.timetableGrid['"]/,
      'TimetableGrid must render sr-only caption with tables.caption.timetableGrid'
    );
    assert.match(code, /<th[^>]*scope=["']col["'][^>]*>\s*\{t\(['"]timetables\.startTime['"]/, 'TimetableGrid time header must have scope="col"');
    assert.match(code, /<th[^>]*key=\{day\}[^>]*scope=["']col["']/, 'TimetableGrid day headers must have scope="col"');
    assert.match(code, /<th[^>]*scope=["']row["'][^>]*p-3 font-bold/, 'TimetableGrid time slots in tbody must be <th scope="row">');
  });

  it('ScheduleView has sr-only caption, scope="col" on day headers, and th scope="row" on time cells', () => {
    const code = src('components/timetable/ScheduleView.tsx');
    assert.match(
      code,
      /<caption\s+className=["']sr-only["']>\s*\{t\(['"]tables\.caption\.scheduleView['"]/,
      'ScheduleView must render sr-only caption with tables.caption.scheduleView'
    );
    assert.match(code, /<th[^>]*scope=["']col["'][^>]*>\s*<Clock/, 'ScheduleView time header must have scope="col"');
    assert.match(code, /<th[^>]*key=\{day\}[^>]*scope=["']col["']/, 'ScheduleView day headers must have scope="col"');
    assert.match(code, /<th[^>]*scope=["']row["'][^>]*whitespace-nowrap/, 'ScheduleView time cells in tbody must be <th scope="row">');
  });
});

describe('Phase 11 — Group F: remaining surfaces (TAB-06 to TAB-22)', () => {
  it('CourseRosterTab (TAB-06): sr-only caption and scope="col" on headers', () => {
    const code = src('pages/courses/components/CourseRosterTab.tsx');
    assert.match(code, /<caption\s+className=["']sr-only["']>\s*\{t\(['"]tables\.caption\.courseRoster['"]/, 'CourseRosterTab must have sr-only caption');
    assert.match(code, /<th[^>]*scope=["']col["']/, 'CourseRosterTab headers must have scope="col"');
  });

  it('ExamsList (TAB-07): sr-only caption, scope="col" on headers, and select-all aria-label', () => {
    const code = src('pages/exams/ExamsList.tsx');
    assert.match(code, /<caption\s+className=["']sr-only["']>\s*\{t\(['"]tables\.caption\.examsList['"]/, 'ExamsList table must have sr-only caption');
    assert.match(code, /<th[^>]*scope=["']col["']/, 'ExamsList headers must have scope="col"');
    assert.match(code, /aria-label=.*(?:selectAll|deselectAll)/, 'ExamsList select-all button must have aria-label');
  });

  it('AdminExamRecordView (TAB-08): sr-only caption, scope="col", and select-all aria-label', () => {
    const code = src('pages/records/components/AdminExamRecordView.tsx');
    assert.match(code, /<caption\s+className=["']sr-only["']>\s*\{t\(['"]tables\.caption\.adminExamRecord['"]/, 'AdminExamRecordView must have sr-only caption');
    assert.match(code, /<th[^>]*scope=["']col["']/, 'AdminExamRecordView headers must have scope="col"');
    assert.match(code, /aria-label=.*(?:selectAll|deselectAll)/, 'AdminExamRecordView select-all button must have aria-label');
  });

  it('KnowledgeBaseAdminPage (TAB-10): sr-only caption, scope="col", and row-context action labels', () => {
    const code = src('pages/knowledge/KnowledgeBaseAdminPage.tsx');
    assert.match(code, /<caption\s+className=["']sr-only["']>\s*\{t\(['"]tables\.caption\.knowledgeBase['"]/, 'KnowledgeBaseAdminPage must have sr-only caption');
    assert.match(code, /<th[^>]*scope=["']col["']/, 'KnowledgeBaseAdminPage headers must have scope="col"');
    assert.match(code, /aria-label=.*viewDetailsTitle/, 'KnowledgeBaseAdminPage action buttons must have aria-label with viewDetailsTitle key');
  });

  it('TimetableManagement & SchedulesList (TAB-11A, TAB-11B): sr-only captions and scope="col"', () => {
    const c1 = src('pages/schedules/TimetableManagement.tsx');
    assert.match(c1, /<caption\s+className=["']sr-only["']>\s*\{t\(['"]tables\.caption\.timetableManagement['"]/, 'TimetableManagement must have sr-only caption');
    assert.match(c1, /<th[^>]*scope=["']col["']/, 'TimetableManagement headers must have scope="col"');

    const c2 = src('pages/schedules/SchedulesList.tsx');
    assert.match(c2, /<caption\s+className=["']sr-only["']>\s*\{t\(['"]tables\.caption\.schedulesList['"]/, 'SchedulesList must have sr-only caption');
    assert.match(c2, /<th[^>]*scope=["']col["']/, 'SchedulesList headers must have scope="col"');
  });

  it('TasksTable (TAB-12): sr-only TableCaption and row-specific aria-label on selection buttons', () => {
    const code = src('pages/tasks/components/TasksTable.tsx');
    assert.match(code, /<TableCaption\s+className=["']sr-only["']>\s*\{t\(['"]tables\.caption\.tasksTable['"]/, 'TasksTable must have sr-only TableCaption');

    // Bounded balanced-brace extractor for all aria-label expressions
    function extractAllAriaLabelExpressions(source) {
      const expressions = [];
      const marker = 'aria-label={';
      let idx = 0;
      while ((idx = source.indexOf(marker, idx)) !== -1) {
        let start = idx + marker.length;
        let depth = 1;
        let pos = start;
        while (pos < source.length && depth > 0) {
          if (source[pos] === '{') depth++;
          else if (source[pos] === '}') depth--;
          pos++;
        }
        expressions.push(source.slice(start, pos - 1));
        idx = pos;
      }
      return expressions;
    }

    const exprs = extractAllAriaLabelExpressions(code);
    const rowExpr = exprs.find(e => e.includes('tasks.selectTaskTitle'));
    assert.ok(rowExpr, 'TasksTable must have a row selection aria-label expression');
    assert.ok(rowExpr.includes('tasks.deselectTaskTitle'), 'aria-label must include tasks.deselectTaskTitle');
    assert.ok(rowExpr.includes('task.title'), 'aria-label must bind task.title');
  });

  it('QuizSubmissionsModal & StudentDetails (TAB-13, TAB-17): raw tables have sr-only caption and scope="col"', () => {
    const c1 = src('pages/quizzes/QuizSubmissionsModal.tsx');
    assert.match(c1, /<caption\s+className=["']sr-only["']>\s*\{t\(['"]tables\.caption\.quizSubmissions['"]/, 'QuizSubmissionsModal must have sr-only caption');
    assert.match(c1, /<th[^>]*scope=["']col["']/, 'QuizSubmissionsModal headers must have scope="col"');

    const c2 = src('pages/students/StudentDetails.tsx');
    assert.match(c2, /<caption\s+className=["']sr-only["']>\s*\{t\(['"]tables\.caption\.studentTuition['"]/, 'StudentDetails tuition table must have sr-only caption');
    assert.match(c2, /<th[^>]*scope=["']col["']/, 'StudentDetails headers must have scope="col"');
  });

  it('Primitive tables (TAB-14A, 14B, 15A, 15B, 16A, 16B, 19, 20, 21): sr-only TableCaption', () => {
    const files = [
      ['pages/doctors/DoctorsList.tsx', 'doctorsList'],
      ['pages/teaching-assistants/TeachingAssistantsList.tsx', 'teachingAssistantsList'],
      ['pages/registration/components/RegistrationRequestsTable.tsx', 'registrationRequests'],
      ['pages/registration/AdminsList.tsx', 'adminsList'],
      ['pages/colleges/CollegeDetails.tsx', 'collegeDepartments'],
      ['pages/departments/DepartmentDetails.tsx', 'departmentStudyPlanYear'],
      ['pages/courses/CoursesList.tsx', 'coursesList'],
      ['pages/attendance/StudentWarningsPage.tsx', 'studentWarnings'],
      ['pages/departments/DepartmentsList.tsx', 'departmentsList'],
    ];

    for (const [file, key] of files) {
      const code = src(file);
      const re = new RegExp(`<TableCaption\\s+className=["']sr-only["']>\\s*\\{t\\(['"]tables\\.caption\\.${key}['"]`);
      assert.match(code, re, `${file} must render TableCaption with tables.caption.${key}`);
    }
  });

  it('AiMessageContent (TAB-22): scope="col" on headers and sr-only caption', () => {
    const code = src('components/ai/AiMessageContent.tsx');
    assert.match(code, /<th[^>]*scope=["']col["']/, 'AiMessageContent markdown table headers must have scope="col"');
    assert.match(code, /<caption[^>]*className=["']sr-only["']/, 'AiMessageContent markdown table must have sr-only caption');
  });

  it('Step 2b/2c additions: CollegeDetails action buttons and DepartmentsList select-all button have aria-labels', () => {
    const cdCode = src('pages/colleges/CollegeDetails.tsx');
    assert.match(cdCode, /aria-label=\{t\(['"]colleges\.viewDepartmentName['"]/, 'CollegeDetails view button must have t(colleges.viewDepartmentName)');
    assert.match(cdCode, /aria-label=\{t\(['"]colleges\.deleteDepartmentName['"]/, 'CollegeDetails delete button must have t(colleges.deleteDepartmentName)');

    const dlCode = src('pages/departments/DepartmentsList.tsx');
    assert.match(dlCode, /aria-label=\{\s*isAllSelected\s*\?\s*t\("common\.deselectAll", "Deselect All"\)\s*:\s*t\("common\.selectAll", "Select All"\)\s*\}/, 'DepartmentsList select-all button must have aria-label');
  });

  it('Step 2c hardcoded string guards: no isRTL ? literal pairs in new action aria-labels and key parity in dictionaries', () => {
    const actionAriaFiles = [
      'pages/tasks/components/TasksTable.tsx',
      'pages/knowledge/KnowledgeBaseAdminPage.tsx',
      'pages/colleges/CollegeDetails.tsx',
      'pages/finance/FinanceDashboard.tsx',
      'pages/courses/components/CourseRosterTab.tsx',
      'pages/departments/DepartmentsList.tsx',
      'pages/records/components/AdminExamRecordView.tsx',
    ];

    for (const rel of actionAriaFiles) {
      const code = src(rel);
      // Balanced brace search for aria-label expressions
      let idx = 0;
      while ((idx = code.indexOf('aria-label={', idx)) !== -1) {
        let start = idx + 'aria-label={'.length;
        let depth = 1;
        let pos = start;
        while (pos < code.length && depth > 0) {
          if (code[pos] === '{') depth++;
          else if (code[pos] === '}') depth--;
          pos++;
        }
        const expr = code.slice(start, pos - 1);
        assert.doesNotMatch(
          expr,
          /isRTL\s*\?/,
          `${rel} contains an isRTL string literal ternary in aria-label: ${expr}`
        );
        idx = pos;
      }
    }

    const en = JSON.parse(src('i18n/en.json'));
    const ar = JSON.parse(src('i18n/ar.json'));

    const requiredKeys = [
      'colleges.viewDepartmentName',
      'colleges.deleteDepartmentName',
      'tasks.selectAllTasks',
      'tasks.deselectAllTasks',
      'tasks.selectTaskTitle',
      'tasks.deselectTaskTitle',
      'knowledgeBase.viewDetailsTitle',
      'knowledgeBase.archiveDocumentTitle',
      'finance.totalRecords',
      'finance.markPaidAria',
      'finance.downloadReceiptAria',
      'finance.editPaymentAria',
      'finance.deletePaymentAria',
      'finance.payNowAria',
      'tables.caption.departmentStudyPlanYear',
      'tables.caption.departmentDoctors',
      'tables.caption.departmentStudents',
      'tables.caption.degreeAuditCategory',
    ];

    function resolveKey(obj, path) {
      return path.split('.').reduce((o, k) => o && o[k], obj);
    }

    for (const key of requiredKeys) {
      assert.ok(resolveKey(en, key), `en.json must define ${key}`);
      assert.ok(resolveKey(ar, key), `ar.json must define ${key}`);
    }
  });

  it('no raw-key translation values in en.json or ar.json for Phase 11 surfaces (D2 contract)', () => {
    const en = JSON.parse(readFileSync(resolve(APP_SRC, 'i18n/en.json'), 'utf-8'));
    const ar = JSON.parse(readFileSync(resolve(APP_SRC, 'i18n/ar.json'), 'utf-8'));

    function resolveKey(obj, path) {
      return path.split('.').reduce((o, k) => o && o[k], obj);
    }

    const phase11Keys = [
      'auth.fullName',
      'students.studentCode',
      'common.total',
      'students.title',
      'students.subtitle',
      'students.addStudent',
      'statistics.gpaDescription',
      'students.searchPlaceholder',
      'courses.title',
      'courses.searchPlaceholder',
      'courses.addCourse',
      'courses.courseCode',
      'courses.courseName',
      'courses.credits',
      'courses.instructor',
      'schedules.managementTitle',
      'schedules.colCourseDept',
      'schedules.colDayTime',
      'schedules.colRoom',
      'schedules.selectAll',
      'schedules.deselectAll',
      'timetables.colTitleDept',
      'timetables.colYearSem',
      'timetables.colStatus',
      'timetables.colUpdatedAt',
      'timetables.colActions',
      'timetables.publishedStatus',
      'timetables.draftStatus',
      'timetables.startTime',
      'timetables.selectCollege',
      'timetables.selectDept',
      'timetables.viewTimetableSchedule',
      'timetables.viewTimetableItem',
      'timetables.publishTimetableItem',
      'timetables.unpublishTimetableItem',
      'timetables.editTimetableItem',
      'timetables.deleteTimetableItem',
      'registration.viewRequestFor',
      'registration.rejectRequestFor',
      'registration.approveRequestFor',
      'registration.deleteRequestFor',
      'transcript.viewExamSubmissionsFor',
    ];

    for (const k of phase11Keys) {
      const enVal = resolveKey(en, k);
      const arVal = resolveKey(ar, k);
      const lastSeg = k.split('.').pop();

      assert.ok(enVal, `en.json must define key ${k}`);
      assert.notEqual(enVal, k, `en.json key ${k} must not equal raw key string`);
      assert.notEqual(enVal, lastSeg, `en.json key ${k} must not equal last segment`);

      assert.ok(arVal, `ar.json must define key ${k}`);
      assert.notEqual(arVal, k, `ar.json key ${k} must not equal raw key string`);
      assert.notEqual(arVal, lastSeg, `ar.json key ${k} must not equal last segment`);
    }
  });
});

describe('Phase 11 — Group G: D5-A & D6-A Static Contracts', () => {
  it('ActionMenu renders act.ariaLabel ?? act.label for both title and aria-label', () => {
    const code = src('components/ui/table.tsx');
    assert.match(
      code,
      /title=\{\s*act\.ariaLabel\s*\?\?\s*act\.label\s*\}/,
      'ActionMenu button must render title={act.ariaLabel ?? act.label}'
    );
    assert.match(
      code,
      /aria-label=\{\s*act\.ariaLabel\s*\?\?\s*act\.label\s*\}/,
      'ActionMenu button must render aria-label={act.ariaLabel ?? act.label}'
    );
  });

  it('every literal t() key used in Phase 11 files exists in both dictionaries with matching interpolation variables (dynamically scanned)', () => {
    const en = JSON.parse(src('i18n/en.json'));
    const ar = JSON.parse(src('i18n/ar.json'));

    function getVal(obj, keyPath) {
      const parts = keyPath.split('.');
      let curr = obj;
      for (const p of parts) {
        if (!curr || typeof curr !== 'object') return undefined;
        curr = curr[p];
      }
      return typeof curr === 'string' ? curr : undefined;
    }

    const phase11Surfaces = [
      'components/ai/AiMessageContent.tsx',
      'components/timetable/ScheduleView.tsx',
      'components/ui/table.tsx',
      'pages/attendance/FacultyAttendanceDashboard.tsx',
      'pages/attendance/StudentWarningsPage.tsx',
      'pages/colleges/CollegeDetails.tsx',
      'pages/courses/CoursesList.tsx',
      'pages/courses/components/CourseRosterTab.tsx',
      'pages/degree-audit/DegreeAudit.tsx',
      'pages/departments/DepartmentDetails.tsx',
      'pages/departments/DepartmentsList.tsx',
      'pages/doctors/DoctorsList.tsx',
      'pages/exams/ExamsList.tsx',
      'pages/finance/FinanceDashboard.tsx',
      'pages/knowledge/KnowledgeBaseAdminPage.tsx',
      'pages/quizzes/QuizSubmissionsModal.tsx',
      'pages/records/components/AdminExamRecordView.tsx',
      'pages/registration/AdminsList.tsx',
      'pages/registration/components/RegistrationRequestsTable.tsx',
      'pages/schedules/SchedulesList.tsx',
      'pages/schedules/TimetableGrid.tsx',
      'pages/schedules/TimetableManagement.tsx',
      'pages/students/StudentDetails.tsx',
      'pages/students/StudentsList.tsx',
      'pages/tasks/TasksList.tsx',
      'pages/tasks/components/TasksTable.tsx',
      'pages/teaching-assistants/TeachingAssistantsList.tsx'
    ];

    const tRegex = /\bt\(\s*['"]([a-zA-Z0-9_.]+)['"]([^)]*)\)/gs;
    const scannedKeys = new Set();
    const missingEn = [];
    const missingAr = [];
    const varMismatches = [];

    for (const rel of phase11Surfaces) {
      const content = src(rel);
      let match;
      while ((match = tRegex.exec(content)) !== null) {
        const key = match[1];
        scannedKeys.add(key);
        const valEn = getVal(en, key);
        const valAr = getVal(ar, key);

        if (valEn === undefined) {
          missingEn.push(`${rel}: ${key}`);
        }
        if (valAr === undefined) {
          missingAr.push(`${rel}: ${key}`);
        }

        if (valEn && valAr) {
          const varsInEn = [...valEn.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map(m => m[1]).sort();
          const varsInAr = [...valAr.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map(m => m[1]).sort();
          if (varsInEn.join(',') !== varsInAr.join(',')) {
            varMismatches.push({ key, varsInEn, varsInAr });
          }
        }
      }
    }

    assert.ok(scannedKeys.size > 200, `Expected >200 scanned keys, got ${scannedKeys.size}`);
    assert.deepEqual(missingEn, [], `Missing in en.json: ${JSON.stringify(missingEn)}`);
    assert.deepEqual(missingAr, [], `Missing in ar.json: ${JSON.stringify(missingAr)}`);
    assert.deepEqual(varMismatches, [], `Variable mismatches: ${JSON.stringify(varMismatches)}`);
  });
});






