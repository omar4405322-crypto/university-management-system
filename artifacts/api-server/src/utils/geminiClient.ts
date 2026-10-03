import { GoogleGenAI } from '@google/genai';

let client: GoogleGenAI | undefined;

export function getGeminiClient(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY?.trim()) throw new Error('Gemini client is not configured');
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, vertexai: false });
  return client;
}
