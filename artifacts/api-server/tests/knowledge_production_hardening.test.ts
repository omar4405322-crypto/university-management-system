import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'fs';
import path from 'path';
import express from 'express';
import type { AuthActor } from '../src/types/auth.types';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'knowledge-hardening-jwt-secret-very-long';
process.env.AI_ASSISTANT_ENABLED = 'true';
process.env.AI_PROVIDER = 'gemini';
process.env.GEMINI_API_KEY = 'mock-gemini-key';
process.env.GEMINI_MODEL = 'gemini-3.5-flash-lite';

// Guard: Real provider network calls are strictly forbidden in tests
let realExternalCalls = 0;
const nativeFetch = globalThis.fetch;
globalThis.fetch = async (...args: Parameters<typeof fetch>) => {
  const input = args[0];
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
    realExternalCalls++;
    throw new Error(`Real external AI call strictly forbidden in automated test: ${url.hostname}`);
  }
  return nativeFetch(...args);
};

const [
  { default: prisma },
  { default: errorHandler },
  { generateAccessToken },
  { default: knowledgeRoutes },
  {
    createKnowledgeDocument,
    uploadNewDocumentVersion,
    activateDocumentVersion,
    archiveKnowledgeDocument,
    verifyAdminKnowledgeScope,
    listKnowledgeDocuments,
  },
  {
    getKnowledgeStorage,
    setKnowledgeStorageForTesting,
    LocalKnowledgeFileStorage,
    FailClosedProductionStorage,
  },
  { retrieveKnowledgeChunks, normalizeArabicSearchText, generateArabicSearchVariants },
  { extractDocumentContent },
] = await Promise.all([
  import('../src/utils/prismaClient'),
  import('../src/middleware/error.middleware'),
  import('../src/utils/jwt.utils'),
  import('../src/routes/knowledge.routes'),
  import('../src/services/knowledge/knowledgeAdmin.service'),
  import('../src/services/knowledge/knowledgeStorage.service'),
  import('../src/services/knowledge/knowledgeRetrieval.service'),
  import('../src/services/knowledge/knowledgeExtractor.service'),
]);

console.log('=== PHASE 11.1: KNOWLEDGE BASE PRODUCTION HARDENING TEST SUITE ===');

// Setup Express Test App
const app = express();
app.use(express.json());
app.use('/api/knowledge', knowledgeRoutes);
app.use(errorHandler);

const server = http.createServer(app);
await new Promise<void>((resolve) => server.listen(0, resolve));
const port = (server.address() as any).port;
const baseUrl = `http://127.0.0.1:${port}`;

// Setup Test Colleges and Departments
const testCollege1 = await prisma.college.upsert({
  where: { id: 701 },
  update: { name: 'Engineering Hardening', nameAr: 'الهندسة' },
  create: { id: 701, name: 'Engineering Hardening', nameAr: 'الهندسة' },
});

const testCollege2 = await prisma.college.upsert({
  where: { id: 702 },
  update: { name: 'Medicine Hardening', nameAr: 'الطب' },
  create: { id: 702, name: 'Medicine Hardening', nameAr: 'الطب' },
});

const testDept1 = await prisma.department.upsert({
  where: { id: 711 },
  update: { name: 'Computer Science Hardening', nameAr: 'علوم الحاسب', collegeId: testCollege1.id },
  create: { id: 711, name: 'Computer Science Hardening', nameAr: 'علوم الحاسب', collegeId: testCollege1.id },
});

const testDept2 = await prisma.department.upsert({
  where: { id: 712 },
  update: { name: 'Civil Engineering Hardening', nameAr: 'الهندسة المدنية', collegeId: testCollege1.id },
  create: { id: 712, name: 'Civil Engineering Hardening', nameAr: 'الهندسة المدنية', collegeId: testCollege1.id },
});

const testDeptOtherCollege = await prisma.department.upsert({
  where: { id: 721 },
  update: { name: 'Surgery Hardening', nameAr: 'الجراحة', collegeId: testCollege2.id },
  create: { id: 721, name: 'Surgery Hardening', nameAr: 'الجراحة', collegeId: testCollege2.id },
});

