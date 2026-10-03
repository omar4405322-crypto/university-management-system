import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../src/utils/prismaClient';
import {
  CANONICAL_QUICK_ACTIONS,
  calculateRankingScore,
  formatQuickActionItem,
  getPersonalizedQuickActions,
  getRoleDefaultActionKey,
  getUsageDateKey,
  recordQuickActionUsage,
  resolveActionKeyFromPrompt,
  resolveActionKeyFromTool,
  REPEAT_USAGE_THRESHOLD,
  HORIZON_DAYS,
  MAX_QUICK_ACTIONS,
} from '../src/services/aiQuickAction.service';
import type { AuthActor } from '../src/types/auth.types';

describe('AI Personalized Quick Actions Service', () => {
  const testUserId1 = 9876541;
  const testUserId2 = 9876542;

  beforeEach(async () => {
    // Ensure test users exist in test database for FK constraint
    await prisma.user.upsert({
      where: { id: testUserId1 },
      update: { email: 'quickaction1@test.edu', role: 'STUDENT', isActive: true },
      create: { id: testUserId1, email: 'quickaction1@test.edu', password: 'hash', role: 'STUDENT', isActive: true },
    });
    await prisma.user.upsert({
      where: { id: testUserId2 },
      update: { email: 'quickaction2@test.edu', role: 'STUDENT', isActive: true },
      create: { id: testUserId2, email: 'quickaction2@test.edu', password: 'hash', role: 'STUDENT', isActive: true },
    });

    // Clean test usage records
    await prisma.aIQuickActionUsage.deleteMany({
      where: {
        userId: { in: [testUserId1, testUserId2] },
      },
    });
  });

  describe('1. Canonical Action Taxonomy & Synonymous Mapping', () => {
    it('resolves tool names to correct canonical action keys', () => {
      assert.equal(resolveActionKeyFromTool('get_my_academic_summary'), 'student_academic_summary');
      assert.equal(resolveActionKeyFromTool('get_my_courses'), 'student_courses');
      assert.equal(resolveActionKeyFromTool('get_my_attendance_summary'), 'attendance_summary');
      assert.equal(resolveActionKeyFromTool('get_my_schedule'), 'schedule_summary');
      assert.equal(resolveActionKeyFromTool('get_my_tasks'), 'tasks_summary');
      assert.equal(resolveActionKeyFromTool('get_my_exams'), 'exams_summary');
      assert.equal(resolveActionKeyFromTool('get_my_payments'), 'payments_summary');
      assert.equal(resolveActionKeyFromTool('get_my_teaching_courses'), 'doctor_courses');
      assert.equal(resolveActionKeyFromTool('get_my_assigned_sections'), 'ta_sections');
      assert.equal(resolveActionKeyFromTool('get_scoped_university_summary'), 'admin_university_summary');
      assert.equal(resolveActionKeyFromTool('search_scoped_students'), 'admin_search_students');
      assert.equal(resolveActionKeyFromTool('unknown_tool'), null);
    });

    it('groups synonymous student prompts into the same canonical action key', () => {
      const studentActor: AuthActor = { id: testUserId1, role: 'STUDENT', student: { id: 1 } as any };
      assert.equal(resolveActionKeyFromPrompt('لخص مستواي الأكاديمي', studentActor), 'student_academic_summary');
      assert.equal(resolveActionKeyFromPrompt('معدلي التراكمي كام؟', studentActor), 'student_academic_summary');
      assert.equal(resolveActionKeyFromPrompt('وريني درجاتي والسجل الأكاديمي', studentActor), 'student_academic_summary');
      assert.equal(resolveActionKeyFromPrompt('show my gpa and academic standing', studentActor), 'student_academic_summary');

      // Attendance synonyms
      assert.equal(resolveActionKeyFromPrompt('كيف هو حضوري؟', studentActor), 'attendance_summary');
      assert.equal(resolveActionKeyFromPrompt('نسبة الغياب كام عندي؟', studentActor), 'attendance_summary');
      assert.equal(resolveActionKeyFromPrompt('سجل الحضور والغياب', studentActor), 'attendance_summary');
    });

    it('groups synonymous admin prompts into the same canonical action key without leaking arguments', () => {
      const adminActor: AuthActor = { id: testUserId1, role: 'SUPER_ADMIN' };
      assert.equal(resolveActionKeyFromPrompt('ابحث عن طالب اسمه أحمد', adminActor), 'admin_search_students');
      assert.equal(resolveActionKeyFromPrompt('بحث عن طالب برقم 2024001', adminActor), 'admin_search_students');
      assert.equal(resolveActionKeyFromPrompt('دورلي على طالب في قسم حاسبات', adminActor), 'admin_search_students');
    });
  });

  describe('2. Atomic Usage Recording & Single-Count Invariant', () => {
    it('atomically creates and increments usage count in daily bucket for a canonical action', async () => {
      const now = new Date();
      const usageDate = getUsageDateKey(now);
      // First use -> count = 1
      await recordQuickActionUsage(testUserId1, 'student_academic_summary', now);
      let record = await prisma.aIQuickActionUsage.findUnique({
        where: { userId_actionKey_usageDate: { userId: testUserId1, actionKey: 'student_academic_summary', usageDate } },
      });
      assert.ok(record);
      assert.equal(record.count, 1);

      // Second use -> atomic increment to 2
      await recordQuickActionUsage(testUserId1, 'student_academic_summary', now);
      record = await prisma.aIQuickActionUsage.findUnique({
        where: { userId_actionKey_usageDate: { userId: testUserId1, actionKey: 'student_academic_summary', usageDate } },
      });
      assert.ok(record);
      assert.equal(record.count, 2);
    });

    it('does not increment multiple times when multiple internal tools are called in a single turn', async () => {
      // Simulating a turn that invoked multiple tools: only 1 canonical action is recorded
      const invokedTools = ['get_my_academic_summary', 'get_my_courses', 'get_my_attendance_summary'];
      const primaryTool = invokedTools[0];
      const actionKey = resolveActionKeyFromTool(primaryTool);
      assert.ok(actionKey);

      await recordQuickActionUsage(testUserId1, actionKey);

      const records = await prisma.aIQuickActionUsage.findMany({
        where: { userId: testUserId1 },
      });
      assert.equal(records.length, 1);
      assert.equal(records[0].count, 1);
    });
  });

  describe('3. Privacy, User Isolation & No Leaked Raw Prompts', () => {
    it('enforces strict per-user isolation with zero cross-user leakage', async () => {
      const actor1: AuthActor = { id: testUserId1, role: 'STUDENT', student: { id: 1 } as any };
      const actor2: AuthActor = { id: testUserId2, role: 'STUDENT', student: { id: 2 } as any };

      // User 1 uses attendance 3 times
      await recordQuickActionUsage(testUserId1, 'attendance_summary');
      await recordQuickActionUsage(testUserId1, 'attendance_summary');
      await recordQuickActionUsage(testUserId1, 'attendance_summary');

      // User 2 uses exams 3 times
      await recordQuickActionUsage(testUserId2, 'exams_summary');
      await recordQuickActionUsage(testUserId2, 'exams_summary');
      await recordQuickActionUsage(testUserId2, 'exams_summary');

      const actions1 = await getPersonalizedQuickActions(actor1);
      const actions2 = await getPersonalizedQuickActions(actor2);

      assert.equal(actions1.length, 1);
      assert.equal(actions1[0].key, 'attendance_summary');

      assert.equal(actions2.length, 1);
      assert.equal(actions2[0].key, 'exams_summary');
    });

    it('returns only clean, safe presentation data and never raw prompt arguments or conversation content', async () => {
      const def = CANONICAL_QUICK_ACTIONS.admin_search_students;
      const formatted = formatQuickActionItem(def);

      assert.equal(formatted.title, 'البحث عن طالب');
      assert.equal(formatted.prompt, 'البحث عن الطلاب ضمن صلاحياتي');
      assert.ok(!('count' in formatted));
      assert.ok(!('score' in formatted));
      assert.ok(!('lastUsedAt' in formatted));
      assert.ok(!('userId' in formatted));
    });
  });

  describe('4. Authoritative RBAC Filtering', () => {
    it('immediately hides an action if user loses permissions, even if historically common', async () => {
      // User originally had DOCTOR role and frequently used doctor_courses
      await recordQuickActionUsage(testUserId1, 'doctor_courses');
      await recordQuickActionUsage(testUserId1, 'doctor_courses');
      await recordQuickActionUsage(testUserId1, 'doctor_courses');

      // But current actor role is STUDENT!
      const studentActor: AuthActor = { id: testUserId1, role: 'STUDENT', student: { id: 1 } as any };
      const actions = await getPersonalizedQuickActions(studentActor);

      // doctor_courses MUST NOT appear!
      assert.ok(!actions.some((a) => a.key === 'doctor_courses'));
      // Fallback is role-appropriate for STUDENT
      assert.equal(actions.length, 1);
      assert.equal(actions[0].key, 'student_academic_summary');
    });
  });

  describe('5. Ranking, Recency, Decay & Repeat Threshold', () => {
    it('requires repeat threshold (usageCount >= 2) within horizon to qualify as repeated', async () => {
      const actor: AuthActor = { id: testUserId1, role: 'STUDENT', student: { id: 1 } as any };

      // Record one-off usage for tasks (count = 1)
      await recordQuickActionUsage(testUserId1, 'tasks_summary');

      // Since count is 1 (< 2), it does NOT qualify for the repeated list.
      // Zero-repeat fallback kicks in and returns 1 card (the most recent permitted action).
      const actions = await getPersonalizedQuickActions(actor);
      assert.equal(actions.length, 1);
      assert.equal(actions[0].key, 'tasks_summary');
    });

    it('ranks recent repeated actions higher than older actions', () => {
      const now = new Date('2026-10-03T10:00:00Z');
      const recentDate = new Date('2026-10-01T10:00:00Z'); // 2 days ago (+30 boost)
      const oldDate = new Date('2026-09-01T10:00:00Z'); // 32 days ago (0 boost)

      // Action A: count=2, recent (2*10 + 30 = 50)
      const scoreRecent = calculateRankingScore(2, recentDate, now);
      // Action B: count=3, older (3*10 + 0 = 30)
      const scoreOld = calculateRankingScore(3, oldDate, now);

      assert.ok(scoreRecent > scoreOld, `Recent score (${scoreRecent}) should beat older score (${scoreOld})`);
    });

    it('decays actions older than 60 days so they do not dominate forever', () => {
      const now = new Date('2026-10-03T10:00:00Z');
      const veryOldDate = new Date('2026-07-01T10:00:00Z'); // >90 days ago

      const scoreVeryOld = calculateRankingScore(50, veryOldDate, now);
      assert.ok(scoreVeryOld < 0, 'Actions beyond 60 days must receive a negative/decayed score');
    });
  });

  describe('6. True Bounded Recency & Required Edge Cases (A - F)', () => {
    const fixedNow = new Date('2026-10-03T12:00:00Z');
    const studentActor: AuthActor = { id: testUserId1, role: 'STUDENT', student: { id: 1 } as any };

    it('CASE A: 50 uses older than 60 days + 1 use today => does NOT qualify as repeated', async () => {
      // 50 uses 100 days ago
      const oldDate = new Date(fixedNow.getTime() - 100 * 24 * 60 * 60 * 1000);
      for (let i = 0; i < 50; i++) {
        await recordQuickActionUsage(testUserId1, 'student_academic_summary', oldDate);
      }
      // 1 use today
      await recordQuickActionUsage(testUserId1, 'student_academic_summary', fixedNow);

      // Also give action B 2 uses today so there is a qualified action to contrast
      await recordQuickActionUsage(testUserId1, 'schedule_summary', fixedNow);
      await recordQuickActionUsage(testUserId1, 'schedule_summary', fixedNow);

      const actions = await getPersonalizedQuickActions(studentActor, fixedNow);

      // schedule_summary (2 uses today) qualifies
      // student_academic_summary (1 use in window) does NOT qualify as repeated!
      assert.equal(actions.length, 1, 'Only schedule_summary should qualify');
      assert.equal(actions[0].key, 'schedule_summary');
    });

    it('CASE B: 50 uses older than 60 days + 2 uses today => qualifies based on recent count = 2, NOT lifetime count = 52', async () => {
      // 50 uses 100 days ago
      const oldDate = new Date(fixedNow.getTime() - 100 * 24 * 60 * 60 * 1000);
      for (let i = 0; i < 50; i++) {
        await recordQuickActionUsage(testUserId1, 'student_academic_summary', oldDate);
      }
      // 2 uses today
      await recordQuickActionUsage(testUserId1, 'student_academic_summary', fixedNow);
      await recordQuickActionUsage(testUserId1, 'student_academic_summary', fixedNow);

      // Action B has 5 uses 3 days ago (recent count = 5, score = 5*10 + 30 = 80)
      const threeDaysAgo = new Date(fixedNow.getTime() - 3 * 24 * 60 * 60 * 1000);
      for (let i = 0; i < 5; i++) {
        await recordQuickActionUsage(testUserId1, 'attendance_summary', threeDaysAgo);
      }

      const actions = await getPersonalizedQuickActions(studentActor, fixedNow);

      assert.equal(actions.length, 2);
      // If student_academic_summary used lifetime count 52, it would score 52*10+30 = 550 and be #1.
      // But based on recent count 2, it scores 2*10+30 = 50, so attendance_summary (score 80) is #1!
      assert.equal(actions[0].key, 'attendance_summary', 'attendance_summary (5 recent) must outrank academic (2 recent)');
      assert.equal(actions[1].key, 'student_academic_summary');
    });

    it('CASE C: 2 uses 59 days ago => qualifies', async () => {
      const fiftyNineDaysAgo = new Date(fixedNow.getTime() - 59 * 24 * 60 * 60 * 1000);
      await recordQuickActionUsage(testUserId1, 'tasks_summary', fiftyNineDaysAgo);
      await recordQuickActionUsage(testUserId1, 'tasks_summary', fiftyNineDaysAgo);

      const actions = await getPersonalizedQuickActions(studentActor, fixedNow);
      assert.equal(actions.length, 1);
      assert.equal(actions[0].key, 'tasks_summary');
    });

    it('CASE D: 2 uses 61 days ago => does not qualify', async () => {
      const sixtyOneDaysAgo = new Date(fixedNow.getTime() - 61 * 24 * 60 * 60 * 1000);
      await recordQuickActionUsage(testUserId1, 'tasks_summary', sixtyOneDaysAgo);
      await recordQuickActionUsage(testUserId1, 'tasks_summary', sixtyOneDaysAgo);

      // 61 days ago is outside the 60-day window. It does NOT qualify as repeated.
      // Zero-repeat fallback triggers. Since it was in DB, it returns exactly 1 fallback card.
      const actions = await getPersonalizedQuickActions(studentActor, fixedNow);
      assert.equal(actions.length, 1);
      // Let's verify that if a second action has 2 uses today, tasks_summary is NOT in the repeated list:
      await recordQuickActionUsage(testUserId1, 'schedule_summary', fixedNow);
      await recordQuickActionUsage(testUserId1, 'schedule_summary', fixedNow);

      const actionsWithRepeated = await getPersonalizedQuickActions(studentActor, fixedNow);
      assert.equal(actionsWithRepeated.length, 1);
      assert.equal(actionsWithRepeated[0].key, 'schedule_summary', '61-day-old action must NOT qualify as repeated');
    });

    it('CASE E: old high-frequency action must not outrank a genuinely repeated recent action', async () => {
      // Action A: 100 uses 80 days ago + 1 use today (recent count = 1)
      const eightyDaysAgo = new Date(fixedNow.getTime() - 80 * 24 * 60 * 60 * 1000);
      for (let i = 0; i < 100; i++) {
        await recordQuickActionUsage(testUserId1, 'exams_summary', eightyDaysAgo);
      }
      await recordQuickActionUsage(testUserId1, 'exams_summary', fixedNow);

      // Action B: 2 uses yesterday (recent count = 2)
      const yesterday = new Date(fixedNow.getTime() - 1 * 24 * 60 * 60 * 1000);
      await recordQuickActionUsage(testUserId1, 'student_courses', yesterday);
      await recordQuickActionUsage(testUserId1, 'student_courses', yesterday);

      const actions = await getPersonalizedQuickActions(studentActor, fixedNow);

      // Action B qualifies as repeated (2 >= 2)
      // Action A does not qualify as repeated (1 < 2)
      assert.equal(actions.length, 1);
      assert.equal(actions[0].key, 'student_courses', 'Genuinely repeated recent action must outrank old high-frequency action');
    });

    it('CASE F: no raw prompt text is stored by the new storage model', async () => {
      await recordQuickActionUsage(testUserId1, 'student_academic_summary', fixedNow);
      const row = await prisma.aIQuickActionUsage.findFirst({
        where: { userId: testUserId1 },
      });
      assert.ok(row);
      const keys = Object.keys(row);

      // Verify that no raw prompt, query, arguments, or conversation text columns exist
      assert.ok(!keys.includes('prompt'));
      assert.ok(!keys.includes('rawPrompt'));
      assert.ok(!keys.includes('userQuery'));
      assert.ok(!keys.includes('arguments'));
      assert.ok(!keys.includes('message'));

      // Verify exact expected columns
      assert.deepEqual(keys.sort(), ['actionKey', 'count', 'createdAt', 'id', 'lastUsedAt', 'usageDate', 'userId'].sort());
    });
  });

  describe('7. Layout Counts: 1, 2, 3, 4 and Zero-Repeat Fallback', () => {
    it('returns exactly 1 fallback card when user has 0 usage history', async () => {
      const actor: AuthActor = { id: testUserId1, role: 'STUDENT', student: { id: 1 } as any };
      const actions = await getPersonalizedQuickActions(actor);

      assert.equal(actions.length, 1);
      assert.equal(actions[0].key, 'student_academic_summary');
    });

    it('returns exactly 1 card when only 1 action repeats (count >= 2)', async () => {
      const actor: AuthActor = { id: testUserId1, role: 'STUDENT', student: { id: 1 } as any };
      await recordQuickActionUsage(testUserId1, 'schedule_summary');
      await recordQuickActionUsage(testUserId1, 'schedule_summary');

      const actions = await getPersonalizedQuickActions(actor);
      assert.equal(actions.length, 1);
      assert.equal(actions[0].key, 'schedule_summary');
    });

    it('returns exactly 2 cards when 2 actions repeat (count >= 2)', async () => {
      const actor: AuthActor = { id: testUserId1, role: 'STUDENT', student: { id: 1 } as any };
      await recordQuickActionUsage(testUserId1, 'schedule_summary');
      await recordQuickActionUsage(testUserId1, 'schedule_summary');
      await recordQuickActionUsage(testUserId1, 'attendance_summary');
      await recordQuickActionUsage(testUserId1, 'attendance_summary');

      const actions = await getPersonalizedQuickActions(actor);
      assert.equal(actions.length, 2);
      const keys = actions.map((a) => a.key);
      assert.ok(keys.includes('schedule_summary'));
      assert.ok(keys.includes('attendance_summary'));
    });

    it('caps at maximum 4 cards when 5 or more actions repeat', async () => {
      const actor: AuthActor = { id: testUserId1, role: 'STUDENT', student: { id: 1 } as any };
      const actionKeys = [
        'student_academic_summary',
        'student_courses',
        'attendance_summary',
        'schedule_summary',
        'tasks_summary',
        'exams_summary',
      ];

      for (const k of actionKeys) {
        await recordQuickActionUsage(testUserId1, k);
        await recordQuickActionUsage(testUserId1, k);
      }

      const actions = await getPersonalizedQuickActions(actor);
      assert.equal(actions.length, 4, 'Must strictly cap at 4 quick action cards');
    });
  });
});
