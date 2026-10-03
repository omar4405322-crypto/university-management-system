declare module 'mammoth' {
  export interface MammothResult {
    value: string;
    messages: Array<{ type: string; message: string }>;
  }

  export function convertToMarkdown(input: { buffer: Buffer } | { path: string }): Promise<MammothResult>;
  export function extractRawText(input: { buffer: Buffer } | { path: string }): Promise<MammothResult>;
  export function convertToHtml(input: { buffer: Buffer } | { path: string }): Promise<MammothResult>;
}
