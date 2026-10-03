import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { getAiStarterPromptKeys, normalizeAiMessage, requestAiReply, AI_MESSAGE_LIMIT } from '../src/services/aiAssistant.utils';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = (file: string) => readFileSync(path.join(root, 'src', file), 'utf8');
const en = JSON.parse(source('i18n/en.json'));
const ar = JSON.parse(source('i18n/ar.json'));
const leafKeys = (value: Record<string, unknown>, prefix = ''): string[] => Object.entries(value).flatMap(([key, child]) =>
  child && typeof child === 'object' ? leafKeys(child as Record<string, unknown>, `${prefix}${key}.`) : [`${prefix}${key}`]);
assert.deepEqual(leafKeys(en.aiAssistant).sort(), leafKeys(ar.aiAssistant).sort());

assert.equal(AI_MESSAGE_LIMIT, 4000);
assert.equal(normalizeAiMessage('  Hello  '), 'Hello');
assert.equal(normalizeAiMessage('  '), null);
assert.equal(normalizeAiMessage('x'.repeat(4001)), null);
assert.equal(normalizeAiMessage('x'.repeat(4000))?.length, 4000);

assert.deepEqual(getAiStarterPromptKeys('STUDENT'), [
  'aiAssistant.starters.studentAcademicSummary',
  'aiAssistant.starters.schedule',
  'aiAssistant.starters.exams',
  'aiAssistant.starters.tasks',
  'aiAssistant.starters.attendance',
  'aiAssistant.starters.payments',
]);

assert.deepEqual(getAiStarterPromptKeys('DOCTOR'), [
  'aiAssistant.starters.doctorCourses',
  'aiAssistant.starters.doctorSchedule',
  'aiAssistant.starters.doctorWorkload',
  'aiAssistant.starters.doctorAttendanceOverview',
  'aiAssistant.starters.doctorCourseRoster',
]);

assert.deepEqual(getAiStarterPromptKeys('TEACHING_ASSISTANT'), [
  'aiAssistant.starters.taSections',
  'aiAssistant.starters.taSchedule',
  'aiAssistant.starters.taWorkload',
  'aiAssistant.starters.taSectionStudents',
]);

for (const role of ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN']) {
  assert.deepEqual(getAiStarterPromptKeys(role), [
    'aiAssistant.starters.adminSummary',
    'aiAssistant.starters.adminAttendance',
    'aiAssistant.starters.adminAcademic',
    'aiAssistant.starters.adminSearchStudents',
    'aiAssistant.starters.adminSearchDoctors',
    'aiAssistant.starters.adminSearchCourses',
    'aiAssistant.starters.adminDepartments',
  ]);
}

for (const role of ['STUDENT', 'DOCTOR', 'TEACHING_ASSISTANT', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN']) {
  assert.deepEqual(getAiStarterPromptKeys(role, false), ['aiAssistant.starters.studyHelp', 'aiAssistant.starters.explainConcept']);
}

const calls: Array<{ url: string; body: unknown }> = [];
const fakeClient = { post: async (url: string, body: unknown) => {
  calls.push({ url, body });
  return { data: { success: true, data: { reply: 'Mocked answer' } } };
} };
assert.equal(await requestAiReply(fakeClient as any, '  First question  '), 'Mocked answer');
assert.equal(await requestAiReply(fakeClient as any, 'Second question'), 'Mocked answer');
assert.deepEqual(calls, [
  { url: '/ai/chat', body: { message: 'First question' } },
  { url: '/ai/chat', body: { message: 'Second question' } },
]);
await assert.rejects(requestAiReply(fakeClient as any, ' '));
await assert.rejects(requestAiReply(fakeClient as any, 'x'.repeat(4001)));
assert.equal(calls.length, 2);
await assert.rejects(requestAiReply({ post: async () => ({ data: { data: { reply: '' } } }) } as any, 'Question'));

const app = source('App.tsx');
const sidebar = source('components/layout/Sidebar.tsx');
const page = source('pages/ai/AiAssistantPage.tsx');
const service = source('services/ai.service.ts');
assert.match(app, /path="ai-assistant"/);
assert.match(app, /<ProtectedRoute>/);
assert.match(sidebar, /path: '\/ai-assistant'/);
assert.match(service, /requestAiReply\(api, message\)/);
assert.match(page, /<form[\s\S]*onSubmit/);
assert.match(page, /role="alert"/);
assert.match(page, /aria-live="polite"/);
assert.match(page, /requestSubmit\(\)/);
assert.match(page, /event\.shiftKey/);
assert.match(page, /pendingRef\.current/);
assert.match(page, /maxLength=\{AI_MESSAGE_LIMIT\}/);
assert.match(page, /dir=\{isRTL \? 'rtl' : 'ltr'\}/);
assert.doesNotMatch(page, /localStorage|sessionStorage|EventSource|WebSocket/);
assert.doesNotMatch(service + page, /OPENAI_API_KEY|VITE_OPENAI|api\.openai\.com|model:|tools:|userId:|role:/);

const keys = [
  'title', 'description', 'memoryNote', 'emptyTitle', 'emptyDescription',
  'question', 'answer', 'answerReady', 'inputLabel', 'placeholder',
  'send', 'sending', 'unavailable', 'retry', 'characterCount', 'keyboardHint',
  'starters.studentAcademicSummary', 'starters.schedule', 'starters.exams', 'starters.tasks', 'starters.attendance', 'starters.payments',
  'starters.doctorCourses', 'starters.doctorSchedule', 'starters.doctorWorkload',
  'starters.taSections', 'starters.taSchedule', 'starters.taWorkload',
  'starters.adminSummary', 'starters.adminAttendance', 'starters.adminAcademic',
  'starters.grades', 'starters.authorizedData', 'starters.studyHelp', 'starters.explainConcept',
];
for (const key of keys) {
  const value = (data: any) => key.split('.').reduce((part, segment) => part?.[segment], data.aiAssistant);
  assert.equal(typeof value(en), 'string', `Missing English ${key}`);
  assert.equal(typeof value(ar), 'string', `Missing Arabic ${key}`);
  assert.ok(value(en).trim() && value(ar).trim());
}
assert.equal(typeof en.nav.aiAssistant, 'string');
assert.equal(typeof ar.nav.aiAssistant, 'string');

console.log('AI Assistant frontend checks passed; fake API client only');
