import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import prisma from '../src/utils/prismaClient';
import { getCourseById } from '../src/controllers/courses.controller';
import {
  approveRequest,
  createRequest,
} from '../src/controllers/requests.controller';

type InvocationResult = {
  status: number;
  body?: any;
  error?: any;
};

async function invokeController(
  handler: any,
  request: Record<string, any>
): Promise<InvocationResult> {
  return new Promise((resolve) => {
    let status = 200;
    const response = {
      status(code: number) {
        status = code;
        return this;
      },
      json(body: any) {
        resolve({ status, body });
        return this;
      },
    };
    const next = (error?: any) => resolve({ status, error });
    handler(request, response, next);
  });
}

function schemaAndMigrationAreProtective() {
  const schema = fs.readFileSync(
    path.resolve(process.cwd(), 'prisma/schema.prisma'),
    'utf8'
  );
  const migration = fs.readFileSync(
    path.resolve(
      process.cwd(),
      'prisma/migrations/20260909001001_preserve_materials_and_schedule_requests/migration.sql'
    ),
    'utf8'
  );

  assert.match(schema, /uploadedById\s+Int\?/);
  assert.match(
    schema,
    /uploadedBy\s+User\?\s+@relation\(fields: \[uploadedById\], references: \[id\], onDelete: SetNull\)/
  );
  assert.match(schema, /targetScheduleSlotId\s+Int\?/);
  assert.match(
    schema,
    /scheduleSlot\s+ScheduleSlot\?\s+@relation\(fields: \[scheduleSlotId\], references: \[id\], onDelete: SetNull\)/
  );
  assert.match(
    migration,
    /SET "targetScheduleSlotId" = "scheduleSlotId"\s+WHERE "scheduleSlotId" IS NOT NULL;/
  );
}

async function nullUploaderIsReturned() {
  const originalFindFirst = prisma.course.findFirst;
  try {
    (prisma.course.findFirst as any) = async (args: any) => {
      assert.ok(args.include.materials.include.uploadedBy);
      return {
        id: 41,
        isPublished: true,
        materials: [
          {
            id: 52,
            title: 'Retained material',
            uploadedById: null,
            uploadedBy: null,
          },
        ],
      };
    };

    const result = await invokeController(getCourseById, {
      params: { id: '41' },
      user: { id: 1, role: 'SUPER_ADMIN' },
    });
    assert.equal(result.error, undefined);
    assert.equal(result.body.data.materials.length, 1);
    assert.equal(result.body.data.materials[0].uploadedById, null);
    assert.equal(result.body.data.materials[0].uploadedBy, null);
  } finally {
    prisma.course.findFirst = originalFindFirst;
  }
}

async function requestCreationAndDeleteApprovalRetainSnapshot() {
  const originalCourseFindFirst = prisma.course.findFirst;
  const originalSlotFindFirst = prisma.scheduleSlot.findFirst;
  const originalRequestCreate = prisma.scheduleChangeRequest.create;
  const originalRequestFindFirst = prisma.scheduleChangeRequest.findFirst;
  const originalTransaction = prisma.$transaction;
  const originalAuditCreate = prisma.auditLog.create;
  const storedRequest: any = {
    id: 61,
    type: 'DELETE_SLOT',
    status: 'PENDING',
    courseId: 71,
    scheduleSlotId: 81,
    targetScheduleSlotId: 81,
    proposedData: {},
    course: { id: 71 },
  };

  try {
    (prisma.course.findFirst as any) = async () => ({ id: 71 });
    (prisma.scheduleSlot.findFirst as any) = async () => ({ id: 81 });
    (prisma.scheduleChangeRequest.create as any) = async ({ data }: any) => {
      assert.equal(data.scheduleSlotId, 81);
      assert.equal(data.targetScheduleSlotId, 81);
      return { ...storedRequest, ...data };
    };
    (prisma.auditLog.create as any) = async () => ({ id: 1 });

    const created = await invokeController(createRequest, {
      body: {
        type: 'DELETE_SLOT',
        courseId: 71,
        scheduleSlotId: 81,
        proposedData: {},
      },
      user: { id: 1, role: 'SUPER_ADMIN' },
    });
    assert.equal(created.error, undefined);
    assert.equal(created.status, 201);

    (prisma.scheduleChangeRequest.findFirst as any) = async () => storedRequest;
    (prisma as any).$transaction = async (callback: any) => callback({
      scheduleSlot: {
        findFirst: async () => ({
          id: 81,
          courseId: 71,
          dayOfWeek: 'MONDAY',
          startTime: '09:00',
          endTime: '10:00',
        }),
        delete: async () => {
          storedRequest.scheduleSlotId = null;
          return { id: 81 };
        },
      },
      scheduleChangeRequest: {
        update: async ({ data }: any) => {
          Object.assign(storedRequest, data);
          return storedRequest;
        },
      },
    });

    const approved = await invokeController(approveRequest, {
      params: { id: '61' },
      body: { adminComment: 'approved' },
      user: { id: 1, role: 'SUPER_ADMIN' },
    });
    assert.equal(approved.error, undefined);
    assert.equal(approved.status, 200);
    assert.equal(storedRequest.status, 'APPROVED');
    assert.equal(storedRequest.scheduleSlotId, null);
    assert.equal(storedRequest.targetScheduleSlotId, 81);
  } finally {
    prisma.course.findFirst = originalCourseFindFirst;
    prisma.scheduleSlot.findFirst = originalSlotFindFirst;
    prisma.scheduleChangeRequest.create = originalRequestCreate;
    prisma.scheduleChangeRequest.findFirst = originalRequestFindFirst;
    prisma.$transaction = originalTransaction;
    prisma.auditLog.create = originalAuditCreate;
  }
}

