import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootPackageJson = path.resolve(__dirname, '../../../package.json');
const req = createRequire(rootPackageJson);
const ts = req('typescript');

async function loadProductionAiService() {
  const servicePath = path.resolve(__dirname, '../src/services/ai.service.ts');
  let source = fs.readFileSync(servicePath, 'utf8');

  // Stub imports with a fake api client that captures requests
  source = source.replace(/import api, \{ getAccessToken, getDynamicBaseUrl \} from '\.\/api';/, `
    export const fakeApi = {
      postCalls: [],
      getCalls: [],
      deleteCalls: [],
      async post(url, data, config) {
        this.postCalls.push({ url, data, config });
        return { data: { success: true, data: { attachment: { id: 'att-123', originalFilename: 'notes.pdf', byteSize: 1024, mimeType: 'application/pdf', pageCount: 3, createdAt: new Date().toISOString() } } } };
      },
      async get(url) {
        this.getCalls.push({ url });
        return { data: { success: true, data: { attachments: [{ id: 'att-123', originalFilename: 'notes.pdf', byteSize: 1024, mimeType: 'application/pdf', pageCount: 3, createdAt: new Date().toISOString() }] } } };
      },
      async delete(url) {
        this.deleteCalls.push({ url });
        return { data: { success: true, message: 'Deleted' } };
      },
    };
    const api = fakeApi;
    export const getAccessToken = () => 'mock-jwt-token';
    export const getDynamicBaseUrl = () => 'http://localhost:3000/api';
  `);
  source = source.replace(/import \{ requestAiReply \} from '\.\/aiAssistant\.utils';/, `
    const requestAiReply = async () => 'mock';
  `);

  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  const dataUri = 'data:text/javascript;base64,' + Buffer.from(transpiled).toString('base64');
  return await import(dataUri);
}

test('PHASE 15 — Frontend Attachments API & Composer Contract', async (t) => {
  const service = await loadProductionAiService();
  const { uploadConversationAttachment, listConversationAttachments, deleteConversationAttachment, fakeApi } = service;

  await t.test('1. uploadConversationAttachment packages multipart FormData and dispatches to conversation route', async () => {
    fakeApi.postCalls = [];
    const mockFile = new File(['mock content'], 'lecture_notes.pdf', { type: 'application/pdf' });

    const result = await uploadConversationAttachment('conv-77', mockFile);

    assert.equal(fakeApi.postCalls.length, 1);
    assert.equal(fakeApi.postCalls[0].url, '/ai/conversations/conv-77/attachments');
    assert.ok(fakeApi.postCalls[0].data instanceof FormData);
    assert.equal(fakeApi.postCalls[0].config?.headers?.['Content-Type'], 'multipart/form-data');
    assert.equal(result.id, 'att-123');
    assert.equal(result.originalFilename, 'notes.pdf');
  });

  await t.test('2. listConversationAttachments queries conversation attachments endpoint', async () => {
    fakeApi.getCalls = [];
    const attachments = await listConversationAttachments('conv-77');

    assert.equal(fakeApi.getCalls.length, 1);
    assert.equal(fakeApi.getCalls[0].url, '/ai/conversations/conv-77/attachments');
    assert.equal(attachments.length, 1);
    assert.equal(attachments[0].id, 'att-123');
  });

  await t.test('3. deleteConversationAttachment sends DELETE to attachment resource', async () => {
    fakeApi.deleteCalls = [];
    await deleteConversationAttachment('conv-77', 'att-123');

    assert.equal(fakeApi.deleteCalls.length, 1);
    assert.equal(fakeApi.deleteCalls[0].url, '/ai/conversations/conv-77/attachments/att-123');
  });

  await t.test('4. Attachment constraints validation contract: size and extension limits', () => {
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const MAX_TOTAL_SIZE = 25 * 1024 * 1024; // 25MB
    const ALLOWED_EXTENSIONS = ['.pdf', '.txt', '.md', '.docx', '.csv'];

    // Valid file
    const validFile = { name: 'syllabus.pdf', size: 2 * 1024 * 1024 };
    const ext = path.extname(validFile.name).toLowerCase();
    assert.ok(ALLOWED_EXTENSIONS.includes(ext));
    assert.ok(validFile.size <= MAX_FILE_SIZE);

    // Oversized single file
    const oversizedFile = { name: 'huge_book.pdf', size: 12 * 1024 * 1024 };
    assert.equal(oversizedFile.size > MAX_FILE_SIZE, true);

    // Unsupported extension
    const exeFile = { name: 'script.exe', size: 1024 };
    assert.equal(ALLOWED_EXTENSIONS.includes(path.extname(exeFile.name).toLowerCase()), false);

    // Total size calculation across draft attachments
    const files = [
      { name: '1.pdf', size: 9 * 1024 * 1024 },
      { name: '2.pdf', size: 9 * 1024 * 1024 },
      { name: '3.pdf', size: 9 * 1024 * 1024 },
    ];
    const total = files.reduce((sum, f) => sum + f.size, 0);
    assert.equal(total > MAX_TOTAL_SIZE, true, 'Combined attachments exceeding 25MB must be flagged');
  });
});
