import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { hasCapability } from '../../config/capabilities';

function useSafeAuth() {
  try {
    return useAuth();
  } catch {
    return { user: null } as unknown as ReturnType<typeof useAuth>;
  }
}

function useSafeNavigate() {
  try {
    return useNavigate();
  } catch {
    return () => {};
  }
}

interface AiMessageContentProps {
  content: string;
}

export interface TableBlock {
  type: 'table';
  headers: string[];
  rows: string[][];
}

export interface ListBlock {
  type: 'list';
  ordered: boolean;
  items: string[];
}

export interface HeadingBlock {
  type: 'heading';
  level: number;
  text: string;
}

export interface ParagraphBlock {
  type: 'paragraph';
  text: string;
}

export interface StudentRecord {
  id?: string | number;
  name: string;
  studentId?: string;
  year?: string;
  department?: string;
  college?: string;
  status?: string;
}

export interface StudentCardsBlock {
  type: 'student-cards';
  students: StudentRecord[];
}

export type Block = TableBlock | ListBlock | HeadingBlock | ParagraphBlock | StudentCardsBlock;

// Safely parses row cells while respecting escaped pipes (\|)
export function splitTableRow(rowLine: string): { cells: string[]; trailingText?: string } {
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

  // Fallback for lines without strict outer pipes (e.g. col1 | col2)
  const fallbackCells = sanitized.split('|').map((c) => c.replace(new RegExp(placeholder, 'g'), '|').trim());
  return { cells: fallbackCells.filter((c, idx) => !(idx === 0 && !c) && !(idx === fallbackCells.length - 1 && !c)) };
}

export function isTableSeparatorLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes('-')) return false;
  const { cells } = splitTableRow(trimmed);
  return cells.length > 0 && cells.every((s) => /^[:\s-]+$/.test(s));
}

export function isTableRowLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes('|')) return false;
  if (/^#{1,6}\s+/.test(trimmed) || /^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
    return false;
  }
  return trimmed.startsWith('|') || (trimmed.endsWith('|') && trimmed.includes('|'));
}

export function isStudentTable(headers: string[]): { isMatch: boolean; colMap: Record<string, number> } {
  const colMap: Record<string, number> = {};
  headers.forEach((h, idx) => {
    const norm = h.toLowerCase().trim();
    if (/(?:طالب|student|اسم|name)/.test(norm) && !/(?:رقم|id|كود|code)/.test(norm)) {
      colMap.name = idx;
    } else if (/(?:رقم|id|جامعي|كود|code|academic)/.test(norm)) {
      colMap.studentId = idx;
    } else if (/(?:فرقة|سنة|year|level|cohort)/.test(norm)) {
      colMap.year = idx;
    } else if (/(?:قسم|department|dept)/.test(norm)) {
      colMap.department = idx;
    } else if (/(?:كلية|college|faculty)/.test(norm)) {
      colMap.college = idx;
    } else if (/(?:حالة|status)/.test(norm)) {
      colMap.status = idx;
    } else if (/(?:معرف|سجل|rec_id|db_id|^id$)/.test(norm)) {
      colMap.id = idx;
    }
  });

  const isMatch =
    colMap.name !== undefined &&
    ((colMap.studentId !== undefined && (colMap.department !== undefined || colMap.college !== undefined || colMap.year !== undefined)) ||
      (colMap.department !== undefined && colMap.college !== undefined));

  return { isMatch, colMap };
}

