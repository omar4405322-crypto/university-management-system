import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.resolve(__dirname, '../artifacts/api-server');
const require = createRequire(import.meta.url);
const { PrismaClient, Prisma } = require(path.join(apiDir, 'node_modules/@prisma/client'));

const envPath = path.join(apiDir, '.env');
if (fs.existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

const prisma = new PrismaClient();

async function main() {
  console.log('=== VERIFYING GIN FULL-TEXT SEARCH RETRIEVAL PLAN ===\n');

  try {
    const testDoc = await prisma.knowledgeDocument.create({
      data: {
        title: 'Plan Test Regulations',
        titleAr: 'لائحة اختبار خطة الاستعلام',
        documentType: 'REGULATION',
        scope: 'GLOBAL',
        status: 'ACTIVE',
      },
    });

    const testVersion = await prisma.knowledgeDocumentVersion.create({
      data: {
        documentId: testDoc.id,
        version: 1,
        versionTag: 'v1.0-plan',
        originalFilename: 'plan_regulations.txt',
        fileUrl: 'knowledge/versions/plan_regulations.txt',
        mimeType: 'text/plain',
        fileSize: 1024,
        fileHash: 'test-hash-plan-12345',
        processingStatus: 'READY',
      },
    });

    await prisma.knowledgeChunk.createMany({
      data: [
        {
          documentId: testDoc.id,
          documentVersionId: testVersion.id,
          chunkIndex: 0,
          pageNumber: 1,
          sectionTitle: 'الإنذار الأكاديمي',
          articleNumber: 'المادة 12',
          content: 'يوجه للطالب إنذار أكاديمي إذا انخفض معدله التراكمي عن نقطتين في نهاية الفصل الدراسي الرئيسي.',
        },
        {
          documentId: testDoc.id,
          documentVersionId: testVersion.id,
          chunkIndex: 1,
          pageNumber: 1,
          sectionTitle: 'نسبة الحضور والغياب',
          articleNumber: 'المادة 13',
          content: 'يشترط لدخول الامتحان النهائي ألا تقل نسبة حضور الطالب عن 75% من مجموع الساعات المقررة للمساق.',
        },
      ],
    });

    const queryText = 'انذار اكاديمي';
    const versionIds = [testVersion.id];

    // 1. Verify GIN index definition in PostgreSQL catalog
    console.log('1. Checking PostgreSQL pg_indexes for KnowledgeChunk GIN index...');
    const indexes = await prisma.$queryRaw`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'KnowledgeChunk' AND indexname = 'KnowledgeChunk_content_search_idx';
    `;
    console.log('Catalog index:', indexes);
    if (!indexes || indexes.length === 0) {
      throw new Error('KnowledgeChunk_content_search_idx GIN index is missing in PostgreSQL catalog!');
    }

    // 2. EXPLAIN with normal PostgreSQL settings
    console.log('\n2. Standard EXPLAIN plan:');
    const plan = await prisma.$queryRaw`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
      SELECT 
        c.id,
        c."documentId",
        c."documentVersionId",
        c."chunkIndex",
        c."pageNumber",
        c."sectionTitle",
        c."articleNumber",
        c.content,
        ts_rank_cd(to_tsvector('simple', c.content), plainto_tsquery('simple', ${queryText})) as "rankScore"
      FROM "KnowledgeChunk" c
      WHERE c."documentVersionId" IN (${Prisma.join(versionIds)})
        AND (
          to_tsvector('simple', c.content) @@ plainto_tsquery('simple', ${queryText})
          OR c.content ILIKE ${'%' + queryText + '%'}
        )
      ORDER BY "rankScore" DESC
      LIMIT 10;
    `;
    console.log(plan.map((r) => Object.values(r)[0]).join('\n'));

    // 3. EXPLAIN with enable_seqscan = off to verify GIN Bitmap Index Scan
    console.log('\n3. GIN Index Scan Plan (enable_seqscan = off):');
    await prisma.$executeRawUnsafe('SET enable_seqscan = off;');
    const indexPlan = await prisma.$queryRaw`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
      SELECT 
        c.id,
        c."documentId",
        c."documentVersionId",
        c.content,
        ts_rank_cd(to_tsvector('simple', c.content), plainto_tsquery('simple', ${queryText})) as "rankScore"
      FROM "KnowledgeChunk" c
      WHERE to_tsvector('simple', c.content) @@ plainto_tsquery('simple', ${queryText})
      ORDER BY "rankScore" DESC
      LIMIT 10;
    `;
    console.log(indexPlan.map((r) => Object.values(r)[0]).join('\n'));
    await prisma.$executeRawUnsafe('SET enable_seqscan = on;');

    // Clean up
    await prisma.knowledgeChunk.deleteMany({ where: { documentId: testDoc.id } });
    await prisma.knowledgeDocumentVersion.deleteMany({ where: { documentId: testDoc.id } });
    await prisma.knowledgeDocument.deleteMany({ where: { id: testDoc.id } });
    console.log('\nCleaned up.');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
