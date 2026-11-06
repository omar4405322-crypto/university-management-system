import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import prisma from '../src/utils/prismaClient';
import { generateAccessToken } from '../src/utils/jwt.utils';
import app from '../src/app';

const VALID_PDF_BYTES = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n',
  'utf8'
);

test('WP5-T6a2: Course Material SHA-256 Hash Computation (C10)', async (t) => {
  const SUFFIX = `t6a2_mat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  let server: http.Server | null = null;
  let baseUrl = '';

  const uploadsMatDir = path.resolve(process.cwd(), 'uploads/materials');
  if (!fs.existsSync(uploadsMatDir)) {
    fs.mkdirSync(uploadsMatDir, { recursive: true });
  }

  const tracked = {
    createdDiskFiles: [] as string[],
    materialIds: [] as number[],
    slotIds: [] as number[],
    doctorIds: [] as number[],
    courseIds: [] as number[],
    userIds: [] as number[],
    departmentIds: [] as number[],
    collegeIds: [] as number[],
  };

  try {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as any;
    baseUrl = `http://127.0.0.1:${addr.port}/api`;

    // College & Department
    const college = await prisma.college.create({
      data: { name: `Col_${SUFFIX}` },
    });
    tracked.collegeIds.push(college.id);

    const dept = await prisma.department.create({
      data: { name: `Dept_${SUFFIX}`, collegeId: college.id },
    });
    tracked.departmentIds.push(dept.id);

    // Doctor
    const passwordHash = await bcrypt.hash(crypto.randomUUID(), 4);
    const docUser = await prisma.user.create({
      data: {
        email: `doc_${SUFFIX}@test.unicore`,
        password: passwordHash,
        role: 'DOCTOR',
        departmentId: dept.id,
        collegeId: college.id,
        isActive: true,
      },
    });
    tracked.userIds.push(docUser.id);

    const doctor = await prisma.doctor.create({
      data: {
        userId: docUser.id,
        firstName: 'Dr',
        lastName: SUFFIX,
        doctorId: `DOC_${SUFFIX}`,
        departmentId: dept.id,
      },
    });
    tracked.doctorIds.push(doctor.id);
    const doctorToken = generateAccessToken(docUser.id, docUser.tokenVersion);

    // Course
    const course = await prisma.course.create({
      data: {
        name: `Course_${SUFFIX}`,
        courseCode: `C_${SUFFIX}`,
        departmentId: dept.id,
        credits: 3,
        isPublished: true,
      },
    });
    tracked.courseIds.push(course.id);

    // Schedule Slot (assigns doctor to course)
    const slot = await prisma.scheduleSlot.create({
      data: {
        courseId: course.id,
        doctorId: doctor.id,
        dayOfWeek: 'Monday',
        startTime: '08:00',
        endTime: '10:00',
        slotType: 'LECTURE',
        isArchived: false,
      },
    });
    tracked.slotIds.push(slot.id);

    // -------------------------------------------------------------------------
    // C10: Course-material file upload computes SHA-256 server-side
    // -------------------------------------------------------------------------
    await t.test('C10: Course-material file upload computes SHA-256, link materials stay null, legacy untouched', async () => {
      const filesBefore = new Set(fs.readdirSync(uploadsMatDir));

      // 1. Upload a file material
      const formData = new FormData();
      formData.append('title', `Lecture Notes ${SUFFIX}`);
      formData.append('type', 'LECTURE');
      formData.append('file', new Blob([VALID_PDF_BYTES], { type: 'application/pdf' }), 'lecture1.pdf');

      const resFile = await fetch(`${baseUrl}/courses/${course.id}/materials`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${doctorToken}`,
        },
        body: formData,
      });

      const filesAfter = fs.readdirSync(uploadsMatDir);
      for (const f of filesAfter) {
        if (!filesBefore.has(f)) {
          tracked.createdDiskFiles.push(path.join(uploadsMatDir, f));
        }
      }

      assert.equal(resFile.status, 201, 'File material upload must succeed with 201');
      const jsonFile: any = await resFile.json();
      assert.ok(jsonFile.data?.id, 'Response must include created material');
      tracked.materialIds.push(jsonFile.data.id);

      const expectedHash = crypto.createHash('sha256').update(VALID_PDF_BYTES).digest('hex');

      // Check DB row
      const fileMaterialInDb = await prisma.courseMaterial.findUnique({
        where: { id: jsonFile.data.id },
      });
      assert.ok(fileMaterialInDb, 'CourseMaterial row must exist in DB');
      assert.equal(
        fileMaterialInDb.fileHash,
        expectedHash,
        'CourseMaterial.fileHash must match SHA-256 of uploaded file'
      );

      // 2. Upload a link material (no file)
      const resLink = await fetch(`${baseUrl}/courses/${course.id}/materials`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${doctorToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: `Reference Link ${SUFFIX}`,
          type: 'LECTURE',
          fileUrl: 'https://example.com/lecture-reference',
        }),
      });

      assert.equal(resLink.status, 201, 'Link material creation must succeed with 201');
      const jsonLink: any = await resLink.json();
      assert.ok(jsonLink.data?.id, 'Link material must be created');
      tracked.materialIds.push(jsonLink.data.id);

      const linkMaterialInDb = await prisma.courseMaterial.findUnique({
        where: { id: jsonLink.data.id },
      });
      assert.ok(linkMaterialInDb, 'Link material row must exist in DB');
      assert.equal(linkMaterialInDb.fileHash, null, 'Link material fileHash must stay null');

      // 3. Legacy materials with null fileHash stay untouched
      const legacyMaterial = await prisma.courseMaterial.create({
        data: {
          title: `Legacy Material ${SUFFIX}`,
          type: 'LECTURE',
          courseId: course.id,
          uploadedById: docUser.id,
          fileHash: null,
          fileUrl: '/uploads/materials/legacy.pdf',
        },
      });
      tracked.materialIds.push(legacyMaterial.id);

      const legacyInDb = await prisma.courseMaterial.findUnique({
        where: { id: legacyMaterial.id },
      });
      assert.equal(legacyInDb?.fileHash, null, 'Legacy material fileHash must remain null');
    });
  } finally {
    if (server) {
      server.close();
    }
    // Cleanup in reverse topological order
    for (const f of tracked.createdDiskFiles) {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch {}
    }
    if (tracked.materialIds.length > 0) {
      await prisma.courseMaterial.deleteMany({ where: { id: { in: tracked.materialIds } } }).catch(() => {});
    }
    if (tracked.slotIds.length > 0) {
      await prisma.scheduleSlot.deleteMany({ where: { id: { in: tracked.slotIds } } }).catch(() => {});
    }
    if (tracked.courseIds.length > 0) {
      await prisma.course.deleteMany({ where: { id: { in: tracked.courseIds } } }).catch(() => {});
    }
    if (tracked.doctorIds.length > 0) {
      await prisma.doctor.deleteMany({ where: { id: { in: tracked.doctorIds } } }).catch(() => {});
    }
    if (tracked.userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: tracked.userIds } } }).catch(() => {});
    }
    if (tracked.departmentIds.length > 0) {
      await prisma.department.deleteMany({ where: { id: { in: tracked.departmentIds } } }).catch(() => {});
    }
    if (tracked.collegeIds.length > 0) {
      await prisma.college.deleteMany({ where: { id: { in: tracked.collegeIds } } }).catch(() => {});
    }
  }
});
