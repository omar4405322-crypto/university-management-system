import fs from 'fs';
import { extractText as extractPdfText } from 'unpdf';
import mammoth from 'mammoth';
import logger from '../../utils/logger';
import { getKnowledgeStorage } from './knowledgeStorage.service';

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export interface ExtractionResult {
  pages: ExtractedPage[];
  totalPages: number;
  totalCharacters: number;
  isScannedOrTextless: boolean;
  warnings?: string[];
}

/**
 * Remove typical running headers/footers and page number artifacts
 * while strictly preserving substantive regulatory text.
 */
export function cleanDocumentNoise(rawText: string): string {
  if (!rawText) return '';

  return rawText
    // Remove standalone page numbering lines like "Page 5", "صفحة 5 من 20", "- 5 -"
    .replace(/^[-–—\s]*(?:page|صفحة)?\s*\d+(?:\s*(?:of|من|\/)\s*\d+)?[-–—\s]*$/gim, '')
    // Normalize excessive consecutive blank lines to double newline
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    // Remove non-printable control characters except standard whitespace
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
}

/**
 * Detect repeated identical header or footer lines across multiple pages
 */
function stripRepeatedHeadersFooters(pageTexts: string[]): string[] {
  if (pageTexts.length < 3) return pageTexts.map(cleanDocumentNoise);

  // Collect first and last non-empty lines from each page
  const firstLinesCount = new Map<string, number>();
  const lastLinesCount = new Map<string, number>();

  for (const page of pageTexts) {
    const lines = page.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length > 0) {
      const top = lines[0];
      firstLinesCount.set(top, (firstLinesCount.get(top) || 0) + 1);
      const bottom = lines[lines.length - 1];
      lastLinesCount.set(bottom, (lastLinesCount.get(bottom) || 0) + 1);
    }
  }

  // Threshold: if a line appears in > 70% of pages, it is a running header or footer
  const threshold = pageTexts.length * 0.7;
  const runningHeaders = new Set<string>();
  const runningFooters = new Set<string>();

  for (const [line, count] of firstLinesCount.entries()) {
    if (count >= threshold && line.length < 120) {
      runningHeaders.add(line);
    }
  }
  for (const [line, count] of lastLinesCount.entries()) {
    if (count >= threshold && line.length < 120) {
      runningFooters.add(line);
    }
  }

  return pageTexts.map(page => {
    const lines = page.split('\n');
    const filtered = lines.filter(line => {
      const trimmed = line.trim();
      return !runningHeaders.has(trimmed) && !runningFooters.has(trimmed);
    });
    return cleanDocumentNoise(filtered.join('\n'));
  });
}

export async function extractDocumentContent(
  source: string | Buffer,
  mimeType: string
): Promise<ExtractionResult> {
  let buffer: Buffer;
  if (Buffer.isBuffer(source)) {
    buffer = source;
  } else {
    try {
      buffer = await getKnowledgeStorage().read(source);
    } catch {
      // Fallback if raw file path is passed
      if (fs.existsSync(source)) {
        buffer = await fs.promises.readFile(source);
      } else {
        throw new Error(`Knowledge document not accessible: ${source}`);
      }
    }
  }
  const pages: ExtractedPage[] = [];

  if (mimeType === 'application/pdf') {
    try {
      const uint8 = new Uint8Array(buffer);
      const pdfData = await extractPdfText(uint8);
      const rawPages = Array.isArray(pdfData.text) ? pdfData.text : [pdfData.text];
      const cleaned = stripRepeatedHeadersFooters(rawPages);

      cleaned.forEach((text, idx) => {
        pages.push({
          pageNumber: idx + 1,
          text: text.trim(),
        });
      });
    } catch (err) {
      logger.warn('[KnowledgeExtractor] PDF extraction error', { source: typeof source === 'string' ? source : 'buffer', error: (err as Error).message });
      throw new Error(`Failed to parse PDF document: ${(err as Error).message}`);
    }
  } else if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    (typeof source === 'string' && source.endsWith('.docx'))
  ) {
    try {
      const result = await mammoth.convertToMarkdown({ buffer });
      const cleaned = cleanDocumentNoise(result.value);
      // Split into logical pages (~3000 chars per page estimate) or single page
      pages.push({
        pageNumber: 1,
        text: cleaned,
      });
    } catch (err) {
      logger.warn('[KnowledgeExtractor] DOCX extraction error', { source: typeof source === 'string' ? source : 'buffer', error: (err as Error).message });
      throw new Error(`Failed to parse DOCX document: ${(err as Error).message}`);
    }
  } else {
    // Plain text / Markdown
    const text = buffer.toString('utf8');
    const cleaned = cleanDocumentNoise(text);
    pages.push({
      pageNumber: 1,
      text: cleaned,
    });
  }

  // Calculate text volume
  const totalCharacters = pages.reduce((sum, p) => sum + p.text.replace(/\s/g, '').length, 0);

  // Scanned PDF detection (Section 10):
  // If a PDF document has pages but total non-whitespace characters is negligible (< 50 chars)
  // For other text/docx documents, textless is strictly 0 characters.
  const isScannedOrTextless = mimeType === 'application/pdf'
    ? totalCharacters < 50
    : totalCharacters === 0;

  return {
    pages,
    totalPages: pages.length,
    totalCharacters,
    isScannedOrTextless,
  };
}
