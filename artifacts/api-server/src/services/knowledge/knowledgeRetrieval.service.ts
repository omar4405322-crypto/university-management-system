import prisma from '../../utils/prismaClient';
import { Prisma } from '@prisma/client';
import type { AuthActor } from '../../types/auth.types';
import logger from '../../utils/logger';

export interface RetrievedKnowledgeChunk {
  chunkId: string;
  documentId: string;
  documentVersionId: string;
  documentTitle: string;
  documentTitleAr: string | null;
  documentType: string;
  version: number;
  effectiveDate: Date | null;
  pageNumber: number | null;
  sectionTitle: string | null;
  articleNumber: string | null;
  content: string;
  relevanceScore: number;
}

export interface KnowledgeRetrievalOptions {
  actor?: AuthActor;
  query: string;
  documentType?: string;
  topK?: number;
  includeSuperseded?: boolean;
}

export interface KnowledgeRetrievalResponse {
  chunks: RetrievedKnowledgeChunk[];
  totalMatches: number;
  hasPotentialConflict: boolean;
  authorizedScope: string;
}

/**
 * Normalize Arabic text for uniform matching:
 * remove tashkeel/diacritics, normalize alef variants, teh marbuta
 */
export function normalizeArabicSearchText(text: string): string {
  if (!text) return '';
  return text
    // Remove diacritics (tashkeel)
    .replace(/[\u064B-\u065F\u0670]/g, '')
    // Normalize Alef variants (أ, إ, آ -> ا)
    .replace(/[أإآ]/g, 'ا')
    // Normalize Teh Marbuta (ة -> ه)
    .replace(/ة/g, 'ه')
    // Normalize Yeh (ى -> ي)
    .replace(/ى/g, 'ي')
    .toLowerCase()
    .trim();
}

export function generateArabicSearchVariants(token: string): string[] {
  if (!token) return [];
  const clean = token.replace(/[\u064B-\u065F\u0670]/g, '').toLowerCase().trim();
  const variants = new Set<string>([clean]);

  if (/[أإآا]/.test(clean)) {
    if (/^[أإآا]/.test(clean)) {
      const rest = clean.slice(1);
      ['ا', 'أ', 'إ', 'آ'].forEach((alef) => variants.add(`${alef}${rest}`));
    }
  }

  if (/[ةه]$/.test(clean)) {
    const base = clean.slice(0, -1);
    variants.add(`${base}ة`);
    variants.add(`${base}ه`);
  }

  if (/[يى]$/.test(clean)) {
    const base = clean.slice(0, -1);
    variants.add(`${base}ي`);
    variants.add(`${base}ى`);
  }

  return Array.from(variants);
}

/**
 * Build Prisma WHERE clause ensuring fail-closed authorization scope
 */
export function buildKnowledgeScopeFilter(actor?: AuthActor): any {
  if (!actor) {
    // Fail closed: No authenticated user => no document access
    return { id: '__UNAUTHORIZED__' };
  }

  const role = actor.role?.toUpperCase();

  // SUPER_ADMIN has full institutional visibility
  if (role === 'SUPER_ADMIN') {
    return {};
  }

  // Scoped ADMIN or COLLEGE_ADMIN
  const collegeId = actor.managedCollegeId || actor.collegeId;
  const departmentId = actor.managedDepartmentId || actor.departmentId;

  if (role === 'ADMIN' || role === 'COLLEGE_ADMIN') {
    if (collegeId) {
      return {
        OR: [
          { scope: 'GLOBAL' },
          { scope: 'COLLEGE', collegeId },
          { scope: 'DEPARTMENT', department: { collegeId } },
        ],
      };
    }
    return {};
  }

  if (role === 'DEPARTMENT_ADMIN') {
    return {
      OR: [
        { scope: 'GLOBAL' },
        ...(departmentId ? [{ scope: 'DEPARTMENT', departmentId }] : []),
        ...(collegeId ? [{ scope: 'COLLEGE', collegeId }] : []),
      ],
    };
  }

  // STUDENT
  if (role === 'STUDENT' && actor.student) {
    const studentDeptId = actor.student.departmentId;
    return {
      OR: [
        { scope: 'GLOBAL' },
        ...(studentDeptId
          ? [
              { scope: 'DEPARTMENT', departmentId: studentDeptId },
              { scope: 'COLLEGE', department: { id: studentDeptId } },
            ]
          : []),
      ],
    };
  }

  // DOCTOR
  if (role === 'DOCTOR' && actor.doctor) {
    const doctorDeptId = actor.doctor.departmentId;
    return {
      OR: [
        { scope: 'GLOBAL' },
        ...(doctorDeptId
          ? [
              { scope: 'DEPARTMENT', departmentId: doctorDeptId },
              { scope: 'COLLEGE', department: { id: doctorDeptId } },
            ]
          : []),
      ],
    };
  }

  // TEACHING_ASSISTANT or other authenticated university users
  return {
    scope: 'GLOBAL',
  };
}

