import assert from 'node:assert/strict';
import { test } from 'node:test';

// Mirror of the hardened parser in AiMessageContent.tsx for hermetic Node.js spec testing
function splitTableRow(rowLine) {
  const placeholder = '\uE000';
  const sanitized = rowLine.replace(/\\\|/g, placeholder);

  const firstPipe = sanitized.indexOf('|');
  const lastPipe = sanitized.lastIndexOf('|');

  if (firstPipe !== -1 && lastPipe > firstPipe) {
    const cellsContent = sanitized.slice(firstPipe + 1, lastPipe);
    const rawCells = cellsContent.split('|').map((c) => c.replace(new RegExp(placeholder, 'g'), '|').trim());
    const afterLastPipe = sanitized.slice(lastPipe + 1).trim();
    return {
      cells: rawCells,
      trailingText: afterLastPipe ? afterLastPipe : undefined,
    };
  }

  const fallbackCells = sanitized.split('|').map((c) => c.replace(new RegExp(placeholder, 'g'), '|').trim());
  return { cells: fallbackCells.filter((c, idx) => !(idx === 0 && !c) && !(idx === fallbackCells.length - 1 && !c)) };
}

function isTableSeparatorLine(line) {
  const trimmed = line.trim();
  if (!trimmed.includes('-')) return false;
  const { cells } = splitTableRow(trimmed);
  return cells.length > 0 && cells.every((s) => /^[:\s-]+$/.test(s));
}

function isTableRowLine(line) {
  const trimmed = line.trim();
  if (!trimmed.includes('|')) return false;
  if (/^#{1,6}\s+/.test(trimmed) || /^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
    return false;
  }
  return trimmed.startsWith('|') || (trimmed.endsWith('|') && trimmed.includes('|'));
}

