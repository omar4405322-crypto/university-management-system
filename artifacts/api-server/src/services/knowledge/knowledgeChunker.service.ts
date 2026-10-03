import type { ExtractedPage } from './knowledgeExtractor.service';

export interface GeneratedChunk {
  chunkIndex: number;
  pageNumber: number;
  sectionTitle?: string;
  articleNumber?: string;
  content: string;
  tokenCount: number;
}

const ARTICLE_REGEX = /(?:^|\n)\s*(?:(المادة\s+(?:\d+|[^\n:]{1,30})|Article\s+\d+|مادة\s*\(\s*\d+\s*\))[:\s–—\-]*)([^\n]*)/i;
const SECTION_REGEX = /(?:^|\n)\s*(?:(الباب\s+[^\n:]{1,30}|الفصل\s+[^\n:]{1,30}|القسم\s+[^\n:]{1,30}|Chapter\s+\d+|Section\s+\d+|#+\s+[^\n]+)[:\s–—\-]*)([^\n]*)/i;

/**
 * Estimate token count using average character-to-token ratio (~4 chars per token for English, ~3 for Arabic)
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 3.5);
}

export const TARGET_CHUNK_SIZE = 1200; // ~300 tokens
export const MAX_CHUNK_SIZE = 1800;    // ~450 tokens
export const CHUNK_OVERLAP = 150;      // characters

export function chunkDocumentPages(pages: ExtractedPage[]): GeneratedChunk[] {
  const chunks: GeneratedChunk[] = [];
  let chunkIndex = 0;

  let currentSectionTitle: string | undefined = undefined;
  let currentArticleNumber: string | undefined = undefined;

  for (const page of pages) {
    const text = page.text.trim();
    if (!text) continue;

    // Split text into structural blocks (paragraphs, articles, headings)
    const rawParagraphs = text.split(/\n\s*\n+/);

    let currentAccumulator = '';
    let startingPage = page.pageNumber;

    for (const para of rawParagraphs) {
      const trimmedPara = para.trim();
      if (!trimmedPara) continue;

      // Check if paragraph introduces a new Article or Section
      const sectionMatch = trimmedPara.match(SECTION_REGEX);
      const articleMatch = trimmedPara.match(ARTICLE_REGEX);

      // If starting a new Article or Section and accumulator has content, flush previous chunk
      if (currentAccumulator.trim().length > 100 && (articleMatch || sectionMatch)) {
        chunks.push({
          chunkIndex: chunkIndex++,
          pageNumber: startingPage,
          sectionTitle: currentSectionTitle,
          articleNumber: currentArticleNumber,
          content: currentAccumulator.trim(),
          tokenCount: estimateTokenCount(currentAccumulator),
        });
        currentAccumulator = '';
      }

      if (sectionMatch) {
        currentSectionTitle = (sectionMatch[1] + (sectionMatch[2] ? ` - ${sectionMatch[2]}` : '')).trim().replace(/^#+\s*/, '');
      }
      if (articleMatch) {
        currentArticleNumber = articleMatch[1].trim();
      }

      // If adding this paragraph exceeds target chunk size and currentAccumulator is non-empty, flush current chunk
      if (currentAccumulator.length > 0 && currentAccumulator.length + trimmedPara.length > TARGET_CHUNK_SIZE) {
        chunks.push({
          chunkIndex: chunkIndex++,
          pageNumber: startingPage,
          sectionTitle: currentSectionTitle,
          articleNumber: currentArticleNumber,
          content: currentAccumulator.trim(),
          tokenCount: estimateTokenCount(currentAccumulator),
        });

        // Retain small overlap for continuity if splitting a large section
        if (currentAccumulator.length > CHUNK_OVERLAP) {
          const overlap = currentAccumulator.slice(-CHUNK_OVERLAP).trim();
          currentAccumulator = overlap ? `${overlap}\n\n${trimmedPara}` : trimmedPara;
        } else {
          currentAccumulator = trimmedPara;
        }
      } else {
        currentAccumulator = currentAccumulator
          ? `${currentAccumulator}\n\n${trimmedPara}`
          : trimmedPara;
      }

      // If a single paragraph is enormous (> MAX_CHUNK_SIZE), force break at sentence boundaries
      while (currentAccumulator.length > MAX_CHUNK_SIZE) {
        const breakPoint = findSafeBreakPoint(currentAccumulator, TARGET_CHUNK_SIZE);
        const chunkPart = currentAccumulator.slice(0, breakPoint).trim();
        chunks.push({
          chunkIndex: chunkIndex++,
          pageNumber: startingPage,
          sectionTitle: currentSectionTitle,
          articleNumber: currentArticleNumber,
          content: chunkPart,
          tokenCount: estimateTokenCount(chunkPart),
        });
        currentAccumulator = currentAccumulator.slice(breakPoint).trim();
      }
    }

    // Flush any remaining accumulated text for this page
    if (currentAccumulator.trim().length > 0) {
      chunks.push({
        chunkIndex: chunkIndex++,
        pageNumber: startingPage,
        sectionTitle: currentSectionTitle,
        articleNumber: currentArticleNumber,
        content: currentAccumulator.trim(),
        tokenCount: estimateTokenCount(currentAccumulator),
      });
      currentAccumulator = '';
    }
  }

  return chunks;
}

/**
 * Finds a punctuation/sentence boundary near targetSize, avoiding arbitrary cuts
 */
function findSafeBreakPoint(text: string, targetSize: number): number {
  if (text.length <= targetSize) return text.length;

  const searchWindow = text.slice(targetSize - 200, targetSize + 200);
  const punctuationMarks = ['. ', '.\n', '؟ ', '? ', '! ', '؛ ', '; '];

  for (const mark of punctuationMarks) {
    const idx = searchWindow.lastIndexOf(mark);
    if (idx !== -1) {
      return (targetSize - 200) + idx + mark.length;
    }
  }

  // Fall back to line break or space
  const newlineIdx = searchWindow.lastIndexOf('\n');
  if (newlineIdx !== -1) {
    return (targetSize - 200) + newlineIdx + 1;
  }

  const spaceIdx = searchWindow.lastIndexOf(' ');
  if (spaceIdx !== -1) {
    return (targetSize - 200) + spaceIdx + 1;
  }

  return targetSize;
}
