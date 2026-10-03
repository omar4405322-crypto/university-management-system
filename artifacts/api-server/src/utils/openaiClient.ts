import OpenAI from 'openai';

let client: OpenAI | undefined;

export function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error('OpenAI client is not configured');
  }
  client ??= new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    maxRetries: 0,
    timeout: 15_000,
    logLevel: 'off',
  });
  return client;
}