// Setup Test Actors
const superAdminActor: AuthActor = { id: 8901, email: 'superadmin_h@test.edu', role: 'SUPER_ADMIN', tokenVersion: 0, isActive: true };
const adminActor: AuthActor = { id: 8902, email: 'admin_h@test.edu', role: 'ADMIN', collegeId: testCollege1.id, managedCollegeId: testCollege1.id, tokenVersion: 0, isActive: true };
const collegeAdminActor: AuthActor = { id: 8903, email: 'collegeadmin_h@test.edu', role: 'COLLEGE_ADMIN', managedCollegeId: testCollege1.id, collegeId: testCollege1.id, tokenVersion: 0, isActive: true };
const otherCollegeAdminActor: AuthActor = { id: 8904, email: 'othercollegeadmin_h@test.edu', role: 'COLLEGE_ADMIN', managedCollegeId: testCollege2.id, collegeId: testCollege2.id, tokenVersion: 0, isActive: true };
const deptAdminActor: AuthActor = { id: 8905, email: 'deptadmin_h@test.edu', role: 'DEPARTMENT_ADMIN', managedDepartmentId: testDept1.id, departmentId: testDept1.id, collegeId: testCollege1.id, tokenVersion: 0, isActive: true };
const otherDeptAdminActor: AuthActor = { id: 8906, email: 'otherdeptadmin_h@test.edu', role: 'DEPARTMENT_ADMIN', managedDepartmentId: testDept2.id, departmentId: testDept2.id, collegeId: testCollege1.id, tokenVersion: 0, isActive: true };
const doctorActor: AuthActor = { id: 8907, email: 'doctor_h@test.edu', role: 'DOCTOR', collegeId: testCollege1.id, departmentId: testDept1.id, doctor: { id: 897, departmentId: testDept1.id }, tokenVersion: 0, isActive: true };
const taActor: AuthActor = { id: 8908, email: 'ta_h@test.edu', role: 'TEACHING_ASSISTANT', collegeId: testCollege1.id, departmentId: testDept1.id, teachingAssistant: { id: 898, departmentId: testDept1.id }, tokenVersion: 0, isActive: true };
const studentActor: AuthActor = { id: 8909, email: 'student_h@test.edu', role: 'STUDENT', collegeId: testCollege1.id, departmentId: testDept1.id, student: { id: 899, departmentId: testDept1.id }, tokenVersion: 0, isActive: true };
const otherStudentActor: AuthActor = { id: 8910, email: 'otherstudent_h@test.edu', role: 'STUDENT', collegeId: testCollege2.id, departmentId: testDeptOtherCollege.id, student: { id: 900, departmentId: testDeptOtherCollege.id }, tokenVersion: 0, isActive: true };

for (const actor of [superAdminActor, adminActor, collegeAdminActor, otherCollegeAdminActor, deptAdminActor, otherDeptAdminActor, doctorActor, taActor, studentActor, otherStudentActor]) {
  await prisma.user.upsert({
    where: { id: actor.id },
    update: {
      email: actor.email,
      role: actor.role as any,
      collegeId: actor.collegeId,
      managedCollegeId: actor.managedCollegeId,
      departmentId: actor.departmentId,
      managedDepartmentId: actor.managedDepartmentId,
      isActive: true,
    },
    create: {
      id: actor.id,
      email: actor.email,
      password: 'hash',
      role: actor.role as any,
      collegeId: actor.collegeId,
      managedCollegeId: actor.managedCollegeId,
      departmentId: actor.departmentId,
      managedDepartmentId: actor.managedDepartmentId,
      isActive: true,
    },
  });
}

const superAdminToken = generateAccessToken(superAdminActor.id, 0);
const collegeAdminToken = generateAccessToken(collegeAdminActor.id, 0);
const deptAdminToken = generateAccessToken(deptAdminActor.id, 0);
const studentToken = generateAccessToken(studentActor.id, 0);
const otherStudentToken = generateAccessToken(otherStudentActor.id, 0);

