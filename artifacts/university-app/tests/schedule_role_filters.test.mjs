import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  API_SCHEDULE_DAYS,
  isValidScheduleDay,
  getAllowedScheduleFilters,
  isScheduleFilterAllowed,
  getScheduleFilterPermissions,
} from '../src/utils/scheduleFilterRules.ts';

describe('WP-3 Batch 3A Task 4: Pure Schedule Role-Scoped Filters Matrix', () => {
  test('API_SCHEDULE_DAYS contains strictly the 7 uppercase days accepted by API', () => {
    assert.deepEqual(API_SCHEDULE_DAYS, [
      'SUNDAY',
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
    ]);
  });

  test('isValidScheduleDay validates API-acceptable day values and rejects numeric/invalid days', () => {
    assert.equal(isValidScheduleDay('SUNDAY'), true);
    assert.equal(isValidScheduleDay('monday'), true);
    assert.equal(isValidScheduleDay('FRIDAY'), true);
    assert.equal(isValidScheduleDay('1'), false, 'Numeric day 1 must be rejected');
    assert.equal(isValidScheduleDay(''), false);
    assert.equal(isValidScheduleDay(undefined), false);
    assert.equal(isValidScheduleDay('INVALID_DAY'), false);
  });

  test('STUDENT role: allowed search, course, type, day; year and semester removed', () => {
    const filters = getAllowedScheduleFilters('STUDENT');
    assert.ok(filters.includes('search'));
    assert.ok(filters.includes('course'));
    assert.ok(filters.includes('type'));
    assert.ok(filters.includes('day'));

    assert.equal(filters.includes('year'), false, 'STUDENT must not have year select');
    assert.equal(filters.includes('semester'), false, 'STUDENT must not have semester select');
    assert.equal(filters.includes('college'), false);
    assert.equal(filters.includes('department'), false);
    assert.equal(filters.includes('doctor'), false);
    assert.equal(filters.includes('teachingAssistant'), false);

    const perms = getScheduleFilterPermissions('STUDENT');
    assert.equal(perms.search, true);
    assert.equal(perms.course, true);
    assert.equal(perms.type, true);
    assert.equal(perms.day, true);
    assert.equal(perms.year, false);
    assert.equal(perms.semester, false);
    assert.equal(perms.college, false);
    assert.equal(perms.department, false);
  });

  test('TEACHING_ASSISTANT role: no TA selector, allowed search, course, type, day', () => {
    const filters = getAllowedScheduleFilters('TEACHING_ASSISTANT');
    assert.ok(filters.includes('search'));
    assert.ok(filters.includes('course'));
    assert.ok(filters.includes('type'));
    assert.ok(filters.includes('day'));

    assert.equal(filters.includes('teachingAssistant'), false, 'TA must not have TA selector');
    assert.equal(filters.includes('college'), false);
    assert.equal(filters.includes('department'), false);
    assert.equal(filters.includes('year'), false);
    assert.equal(filters.includes('semester'), false);
    assert.equal(filters.includes('doctor'), false);

    assert.equal(isScheduleFilterAllowed('TEACHING_ASSISTANT', 'teachingAssistant'), false);
    assert.equal(isScheduleFilterAllowed('TEACHING_ASSISTANT', 'course'), true);
  });

  test('DOCTOR role: no doctor selector, allowed search, course, year (of own courses), type, day', () => {
    const filters = getAllowedScheduleFilters('DOCTOR');
    assert.ok(filters.includes('search'));
    assert.ok(filters.includes('course'));
    assert.ok(filters.includes('year'), 'DOCTOR must have year filter for own courses');
    assert.ok(filters.includes('type'));
    assert.ok(filters.includes('day'));

    assert.equal(filters.includes('doctor'), false, 'DOCTOR must not have doctor selector');
    assert.equal(filters.includes('college'), false);
    assert.equal(filters.includes('department'), false);
    assert.equal(filters.includes('semester'), false);
    assert.equal(filters.includes('teachingAssistant'), false);

    assert.equal(isScheduleFilterAllowed('DOCTOR', 'doctor'), false);
    assert.equal(isScheduleFilterAllowed('DOCTOR', 'year'), true);
  });

  test('DEPARTMENT_ADMIN role: college hidden, department hidden, year/sem/type/day allowed', () => {
    const filters = getAllowedScheduleFilters('DEPARTMENT_ADMIN');
    assert.equal(filters.includes('college'), false, 'DEPARTMENT_ADMIN locks college');
    assert.equal(filters.includes('department'), false, 'DEPARTMENT_ADMIN locks department');

    assert.ok(filters.includes('search'));
    assert.ok(filters.includes('year'));
    assert.ok(filters.includes('semester'));
    assert.ok(filters.includes('type'));
    assert.ok(filters.includes('day'));
    assert.ok(filters.includes('archiveStatus'));

    assert.equal(isScheduleFilterAllowed('DEPARTMENT_ADMIN', 'college'), false);
    assert.equal(isScheduleFilterAllowed('DEPARTMENT_ADMIN', 'department'), false);
    assert.equal(isScheduleFilterAllowed('DEPARTMENT_ADMIN', 'year'), true);
  });

  test('COLLEGE_ADMIN role: college hidden, department allowed, year/sem/type/day allowed', () => {
    const filters = getAllowedScheduleFilters('COLLEGE_ADMIN');
    assert.equal(filters.includes('college'), false, 'COLLEGE_ADMIN locks college');
    assert.ok(filters.includes('department'), 'COLLEGE_ADMIN can filter by department');

    assert.ok(filters.includes('search'));
    assert.ok(filters.includes('year'));
    assert.ok(filters.includes('semester'));
    assert.ok(filters.includes('type'));
    assert.ok(filters.includes('day'));
    assert.ok(filters.includes('archiveStatus'));

    assert.equal(isScheduleFilterAllowed('COLLEGE_ADMIN', 'college'), false);
    assert.equal(isScheduleFilterAllowed('COLLEGE_ADMIN', 'department'), true);
  });

  test('SUPER_ADMIN role: unchanged, full access to all selectors', () => {
    const filters = getAllowedScheduleFilters('SUPER_ADMIN');
    assert.ok(filters.includes('college'));
    assert.ok(filters.includes('department'));
    assert.ok(filters.includes('year'));
    assert.ok(filters.includes('semester'));
    assert.ok(filters.includes('type'));
    assert.ok(filters.includes('day'));
    assert.ok(filters.includes('doctor'));
    assert.ok(filters.includes('teachingAssistant'));
    assert.ok(filters.includes('archiveStatus'));

    assert.equal(isScheduleFilterAllowed('SUPER_ADMIN', 'college'), true);
    assert.equal(isScheduleFilterAllowed('SUPER_ADMIN', 'department'), true);
  });

  test('Unknown role: most restrictive filter set (no admin or privileged selectors)', () => {
    for (const unknownRole of [null, undefined, '', 'GUEST', 'UNKNOWN', 'ANONYMOUS']) {
      const filters = getAllowedScheduleFilters(unknownRole);
      assert.deepEqual(
        [...filters].sort(),
        ['course', 'day', 'search', 'type'].sort(),
        `Unknown role "${unknownRole}" must return the most restrictive filter set`
      );

      const perms = getScheduleFilterPermissions(unknownRole);
      assert.equal(perms.college, false);
      assert.equal(perms.department, false);
      assert.equal(perms.doctor, false);
      assert.equal(perms.teachingAssistant, false);
      assert.equal(perms.year, false);
      assert.equal(perms.semester, false);
      assert.equal(perms.archiveStatus, false);
    }
  });
});