const INSTITUTIONAL_STOP_WORDS = new Set([
  // Arabic stop words and generic institutional words
  'في', 'من', 'على', 'عن', 'الى', 'إلى', 'مع', 'هذا', 'هذه', 'ذلك', 'تلك', 'التي', 'الذي', 'ما', 'ماذا', 'هل', 'كيف', 'متى', 'أين', 'اين', 'هو', 'هي', 'هم', 'كل', 'بعض', 'غير', 'او', 'أو', 'ثم', 'حسب', 'وفق', 'وفقا', 'وفقاً', 'بشأن',
  'جامعة', 'الجامعة', 'جامعي', 'الجامعي', 'جامعية', 'الجامعية', 'لائحة', 'اللائحة', 'لوائح', 'اللوائح', 'قواعد', 'القواعد', 'نظام', 'النظام', 'شروط', 'الشروط', 'احكام', 'أحكام', 'الاحكام', 'الأحكام', 'بند', 'البند', 'مادة', 'المادة', 'رقم',
  // English stop words and generic institutional words
  'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'in', 'to', 'for', 'of', 'with', 'as', 'by', 'that', 'this', 'it', 'from', 'or', 'are', 'was', 'were', 'be', 'been', 'what', 'how', 'when', 'where', 'who', 'does', 'can',
  'university', 'regulation', 'regulations', 'bylaw', 'bylaws', 'policy', 'policies', 'rules', 'rule', 'article', 'section', 'handbook', 'procedure', 'procedures', 'general',
]);