function normalizeStudentStatus(rawStatus) {
  if (!rawStatus) return null;
  const cleaned = rawStatus.trim().replace(/^[`'"]+|[`'"]+$/g, '');
  if (!cleaned) return null;

  const upper = cleaned.toUpperCase();
  if (upper === 'ACTIVE' || cleaned === 'منتظم' || cleaned === 'نشط') {
    return { label: 'منتظم', variant: 'active' };
  }
  if (upper === 'INACTIVE' || cleaned === 'غير نشط' || cleaned === 'معلق') {
    return { label: 'غير نشط', variant: 'inactive' };
  }
  return { label: cleaned, variant: 'neutral' };
}

function isStudentTable(headers) {
  const colMap = {};
  headers.forEach((h, idx) => {
    const norm = h.toLowerCase().trim();
    if (/(?:طالب|student|اسم|name)/.test(norm) && !/(?:رقم|id|كود|code)/.test(norm)) {
      colMap.name = idx;
    } else if (/(?:رقم|id|جامعي|كود|code|academic)/.test(norm)) {
      colMap.studentId = idx;
    } else if (/(?:فرقة|سنة|مستوى|year|level|cohort)/.test(norm)) {
      colMap.year = idx;
    } else if (/(?:قسم|تخصص|department|dept)/.test(norm)) {
      colMap.department = idx;
    } else if (/(?:كلية|college|faculty)/.test(norm)) {
      colMap.college = idx;
    } else if (/(?:حالة|status)/.test(norm)) {
      colMap.status = idx;
    }
  });

  const isMatch =
    colMap.name !== undefined &&
    ((colMap.studentId !== undefined && (colMap.department !== undefined || colMap.college !== undefined || colMap.year !== undefined)) ||
      (colMap.department !== undefined && colMap.college !== undefined));

  return { isMatch, colMap };
}

function extractStudentFromText(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  const firstLine = lines[0];

  let name = '';
  const boldMatch = firstLine.match(/\*\*([^*]+)\*\*/);
  if (boldMatch) {
    name = boldMatch[1].replace(/^\d+[\.\)]\s*/, '').trim();
  } else {
    const prefixMatch = firstLine.match(/^(?:الطالب|اسم الطالب|Student(?:\s*Name)?)\s*[:\-]\s*(.+)$/i);
    if (prefixMatch) {
      name = prefixMatch[1].trim();
    } else {
      const cleanedFirst = firstLine
        .replace(/^[-*•]\s*/, '')
        .replace(/^\d+[\.\)]\s*/, '')
        .trim();

      const colonIdx = cleanedFirst.indexOf(':');
      if (colonIdx > 0) {
        const potentialKey = cleanedFirst.slice(0, colonIdx).trim();
        if (!/(?:الرقم|الفرقة|السنة|القسم|الكلية|الحالة|id|year|dept|college|status)/i.test(potentialKey)) {
          name = cleanedFirst.slice(0, colonIdx).trim();
        }
      } else if (!/(?:الرقم|الفرقة|السنة|القسم|الكلية|الحالة|id|year|dept|college|status)/i.test(cleanedFirst) && cleanedFirst.length < 60) {
        name = cleanedFirst;
      }
    }
  }

  let studentIdFromParenthesis = '';
  const parenIdMatch = name.match(/\s*\((?:الرقم(?:\s*الجامعي)?[:\s]*)?([A-Za-z0-9_\-]+)\)\s*$/);
  if (parenIdMatch) {
    studentIdFromParenthesis = parenIdMatch[1].trim();
    name = name.slice(0, parenIdMatch.index).trim();
  }

  name = name.replace(/<!--[\s\S]*?-->/g, '').replace(/^[*_~`]+|[*_~`]+$/g, '').trim();
  if (!name || name.length < 2) return null;

  const combined = lines.join(' \n ');

  let id = undefined;
  const internalIdMatch =
    combined.match(/<!--\s*(?:id|record_id|student_id|db_id):\s*(\d+)\s*-->/i) ||
    combined.match(/(?:المعرف|رقم\s*السجل|record_id|db_id|\bid)[:\s]+(\d+)/i);
  if (internalIdMatch) {
    const parsedNum = Number(internalIdMatch[1]);
    if (Number.isInteger(parsedNum) && parsedNum > 0) {
      id = parsedNum;
    }
  }

  // Strip discrete comments before searching public fields so internal comments cannot match as studentId
  const cleanCombined = combined.replace(/<!--[\s\S]*?-->/g, '');

  let studentId = studentIdFromParenthesis;
  if (!studentId) {
    const idMatch =
      cleanCombined.match(/(?:الرقم\s*الجامعي|رقم\s*الطالب|الرقم\s*الأكاديمي|Student\s*ID|كود\s*الطالب|كود|الرقم|ID)[:\s]+`?([A-Za-z0-9_\-]+)`?/i) ||
      cleanCombined.match(/\((?:الرقم\s*الجامعي:\s*)?([A-Za-z0-9_\-]+)\)/);
    if (idMatch) {
      studentId = idMatch[1].trim();
    }
  }

  let year = '';
  const yearMatch = cleanCombined.match(/(?:الفرقة\s*الدراسية|الفرقة|السنة\s*الدراسية|السنة|المستوى|Year|Level|Cohort)[:\s]+([^•\-,;\n|]+)/i);
  if (yearMatch) {
    year = yearMatch[1].trim().replace(/^[*_`]+|[*_`]+$/g, '');
  }

  let department = '';
  const deptMatch = cleanCombined.match(/(?:القسم\s*الأكاديمي|القسم|التخصص|Department|Dept)[:\s]+([^•\-,;\n|]+)/i);
  if (deptMatch) {
    department = deptMatch[1].trim().replace(/^[*_`]+|[*_`]+$/g, '');
  }

  let college = '';
  const collegeMatch = cleanCombined.match(/(?:الكلية|كلية|College|Faculty)[:\s]+([^•\-,;\n|]+)/i);
  if (collegeMatch) {
    college = collegeMatch[1].trim().replace(/^[*_`]+|[*_`]+$/g, '');
  }

  let status = '';
  const statusMatch = cleanCombined.match(/(?:الحالة\s*الأكاديمية|الحالة|Status)[:\s]+([^•\-,;\n|]+)/i);
  if (statusMatch) {
    status = statusMatch[1].trim().replace(/^[*_`]+|[*_`]+$/g, '');
  }

  if (name && (studentId || department || college || year)) {
    return { id, name, studentId, year, department, college, status };
  }
  return null;
}

