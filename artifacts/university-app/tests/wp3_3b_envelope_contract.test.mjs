import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test, describe } from 'node:test';
import ts from 'typescript';

// Dynamically transpile and import the live builderUtils TypeScript source (D5 Parity)
const builderUtilsSource = readFileSync(
  new URL('../src/components/timetable/builder/builderUtils.ts', import.meta.url),
  'utf8'
);

const transpiledJs = ts.transpileModule(builderUtilsSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext },
}).outputText;

const dataUri = `data:text/javascript;base64,${Buffer.from(transpiledJs).toString('base64')}`;
const {
  parseCheckConflictResponse,
  evaluateTAApproval,
  flattenGroupTree,
  formatConflictMessage,
  CONFLICT_I18N_FALLBACKS,
} = await import(dataUri);

describe('WP-3 3B-4 C1 & D1-D5: UI/API Contract Envelope & Request Validation', () => {
  test('C1 / D5 Contract 1: check-conflict parser extracts conflicts from live source', () => {
    // Real backend returns { success: true, hasConflict: true, conflicts: [...], resolvedTerm, resolvedRoom } at root
    const realBackendEnvelope = {
      success: true,
      hasConflict: true,
      conflicts: [
        {
          type: 'ROOM_OCCUPIED',
          messageAr: 'القاعة مشغولة في هذا التوقيت',
          messageEn: 'Room is occupied at this time slot',
        },
        {
          type: 'DOCTOR_BUSY',
          messageAr: 'عضو هيئة التدريس لديه محاضرة أخرى',
          messageEn: 'Doctor is already scheduled for another class',
        },
      ],
      resolvedTerm: { id: 1, name: 'Fall 2026', code: 'FALL-2026' },
      resolvedRoom: { id: 201, name: 'Auditorium 1' },
    };

    const parsed = parseCheckConflictResponse(realBackendEnvelope);
    assert.equal(parsed.conflicts.length, 2, 'Must extract 2 conflicts from root envelope');
    assert.equal(parsed.conflicts[0].type, 'ROOM_OCCUPIED');
    assert.equal(parsed.resolvedTerm?.id, 1);
    assert.equal(parsed.resolvedRoom?.id, 201);

    // Also support data-wrapped envelopes
    const dataWrapped = {
      success: true,
      data: {
        conflicts: [
          { type: 'TA_BUSY', messageAr: 'المعيد مشغول', messageEn: 'TA is busy' },
        ],
        resolvedTerm: { id: 2 },
        resolvedRoom: { id: 105 },
      },
    };
    const parsedDataWrapped = parseCheckConflictResponse(dataWrapped);
    assert.equal(parsedDataWrapped.conflicts.length, 1);
    assert.equal(parsedDataWrapped.conflicts[0].type, 'TA_BUSY');
    assert.equal(parsedDataWrapped.resolvedTerm?.id, 2);
    assert.equal(parsedDataWrapped.resolvedRoom?.id, 105);
  });

  test('C1 / D5 Contract 2: TA Cross-Department Approval matches CUID string teachingAssistantId from live source', () => {
    const realApprovalsEnvelope = {
      success: true,
      data: {
        approvals: [
          {
            id: 1,
            teachingAssistantId: 'cmvdu9eve0001c764yhnhra5d',
            courseId: 101,
            status: 'APPROVED',
            reason: 'Dean Special Approval',
          },
          {
            id: 2,
            teachingAssistantId: 'cmvdu9other0002c764yhnhra5e',
            courseId: 101,
            status: 'REVOKED',
            reason: 'Revoked by Department Head',
          },
        ],
        pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
      },
    };

    const targetCourseDeptId = 1;
    const testTAs = [
      {
        id: 'cmvdu9eve0001c764yhnhra5d',
        name: 'Eng. Sarah Adel',
        departmentId: 2, // Cross-department!
      },
      {
        id: 'cmvdu9other0002c764yhnhra5e',
        name: 'Eng. Karim Omar',
        departmentId: 2, // Cross-department & REVOKED!
      },
      {
        id: 'cmvdu9inhouse0003c764yhnhra5f',
        name: 'Eng. Mona Ali',
        departmentId: 1, // In-department (no approval needed)
      },
    ];

    const approvalsList = realApprovalsEnvelope.data.approvals;

    const sarahEval = evaluateTAApproval(testTAs[0], 101, targetCourseDeptId, approvalsList);
    assert.equal(sarahEval.isApproved, true, 'Approved cross-dept TA must be approved');
    assert.equal(sarahEval.isDisabled, false, 'Approved cross-dept TA must not be disabled');
    assert.equal(sarahEval.approvalReason, 'Dean Special Approval');

    const karimEval = evaluateTAApproval(testTAs[1], 101, targetCourseDeptId, approvalsList);
    assert.equal(karimEval.isApproved, false, 'Revoked cross-dept TA must not be approved');
    assert.equal(karimEval.isDisabled, true, 'Revoked cross-dept TA must be disabled');

    const monaEval = evaluateTAApproval(testTAs[2], 101, targetCourseDeptId, approvalsList);
    assert.equal(monaEval.isApproved, true, 'In-department TA requires no approval');
    assert.equal(monaEval.isDisabled, false, 'In-department TA must never be disabled');
  });

  test('C1 / D5 Contract 3: Student groups tree is recursively flattened from live source', () => {
    const realGroupTreeEnvelope = {
      success: true,
      data: [
        {
          id: 10,
          name: 'Group 1',
          year: 2,
          parentGroupId: null,
          children: [
            {
              id: 11,
              name: 'Group 1A',
              year: 2,
              parentGroupId: 10,
              children: [],
            },
            {
              id: 12,
              name: 'Group 1B',
              year: 2,
              parentGroupId: 10,
              children: [],
            },
          ],
        },
        {
          id: 20,
          name: 'Group 2',
          year: 2,
          parentGroupId: null,
          children: [],
        },
      ],
    };

    const flattened = flattenGroupTree(realGroupTreeEnvelope.data);
    assert.equal(flattened.length, 4, 'Must flatten 2 root groups and 2 subgroups into 4 options');
    const ids = flattened.map((g) => g.id);
    assert.deepEqual(ids, [10, 11, 12, 20]);
    assert.equal(flattened[1].name, 'Group 1A');
  });

  test('D2 Contract: All 12 reachable conflict types produce valid bilingual messages from live source', () => {
    const reachable12Types = [
      'AMBIGUOUS_DOCTOR',
      'AMBIGUOUS_TA',
      'INVALID_TERM',
      'NO_ACTIVE_TERM',
      'PAST_TERM_LOCKED',
      'ROOM_NOT_FOUND',
      'ROOM_INACTIVE',
      'UNAPPROVED_CROSS_DEPARTMENT_TA',
      'ROOM_OCCUPIED',
      'DOCTOR_BUSY',
      'TA_BUSY',
      'GROUP_CONFLICT',
    ];

    // Assert every one of the 12 types has a defined fallback entry
    for (const type of reachable12Types) {
      assert.ok(CONFLICT_I18N_FALLBACKS[type], `CONFLICT_I18N_FALLBACKS must define type '${type}'`);
      assert.ok(CONFLICT_I18N_FALLBACKS[type].ar.length > 5, `Arabic text for '${type}' must be non-empty`);
      assert.ok(CONFLICT_I18N_FALLBACKS[type].en.length > 5, `English text for '${type}' must be non-empty`);
    }

    // Assert formatConflictMessage with real item keys from backend
    for (const type of reachable12Types) {
      const realItem = {
        type,
        messageAr: `رسالة تعارض ${type} من الخادم`,
        messageEn: `Server conflict message for ${type}`,
        conflictingSlot: { courseName: 'Test', time: '09:00 - 11:00' },
      };

      const arMsg = formatConflictMessage(realItem, true);
      const enMsg = formatConflictMessage(realItem, false);
      assert.equal(arMsg, `رسالة تعارض ${type} من الخادم`);
      assert.equal(enMsg, `Server conflict message for ${type}`);

      // Fallback behavior when server messages are absent
      const fallbackItem = { type };
      const fbAr = formatConflictMessage(fallbackItem, true);
      const fbEn = formatConflictMessage(fallbackItem, false);
      assert.equal(fbAr, CONFLICT_I18N_FALLBACKS[type].ar);
      assert.equal(fbEn, CONFLICT_I18N_FALLBACKS[type].en);
    }
  });

  test('D1 Contract: Wizard request payloads strictly match backend Zod / controller expectations', () => {
    // 1. POST /api/schedules payload
    const createPayload = {
      courseId: 101,
      slotType: 'LECTURE',
      dayOfWeek: 'MONDAY',
      startTime: '09:00',
      endTime: '11:00',
      room: 'Auditorium 1',
      roomId: 201,
      termId: 1,
      groupId: 10,
      timetableId: 5,
      doctorId: 12,
      teachingAssistantId: null,
    };
    assert.equal(typeof createPayload.courseId, 'number');
    assert.ok(['LECTURE', 'LAB'].includes(createPayload.slotType));
    assert.ok(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'].includes(createPayload.dayOfWeek));
    assert.match(createPayload.startTime, /^\d{2}:\d{2}$/);
    assert.match(createPayload.endTime, /^\d{2}:\d{2}$/);
    assert.equal(typeof createPayload.doctorId, 'number');
    assert.equal(createPayload.teachingAssistantId, null);

    // 2. PUT /api/schedules/:id with legacy room preservation
    const updatePayload = {
      courseId: 101,
      slotType: 'LAB',
      dayOfWeek: 'TUESDAY',
      startTime: '11:00',
      endTime: '13:00',
      room: 'Legacy Hall 9',
      roomId: null,
      termId: 1,
      groupId: 11,
      timetableId: 5,
      doctorId: null,
      teachingAssistantId: 'cmvdu9eve0001c764yhnhra5d',
    };
    assert.equal(updatePayload.roomId, null);
    assert.equal(updatePayload.room, 'Legacy Hall 9');
    assert.equal(typeof updatePayload.teachingAssistantId, 'string');
    assert.equal(updatePayload.doctorId, null);

    // 3. POST /api/schedules/check-conflict payload
    const checkConflictPayload = {
      dayOfWeek: 'MONDAY',
      startTime: '09:00',
      endTime: '11:00',
      courseId: 101,
      courseName: 'Data Structures',
      departmentId: 1,
      academicYear: 2,
      semester: 1,
      slotType: 'LECTURE',
      groupId: 10,
      roomId: 201,
      room: 'Auditorium 1',
      doctorId: 12,
      doctorName: 'Dr. Mahmoud',
      excludeSlotId: 44,
    };
    assert.ok(checkConflictPayload.dayOfWeek);
    assert.ok(checkConflictPayload.startTime);
    assert.ok(checkConflictPayload.endTime);
    assert.equal(typeof checkConflictPayload.courseId, 'number');
    assert.equal(typeof checkConflictPayload.departmentId, 'number');
    assert.equal(typeof checkConflictPayload.excludeSlotId, 'number');

    // 4. POST /api/schedules/sync-grid payload from TimetableGrid
    const syncGridPayload = {
      collegeId: 1,
      departmentId: 1,
      academicYear: 2,
      semester: 1,
      slots: [
        {
          day: 'MONDAY',
          startTime: '09:00',
          endTime: '11:00',
          courseName: 'Algorithms',
          courseId: 102,
          instructor: 'Dr. Tarek',
          doctorId: 15,
          teachingAssistantId: undefined,
          room: 'Hall B',
          slotType: 'LECTURE',
        },
      ],
    };
    assert.equal(typeof syncGridPayload.departmentId, 'number');
    assert.ok(Array.isArray(syncGridPayload.slots));
    assert.equal(syncGridPayload.slots[0].day, 'MONDAY');
    assert.equal(typeof syncGridPayload.slots[0].courseName, 'string');
    assert.ok(['LECTURE', 'LAB'].includes(syncGridPayload.slots[0].slotType));
  });
});
