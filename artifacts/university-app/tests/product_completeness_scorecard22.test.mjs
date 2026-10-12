import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('Product Completeness #22: StudentStatisticsPage must have zero placeholders or Coming Soon badges', () => {
  const fileContent = readFileSync(
    new URL('../src/pages/statistics/StudentStatisticsPage.tsx', import.meta.url),
    'utf8'
  );

  // Must not have placeholder comments or Coming Soon badges
  assert.equal(
    fileContent.includes('PLACEHOLDER FOR SLICE 3'),
    false,
    'StudentStatisticsPage must not contain PLACEHOLDER FOR SLICE 3'
  );
  assert.equal(
    fileContent.includes('PLACEHOLDER FOR SLICE 4'),
    false,
    'StudentStatisticsPage must not contain PLACEHOLDER FOR SLICE 4'
  );
  assert.equal(
    fileContent.includes('قريباً (Slice 3)'),
    false,
    'StudentStatisticsPage must not contain Arabic Coming Soon Slice 3 badge'
  );
  assert.equal(
    fileContent.includes('قريباً (Slice 4)'),
    false,
    'StudentStatisticsPage must not contain Arabic Coming Soon Slice 4 badge'
  );
  assert.equal(
    fileContent.includes('Coming Soon'),
    false,
    'StudentStatisticsPage must not contain Coming Soon badge'
  );

  // Must render dynamic distinction honors based on GPA
  assert.ok(
    fileContent.includes('cumulativeGpa'),
    'StudentStatisticsPage must evaluate student cumulativeGpa for distinction'
  );
  assert.ok(
    fileContent.includes('totalCreditsEarned'),
    'StudentStatisticsPage must render totalCreditsEarned in coursework overview'
  );
  assert.ok(
    fileContent.includes('totalCreditsAttempted'),
    'StudentStatisticsPage must render totalCreditsAttempted in coursework overview'
  );
});

test('Product Completeness #22: TeachingAssistantsList must not expose dead-end assignDoctor action', () => {
  const fileContent = readFileSync(
    new URL('../src/pages/teaching-assistants/TeachingAssistantsList.tsx', import.meta.url),
    'utf8'
  );

  // Must not include the orphaned assignDoctor action menu entry
  assert.equal(
    fileContent.includes('t("teachingAssistants.assignDoctor")'),
    false,
    'TeachingAssistantsList must not expose broken assignDoctor action menu item'
  );
  assert.equal(
    fileContent.includes('AssignDoctorModal'),
    false,
    'TeachingAssistantsList must not render AssignDoctorModal'
  );

  // Must retain valid course assignment action
  assert.ok(
    fileContent.includes('setIsAssignCourseModalOpen'),
    'TeachingAssistantsList must retain assignCourse modal action'
  );
});

test('Product Completeness #22: departmentService.autoDivideStudents must call canonical backend route', () => {
  const fileContent = readFileSync(
    new URL('../src/services/department.service.ts', import.meta.url),
    'utf8'
  );

  // Must not use drifted route
  assert.equal(
    fileContent.includes('`/student-groups/${departmentId}/auto-divide`'),
    false,
    'departmentService must not use drifted /student-groups/${departmentId}/auto-divide route'
  );

  // Must use canonical route matching studentGroups.routes.ts
  assert.ok(
    fileContent.includes('`/student-groups/departments/${departmentId}/groups/auto-divide`'),
    'departmentService must target /student-groups/departments/${departmentId}/groups/auto-divide'
  );
});

test('Product Completeness #22: examsService.reportDeviceInfo must not generate 404 network drift', () => {
  const fileContent = readFileSync(
    new URL('../src/services/exams.service.ts', import.meta.url),
    'utf8'
  );

  assert.equal(
    fileContent.includes('`/exams/${examId}/device-info`'),
    false,
    'examsService must not target non-existent /exams/${examId}/device-info endpoint'
  );
});

