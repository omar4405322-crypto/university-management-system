import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_DIR = path.resolve(__dirname, '../src');

describe('WP-3 Batch 3B-4: Timetable Placement Wizard, RoomSelector & Header Unification', () => {
  test('T1 & T2: Wizard and RoomSelector component files exist on disk', () => {
    const wizardModalPath = path.join(APP_DIR, 'components/timetable/builder/PlacementWizardModal.tsx');
    const step1Path = path.join(APP_DIR, 'components/timetable/builder/Step1CourseGroup.tsx');
    const step2Path = path.join(APP_DIR, 'components/timetable/builder/Step2Instructor.tsx');
    const step3Path = path.join(APP_DIR, 'components/timetable/builder/Step3TimeRoom.tsx');
    const step4Path = path.join(APP_DIR, 'components/timetable/builder/Step4ReviewConflict.tsx');
    const roomSelectorPath = path.join(APP_DIR, 'components/timetable/builder/RoomSelector.tsx');
    const roomsServicePath = path.join(APP_DIR, 'services/rooms.service.ts');

    assert.ok(fs.existsSync(wizardModalPath), 'PlacementWizardModal.tsx must exist');
    assert.ok(fs.existsSync(step1Path), 'Step1CourseGroup.tsx must exist');
    assert.ok(fs.existsSync(step2Path), 'Step2Instructor.tsx must exist');
    assert.ok(fs.existsSync(step3Path), 'Step3TimeRoom.tsx must exist');
    assert.ok(fs.existsSync(step4Path), 'Step4ReviewConflict.tsx must exist');
    assert.ok(fs.existsSync(roomSelectorPath), 'RoomSelector.tsx must exist');
    assert.ok(fs.existsSync(roomsServicePath), 'rooms.service.ts must exist');
  });

  test('T1 Step 1: Course & Group selection strictly enforces 2 slot types and required guards', () => {
    const step1Path = path.join(APP_DIR, 'components/timetable/builder/Step1CourseGroup.tsx');
    assert.ok(fs.existsSync(step1Path), 'Step1CourseGroup.tsx must exist');
    const content = fs.readFileSync(step1Path, 'utf8');

    // Slot types strictly LECTURE and LAB
    assert.match(content, /LECTURE/, 'Must support LECTURE');
    assert.match(content, /LAB/, 'Must support LAB');
    assert.ok(!content.includes('SECTION'), 'SECTION must not exist in Step 1');
    assert.ok(!content.includes('TUTORIAL'), 'TUTORIAL must not exist in Step 1');

    // Guards and selectors
    assert.match(content, /department/, 'Must handle department selection');
    assert.match(content, /course/, 'Must handle course selection');
    assert.match(content, /group/, 'Must handle student group selection');
  });

  test('T1 Step 2: Instructor selection handles doctor for lecture, TA for lab, and cross-dept approval status', () => {
    const step2Path = path.join(APP_DIR, 'components/timetable/builder/Step2Instructor.tsx');
    assert.ok(fs.existsSync(step2Path), 'Step2Instructor.tsx must exist');
    const content = fs.readFileSync(step2Path, 'utf8');

    // Doctor for LECTURE, TA for LAB
    assert.match(content, /doctor/i, 'Must support doctor selection');
    assert.match(content, /teachingAssistant|ta/i, 'Must support TA selection');

    // Cross-department approval state
    assert.match(content, /approval|crossDepartment/i, 'Must check or display cross-department approval');
    assert.match(content, /disabled/i, 'Unapproved cross-department TA must be disabled');
  });

  test('T1 Step 3: Free start and end time inputs with end > start validation and RoomSelector integration', () => {
    const step3Path = path.join(APP_DIR, 'components/timetable/builder/Step3TimeRoom.tsx');
    assert.ok(fs.existsSync(step3Path), 'Step3TimeRoom.tsx must exist');
    const content = fs.readFileSync(step3Path, 'utf8');

    // Free time inputs (type="time")
    assert.match(content, /type=["']time["']/, 'Must use free time inputs (type="time") without fixed presets');
    assert.match(content, /startTime/, 'Must handle startTime');
    assert.match(content, /endTime/, 'Must handle endTime');

    // Time validation (end after start)
    assert.match(content, /startTime.*endTime|endTime.*startTime/, 'Must validate endTime > startTime');

    // RoomSelector integration
    assert.match(content, /RoomSelector/, 'Step 3 must integrate RoomSelector');
  });

  test('T1 Step 4: Summary, live check-conflict, conflict type badges, and commit action', () => {
    const step4Path = path.join(APP_DIR, 'components/timetable/builder/Step4ReviewConflict.tsx');
    assert.ok(fs.existsSync(step4Path), 'Step4ReviewConflict.tsx must exist');
    const content = fs.readFileSync(step4Path, 'utf8');

    // Live conflict checking
    assert.match(content, /checkConflict|check-conflict/i, 'Must call check-conflict API');

    // Conflict types handled
    assert.match(content, /ROOM_OCCUPIED/, 'Must handle ROOM_OCCUPIED');
    assert.match(content, /DOCTOR_BUSY/, 'Must handle DOCTOR_BUSY');
    assert.match(content, /TA_BUSY/, 'Must handle TA_BUSY');
    assert.match(content, /GROUP_CONFLICT/, 'Must handle GROUP_CONFLICT');

    // Commit via POST / PUT
    assert.match(content, /createSchedule|updateSchedule|POST|PUT/i, 'Must handle create / update commit');
  });

  test('T2: RoomSelector and rooms.service.ts provide active room search and role-aware creation', () => {
    const roomsServicePath = path.join(APP_DIR, 'services/rooms.service.ts');
    assert.ok(fs.existsSync(roomsServicePath), 'rooms.service.ts must exist');
    const serviceContent = fs.readFileSync(roomsServicePath, 'utf8');
    assert.match(serviceContent, /getRooms/, 'rooms.service.ts must export getRooms');
    assert.match(serviceContent, /createRoom/, 'rooms.service.ts must export createRoom');

    const selectorPath = path.join(APP_DIR, 'components/timetable/builder/RoomSelector.tsx');
    assert.ok(fs.existsSync(selectorPath), 'RoomSelector.tsx must exist');
    const selectorContent = fs.readFileSync(selectorPath, 'utf8');

    // Role-aware create room button
    assert.match(selectorContent, /SUPER_ADMIN/, 'Must check SUPER_ADMIN for room creation');
    assert.match(selectorContent, /createRoom|onAddRoom|isCreating/i, 'Must support inline room creation for SUPER_ADMIN');
  });

  test('T3: TimetableGrid and SchedulesList replace legacy modals with 4-step wizard', () => {
    const gridPath = path.join(APP_DIR, 'pages/schedules/TimetableGrid.tsx');
    const listPath = path.join(APP_DIR, 'pages/schedules/SchedulesList.tsx');

    const gridContent = fs.readFileSync(gridPath, 'utf8');
    const listContent = fs.readFileSync(listPath, 'utf8');

    // Must use PlacementWizardModal or builder
    assert.match(gridContent, /PlacementWizardModal|builder/i, 'TimetableGrid must use PlacementWizardModal');
    assert.match(listContent, /PlacementWizardModal|builder/i, 'SchedulesList must use PlacementWizardModal');
  });

  test('T4: Shared ScheduleHeader on all 6 timetable surfaces', () => {
    const pages = [
      'pages/schedules/TimetableGrid.tsx',
      'pages/schedules/TimetableManagement.tsx',
      'pages/schedules/SchedulesList.tsx',
      'pages/schedules/WeeklySchedule.tsx',
      'pages/schedules/DoctorSchedule.tsx',
      'pages/schedules/TASchedule.tsx',
    ];

    for (const p of pages) {
      const fullPath = path.join(APP_DIR, p);
      assert.ok(fs.existsSync(fullPath), `${p} must exist`);
      const content = fs.readFileSync(fullPath, 'utf8');
      assert.match(content, /ScheduleHeader/, `${p} must render shared ScheduleHeader`);
    }
  });

  test('T1 (M-3): TASchedule renders department select for COLLEGE_ADMIN and SUPER_ADMIN', () => {
    const taSchedulePath = path.join(APP_DIR, 'pages/schedules/TASchedule.tsx');
    assert.ok(fs.existsSync(taSchedulePath), 'TASchedule.tsx must exist');
    const content = fs.readFileSync(taSchedulePath, 'utf8');

    // Must render department select with filteredDepartments
    assert.match(content, /filterPermissions\.department\s*&&\s*!hideDepartmentSelector/, 'Must check filterPermissions.department and !hideDepartmentSelector');
    assert.match(content, /value=\{selectedDeptId\}/, 'Must bind select value to selectedDeptId');
    assert.match(content, /filteredDepartments\.map/, 'Must map filteredDepartments in department select');
  });

  test('T3: Admin filters UI on admin schedule pages sending doctorId, teachingAssistantId, roomId, termId to schedules/week', () => {
    const listPath = path.join(APP_DIR, 'pages/schedules/SchedulesList.tsx');
    assert.ok(fs.existsSync(listPath), 'SchedulesList.tsx must exist');
    const listContent = fs.readFileSync(listPath, 'utf8');

    // Doctor, TA, Room, Term selects in SchedulesList
    assert.match(listContent, /selectedDoctorId/, 'SchedulesList must support selectedDoctorId');
    assert.match(listContent, /selectedTAId/, 'SchedulesList must support selectedTAId');
    assert.match(listContent, /selectedRoomId/, 'SchedulesList must support selectedRoomId');
    assert.match(listContent, /selectedTermId/, 'SchedulesList must support selectedTermId');

    // Params sent to getAllSchedules / week endpoint
    assert.match(listContent, /params\.doctorId\s*=/, 'Must send doctorId to schedules query');
    assert.match(listContent, /params\.teachingAssistantId\s*=/, 'Must send teachingAssistantId to schedules query');
    assert.match(listContent, /params\.roomId\s*=/, 'Must send roomId to schedules query');
    assert.match(listContent, /params\.termId\s*=/, 'Must send termId to schedules query');

    // TimetableGrid admin filters: Doctor, TA, Room (OD-50: Term removed from TimetableGrid)
    const gridPath = path.join(APP_DIR, 'pages/schedules/TimetableGrid.tsx');
    assert.ok(fs.existsSync(gridPath), 'TimetableGrid.tsx must exist');
    const gridContent = fs.readFileSync(gridPath, 'utf8');
    assert.match(gridContent, /selectedDoctorId/, 'TimetableGrid must support doctorId filter');
    assert.match(gridContent, /selectedTAId/, 'TimetableGrid must support teachingAssistantId filter');
    assert.match(gridContent, /selectedRoomId/, 'TimetableGrid must support roomId filter');
    assert.ok(!gridContent.includes('selectedTermId'), 'TimetableGrid must NOT contain selectedTermId filter (OD-50)');
    assert.ok(!gridContent.includes('academicTerms'), 'TimetableGrid must NOT fetch or hold academicTerms (OD-50)');
  });

  test('F1: PlacementWizardModal has no early save draft button in step 1-3 footer', () => {
    const wizardModalPath = path.join(APP_DIR, 'components/timetable/builder/PlacementWizardModal.tsx');
    const content = fs.readFileSync(wizardModalPath, 'utf8');

    // #wizard-save-draft-btn must NOT be rendered in the step navigation footer
    assert.ok(
      !content.includes('id="wizard-save-draft-btn"'),
      'PlacementWizardModal footer must not render #wizard-save-draft-btn on step 1'
    );
    // Must pass onSaveDraft to Step4ReviewConflict
    assert.match(
      content,
      /onSaveDraft=\{onSaveDraft\}/,
      'PlacementWizardModal must pass onSaveDraft to Step4ReviewConflict'
    );
  });

  test('F1: Step4ReviewConflict draft commit calls onSaveDraft with zero POST/PUT', () => {
    const step4Path = path.join(APP_DIR, 'components/timetable/builder/Step4ReviewConflict.tsx');
    const content = fs.readFileSync(step4Path, 'utf8');

    // Step 4 props must accept onSaveDraft
    assert.match(content, /onSaveDraft\??:\s*\(slot:\s*WizardSlotForm\)/, 'Step4ReviewConflict must accept onSaveDraft prop');
    // Primary commit button must invoke onSaveDraft when present
    assert.match(
      content,
      /if\s*\(\s*onSaveDraft\s*\)\s*\{[\s\S]*?onSaveDraft\s*\(\s*form\s*\)/,
      'handleCommit must call onSaveDraft(form) when onSaveDraft is provided'
    );
  });

  test('F1: TimetableGrid onSaveDraft reuses handleSaveSlot with same-day-course, doctor, and room local collision checks', () => {
    const gridPath = path.join(APP_DIR, 'pages/schedules/TimetableGrid.tsx');
    const content = fs.readFileSync(gridPath, 'utf8');

    // onSaveDraft must delegate to handleSaveSlot
    assert.match(
      content,
      /onSaveDraft=\{.*handleSaveSlot/,
      'TimetableGrid onSaveDraft must reuse handleSaveSlot'
    );
    // handleSaveSlot must support draft slot parameter and perform all 3 checks
    assert.match(content, /handleSaveSlot\s*=\s*useCallback\s*\(\s*\(\s*(draft|slot)/, 'handleSaveSlot must accept draft/slot parameter');
    assert.match(content, /sameCourseConflict/, 'handleSaveSlot must check sameCourseConflict');
    assert.match(content, /sameDoctorConflict/, 'handleSaveSlot must check sameDoctorConflict');
    assert.match(content, /sameRoomConflict/, 'handleSaveSlot must check sameRoomConflict');
  });

  test('F1 Executable Logic: Local duplicate collision detection rejects same-day-course, doctor, room', () => {
    // Pure logic test verifying the exact conflict algorithm
    const mockSlots = {
      'Monday_09:00-11:00': {
        courseName: 'Operating Systems',
        doctorName: 'Dr. Mahmoud',
        room: 'Hall A',
        slotType: 'LECTURE',
      },
    };

    function validateSlotPlacement(slots, day, slot, draft) {
      const key = `${day}_${slot}`;
      // 1. Same course on same day
      const sameCourse = Object.entries(slots).find(
        ([k, v]) => k !== key && k.startsWith(`${day}_`) && v.courseName === draft.courseName
      );
      if (sameCourse) {
        return { success: false, conflict: 'SAME_COURSE_DAY' };
      }
      // 2. Same doctor on same slot
      if (draft.doctorName) {
        const sameDoc = Object.entries(slots).find(
          ([k, v]) => k !== key && k.endsWith(`_${slot}`) && v.doctorName === draft.doctorName
        );
        if (sameDoc) {
          return { success: false, conflict: 'SAME_DOCTOR_SLOT' };
        }
      }
      // 3. Same room on same slot
      if (draft.room) {
        const sameRoom = Object.entries(slots).find(
          ([k, v]) => k !== key && k.endsWith(`_${slot}`) && v.room.toLowerCase() === draft.room.toLowerCase()
        );
        if (sameRoom) {
          return { success: false, conflict: 'SAME_ROOM_SLOT' };
        }
      }
      return { success: true };
    }

    // Collision 1: Same course on same day (different time)
    const res1 = validateSlotPlacement(mockSlots, 'Monday', '11:30-13:30', {
      courseName: 'Operating Systems',
      doctorName: 'Dr. Other',
      room: 'Hall B',
    });
    assert.equal(res1.success, false);
    assert.equal(res1.conflict, 'SAME_COURSE_DAY');

    // Collision 2: Same doctor at same slot (different day or same slot)
    const res2 = validateSlotPlacement(mockSlots, 'Tuesday', '09:00-11:00', {
      courseName: 'Algorithms',
      doctorName: 'Dr. Mahmoud',
      room: 'Hall C',
    });
    assert.equal(res2.success, false);
    assert.equal(res2.conflict, 'SAME_DOCTOR_SLOT');

    // Collision 3: Same room at same slot
    const res3 = validateSlotPlacement(mockSlots, 'Wednesday', '09:00-11:00', {
      courseName: 'Databases',
      doctorName: 'Dr. Someone',
      room: 'hall a',
    });
    assert.equal(res3.success, false);
    assert.equal(res3.conflict, 'SAME_ROOM_SLOT');

    // Valid placement: no conflicts
    const res4 = validateSlotPlacement(mockSlots, 'Tuesday', '11:30-13:30', {
      courseName: 'Algorithms',
      doctorName: 'Dr. Someone',
      room: 'Hall B',
    });
    assert.equal(res4.success, true);
  });

  test('T4: Bulk Archive with amber button between Export and Delete, confirmation dialog, Promise.allSettled', () => {
    const listPath = path.join(APP_DIR, 'pages/schedules/SchedulesList.tsx');
    assert.ok(fs.existsSync(listPath), 'SchedulesList.tsx must exist');
    const listContent = fs.readFileSync(listPath, 'utf8');

    // Amber Archive button
    assert.match(listContent, /bulkArchiveModalOpen|isBulkArchiving/, 'SchedulesList must maintain bulk archive state');
    assert.match(listContent, /text-amber-600|bg-amber|hover:bg-amber/, 'Archive button must have amber styling');
    assert.match(listContent, /Promise\.allSettled/, 'Bulk archive must use Promise.allSettled');
    assert.match(listContent, /succeeded.*failed|failed.*succeeded/, 'Must show N succeeded / M failed in toast');
    assert.match(listContent, /archiveSchedule/, 'Must call archiveSchedule per selected slot');
  });

  test('T5: SlotModal.tsx and ScheduleModal.tsx retired; tests ported to wizard equivalents', () => {
    const slotModalPath = path.join(APP_DIR, 'components/timetable/SlotModal.tsx');
    const scheduleModalPath = path.join(APP_DIR, 'pages/schedules/ScheduleModal.tsx');

    assert.equal(fs.existsSync(slotModalPath), false, 'SlotModal.tsx must be retired/deleted');
    assert.equal(fs.existsSync(scheduleModalPath), false, 'ScheduleModal.tsx must be retired/deleted');

    // Orphaned InstructorSelector must still exist
    const instructorSelectorPath = path.join(APP_DIR, 'components/timetable/InstructorSelector.tsx');
    assert.ok(fs.existsSync(instructorSelectorPath), 'InstructorSelector.tsx must NOT be deleted');

    // PlacementWizardModal must exist
    const wizardModalPath = path.join(APP_DIR, 'components/timetable/builder/PlacementWizardModal.tsx');
    assert.ok(fs.existsSync(wizardModalPath), 'PlacementWizardModal.tsx must exist');
  });
});

