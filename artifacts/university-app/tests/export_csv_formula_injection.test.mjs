import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { escapeCsvCell } from '../src/utils/exportCsv.ts';

describe('CSV Cell Escaping & Formula Injection Neutralisation', () => {
  it('neutralises formula injection starting with =, +, -, @, tab, and carriage return', () => {
    // Basic trigger characters
    assert.equal(escapeCsvCell('=SUM(A1:B1)'), "'=SUM(A1:B1)");
    assert.equal(escapeCsvCell('+12345'), "'+12345");
    assert.equal(escapeCsvCell('-cmd|/C calc!A0'), "'-cmd|/C calc!A0");
    assert.equal(escapeCsvCell('@SUM(1+1)'), "'@SUM(1+1)");
    assert.equal(escapeCsvCell('\tmalicious'), "'\tmalicious");
    assert.equal(escapeCsvCell('\rmalicious'), "\"'\rmalicious\""); // contains \r, so quoted
  });

  it('neutralises formula injection after leading whitespace is trimmed', () => {
    assert.equal(escapeCsvCell('   =cmd'), "'   =cmd");
    assert.equal(escapeCsvCell('  +999'), "'  +999");
    assert.equal(escapeCsvCell('    -danger'), "'    -danger");
    assert.equal(escapeCsvCell('   @mention'), "'   @mention");
    assert.equal(escapeCsvCell('   \ttabbed'), "'   \ttabbed");
    assert.equal(escapeCsvCell('   \rcarriage'), "\"'   \rcarriage\"");
  });

  it('handles normal text, numbers, and Arabic text without formula injection prefix', () => {
    assert.equal(escapeCsvCell('Normal Text'), 'Normal Text');
    assert.equal(escapeCsvCell('Student Name'), 'Student Name');
    assert.equal(escapeCsvCell(123), '123');
    assert.equal(escapeCsvCell(0), '0');
    assert.equal(escapeCsvCell('احمد محمد'), 'احمد محمد');
    assert.equal(escapeCsvCell('قسم علوم الحاسب'), 'قسم علوم الحاسب');
  });

  it('does not alter typed finite numbers (including negative numbers) while prefixing string numbers', () => {
    assert.equal(escapeCsvCell(-5), '-5');
    assert.equal(escapeCsvCell(-12.34), '-12.34');
    assert.equal(escapeCsvCell(5), '5');
    assert.equal(escapeCsvCell(0), '0');
    // String negative numbers must still be prefixed
    assert.equal(escapeCsvCell('-5'), "'-5");
    assert.equal(escapeCsvCell('+5'), "'+5");
    assert.equal(escapeCsvCell(' -5'), "' -5");
  });

  it('correctly escapes quotes, commas, and newlines', () => {
    assert.equal(escapeCsvCell('Hello, World'), '"Hello, World"');
    assert.equal(escapeCsvCell('Say "Hello"'), '"Say ""Hello"""');
    assert.equal(escapeCsvCell('Line 1\nLine 2'), '"Line 1\nLine 2"');
    // Combined injection with comma and quotes
    assert.equal(escapeCsvCell('=1+1,"test"'), '"\'=1+1,""test"""');
    assert.equal(escapeCsvCell('مرحبا, بكم'), '"مرحبا, بكم"');
  });

  it('handles null and undefined values safely', () => {
    assert.equal(escapeCsvCell(null), '');
    assert.equal(escapeCsvCell(undefined), '');
  });
});
