import assert from 'node:assert/strict';
import { getTranscriptOverviewWhere } from '../src/utils/transcriptScope.utils';

function runTranscriptOverviewScopeSecurityTests() {
  const now = new Date('2026-09-05T10:00:00.000Z');

  for (const role of ['STUDENT', 'TEACHING_ASSISTANT', 'UNKNOWN_ROLE', 'doctor']) {
    assert.equal(
      getTranscriptOverviewWhere({ role }, now),
      null,
      `${role} must not enter the administrative overview branch`
    );
  }

  const departmentAdmin = getTranscriptOverviewWhere(
    { role: 'DEPARTMENT_ADMIN', managedDepartmentId: 7 },
    now
  );
  assert.deepEqual(departmentAdmin, {
    exam: {
      AND: [{ date: { lte: now } }, { course: { departmentId: 7 } }],
    },
    quiz: {
      AND: [{ endTime: { lte: now } }, { course: { departmentId: 7 } }],
    },
    task: {
      AND: [{ dueDate: { lte: now } }, { course: { departmentId: 7 } }],
    },
  });

  const collegeAdmin = getTranscriptOverviewWhere(
    { role: 'COLLEGE_ADMIN', managedCollegeId: 4 },
    now
  );
  const collegeCourseScope = { department: { collegeId: 4 } };
  assert.deepEqual(collegeAdmin, {
    exam: {
      AND: [{ date: { lte: now } }, { course: collegeCourseScope }],
    },
    quiz: {
      AND: [{ endTime: { lte: now } }, { course: collegeCourseScope }],
    },
    task: {
      AND: [{ dueDate: { lte: now } }, { course: collegeCourseScope }],
    },
  });

  const doctor = getTranscriptOverviewWhere({ role: 'DOCTOR', doctor: { id: 12 } }, now);
  const assignedCourseScope = { scheduleSlots: { some: { doctorId: 12 } } };
  assert.deepEqual(doctor, {
    exam: {
      AND: [
        { date: { lte: now } },
        { course: assignedCourseScope },
      ],
    },
    quiz: {
      AND: [{ endTime: { lte: now } }, { course: assignedCourseScope }],
    },
    task: {
      AND: [{ dueDate: { lte: now } }, { course: assignedCourseScope }],
    },
  });

  const unscopedLegacyAdmin = getTranscriptOverviewWhere({ role: 'ADMIN' }, now);
  assert.deepEqual(unscopedLegacyAdmin, {
    exam: { AND: [{ date: { lte: now } }, { id: -1 }] },
    quiz: { AND: [{ endTime: { lte: now } }, { course: { id: -1 } }] },
    task: { AND: [{ dueDate: { lte: now } }, { course: { id: -1 } }] },
  });

  const superAdmin = getTranscriptOverviewWhere({ role: 'SUPER_ADMIN' }, now);
  assert.deepEqual(superAdmin, {
    exam: { AND: [{ date: { lte: now } }, {}] },
    quiz: { AND: [{ endTime: { lte: now } }, { course: {} }] },
    task: { AND: [{ dueDate: { lte: now } }, { course: {} }] },
  });
}

runTranscriptOverviewScopeSecurityTests();
console.log('Transcript overview scope security checks passed');
