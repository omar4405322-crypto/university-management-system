import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '../src');

function getAllTsFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllTsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

import ts from 'typescript';

test('Architecture: Only approved services may write Enrollment finalGrade, points, and completion status', () => {
  const files = getAllTsFiles(srcDir);
  const allowedWriters = new Set([
    path.normalize(path.resolve(srcDir, 'services/gradebookPublish.service.ts')),
    path.normalize(path.resolve(srcDir, 'services/gradebookCorrection.service.ts')),
  ]);

  const forbiddenFields = new Set(['finalGrade', 'finalPointsEarned', 'finalPointsMax']);
  const forbiddenStatuses = new Set(['COMPLETED', 'FAILED']);

  const offendingFiles: Array<{ file: string; line: number; match: string }> = [];

  for (const filePath of files) {
    const normalized = path.normalize(filePath);
    if (allowedWriters.has(normalized)) continue;

    const content = fs.readFileSync(filePath, 'utf-8');
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true
    );

    function checkObjectLiteral(obj: ts.ObjectLiteralExpression, line: number) {
      for (const prop of obj.properties) {
        if (ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop)) {
          const propName = prop.name.getText(sourceFile);
          if (forbiddenFields.has(propName)) {
            offendingFiles.push({
              file: path.relative(srcDir, filePath),
              line,
              match: prop.getText(sourceFile),
            });
          }
          if (propName === 'status' && ts.isPropertyAssignment(prop)) {
            const valText = prop.initializer.getText(sourceFile);
            for (const s of forbiddenStatuses) {
              if (valText.includes(`'${s}'`) || valText.includes(`"${s}"`)) {
                offendingFiles.push({
                  file: path.relative(srcDir, filePath),
                  line,
                  match: prop.getText(sourceFile),
                });
                break;
              }
            }
          }
        }
      }
    }

    function visit(node: ts.Node) {
      // Check method calls: e.g. tx.enrollment.update(...) or prisma.enrollment.updateMany(...)
      if (ts.isCallExpression(node)) {
        const exprText = node.expression.getText(sourceFile);
        if (
          exprText.includes('enrollment.update') ||
          exprText.includes('enrollment.updateMany') ||
          exprText.includes('enrollment.create') ||
          exprText.includes('enrollment.upsert')
        ) {
          const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
          for (const arg of node.arguments) {
            if (ts.isObjectLiteralExpression(arg)) {
              for (const prop of arg.properties) {
                if (
                  ts.isPropertyAssignment(prop) &&
                  (prop.name.getText(sourceFile) === 'data' || prop.name.getText(sourceFile) === 'create') &&
                  ts.isObjectLiteralExpression(prop.initializer)
                ) {
                  checkObjectLiteral(prop.initializer, line);
                }
              }
            }
          }
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }

  assert.deepStrictEqual(
    offendingFiles,
    [],
    `Unauthorized writes to Enrollment final grades/status detected in: ${JSON.stringify(offendingFiles, null, 2)}`
  );
});