export async function retrieveKnowledgeChunks(
  options: KnowledgeRetrievalOptions
): Promise<KnowledgeRetrievalResponse> {
  const { actor, query, documentType, topK = 4, includeSuperseded = false } = options;

  if (!query || !query.trim()) {
    return {
      chunks: [],
      totalMatches: 0,
      hasPotentialConflict: false,
      authorizedScope: actor?.role || 'NONE',
    };
  }

  const scopeFilter = buildKnowledgeScopeFilter(actor);
  const normalizedQuery = normalizeArabicSearchText(query);
  const queryTokens = normalizedQuery
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);

  if (queryTokens.length === 0) {
    return {
      chunks: [],
      totalMatches: 0,
      hasPotentialConflict: false,
      authorizedScope: actor?.role || 'NONE',
    };
  }

  const substantiveTokens = queryTokens.filter((t) => !INSTITUTIONAL_STOP_WORDS.has(t));

  // Document filter: ACTIVE status + matching scope + optional documentType
  const documentWhere: any = {
    status: 'ACTIVE',
    ...scopeFilter,
  };
  if (documentType) {
    documentWhere.documentType = documentType;
  }

  // Version filter: READY processing status
  const versionWhere: any = {
    processingStatus: 'READY',
  };
  if (!includeSuperseded) {
    versionWhere.supersededAt = null;
  }

  // 1. Fetch authorized active documents
  const documents = await prisma.knowledgeDocument.findMany({
    where: documentWhere,
    include: {
      activeVersion: true,
      versions: includeSuperseded ? { where: versionWhere } : false,
    },
    take: 50,
  });

  if (documents.length === 0) {
    return {
      chunks: [],
      totalMatches: 0,
      hasPotentialConflict: false,
      authorizedScope: actor?.role || 'NONE',
    };
  }

  const docMap = new Map<string, any>();
  const verMap = new Map<string, any>();
  const searchVersionIds: string[] = [];

  for (const doc of documents) {
    docMap.set(doc.id, doc);
    const versions = includeSuperseded ? (doc.versions as any[]) : (doc.activeVersion ? [doc.activeVersion] : []);
    for (const ver of versions) {
      if (ver) {
        verMap.set(ver.id, ver);
        searchVersionIds.push(ver.id);
      }
    }
  }

  if (searchVersionIds.length === 0) {
    return {
      chunks: [],
      totalMatches: 0,
      hasPotentialConflict: false,
      authorizedScope: actor?.role || 'NONE',
    };
  }

  // 2. Fetch candidate chunks using PostgreSQL full-text search SQL
  // This explicitly matches the GIN index on "KnowledgeChunk"(to_tsvector('simple', content))
  // with Arabic variants, plainto_tsquery, and ILIKE fallback for exact phrases
  const cleanTokens = substantiveTokens.length > 0 ? substantiveTokens : queryTokens;
  const rawQueryTokens = query
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);

  const allSearchTokens = new Set<string>();
  cleanTokens.forEach((t) => {
    allSearchTokens.add(t);
    generateArabicSearchVariants(t).forEach((v) => allSearchTokens.add(v));
  });
  rawQueryTokens.forEach((t) => {
    allSearchTokens.add(t);
    generateArabicSearchVariants(t).forEach((v) => allSearchTokens.add(v));
  });

  const safeTsQuery = Array.from(allSearchTokens)
    .map((t) => t.replace(/['":*&|!()]/g, ''))
    .filter((t) => t.length > 1)
    .slice(0, 20)
    .map((t) => `'${t}'`)
    .join(' | ');

  let candidateRawChunks: Array<{
    id: string;
    documentId: string;
    documentVersionId: string;
    chunkIndex: number;
    pageNumber: number | null;
    sectionTitle: string | null;
    articleNumber: string | null;
    content: string;
    rankScore: number;
  }> = [];

  try {
    candidateRawChunks = await prisma.$queryRaw<Array<{
      id: string;
      documentId: string;
      documentVersionId: string;
      chunkIndex: number;
      pageNumber: number | null;
      sectionTitle: string | null;
      articleNumber: string | null;
      content: string;
      rankScore: number;
    }>>`
      SELECT 
        c.id,
        c."documentId",
        c."documentVersionId",
        c."chunkIndex",
        c."pageNumber",
        c."sectionTitle",
        c."articleNumber",
        c.content,
        ts_rank_cd(to_tsvector('simple', c.content), plainto_tsquery('simple', ${query.trim()})) as "rankScore"
      FROM "KnowledgeChunk" c
      WHERE c."documentVersionId" IN (${Prisma.join(searchVersionIds)})
        AND (
          to_tsvector('simple', c.content) @@ plainto_tsquery('simple', ${query.trim()})
          OR to_tsvector('simple', c.content) @@ plainto_tsquery('simple', ${normalizedQuery})
          ${safeTsQuery.length > 0 ? Prisma.sql`OR to_tsvector('simple', c.content) @@ to_tsquery('simple', ${safeTsQuery})` : Prisma.empty}
          OR c.content ILIKE ${'%' + query.trim() + '%'}
          OR c.content ILIKE ${'%' + normalizedQuery + '%'}
          OR c."sectionTitle" ILIKE ${'%' + query.trim() + '%'}
          OR c."articleNumber" ILIKE ${'%' + query.trim() + '%'}
          ${Prisma.join(
            Array.from(allSearchTokens).slice(0, 6).map((tok) => Prisma.sql`OR c.content ILIKE ${'%' + tok + '%'}`),
            ' '
          )}
        )
      ORDER BY "rankScore" DESC
      LIMIT 60
    `;
  } catch (err: any) {
    logger.warn('[KnowledgeRetrieval] Full-text raw query fallback', { error: err.message });
  }

  // Safe fallback if raw query returned 0 rows but versions exist
  if (candidateRawChunks.length === 0) {
    const fallbackDbChunks = await prisma.knowledgeChunk.findMany({
      where: { documentVersionId: { in: searchVersionIds } },
      take: 100,
    });
    candidateRawChunks = fallbackDbChunks.map((c) => ({
      ...c,
      rankScore: 0,
    }));
  }

  const candidateChunks: Array<{
    chunk: any;
    doc: any;
    ver: any;
    score: number;
  }> = [];

  // 3. Score candidate chunks deterministically using token overlap and structural relevance
  for (const rawChunk of candidateRawChunks) {
    const doc = docMap.get(rawChunk.documentId);
    const ver = verMap.get(rawChunk.documentVersionId);
    if (!doc || !ver) continue;

    const rawContent = rawChunk.content;
    const normalizedContent = normalizeArabicSearchText(rawContent);
    const sectionNorm = normalizeArabicSearchText(rawChunk.sectionTitle || '');
    const articleNorm = normalizeArabicSearchText(rawChunk.articleNumber || '');
    const docTitleNorm = normalizeArabicSearchText(doc.title + ' ' + (doc.titleAr || ''));

    let score = Math.round((Number(rawChunk.rankScore) || 0) * 10);
    let tokenMatches = 0;
    let substantiveMatches = 0;

    for (const token of queryTokens) {
      const isSubstantive = !INSTITUTIONAL_STOP_WORDS.has(token);

      if (normalizedContent.includes(token)) {
        tokenMatches++;
        if (isSubstantive) substantiveMatches++;
        score += isSubstantive ? 3 : 1;
      }
      if (sectionNorm.includes(token)) {
        if (isSubstantive) substantiveMatches++;
        score += isSubstantive ? 4 : 2; // Section title boost
      }
      if (articleNorm.includes(token)) {
        if (isSubstantive) substantiveMatches++;
        score += isSubstantive ? 5 : 2; // Exact article match boost
      }
      if (docTitleNorm.includes(token)) {
        score += isSubstantive ? 2 : 1;
      }
    }

    // Exact full phrase bonus
    const hasExactPhrase = normalizedContent.includes(normalizedQuery);
    if (hasExactPhrase) {
      score += 15;
    }

    // Require substantive token match if query contains substantive terms
    const hasSubstantiveRequirement = substantiveTokens.length > 0;
    const passesSubstantive = hasSubstantiveRequirement
      ? (substantiveMatches > 0 || hasExactPhrase)
      : tokenMatches > 0;

    if (passesSubstantive && score >= 2) {
      candidateChunks.push({
        chunk: rawChunk,
        doc,
        ver,
        score,
      });
    }
  }

  // 4. Sort by score descending
  candidateChunks.sort((a, b) => b.score - a.score);

  // 5. Select bounded top-K results
  const selected = candidateChunks.slice(0, Math.min(topK, 6));

  const chunks: RetrievedKnowledgeChunk[] = selected.map(({ chunk, doc, ver, score }) => ({
    chunkId: chunk.id,
    documentId: doc.id,
    documentVersionId: ver.id,
    documentTitle: doc.title,
    documentTitleAr: doc.titleAr,
    documentType: doc.documentType,
    version: ver.version,
    effectiveDate: ver.effectiveDate,
    pageNumber: chunk.pageNumber,
    sectionTitle: chunk.sectionTitle,
    articleNumber: chunk.articleNumber,
    content: chunk.content,
    relevanceScore: score,
  }));

  // Detect potential conflicting sources:
  // e.g. chunks from different active documents covering the same query with different guidelines
  const distinctDocIds = new Set(chunks.map((c) => c.documentId));
  const hasPotentialConflict = distinctDocIds.size > 1;

  logger.debug('[KnowledgeRetrieval] Query executed', {
    userId: actor?.id,
    role: actor?.role,
    matches: chunks.length,
    distinctDocuments: distinctDocIds.size,
  });

  return {
    chunks,
    totalMatches: candidateChunks.length,
    hasPotentialConflict,
    authorizedScope: actor?.role || 'NONE',
  };
}
