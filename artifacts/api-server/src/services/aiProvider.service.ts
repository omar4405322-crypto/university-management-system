import type OpenAI from 'openai';
import type { GoogleGenAI } from '@google/genai';
import { toResponseInputItems } from 'openai/lib/responses/ResponseInputItems';
import { getOpenAIClient } from '../utils/openaiClient';
import { getGeminiClient } from '../utils/geminiClient';

export type AiProviderClient = Pick<OpenAI, 'responses'> | Pick<GoogleGenAI, 'interactions'>;
type FunctionTool = Extract<OpenAI.Responses.Tool, { type: 'function' }>;
type GeminiRequest = Extract<Parameters<GoogleGenAI['interactions']['create']>[0], { model: unknown }>;
type GeminiHistory = Extract<NonNullable<GeminiRequest['input']>, unknown[]>;

interface ToolCall { name: string; arguments: string; id: string }
interface ProviderTurn { reply?: string; calls: ToolCall[] }
export interface AiProviderSession {
  next: (onDelta?: (delta: string) => void) => Promise<ProviderTurn>;
  addResult: (call: ToolCall, result: Record<string, unknown>) => void;
}

export interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

function emitDeltas(text: string | undefined, onDelta?: (delta: string) => void) {
  if (!onDelta || !text) return;
  const tokens = text.match(/\S+\s*|\s+/g) || [text];
  for (const token of tokens) {
    onDelta(token);
  }
}

export function createAiProviderSession(
  provider: 'openai' | 'gemini',
  message: string,
  model: string,
  instructions: string,
  tools: FunctionTool[],
  client?: AiProviderClient,
  historyMessages: HistoryMessage[] = [],
): AiProviderSession {
  if (provider === 'openai') {
    if (client && !('responses' in client)) throw new Error('Invalid AI client');
    const selected = client ?? getOpenAIClient();
    const history: OpenAI.Responses.ResponseInputItem[] = [
      ...historyMessages.map(m => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: message },
    ];
    let first = true;
    return {
      next: async (onDelta?: (delta: string) => void) => {
        const response = await selected.responses.create({
          model, instructions, input: first && historyMessages.length === 0 ? message : history,
          ...(tools.length ? { tools, parallel_tool_calls: false } : {}),
          store: false, max_output_tokens: 768,
        });
        first = false;
        if (response.status && response.status !== 'completed') throw new Error('Incomplete AI response');
        const calls = response.output?.filter(item => item.type === 'function_call') ?? [];
        if (calls.length) history.push(...toResponseInputItems(response.output));
        if (!calls.length && response.output_text) {
          emitDeltas(response.output_text, onDelta);
        }
        return { reply: response.output_text, calls: calls.map(call => ({ name: call.name, arguments: call.arguments, id: call.call_id })) };
      },
      addResult: (call, result) => { history.push({ type: 'function_call_output', call_id: call.id, output: JSON.stringify(result) }); },
    };
  }

  if (client && !('interactions' in client)) throw new Error('Invalid AI client');
  const selected = client ?? getGeminiClient();
  const history: GeminiHistory = [
    ...historyMessages.map(m => (m.role === 'user'
      ? { type: 'user_input' as const, content: [{ type: 'text' as const, text: m.content }] }
      : { type: 'model_output' as const, content: [{ type: 'text' as const, text: m.content }] })),
    { type: 'user_input' as const, content: [{ type: 'text' as const, text: message }] },
  ];
  return {
    next: async (onDelta?: (delta: string) => void) => {
      const response = await selected.interactions.create({
        model, input: history, system_instruction: instructions, store: false, stream: false,
        generation_config: { max_output_tokens: 768 },
        ...(tools.length ? { tools: tools.map(tool => ({ type: 'function' as const, name: tool.name, description: tool.description ?? '', parameters: tool.parameters ?? {} })) } : {}),
      }, { timeout_ms: 15_000, retries: { strategy: 'none' } });
      const calls = response.steps?.filter(step => step.type === 'function_call') ?? [];
      if (response.errors?.length || (response.status !== 'completed' && !(response.status === 'requires_action' && calls.length))) throw new Error('Incomplete AI response');
      if (calls.length) history.push(...(response.steps ?? []));
      if (!calls.length && response.output_text) {
        emitDeltas(response.output_text, onDelta);
      }
      return {
        reply: response.output_text,
        calls: calls.map(call => {
          if (!call.id || !call.name || call.arguments === undefined) throw new Error('Invalid AI tool call');
          return { name: call.name, arguments: JSON.stringify(call.arguments), id: call.id };
        }),
      };
    },
    addResult: (call, result) => { history.push({ type: 'function_result', name: call.name, call_id: call.id, result: [{ type: 'text', text: JSON.stringify(result) }] }); },
  };
}