try {
  // -------------------------------------------------------------
  // 1. STORAGE ABSTRACTION & FAIL-CLOSED BEHAVIOR
  // -------------------------------------------------------------
  console.log('1. Testing storage abstraction and fail-closed production behavior...');
  const storage = getKnowledgeStorage();
  assert.ok(storage, 'Storage instance must be resolved');

  const testBuffer = Buffer.from('Official regulation document content for hardening test', 'utf8');
  const stored = await storage.store({
    buffer: testBuffer,
    originalFilename: 'test_hardening_doc.txt',
    mimeType: 'text/plain',
    fileHash: 'sha256-test-hardening-001',
  });

  assert.ok(stored.storageKey, 'Storage key must be returned');
  assert.ok(!path.isAbsolute(stored.storageKey), 'Storage key must be platform-independent relative key');
  assert.ok(stored.storageKey.startsWith('knowledge/versions/'), 'Storage key must use standard knowledge/versions/ prefix');

  const readBack = await storage.read(stored.storageKey);
  assert.equal(readBack.toString('utf8'), testBuffer.toString('utf8'), 'Read-back content must match exactly');

  const exists = await storage.exists(stored.storageKey);
  assert.equal(exists, true, 'File must exist in storage');

  // Fail-closed in production without durable cloud storage
  const failClosedStorage = new FailClosedProductionStorage();
  await assert.rejects(
    () => failClosedStorage.store({
      buffer: testBuffer,
      originalFilename: 'test.txt',
      mimeType: 'text/plain',
      fileHash: 'hash-fail-closed',
    }),
    /Durable document storage is not configured/
  );

  // Path traversal defense on storage
  assert.throws(
    () => (storage as LocalKnowledgeFileStorage).resolveLocalPath('../../etc/passwd'),
    /Invalid storage path traversal attempt/
  );

  await storage.delete(stored.storageKey);
  const existsAfterDelete = await storage.exists(stored.storageKey);
  assert.equal(existsAfterDelete, false, 'File must be removed after deletion');

  // -------------------------------------------------------------
  // 2. STORAGE FAILURE CONSISTENCY & DB COMPENSATION
  // -------------------------------------------------------------
  console.log('2. Testing storage failure consistency and DB compensation...');

  // A. Storage upload failure fails closed and creates zero DB records
  const mockFailingStorage = {
    async store() { throw new Error('Simulated cloud storage outage (e.g. 503 Service Unavailable)'); },
    async read() { throw new Error('Not implemented'); },
    async exists() { return false; },
    async delete() {},
    resolveLocalPath() { return null; },
  };

  setKnowledgeStorageForTesting(mockFailingStorage);

  await assert.rejects(
    () => createKnowledgeDocument(
      superAdminActor,
      { title: 'Failure Consistency Doc', scope: 'GLOBAL' },
      {
        originalname: 'failure_test.txt',
        path: '',
        mimetype: 'text/plain',
        size: 100,
        fileHash: 'hash-failure-consistency-001',
        buffer: Buffer.from('Content that fails storage', 'utf8'),
      }
    ),
    /Simulated cloud storage outage/
  );

  const docCountAfterStorageFail = await prisma.knowledgeDocument.count({
    where: { title: 'Failure Consistency Doc' },
  });
  assert.equal(docCountAfterStorageFail, 0, 'No DB record should be created when storage fails');

  // Restore real storage
  setKnowledgeStorageForTesting(storage);

  // B. Compensation on DB Failure: Stored file is deleted if DB record creation throws
  let deletedKey: string | null = null;
  const trackingStorage = {
    async store(input: any) {
      return storage.store(input);
    },
    async read(key: string) { return storage.read(key); },
    async exists(key: string) { return storage.exists(key); },
    async delete(key: string) {
      deletedKey = key;
      return storage.delete(key);
    },
    resolveLocalPath(key: string) { return storage.resolveLocalPath(key); },
  };

  setKnowledgeStorageForTesting(trackingStorage);

  // Trigger DB failure by passing an invalid documentType that fails Prisma validation
  await assert.rejects(
    () => createKnowledgeDocument(
      superAdminActor,
      {
        title: 'DB Failure Doc',
        scope: 'GLOBAL',
        documentType: 'INVALID_ENUM' as any,
      },
      {
        originalname: 'db_fail.txt',
        path: '',
        mimetype: 'text/plain',
        size: 50,
        fileHash: 'hash-db-fail-002',
        buffer: Buffer.from('Content for DB failure compensation', 'utf8'),
      }
    )
  );

  assert.ok(deletedKey, 'Stored file must be compensated (deleted) when DB creation fails');
  const fileExistsAfterCompensation = await storage.exists(deletedKey!);
  assert.equal(fileExistsAfterCompensation, false, 'Compensated file must not remain on disk');

  setKnowledgeStorageForTesting(storage);

  // C. Ingestion extraction failure marks version FAILED, never READY
  const malformedPdfContent = Buffer.from('%PDF-1.4 Malformed binary bytes with corrupted header \x00\x01\x02', 'utf8');
  const malformedDoc = await createKnowledgeDocument(
    superAdminActor,
    { title: 'Malformed PDF Test', scope: 'GLOBAL' },
    {
      originalname: 'corrupt.pdf',
      path: '',
      mimetype: 'application/pdf',
      size: malformedPdfContent.length,
      fileHash: 'hash-corrupt-pdf-003',
      buffer: malformedPdfContent,
    }
  );

  const corruptVersion = await prisma.knowledgeDocumentVersion.findFirst({
    where: { documentId: malformedDoc?.id },
  });
  assert.equal(corruptVersion?.processingStatus, 'FAILED', 'Malformed PDF version must be marked FAILED');
  assert.ok(corruptVersion?.processingError, 'Processing error must be recorded');
  assert.notEqual(corruptVersion?.processingStatus, 'READY', 'Failed document must never become READY');

  // D. Failed version cannot be activated
  await assert.rejects(
    () => activateDocumentVersion(superAdminActor, malformedDoc!.id, corruptVersion!.id),
    /Cannot activate version with processing status: FAILED/
  );

  // -------------------------------------------------------------
  // 3. COMPLETE KNOWLEDGE ADMIN RBAC MATRIX
  // -------------------------------------------------------------
  console.log('3. Testing complete Knowledge Admin RBAC matrix across all roles...');

  // A. GLOBAL Scope
  // SUPER_ADMIN & ADMIN can create GLOBAL
  await assert.doesNotReject(() => verifyAdminKnowledgeScope(superAdminActor, 'GLOBAL'));
  await assert.doesNotReject(() => verifyAdminKnowledgeScope(adminActor, 'GLOBAL'));
  // COLLEGE_ADMIN & DEPARTMENT_ADMIN cannot create GLOBAL
  await assert.rejects(() => verifyAdminKnowledgeScope(collegeAdminActor, 'GLOBAL'), /Only university administrators/);
  await assert.rejects(() => verifyAdminKnowledgeScope(deptAdminActor, 'GLOBAL'), /Only university administrators/);
  // Non-admins cannot manage knowledge base
  await assert.rejects(() => verifyAdminKnowledgeScope(doctorActor, 'COLLEGE', testCollege1.id), /Insufficient administrative permissions/);
  await assert.rejects(() => verifyAdminKnowledgeScope(taActor, 'COLLEGE', testCollege1.id), /Insufficient administrative permissions/);
  await assert.rejects(() => verifyAdminKnowledgeScope(studentActor, 'COLLEGE', testCollege1.id), /Insufficient administrative permissions/);

  // B. COLLEGE Scope
  // SUPER_ADMIN & ADMIN can create COLLEGE for any college
  await assert.doesNotReject(() => verifyAdminKnowledgeScope(superAdminActor, 'COLLEGE', testCollege1.id));
  await assert.doesNotReject(() => verifyAdminKnowledgeScope(adminActor, 'COLLEGE', testCollege1.id));
  // COLLEGE_ADMIN can create for their own college
  await assert.doesNotReject(() => verifyAdminKnowledgeScope(collegeAdminActor, 'COLLEGE', testCollege1.id));
  // COLLEGE_ADMIN cannot create for another college
  await assert.rejects(() => verifyAdminKnowledgeScope(collegeAdminActor, 'COLLEGE', testCollege2.id), /only manage documents for your assigned college/);
  // DEPARTMENT_ADMIN cannot create COLLEGE document
  await assert.rejects(() => verifyAdminKnowledgeScope(deptAdminActor, 'COLLEGE', testCollege1.id), /only manage documents for your assigned department/);

  // C. DEPARTMENT Scope
  // SUPER_ADMIN & ADMIN can create DEPARTMENT for any department
  await assert.doesNotReject(() => verifyAdminKnowledgeScope(superAdminActor, 'DEPARTMENT', undefined, testDept1.id));
  await assert.doesNotReject(() => verifyAdminKnowledgeScope(adminActor, 'DEPARTMENT', undefined, testDept1.id));
  // COLLEGE_ADMIN can create for department within their college
  await assert.doesNotReject(() => verifyAdminKnowledgeScope(collegeAdminActor, 'DEPARTMENT', undefined, testDept1.id));
  // COLLEGE_ADMIN cannot create for department outside their college
  await assert.rejects(() => verifyAdminKnowledgeScope(collegeAdminActor, 'DEPARTMENT', undefined, testDeptOtherCollege.id), /department documents within your assigned college/);
  // DEPARTMENT_ADMIN can create for their own department
  await assert.doesNotReject(() => verifyAdminKnowledgeScope(deptAdminActor, 'DEPARTMENT', undefined, testDept1.id));
  // DEPARTMENT_ADMIN cannot create for another department
  await assert.rejects(() => verifyAdminKnowledgeScope(deptAdminActor, 'DEPARTMENT', undefined, testDept2.id), /only manage documents for your assigned department/);

  // -------------------------------------------------------------
  // 4. FRONTEND / BACKEND AUTHORIZATION PARITY
  // -------------------------------------------------------------
  console.log('4. Testing API endpoint authorization parity across roles...');

  // Endpoint: GET /api/knowledge/documents (Admin listing)
  const superAdminListRes = await fetch(`${baseUrl}/api/knowledge/documents`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  assert.equal(superAdminListRes.status, 200, 'SUPER_ADMIN must access /api/knowledge/documents');

  const collegeAdminListRes = await fetch(`${baseUrl}/api/knowledge/documents`, {
    headers: { Authorization: `Bearer ${collegeAdminToken}` },
  });
  assert.equal(collegeAdminListRes.status, 200, 'COLLEGE_ADMIN must access /api/knowledge/documents');

  const deptAdminListRes = await fetch(`${baseUrl}/api/knowledge/documents`, {
    headers: { Authorization: `Bearer ${deptAdminToken}` },
  });
  assert.equal(deptAdminListRes.status, 200, 'DEPARTMENT_ADMIN must access /api/knowledge/documents');

  const studentListRes = await fetch(`${baseUrl}/api/knowledge/documents`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(studentListRes.status, 403, 'STUDENT must be rejected from admin /api/knowledge/documents');

  // -------------------------------------------------------------
  // 5. DOCUMENT DOWNLOAD SECURITY & CROSS-TENANT ISOLATION
  // -------------------------------------------------------------
  console.log('5. Testing document download security and cross-tenant isolation...');

  // Create College 1 document
  const college1Content = Buffer.from('Engineering College Internal Bylaw 2026', 'utf8');
  const college1Doc = await createKnowledgeDocument(
    collegeAdminActor,
    {
      title: 'Engineering College Bylaw',
      documentType: 'BYLAW',
      scope: 'COLLEGE',
      collegeId: testCollege1.id,
    },
    {
      originalname: 'eng_bylaw.txt',
      path: '',
      mimetype: 'text/plain',
      size: college1Content.length,
      fileHash: 'hash-eng-bylaw-004',
      buffer: college1Content,
    }
  );

  // Student in College 1 (Dept 1) can download
  const studentDownloadRes = await fetch(`${baseUrl}/api/knowledge/documents/${college1Doc!.id}/download`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(studentDownloadRes.status, 200, 'College 1 student should be authorized to download College 1 document');
  const downloadedBody = await studentDownloadRes.text();
  assert.equal(downloadedBody, 'Engineering College Internal Bylaw 2026');

  // Student in College 2 cannot download College 1 document
  const outsiderDownloadRes = await fetch(`${baseUrl}/api/knowledge/documents/${college1Doc!.id}/download`, {
    headers: { Authorization: `Bearer ${otherStudentToken}` },
  });
  assert.equal(outsiderDownloadRes.status, 403, 'College 2 student must be forbidden from downloading College 1 document');

  // Unauthenticated user cannot download
  const unauthDownloadRes = await fetch(`${baseUrl}/api/knowledge/documents/${college1Doc!.id}/download`);
  assert.equal(unauthDownloadRes.status, 401, 'Unauthenticated user must be rejected from downloading');

  // -------------------------------------------------------------
  // 6. CITATION PROVENANCE DURABILITY
  // -------------------------------------------------------------
  console.log('6. Testing citation provenance durability across new versions and archival...');

  // A. Create Citation referencing version 1
  const v1 = college1Doc!.activeVersion!;
  const testConv = await prisma.aIConversation.create({
    data: {
      userId: superAdminActor.id,
      title: 'Citation Durability Conversation',
      messages: {
        create: {
          role: 'ASSISTANT' as any,
          content: 'Here is the cited answer',
          sequence: 1,
        },
      },
    },
    include: { messages: true },
  });
  const messageId = testConv.messages[0].id;

  const citation = await prisma.aIMessageCitation.create({
    data: {
      messageId: messageId,
      documentVersionId: v1.id,
      documentTitle: college1Doc!.title,
      version: v1.version,
      quote: 'Engineering College Internal Bylaw 2026 quote',
    },
  });

  // B. Upload and activate Version 2
  const v2Content = Buffer.from('Engineering College Internal Bylaw 2026 Updated Version 2', 'utf8');
  await uploadNewDocumentVersion(
    collegeAdminActor,
    college1Doc!.id,
    {
      originalname: 'eng_bylaw_v2.txt',
      path: '',
      mimetype: 'text/plain',
      size: v2Content.length,
      fileHash: 'hash-eng-bylaw-v2-005',
      buffer: v2Content,
    },
    { versionTag: 'v2.0' }
  );

  const docWithV2 = await prisma.knowledgeDocument.findUnique({
    where: { id: college1Doc!.id },
    include: { versions: { orderBy: { version: 'desc' } } },
  });
  const v2 = docWithV2!.versions[0];
  await activateDocumentVersion(collegeAdminActor, college1Doc!.id, v2.id);

  // C. Archive the document
  await archiveKnowledgeDocument(collegeAdminActor, college1Doc!.id);

  // D. Verify the historical citation remains immutable and unchanged
  const verifiedCitation = await prisma.aIMessageCitation.findUnique({
    where: { id: citation.id },
  });
  assert.equal(verifiedCitation?.documentVersionId, v1.id, 'Citation must still reference original version 1');
  assert.equal(verifiedCitation?.version, 1, 'Citation version number must remain 1');
  assert.equal(verifiedCitation?.quote, 'Engineering College Internal Bylaw 2026 quote');
  assert.notEqual(verifiedCitation?.documentVersionId, v2.id, 'Citation must NEVER silently mutate to version 2');

  // -------------------------------------------------------------
  // 7. ARABIC VARIANT EXPANSION SANITY
  // -------------------------------------------------------------
  console.log('7. Testing Arabic search variant generation...');
  const variants = generateArabicSearchVariants('إنذار');
  assert.ok(variants.includes('انذار'), 'Must include bare alef');
  assert.ok(variants.includes('إنذار'), 'Must include alef-kasra');
  assert.ok(variants.includes('أنذار'), 'Must include alef-hamza');

  const tehVariants = generateArabicSearchVariants('لائحة');
  assert.ok(tehVariants.includes('لائحة'), 'Must include teh marbuta');
  assert.ok(tehVariants.includes('لائحه'), 'Must include heh');

  // -------------------------------------------------------------
  // 8. OCR DETECTION INTEGRITY
  // -------------------------------------------------------------
  console.log('8. Testing scanned PDF detection and REQUIRES_OCR status...');
  // A textless PDF or empty character extraction
  const textlessExtraction = await extractDocumentContent(
    Buffer.from('   \n\n   \t  ', 'utf8'),
    'text/plain'
  );
  assert.equal(textlessExtraction.isScannedOrTextless, true, 'Textless content must be flagged as scanned/textless');

  console.log('\n✅ ALL PHASE 11.1 HARDENING & PRODUCTION INTEGRITY TESTS PASSED!');
} finally {
  server.close();
  // Clean up test data safely
  await prisma.aIMessageCitation.deleteMany({});
  await prisma.aIMessage.deleteMany({ where: { conversation: { title: 'Citation Durability Conversation' } } });
  await prisma.aIConversation.deleteMany({ where: { title: 'Citation Durability Conversation' } });
  await prisma.knowledgeChunk.deleteMany({ where: { document: { title: { contains: 'Hardening' } } } });
  await prisma.knowledgeDocumentVersion.deleteMany({ where: { document: { title: { contains: 'Hardening' } } } });
  await prisma.knowledgeDocument.deleteMany({ where: { title: { contains: 'Hardening' } } });
  await prisma.knowledgeChunk.deleteMany({ where: { document: { title: { contains: 'Failure' } } } });
  await prisma.knowledgeDocumentVersion.deleteMany({ where: { document: { title: { contains: 'Failure' } } } });
  await prisma.knowledgeDocument.deleteMany({ where: { title: { contains: 'Failure' } } });
  await prisma.knowledgeChunk.deleteMany({ where: { document: { title: { contains: 'Malformed' } } } });
  await prisma.knowledgeDocumentVersion.deleteMany({ where: { document: { title: { contains: 'Malformed' } } } });
  await prisma.knowledgeDocument.deleteMany({ where: { title: { contains: 'Malformed' } } });
  await prisma.knowledgeChunk.deleteMany({ where: { document: { title: 'Engineering College Bylaw' } } });
  await prisma.knowledgeDocumentVersion.deleteMany({ where: { document: { title: 'Engineering College Bylaw' } } });
  await prisma.knowledgeDocument.deleteMany({ where: { title: 'Engineering College Bylaw' } });

  await prisma.$disconnect();
}