async function databaseConstraintsPreserveRecords() {
  const rollbackMessage = 'ROLLBACK_DEFERRED_SCHEMA_FIX_FIXTURES';
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await assert.rejects(
    prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: `schema-fix-${suffix}@example.test`,
          password: 'not-used',
          role: 'DOCTOR',
        },
      });
      const course = await tx.course.create({
        data: {
          courseCode: `SCHEMA-${suffix}`,
          name: 'Schema regression fixture',
        },
      });
      const material = await tx.courseMaterial.create({
        data: {
          title: 'Retained material',
          fileUrl: 'https://example.test/material.pdf',
          courseId: course.id,
          uploadedById: user.id,
        },
      });
      await tx.user.delete({ where: { id: user.id } });
      const retainedMaterial = await tx.courseMaterial.findUnique({
        where: { id: material.id },
        include: { uploadedBy: true },
      });
      assert.ok(retainedMaterial);
      assert.equal(retainedMaterial.uploadedById, null);
      assert.equal(retainedMaterial.uploadedBy, null);

      const slot = await tx.scheduleSlot.create({
        data: {
          courseId: course.id,
          dayOfWeek: 'MONDAY',
          startTime: '09:00',
          endTime: '10:00',
          slotType: 'LECTURE',
        },
      });
      const request = await tx.scheduleChangeRequest.create({
        data: {
          type: 'DELETE_SLOT',
          courseId: course.id,
          scheduleSlotId: slot.id,
          targetScheduleSlotId: slot.id,
          proposedData: {},
        },
      });
      await tx.scheduleSlot.delete({ where: { id: slot.id } });
      await tx.scheduleChangeRequest.update({
        where: { id: request.id },
        data: { status: 'APPROVED' },
      });
      const retainedRequest = await tx.scheduleChangeRequest.findUnique({
        where: { id: request.id },
      });
      assert.ok(retainedRequest);
      assert.equal(retainedRequest.status, 'APPROVED');
      assert.equal(retainedRequest.scheduleSlotId, null);
      assert.equal(retainedRequest.targetScheduleSlotId, slot.id);

      throw new Error(rollbackMessage);
    }),
    new RegExp(rollbackMessage)
  );
}

async function migrationBackfillCopiesNonNullSlotIds() {
  const rollbackMessage = 'ROLLBACK_BACKFILL_FIXTURES';
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const courseCode = `BACKFILL-${suffix}`;
  await assert.rejects(
    prisma.$transaction(async (tx) => {
      const course = await tx.course.create({
        data: {
          courseCode,
          name: 'Backfill regression fixture',
        },
      });
      const slots = await Promise.all(
        ['MONDAY', 'TUESDAY', 'WEDNESDAY'].map((dayOfWeek, index) =>
          tx.scheduleSlot.create({
            data: {
              courseId: course.id,
              dayOfWeek,
              startTime: `${index + 8}`.padStart(2, '0') + ':00',
              endTime: `${index + 9}`.padStart(2, '0') + ':00',
              slotType: 'LECTURE',
            },
          })
        )
      );
      const requests = await Promise.all(
        slots.map((slot) =>
          tx.scheduleChangeRequest.create({
            data: {
              type: 'DELETE_SLOT',
              courseId: course.id,
              scheduleSlotId: slot.id,
              targetScheduleSlotId: null,
              proposedData: {},
            },
          })
        )
      );

      const legacyRows = await tx.scheduleChangeRequest.findMany({
        where: { id: { in: requests.map((request) => request.id) } },
        select: { scheduleSlotId: true, targetScheduleSlotId: true },
      });
      assert.equal(legacyRows.length, slots.length);
      for (const request of legacyRows) {
        assert.notEqual(request.scheduleSlotId, null);
        assert.equal(request.targetScheduleSlotId, null);
      }

      const updatedRows = await tx.$executeRawUnsafe(`UPDATE "ScheduleChangeRequest"
SET "targetScheduleSlotId" = "scheduleSlotId"
WHERE "scheduleSlotId" IS NOT NULL;`);
      const backfilled = await tx.scheduleChangeRequest.findMany({
        where: { id: { in: requests.map((request) => request.id) } },
        select: { scheduleSlotId: true, targetScheduleSlotId: true },
        orderBy: { id: 'asc' },
      });

      assert.equal(backfilled.length, slots.length);
      for (const request of backfilled) {
        assert.notEqual(request.scheduleSlotId, null);
        assert.equal(request.targetScheduleSlotId, request.scheduleSlotId);
      }
      console.log(`BACKFILL_FIXTURES=${slots.length}`);
      console.log(`BACKFILL_UPDATED_ROWS=${updatedRows}`);
      console.log(`BACKFILL_MATCHED_ROWS=${backfilled.length}`);

      throw new Error(rollbackMessage);
    }),
    new RegExp(rollbackMessage)
  );

  assert.equal(await prisma.course.count({ where: { courseCode } }), 0);
  console.log('BACKFILL_ROLLBACK_VERIFIED=true');
}

schemaAndMigrationAreProtective();
await nullUploaderIsReturned();
await requestCreationAndDeleteApprovalRetainSnapshot();
await databaseConstraintsPreserveRecords();
await migrationBackfillCopiesNonNullSlotIds();
console.log('Deferred schema fixes regression checks passed');
