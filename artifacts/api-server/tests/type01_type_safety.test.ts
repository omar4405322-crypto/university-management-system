import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AuthActor } from '../src/types/auth.types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('TYPE-001: AuthActor typed identity has required authorization fields', () => {
  const actor: AuthActor = {
    id: 101,
    email: 'admin@techno6.edu.eg',
    role: 'ADMIN',
    adminRole: 'COLLEGE_ADMIN',
    collegeId: 1,
    departmentId: 2,
    managedCollegeId: 1,
    managedDepartmentId: null,
    tokenVersion: 2,
    createdAt: new Date(),
    isActive: true,
  };

  assert.equal(actor.id, 101);
  assert.equal(actor.role, 'ADMIN');
  assert.equal(actor.managedCollegeId, 1);
});

test('TYPE-001: Backend source code has 0 @ts-nocheck and 0 @ts-ignore directives', () => {
  const srcDir = path.resolve(__dirname, '../src');

  function scanFiles(dir: string, fileList: string[] = []): string[] {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        scanFiles(fullPath, fileList);
      } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        fileList.push(fullPath);
      }
    }
    return fileList;
  }

  const allFiles = scanFiles(srcDir);
  const tsNoCheckFiles: string[] = [];
  const tsIgnoreFiles: string[] = [];

  for (const file of allFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    if (content.includes('@ts-nocheck')) {
      tsNoCheckFiles.push(path.relative(srcDir, file));
    }
    if (content.includes('@ts-ignore')) {
      tsIgnoreFiles.push(path.relative(srcDir, file));
    }
  }

  assert.deepEqual(
    tsNoCheckFiles,
    [],
    `Expected 0 @ts-nocheck in backend src, found in: ${tsNoCheckFiles.join(', ')}`
  );
  assert.deepEqual(
    tsIgnoreFiles,
    [],
    `Expected 0 @ts-ignore in backend src, found in: ${tsIgnoreFiles.join(', ')}`
  );
});

test('TYPE-001: Frontend source code has 0 @ts-nocheck and 0 @ts-ignore directives', () => {
  const srcDir = path.resolve(__dirname, '../../university-app/src');

  function scanFiles(dir: string, fileList: string[] = []): string[] {
    if (!fs.existsSync(dir)) return fileList;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        scanFiles(fullPath, fileList);
      } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        fileList.push(fullPath);
      }
    }
    return fileList;
  }

  const allFiles = scanFiles(srcDir);
  const tsNoCheckFiles: string[] = [];
  const tsIgnoreFiles: string[] = [];

  for (const file of allFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    if (content.includes('@ts-nocheck')) {
      tsNoCheckFiles.push(path.relative(srcDir, file));
    }
    if (content.includes('@ts-ignore')) {
      tsIgnoreFiles.push(path.relative(srcDir, file));
    }
  }

  assert.deepEqual(
    tsNoCheckFiles,
    [],
    `Expected 0 @ts-nocheck in frontend src, found in: ${tsNoCheckFiles.join(', ')}`
  );
  assert.deepEqual(
    tsIgnoreFiles,
    [],
    `Expected 0 @ts-ignore in frontend src, found in: ${tsIgnoreFiles.join(', ')}`
  );
});