function parseBlocks(raw) {
  const lines = raw.split(/\r?\n/);
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    if (isTableRowLine(trimmed)) {
      const tableLines = [];
      let trailingParagraphAfterLastRow;

      while (i < lines.length && isTableRowLine(lines[i].trim())) {
        const currentTrimmed = lines[i].trim();
        const { trailingText } = splitTableRow(currentTrimmed);
        tableLines.push(currentTrimmed);
        i++;
        if (trailingText) {
          trailingParagraphAfterLastRow = trailingText;
          break;
        }
      }

      if (tableLines.length >= 2) {
        const headerInfo = splitTableRow(tableLines[0]);
        const headers = headerInfo.cells;
        const colCount = headers.length;
        const secondLineIsSep = isTableSeparatorLine(tableLines[1]);
        const startIndex = secondLineIsSep ? 2 : 1;

        const rows = [];
        for (let r = startIndex; r < tableLines.length; r++) {
          const rowInfo = splitTableRow(tableLines[r]);
          let cells = rowInfo.cells;

          if (cells.length < colCount) {
            cells = [...cells, ...Array(colCount - cells.length).fill('')];
          } else if (cells.length > colCount) {
            cells = [...cells.slice(0, colCount - 1), cells.slice(colCount - 1).join(' ')];
          }
          rows.push(cells);
        }

        const studentTableCheck = isStudentTable(headers);
        if (studentTableCheck.isMatch && rows.length > 0) {
          const { colMap } = studentTableCheck;
          const students = rows
            .map((row) => {
              const fullRowText = row.join(' ');
              const rowIdMatch =
                fullRowText.match(/<!--\s*(?:id|record_id|student_id|db_id):\s*(\d+)\s*-->/i) ||
                fullRowText.match(/(?:المعرف|رقم\s*السجل|record_id|db_id|\bid)[:\s]+(\d+)/i);
              const foundIdStr =
                colMap.id !== undefined && row[colMap.id]
                  ? row[colMap.id].replace(/<!--[\s\S]*?-->/g, '').trim()
                  : rowIdMatch
                  ? rowIdMatch[1]
                  : undefined;
              const numId = foundIdStr ? Number(foundIdStr) : undefined;
              const validId = numId && Number.isInteger(numId) && numId > 0 ? numId : undefined;
              return {
                id: validId,
                name: (row[colMap.name] || '').replace(/<!--[\s\S]*?-->/g, '').trim(),
                studentId: colMap.studentId !== undefined ? row[colMap.studentId]?.replace(/<!--[\s\S]*?-->/g, '').trim() : undefined,
                year: colMap.year !== undefined ? row[colMap.year]?.replace(/<!--[\s\S]*?-->/g, '').trim() : undefined,
                department: colMap.department !== undefined ? row[colMap.department]?.replace(/<!--[\s\S]*?-->/g, '').trim() : undefined,
                college: colMap.college !== undefined ? row[colMap.college]?.replace(/<!--[\s\S]*?-->/g, '').trim() : undefined,
                status: colMap.status !== undefined ? row[colMap.status]?.replace(/<!--[\s\S]*?-->/g, '').trim() : undefined,
              };
            })
            .filter((s) => Boolean(s.name));

          if (students.length > 0) {
            blocks.push({ type: 'student-cards', students });
            if (trailingParagraphAfterLastRow) {
              blocks.push({ type: 'paragraph', text: trailingParagraphAfterLastRow });
            }
            continue;
          }
        }

        blocks.push({ type: 'table', headers, rows });

        if (trailingParagraphAfterLastRow) {
          blocks.push({ type: 'paragraph', text: trailingParagraphAfterLastRow });
        }
        continue;
      } else if (tableLines.length === 1) {
        blocks.push({ type: 'paragraph', text: tableLines[0] });
        continue;
      }
    }

    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      });
      i++;
      continue;
    }

    const isOrderedItem = /^\d+[\.\)]\s+/.test(trimmed);
    const isUnorderedItem = /^[-*•]\s+/.test(trimmed);

    if (isOrderedItem || isUnorderedItem) {
      const items = [];
      const isOrdered = isOrderedItem;

      while (i < lines.length) {
        const curTrimmed = lines[i].trim();
        if (!curTrimmed) {
          let nextIdx = i + 1;
          while (nextIdx < lines.length && !lines[nextIdx].trim()) {
            nextIdx++;
          }
          if (
            nextIdx < lines.length &&
            ((isOrdered && /^\d+[\.\)]\s+/.test(lines[nextIdx].trim())) ||
              (!isOrdered && /^[-*•]\s+/.test(lines[nextIdx].trim())))
          ) {
            i = nextIdx;
            continue;
          }
          break;
        }

        const rawLine = lines[i];
        const isIndented = (rawLine.startsWith('  ') || rawLine.startsWith('\t')) && items.length > 0;

        if (isOrdered && !isIndented && /^[-*•]\s+/.test(curTrimmed)) {
          break;
        }
        if (!isOrdered && !isIndented && /^\d+[\.\)]\s+/.test(curTrimmed)) {
          break;
        }

        const isNewItem = !isIndented && (isOrdered
          ? /^\d+[\.\)]\s+/.test(curTrimmed)
          : /^[-*•]\s+/.test(curTrimmed));

        if (isNewItem) {
          const content = isOrdered
            ? curTrimmed.replace(/^\d+[\.\)]\s+/, '')
            : curTrimmed.replace(/^[-*•]\s+/, '');
          items.push(content);
          i++;
        } else if (items.length > 0) {
          if (isTableRowLine(curTrimmed) || curTrimmed.startsWith('#')) {
            break;
          }
          items[items.length - 1] += '\n' + curTrimmed;
          i++;
        } else {
          break;
        }
      }

      const parsedStudents = items
        .map((it) => extractStudentFromText(it))
        .filter(Boolean);

      if (parsedStudents.length > 0 && parsedStudents.length >= Math.ceil(items.length / 2)) {
        blocks.push({ type: 'student-cards', students: parsedStudents });
      } else {
        blocks.push({ type: 'list', ordered: isOrdered, items });
      }
      continue;
    }

    const paragraphLines = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !isTableRowLine(lines[i].trim()) &&
      !lines[i].trim().startsWith('#') &&
      !/^[-*•]\s+/.test(lines[i].trim()) &&
      !/^\d+[\.\)]\s+/.test(lines[i].trim())
    ) {
      paragraphLines.push(lines[i]);
      i++;
    }

    const paragraphText = paragraphLines.join('\n');
    const maybeStudent = extractStudentFromText(paragraphText);
    if (maybeStudent) {
      blocks.push({ type: 'student-cards', students: [maybeStudent] });
    } else {
      blocks.push({ type: 'paragraph', text: paragraphText });
    }
  }

  const mergedBlocks = [];
  for (const b of blocks) {
    const prev = mergedBlocks[mergedBlocks.length - 1];
    if (b.type === 'student-cards' && prev && prev.type === 'student-cards') {
      prev.students.push(...b.students);
    } else {
      mergedBlocks.push(b);
    }
  }

  return mergedBlocks;
}