export function normalizeStudentStatus(rawStatus?: string): { label: string; isLtr?: boolean; variant: 'active' | 'inactive' | 'neutral' } | null {
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

export function extractStudentFromText(text: string): StudentRecord | null {
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

  let id: number | undefined = undefined;
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

export function parseBlocks(raw: string): Block[] {
  const lines = raw.split(/\r?\n/);
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // 1. Table Detection & Strict Boundary Isolation
    if (isTableRowLine(trimmed)) {
      const tableLines: string[] = [];
      let trailingParagraphAfterLastRow: string | undefined;

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

        const rows: string[][] = [];
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

        // Check if table contains student directory results
        const studentTableCheck = isStudentTable(headers);
        if (studentTableCheck.isMatch && rows.length > 0) {
          const { colMap } = studentTableCheck;
          const students: StudentRecord[] = rows
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

    // 2. Heading check (#, ##, ###, ####)
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

    // 3 & 4. List check (ordered e.g. "1. " or unordered e.g. "- ", "* ", "• ")
    const isOrderedItem = /^\d+[\.\)]\s+/.test(trimmed);
    const isUnorderedItem = /^[-*•]\s+/.test(trimmed);

    if (isOrderedItem || isUnorderedItem) {
      const items: string[] = [];
      const isOrdered = isOrderedItem;

      while (i < lines.length) {
        const curTrimmed = lines[i].trim();
        if (!curTrimmed) {
          // Check if subsequent non-empty line continues list of same type
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
          // Indented or continuation line for current item
          if (isTableRowLine(curTrimmed) || curTrimmed.startsWith('#')) {
            break;
          }
          items[items.length - 1] += '\n' + curTrimmed;
          i++;
        } else {
          break;
        }
      }

      // Check if list items represent student directory records
      const parsedStudents = items
        .map((it) => extractStudentFromText(it))
        .filter(Boolean) as StudentRecord[];

      if (parsedStudents.length > 0 && parsedStudents.length >= Math.ceil(items.length / 2)) {
        blocks.push({ type: 'student-cards', students: parsedStudents });
      } else {
        blocks.push({ type: 'list', ordered: isOrdered, items });
      }
      continue;
    }

    // 5. Paragraph with clean termination before any subsequent block
    const paragraphLines: string[] = [line];
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

  // Merge consecutive student-cards blocks into a single block
  const mergedBlocks: Block[] = [];
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

// Safely parses inline markdown (bold, italic, code, line breaks, citations) into React nodes without HTML injection
export function formatInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const tokenRegex =
    /(\[(?:[^\]]+(?:p\.\s*\d+|ص\.\s*\d+|Article\s*\d+|المادة\s*\d+|Regulation|Handbook|اللائحة|دليل)[^\]]*)\]|<br\s*\/?>|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const [fullMatch, , boldText, italicText, codeText] = match;

    if (fullMatch.startsWith('<br') || fullMatch.startsWith('<BR')) {
      parts.push(<br key={`br-${match.index}`} />);
    } else if (fullMatch.startsWith('[') && fullMatch.endsWith(']')) {
      const citationText = fullMatch.slice(1, -1).trim();
      parts.push(
        <span
          key={`cite-${match.index}`}
          dir="auto"
          title={`Source Citation: ${citationText}`}
          className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded-md text-xs font-medium bg-brand-primary-500/10 text-brand-primary-700 dark:text-brand-primary-300 border border-brand-primary-500/30 align-middle shadow-2xs hover:bg-brand-primary-500/20 transition-colors"
        >
          <span aria-hidden="true" className="opacity-80">📖</span>
          <span>{citationText}</span>
        </span>
      );
    } else if (boldText !== undefined) {
      parts.push(<strong key={`b-${match.index}`} className="font-bold text-brand-text-main">{boldText}</strong>);
    } else if (italicText !== undefined) {
      parts.push(<em key={`i-${match.index}`} className="italic text-brand-text-main">{italicText}</em>);
    } else if (codeText !== undefined) {
      parts.push(
        <code
          key={`c-${match.index}`}
          dir="ltr"
          className="rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 px-1.5 py-0.5 font-mono text-xs text-brand-primary-700 dark:text-brand-primary-300 font-semibold"
        >
          {codeText}
        </code>
      );
    } else {
      parts.push(fullMatch);
    }
    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

export function StudentResultCard({ student }: { student: StudentRecord }) {
  const { user } = useSafeAuth();
  const navigate = useSafeNavigate();
  const statusInfo = normalizeStudentStatus(student.status);

  const canViewStudents = hasCapability(user?.role, 'students.view');
  // Safe authoritative navigation ID:
  // Must be a positive integer primary key required by canonical route /students/:id
  const parsedId =
    student.id !== undefined && student.id !== null && String(student.id).trim() !== ''
      ? Number(student.id)
      : undefined;

  const validNumericId =
    parsedId !== undefined && Number.isInteger(parsedId) && parsedId > 0
      ? parsedId
      : undefined;

  const isNavigable = Boolean(canViewStudents && validNumericId !== undefined);

  const handleNavigate = () => {
    if (isNavigable && validNumericId !== undefined) {
      navigate(`/students/${student.id}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isNavigable) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleNavigate();
    }
  };

  return (
    <div
      data-testid="student-result-card"
      data-navigable={isNavigable ? 'true' : 'false'}
      role={isNavigable ? 'button' : undefined}
      tabIndex={isNavigable ? 0 : undefined}
      onClick={isNavigable ? handleNavigate : undefined}
      onKeyDown={isNavigable ? handleKeyDown : undefined}
      aria-label={isNavigable ? `${student.name} - تفاصيل الطالب` : undefined}
      className={`group rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-3 sm:p-3.5 shadow-2xs transition-all ${
        isNavigable
          ? 'cursor-pointer hover:border-brand-primary-500/50 hover:shadow-xs active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary-500'
          : 'hover:border-brand-primary-500/35'
      }`}
    >
      {/* Top Header: [ Name                         Status (+ Nav Icon) ] */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`font-bold text-sm sm:text-base text-brand-text-main truncate ${
                isNavigable ? 'group-hover:text-brand-primary-600 dark:group-hover:text-brand-primary-400 transition-colors' : ''
              }`}
              dir="auto"
              data-testid="student-name"
            >
              {student.name}
            </span>
          </div>
          {student.studentId && (
            <div className="mt-0.5">
              <span
                className="inline-block font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium"
                dir="ltr"
                data-testid="student-id"
              >
                {student.studentId}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {statusInfo && (
            <span
              dir="auto"
              data-testid="student-status"
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0 border ${
                statusInfo.variant === 'active'
                  ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/25'
                  : statusInfo.variant === 'inactive'
                  ? 'bg-rose-500/10 text-rose-800 dark:text-rose-300 border-rose-500/25'
                  : 'bg-brand-primary-500/10 text-brand-primary-800 dark:text-brand-primary-300 border-brand-primary-500/25'
              }`}
            >
              {statusInfo.label}
            </span>
          )}

          {isNavigable && (
            <span
              data-testid="student-card-nav-indicator"
              className="text-slate-400 group-hover:text-brand-primary-600 dark:group-hover:text-brand-primary-400 transition-colors"
              aria-hidden="true"
            >
              <ChevronLeft size={16} className="rtl:rotate-0 ltr:rotate-180" />
            </span>
          )}
        </div>
      </div>

      {/* Details Row: [ Academic year ] [ Department ] [ College ] */}
      {(student.year || student.department || student.college) && (
        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
          {student.year && (
            <div className="inline-flex items-center gap-1 shrink-0" data-testid="student-year">
              <span className="text-slate-400 dark:text-slate-500 font-medium text-[10px]">الفرقة:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300" dir="auto">
                {student.year}
              </span>
            </div>
          )}
          {student.department && (
            <div className="inline-flex items-center gap-1 min-w-0" data-testid="student-department">
              <span className="text-slate-400 dark:text-slate-500 font-medium text-[10px] shrink-0">القسم:</span>
              <span
                className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[200px] sm:max-w-[260px]"
                dir="auto"
                title={student.department}
              >
                {student.department}
              </span>
            </div>
          )}
          {student.college && (
            <div className="inline-flex items-center gap-1 min-w-0" data-testid="student-college">
              <span className="text-slate-400 dark:text-slate-500 font-medium text-[10px] shrink-0">الكلية:</span>
              <span
                className="font-normal text-slate-600 dark:text-slate-300 truncate max-w-[220px] sm:max-w-[300px]"
                dir="auto"
                title={student.college}
              >
                {student.college}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AiMessageContentBase({ content }: AiMessageContentProps) {
  const blocks = useMemo(() => parseBlocks(content), [content]);

  return (
    <div className="space-y-2.5 leading-relaxed text-brand-text-main break-words" dir="auto">
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'student-cards': {
            return (
              <div key={idx} className="space-y-2 sm:space-y-2.5 my-2.5" data-testid="student-cards-container">
                {block.students.map((student, sIdx) => (
                  <StudentResultCard key={sIdx} student={student} />
                ))}
              </div>
            );
          }
          case 'heading': {
            if (block.level === 1 || block.level === 2) {
              return (
                <h3 key={idx} dir="auto" className="font-bold text-base tracking-tight text-brand-text-main mt-4 mb-2 pb-1 border-b border-slate-100 dark:border-slate-800">
                  {formatInline(block.text)}
                </h3>
              );
            }
            return (
              <h4 key={idx} dir="auto" className="font-semibold text-sm text-brand-primary-800 dark:text-brand-primary-300 mt-3 mb-1">
                {formatInline(block.text)}
              </h4>
            );
          }
          case 'list': {
            const ListTag = block.ordered ? 'ol' : 'ul';
            const listClasses = block.ordered
              ? 'list-decimal ps-5 space-y-2 text-sm my-2 text-start'
              : 'list-disc ps-5 space-y-2 text-sm my-2 text-start';
            return (
              <ListTag key={idx} dir="auto" className={listClasses}>
                {block.items.map((item, itemIdx) => {
                  const lines = item.split('\n');
                  if (lines.length > 1) {
                    return (
                      <li key={itemIdx} className="leading-relaxed">
                        <div>{formatInline(lines[0])}</div>
                        <ul className="list-circle ps-5 mt-1 space-y-1 text-xs text-brand-text-sub">
                          {lines.slice(1).map((sub, sIdx) => (
                            <li key={sIdx} dir="auto" className="leading-normal">
                              {formatInline(sub.replace(/^[-*]\s*/, ''))}
                            </li>
                          ))}
                        </ul>
                      </li>
                    );
                  }
                  return (
                    <li key={itemIdx} className="leading-relaxed">
                      {formatInline(item)}
                    </li>
                  );
                })}
              </ListTag>
            );
          }
          case 'table': {
            return (
              <div key={idx} className="my-3 overflow-x-auto rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs">
                <table dir="auto" className="w-full text-xs text-start border-collapse table-auto">
                  {block.headers.length > 0 && (
                    <thead>
                      <tr className="border-b border-slate-200/90 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 font-semibold text-slate-700 dark:text-slate-300">
                        {block.headers.map((header, hIdx) => (
                          <th key={hIdx} className="px-3.5 py-2.5 text-start font-bold whitespace-nowrap">
                            {formatInline(header)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                  )}
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {block.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="transition-colors hover:bg-brand-primary-500/5">
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="px-3.5 py-2.5 text-start font-normal text-brand-text-main break-words max-w-sm sm:max-w-md">
                            {formatInline(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
          case 'paragraph':
          default: {
            return (
              <p key={idx} dir="auto" className="text-sm font-normal leading-relaxed whitespace-pre-wrap">
                {formatInline(block.text)}
              </p>
            );
          }
        }
      })}
    </div>
  );
}

export const AiMessageContent = React.memo(AiMessageContentBase);
export default AiMessageContent;
