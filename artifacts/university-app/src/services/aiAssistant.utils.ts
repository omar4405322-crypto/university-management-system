import type { AxiosInstance } from 'axios';

export const AI_MESSAGE_LIMIT = 4000;

export function normalizeAiMessage(value: string): string | null {
  const message = value.trim();
  return message && message.length <= AI_MESSAGE_LIMIT ? message : null;
}

export function getAiStarterPromptKeys(role?: string, hasDataScope = true): string[] {
  if (role === 'STUDENT' && hasDataScope) {
    return [
      'aiAssistant.starters.studentAcademicSummary',
      'aiAssistant.starters.schedule',
      'aiAssistant.starters.exams',
      'aiAssistant.starters.tasks',
      'aiAssistant.starters.attendance',
      'aiAssistant.starters.payments',
    ];
  }
  if (role === 'DOCTOR' && hasDataScope) {
    return [
      'aiAssistant.starters.doctorCourses',
      'aiAssistant.starters.doctorSchedule',
      'aiAssistant.starters.doctorWorkload',
      'aiAssistant.starters.doctorAttendanceOverview',
      'aiAssistant.starters.doctorCourseRoster',
    ];
  }
  if (role === 'TEACHING_ASSISTANT' && hasDataScope) {
    return [
      'aiAssistant.starters.taSections',
      'aiAssistant.starters.taSchedule',
      'aiAssistant.starters.taWorkload',
      'aiAssistant.starters.taSectionStudents',
    ];
  }
  if (hasDataScope && ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(role ?? '')) {
    return [
      'aiAssistant.starters.adminSummary',
      'aiAssistant.starters.adminAttendance',
      'aiAssistant.starters.adminAcademic',
      'aiAssistant.starters.adminSearchStudents',
      'aiAssistant.starters.adminSearchDoctors',
      'aiAssistant.starters.adminSearchCourses',
      'aiAssistant.starters.adminDepartments',
    ];
  }
  return ['aiAssistant.starters.studyHelp', 'aiAssistant.starters.explainConcept'];
}

interface AiChatResponse {
  success: boolean;
  data?: { reply?: string };
}

export async function requestAiReply(client: Pick<AxiosInstance, 'post'>, message: string): Promise<string> {
  const normalized = normalizeAiMessage(message);
  if (!normalized) throw new Error('Invalid AI message');

  const response = await client.post<AiChatResponse>('/ai/chat', { message: normalized });
  const reply = response.data?.data?.reply?.trim();
  if (!response.data?.success || !reply) throw new Error('Invalid AI response');
  return reply;
}