test('FMT-001: Table followed immediately by paragraph without blank line', () => {
  const input = [
    '| Course | Grade | Credits |',
    '| :--- | :--- | :--- |',
    '| CS101 | A | 3 |',
    'This is a summary paragraph immediately following the table.',
  ].join('\n');

  const blocks = parseBlocks(input);
  assert.equal(blocks.length, 2, 'Should create exactly 2 blocks (table + paragraph)');
  assert.equal(blocks[0].type, 'table');
  assert.deepEqual(blocks[0].headers, ['Course', 'Grade', 'Credits']);
  assert.equal(blocks[0].rows.length, 1);
  assert.deepEqual(blocks[0].rows[0], ['CS101', 'A', '3']);

  assert.equal(blocks[1].type, 'paragraph');
  assert.equal(blocks[1].text, 'This is a summary paragraph immediately following the table.');
});

test('FMT-002: Trailing content on the same line after closing pipe is separated into paragraph', () => {
  const input = [
    '| Subject | Status |',
    '| --- | --- |',
    '| Math | Passed | Note: All prerequisite requirements met.',
  ].join('\n');

  const blocks = parseBlocks(input);
  assert.equal(blocks.length, 2, 'Should cleanly extract trailing text into a subsequent paragraph block');
  assert.equal(blocks[0].type, 'table');
  assert.deepEqual(blocks[0].rows[0], ['Math', 'Passed'], 'Last table row must NOT contain the trailing note');

  assert.equal(blocks[1].type, 'paragraph');
  assert.equal(blocks[1].text, 'Note: All prerequisite requirements met.');
});

