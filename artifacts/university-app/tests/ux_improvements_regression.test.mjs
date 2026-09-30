import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const APP_DIR = path.resolve(process.cwd().endsWith('university-app') ? 'src' : 'artifacts/university-app/src');

describe('UX Improvements & Regression Protection Suite', () => {
  // 1. UX-AUTH-01: Login error message handling
  it('UX-AUTH-01: Login component maps 401 error to localized invalidCredentials message', () => {
    const loginSrc = fs.readFileSync(path.join(APP_DIR, 'pages/Login.tsx'), 'utf8');
    assert.ok(
      loginSrc.includes("t('auth.invalidCredentials')"),
      'Login.tsx must reference t("auth.invalidCredentials") on 401 error'
    );
    assert.ok(
      loginSrc.includes('role="alert"'),
      'Login.tsx apiError display must include role="alert" for accessibility'
    );
  });

  // 2. UX-AUTH-02: Password policy consistency
  it('UX-AUTH-02: Register form schema enforces at least 8 characters with strength validation', () => {
    const registerSrc = fs.readFileSync(path.join(APP_DIR, 'pages/Register.tsx'), 'utf8');
    assert.ok(
      registerSrc.includes('.min(8') || registerSrc.includes('PASSWORD_MIN') || registerSrc.includes('min(8,'),
      'Register.tsx schema must enforce at least 8 characters for password'
    );
  });

  it('UX-AUTH-02: AddStudentModal form schema enforces at least 8 characters with strength validation', () => {
    const addStudentSrc = fs.readFileSync(path.join(APP_DIR, 'pages/students/AddStudentModal.tsx'), 'utf8');
    assert.ok(
      addStudentSrc.includes('.min(8') || addStudentSrc.includes('min(8,'),
      'AddStudentModal.tsx schema must enforce at least 8 characters for password'
    );
  });

  // 3. UX-SEARCH-01: Global Search doctor path resolution
  it('UX-SEARCH-01: GlobalSearch routes doctor results to /doctors/:id', () => {
    const searchSrc = fs.readFileSync(path.join(APP_DIR, 'components/layout/GlobalSearch.tsx'), 'utf8');
    assert.ok(
      searchSrc.includes('`/doctors/${d.id}`') || searchSrc.includes("'/doctors/' + d.id"),
      'GlobalSearch doctor items must navigate to specific doctor detail page /doctors/:id'
    );
  });

  // 4. UX-NAV-01: Route aliasing for records
  it('UX-NAV-01: App.tsx defines redirect route for /records -> /record', () => {
    const appSrc = fs.readFileSync(path.join(APP_DIR, 'App.tsx'), 'utf8');
    assert.ok(
      appSrc.includes('path="records"') && appSrc.includes('to="/record"'),
      'App.tsx must include a redirect route for /records pointing to /record'
    );
  });

  // 5. UX-TABLE-01: Direct clickable entity names in list tables
  it('UX-TABLE-01: StudentsList renders student name with direct detail navigation link/click', () => {
    const studentsListSrc = fs.readFileSync(path.join(APP_DIR, 'pages/students/StudentsList.tsx'), 'utf8');
    assert.ok(
      studentsListSrc.includes('navigate(`/students/${student.id}`)') ||
      studentsListSrc.includes("navigate('/students/' + student.id)"),
      'StudentsList must allow clicking student name to navigate directly to student details'
    );
  });

  it('UX-TABLE-01: DoctorsList renders doctor name with direct detail navigation link/click', () => {
    const doctorsListSrc = fs.readFileSync(path.join(APP_DIR, 'pages/doctors/DoctorsList.tsx'), 'utf8');
    assert.ok(
      doctorsListSrc.includes('navigate(`/doctors/${doctor.id}`)') ||
      doctorsListSrc.includes("navigate('/doctors/' + doctor.id)"),
      'DoctorsList must allow clicking doctor name to navigate directly to doctor details'
    );
  });

  // 6. UX-A11Y-01: Mobile Menu Button Accessibility
  it('UX-A11Y-01: Header contains data-testid="mobile-menu-button"', () => {
    const headerSrc = fs.readFileSync(path.join(APP_DIR, 'components/layout/Header.tsx'), 'utf8');
    assert.ok(
      headerSrc.includes('data-testid="mobile-menu-button"'),
      'Header.tsx must provide data-testid="mobile-menu-button"'
    );
  });

  // 7. UX-FIND-02: Role-aware redirect for /schedules
  it('UX-FIND-02: App.tsx defines role-aware redirect for /schedules', () => {
    const appSrc = fs.readFileSync(path.join(APP_DIR, 'App.tsx'), 'utf8');
    assert.ok(
      appSrc.includes('path="schedules"') && appSrc.includes('ScheduleRedirect'),
      'App.tsx must include role-aware ScheduleRedirect for path="schedules"'
    );
    assert.ok(
      appSrc.includes('/schedules/doctor') &&
      appSrc.includes('/schedules/student') &&
      appSrc.includes('/schedules/ta') &&
      appSrc.includes('/timetables-management'),
      'ScheduleRedirect must map DOCTOR, STUDENT, TA, and Admin roles to appropriate schedule paths'
    );
  });
});