test('FMT-003: Multiple tables in one response separated by headings and text', () => {
  const input = [
    '### Semester 1',
    '| Course | Grade |',
    '| --- | --- |',
    '| CS101 | A |',
    '',
    '### Semester 2',
    '| Course | Grade |',
    '| --- | --- |',
    '| CS102 | B+ |',
  ].join('\n');

  const blocks = parseBlocks(input);
  assert.equal(blocks.length, 4, 'Should parse 4 blocks (heading, table, heading, table)');
  assert.equal(blocks[0].type, 'heading');
  assert.equal(blocks[1].type, 'table');
  assert.equal(blocks[2].type, 'heading');
  assert.equal(blocks[3].type, 'table');
});

test('FMT-004: Arabic RTL tables with localized headers and cells', () => {
  const input = [
    '| المقرر | الدرجة | التقدير |',
    '| :--- | :--- | :--- |',
    '| تراكيب البيانات | 95 | ممتاز |',
    '| الجبر الخطي | 88 | جيد جداً |',
    '',
    'ملاحظة: تم حساب المعدل الفصلي بنجاح.',
  ].join('\n');

  const blocks = parseBlocks(input);
  assert.equal(blocks[0].type, 'table');
  assert.deepEqual(blocks[0].headers, ['المقرر', 'الدرجة', 'التقدير']);
  assert.equal(blocks[0].rows.length, 2);
  assert.deepEqual(blocks[0].rows[0], ['تراكيب البيانات', '95', 'ممتاز']);
  assert.equal(blocks[1].type, 'paragraph');
});

test('FMT-005: Lists immediately after tables without extra blank lines', () => {
  const input = [
    '| Rule | Penalty |',
    '| --- | --- |',
    '| 3 Absences | Warning 1 |',
    '- First notice sent via SMS',
    '- Second notice sent via email',
    '1. Appeal deadline is 7 days',
    '2. Review by council',
  ].join('\n');

  const blocks = parseBlocks(input);
  assert.equal(blocks.length, 3, 'Should produce Table, Bullet List, and Ordered List');
  assert.equal(blocks[0].type, 'table');
  assert.equal(blocks[1].type, 'list');
  assert.equal(blocks[1].ordered, false);
  assert.equal(blocks[1].items.length, 2);

  assert.equal(blocks[2].type, 'list');
  assert.equal(blocks[2].ordered, true);
  assert.equal(blocks[2].items.length, 2);
});

test('FMT-006: Headings immediately after tables', () => {
  const input = [
    '| Term | Standing |',
    '| --- | --- |',
    '| Fall 2025 | Good |',
    '## Next Steps',
    'Please review your registration schedule.',
  ].join('\n');

  const blocks = parseBlocks(input);
  assert.equal(blocks.length, 3);
  assert.equal(blocks[0].type, 'table');
  assert.equal(blocks[1].type, 'heading');
  assert.equal(blocks[1].level, 2);
  assert.equal(blocks[1].text, 'Next Steps');
  assert.equal(blocks[2].type, 'paragraph');
});

test('FMT-007: Escaped pipes inside table cells', () => {
  const input = [
    '| Bylaw Article | Description |',
    '| --- | --- |',
    '| Article 12 \\| Clause A | Conditions for graduation \\| 120 credit hours |',
  ].join('\n');

  const blocks = parseBlocks(input);
  assert.equal(blocks[0].type, 'table');
  assert.deepEqual(blocks[0].headers, ['Bylaw Article', 'Description']);
  assert.equal(blocks[0].rows[0].length, 2, 'Escaped pipe must not split cells into extra columns');
  assert.equal(blocks[0].rows[0][0], 'Article 12 | Clause A');
  assert.equal(blocks[0].rows[0][1], 'Conditions for graduation | 120 credit hours');
});

test('FMT-008: Malformed column counts gracefully normalized without layout corruption', () => {
  const input = [
    '| Col1 | Col2 | Col3 |',
    '| --- | --- | --- |',
    '| Only One |',
    '| Val1 | Val2 | Val3 | Extra Column Four |',
  ].join('\n');

  const blocks = parseBlocks(input);
  const table = blocks[0];
  assert.equal(table.rows[0].length, 3, 'Underfilled row padded to 3 columns');
  assert.equal(table.rows[0][0], 'Only One');
  assert.equal(table.rows[0][1], '');
  assert.equal(table.rows[0][2], '');

  assert.equal(table.rows[1].length, 3, 'Overfilled row consolidated safely to 3 columns');
});

test('FMT-009: Single orphan pipe line treated as paragraph without silent data loss', () => {
  const input = '| Just an orphan note with pipes |';
  const blocks = parseBlocks(input);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, 'paragraph');
  assert.equal(blocks[0].text, '| Just an orphan note with pipes |');
});

test('FMT-010: Numbered list with sub-bullets parsed as single coherent student-cards block (Observed Failure Mode)', () => {
  const input = [
    'بناءً على نتائج البحث الأكاديمي، تم العثور على الطلاب التاليين:',
    '',
    '1. **أحمد محمد علي**',
    '   - الرقم الجامعي: STU-2024-001',
    '   - الفرقة الدراسية: الفرقة الثالثة',
    '   - القسم: علوم الحاسب',
    '   - الكلية: كلية الحاسبات والمعلومات',
    '   - الحالة: ACTIVE',
    '',
    '2. **سارة خالد العتيبي**',
    '   - الرقم الجامعي: STU-2024-042',
    '   - الفرقة الدراسية: الفرقة الثانية',
    '   - القسم: نظم المعلومات',
    '   - الكلية: كلية الحاسبات والمعلومات',
    '   - الحالة: ACTIVE',
    '',
    'يرجى مراجعة إدارة شؤون الطلاب للمزيد من التفاصيل.',
  ].join('\n');

  const blocks = parseBlocks(input);
  assert.equal(blocks.length, 3, 'Intro paragraph, student cards block, trailing paragraph');
  assert.equal(blocks[0].type, 'paragraph');
  assert.equal(blocks[1].type, 'student-cards');
  assert.equal(blocks[2].type, 'paragraph');

  const studentBlock = blocks[1];
  assert.equal(studentBlock.students.length, 2);
  assert.equal(studentBlock.students[0].name, 'أحمد محمد علي');
  assert.equal(studentBlock.students[0].studentId, 'STU-2024-001');
  assert.equal(studentBlock.students[0].year, 'الفرقة الثالثة');
  assert.equal(studentBlock.students[0].department, 'علوم الحاسب');
  assert.equal(studentBlock.students[0].college, 'كلية الحاسبات والمعلومات');
  assert.equal(studentBlock.students[0].status, 'ACTIVE');

  assert.equal(studentBlock.students[1].name, 'سارة خالد العتيبي');
  assert.equal(studentBlock.students[1].studentId, 'STU-2024-042');
  assert.equal(studentBlock.students[1].department, 'نظم المعلومات');
});

test('FMT-011: Markdown table of students parsed as student-cards block', () => {
  const input = [
    '| الطالب | الرقم الجامعي | الفرقة | القسم | الكلية | الحالة |',
    '| :--- | :--- | :---: | :--- | :--- | :---: |',
    '| أحمد محمد علي | STU-2024-001 | الفرقة الثالثة | Computer Science | كلية الحاسبات والمعلومات | ACTIVE |',
    '| عمر طارق حسن | STU-2023-118 | الفرقة الرابعة | Software Engineering | كلية الحاسبات والمعلومات | INACTIVE |',
  ].join('\n');

  const blocks = parseBlocks(input);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, 'student-cards');
  assert.equal(blocks[0].students.length, 2);
  assert.equal(blocks[0].students[0].name, 'أحمد محمد علي');
  assert.equal(blocks[0].students[1].name, 'عمر طارق حسن');
  assert.equal(blocks[0].students[1].status, 'INACTIVE');
});

test('FMT-012: Bullet list of students parsed as student-cards block', () => {
  const input = [
    '- **أحمد محمد علي** (الرقم الجامعي: STU-2024-001)',
    '  - القسم: هندسة البرمجيات',
    '  - الكلية: كلية الهندسة',
    '  - الحالة: ACTIVE',
    '- **ياسمين عادل** (الرقم الجامعي: STU-2024-089)',
    '  - القسم: الذكاء الاصطناعي',
    '  - الكلية: كلية الحاسبات',
    '  - الحالة: ACTIVE',
  ].join('\n');

  const blocks = parseBlocks(input);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, 'student-cards');
  assert.equal(blocks[0].students.length, 2);
  assert.equal(blocks[0].students[0].name, 'أحمد محمد علي');
  assert.equal(blocks[0].students[0].studentId, 'STU-2024-001');
  assert.equal(blocks[0].students[1].name, 'ياسمين عادل');
  assert.equal(blocks[0].students[1].studentId, 'STU-2024-089');
});

test('FMT-013: Normal non-student bullet and numbered lists remain standard lists', () => {
  const input = [
    'نصائح تنظيم الوقت:',
    '1. مراجعة المحاضرات أولاً بأول',
    '2. تسليم المهام قبل الموعد المحدد',
    '3. التواصل مع المرشد الأكاديمي',
    '',
    '- نقطة استرشادية أ',
    '- نقطة استرشادية ب',
  ].join('\n');

  const blocks = parseBlocks(input);
  assert.equal(blocks.length, 3);
  assert.equal(blocks[0].type, 'paragraph');
  assert.equal(blocks[1].type, 'list');
  assert.equal(blocks[1].ordered, true);
  assert.equal(blocks[1].items.length, 3);
  assert.equal(blocks[2].type, 'list');
  assert.equal(blocks[2].ordered, false);
  assert.equal(blocks[2].items.length, 2);
});

test('FMT-014: normalizeStudentStatus strict status integrity contract', () => {
  assert.deepEqual(normalizeStudentStatus('ACTIVE'), { label: 'منتظم', variant: 'active' });
  assert.deepEqual(normalizeStudentStatus('`ACTIVE`'), { label: 'منتظم', variant: 'active' });
  assert.deepEqual(normalizeStudentStatus('منتظم'), { label: 'منتظم', variant: 'active' });
  assert.deepEqual(normalizeStudentStatus('نشط'), { label: 'منتظم', variant: 'active' });

  assert.deepEqual(normalizeStudentStatus('INACTIVE'), { label: 'غير نشط', variant: 'inactive' });
  assert.deepEqual(normalizeStudentStatus('`INACTIVE`'), { label: 'غير نشط', variant: 'inactive' });
  assert.deepEqual(normalizeStudentStatus('غير نشط'), { label: 'غير نشط', variant: 'inactive' });

  // Must not invent "متفوق" or "قيد التخرج" as active aliases, but preserve raw if supplied
  assert.deepEqual(normalizeStudentStatus('ON_PROBATION'), { label: 'ON_PROBATION', variant: 'neutral' });
  assert.equal(normalizeStudentStatus(''), null);
  assert.equal(normalizeStudentStatus(undefined), null);
});

test('FMT-015: Internal numeric ID discrete extraction & comment stripping contract', () => {
  const inputWithComments = [
    '1. **أحمد محمد علي** <!-- id: 101 -->',
    '   - الرقم الجامعي: STU-2024-001',
    '   - الفرقة: 3',
    '   - القسم: Computer Science',
    '   - الكلية: Faculty of Computers',
    '   - الحالة: ACTIVE',
    '',
    '2. **سارة خالد**',
    '   - الرقم الجامعي: STU-2024-042',
    '   - الفرقة: 2',
    '   - القسم: Information Systems',
    '   - الكلية: Faculty of Computers',
    '   - الحالة: ACTIVE',
  ].join('\n');

  const blocks = parseBlocks(inputWithComments);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, 'student-cards');
  assert.equal(blocks[0].students.length, 2);

  // Student 1: Has discrete numeric ID 101, clean name with no comment, public studentId intact
  assert.equal(blocks[0].students[0].id, 101);
  assert.equal(blocks[0].students[0].name, 'أحمد محمد علي');
  assert.equal(blocks[0].students[0].studentId, 'STU-2024-001');

  // Student 2: Missing numeric ID -> id is undefined, non-interactive fallback
  assert.equal(blocks[0].students[1].id, undefined);
  assert.equal(blocks[0].students[1].name, 'سارة خالد');
  assert.equal(blocks[0].students[1].studentId, 'STU-2024-042');
});


