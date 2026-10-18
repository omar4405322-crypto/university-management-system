import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import bcrypt from 'bcryptjs';
import prisma from '../src/utils/prismaClient';
import { generateAccessToken } from '../src/utils/jwt.utils';
import app from '../src/app';
import { TestCleanupRegistry } from './testCleanup.utils';

test('wp3_3b_room_directory: Room directory CRUD, isActive, scoping, Zod validation, audit logging, and legacy coordinate preservation', async () => {
  const SUFFIX = `room_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const passwordHash = await bcrypt.hash(crypto.randomUUID() + '!Aa1', 4);
  const cleanup = new TestCleanupRegistry();
  let server: http.Server | null = null;

  try {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as any;
    const baseUrl = `http://127.0.0.1:${addr.port}/api`;

    // 1. Setup Users for Auth Roles
    const college = await prisma.college.create({
      data: { name: `College_${SUFFIX}` },
    });
    cleanup.trackCollege(college.id);

    const department = await prisma.department.create({
      data: { name: `Dept_${SUFFIX}`, collegeId: college.id },
    });
    cleanup.trackDepartment(department.id);

    const superAdmin = await prisma.user.create({
      data: {
        email: `super_${SUFFIX}@university.edu`,
        password: passwordHash,
        role: 'SUPER_ADMIN',
      },
    });
    cleanup.trackUser(superAdmin.id);
    const superAdminToken = generateAccessToken(superAdmin.id, superAdmin.tokenVersion);

    const collegeAdmin = await prisma.user.create({
      data: {
        email: `ca_${SUFFIX}@university.edu`,
        password: passwordHash,
        role: 'COLLEGE_ADMIN',
        collegeId: college.id,
        managedCollegeId: college.id,
      },
    });
    cleanup.trackUser(collegeAdmin.id);
    const collegeAdminToken = generateAccessToken(collegeAdmin.id, collegeAdmin.tokenVersion);

    const deptAdmin = await prisma.user.create({
      data: {
        email: `da_${SUFFIX}@university.edu`,
        password: passwordHash,
        role: 'DEPARTMENT_ADMIN',
        departmentId: department.id,
        managedDepartmentId: department.id,
      },
    });
    cleanup.trackUser(deptAdmin.id);
    const deptAdminToken = generateAccessToken(deptAdmin.id, deptAdmin.tokenVersion);

    const doctorUser = await prisma.user.create({
      data: {
        email: `doc_${SUFFIX}@university.edu`,
        password: passwordHash,
        role: 'DOCTOR',
        departmentId: department.id,
      },
    });
    cleanup.trackUser(doctorUser.id);
    const doctorToken = generateAccessToken(doctorUser.id, doctorUser.tokenVersion);

    const studentUser = await prisma.user.create({
      data: {
        email: `student_${SUFFIX}@university.edu`,
        password: passwordHash,
        role: 'STUDENT',
        departmentId: department.id,
      },
    });
    cleanup.trackUser(studentUser.id);
    const studentToken = generateAccessToken(studentUser.id, studentUser.tokenVersion);

    // 2. Test POST /api/rooms (SUPER_ADMIN only)
    // Case A: Non-superadmin is rejected with 403
    const caPostRes = await fetch(`${baseUrl}/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${collegeAdminToken}`,
      },
      body: JSON.stringify({ name: `Hall A ${SUFFIX}` }),
    });
    assert.equal(caPostRes.status, 403, 'COLLEGE_ADMIN cannot POST /api/rooms');

    const daPostRes = await fetch(`${baseUrl}/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deptAdminToken}`,
      },
      body: JSON.stringify({ name: `Hall A ${SUFFIX}` }),
    });
    assert.equal(daPostRes.status, 403, 'DEPARTMENT_ADMIN cannot POST /api/rooms');

    // Case B: Validation error on empty name
    const badNameRes = await fetch(`${baseUrl}/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ name: '   ' }),
    });
    assert.ok([400, 422].includes(badNameRes.status), 'Empty or whitespace room name must fail validation');

    // Case C: SUPER_ADMIN successfully creates room
    const createRes = await fetch(`${baseUrl}/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ name: `  Hall Alpha ${SUFFIX}  ` }),
    });
    assert.equal(createRes.status, 201, `SUPER_ADMIN create room must return 201: ${await createRes.clone().text()}`);
    const createdJson = await createRes.json();
    assert.equal(createdJson.success, true);
    assert.equal(createdJson.data.name, `Hall Alpha ${SUFFIX}`, 'Room name must be trimmed');
    assert.equal(createdJson.data.isActive, true, 'Room.isActive must default to true');
    const roomId = createdJson.data.id;
    cleanup.trackRoom(roomId);

    // Case D: Case-insensitive unique name conflict
    const dupRes = await fetch(`${baseUrl}/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ name: `hall alpha ${SUFFIX}` }),
    });
    assert.ok([400, 409, 422].includes(dupRes.status), 'Duplicate case-insensitive room name must be rejected');

    // Verify AuditLog for create
    const createAudit = await prisma.auditLog.findFirst({
      where: {
        action: 'CREATE_ROOM',
        entityId: String(roomId),
      },
    });
    assert.ok(createAudit, 'AuditLog must be recorded on room creation');

    // Create a second room and mark it inactive for list tests
    const createInactiveRes = await fetch(`${baseUrl}/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ name: `Hall Beta Inactive ${SUFFIX}`, isActive: false }),
    });
    assert.equal(createInactiveRes.status, 201);
    const inactiveJson = await createInactiveRes.json();
    cleanup.trackRoom(inactiveJson.data.id);
    assert.equal(inactiveJson.data.isActive, false);

    // 3. Test GET /api/rooms (Role authorization, search, pagination, includeInactive)
    // Case A: DOCTOR and STUDENT are rejected with 403
    const docGet = await fetch(`${baseUrl}/rooms`, {
      headers: { Authorization: `Bearer ${doctorToken}` },
    });
    assert.equal(docGet.status, 403, 'DOCTOR cannot GET /api/rooms');

    const studentGet = await fetch(`${baseUrl}/rooms`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(studentGet.status, 403, 'STUDENT cannot GET /api/rooms');

    // Case B: SUPER_ADMIN, COLLEGE_ADMIN, DEPARTMENT_ADMIN can access
    const saGet = await fetch(`${baseUrl}/rooms`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(saGet.status, 200, 'SUPER_ADMIN can GET /api/rooms');
    const saData = await saGet.json();
    assert.equal(saData.success, true);
    assert.ok(Array.isArray(saData.data.rooms || saData.data));

    const caGet = await fetch(`${baseUrl}/rooms`, {
      headers: { Authorization: `Bearer ${collegeAdminToken}` },
    });
    assert.equal(caGet.status, 200, 'COLLEGE_ADMIN can GET /api/rooms');

    const daGet = await fetch(`${baseUrl}/rooms`, {
      headers: { Authorization: `Bearer ${deptAdminToken}` },
    });
    assert.equal(daGet.status, 200, 'DEPARTMENT_ADMIN can GET /api/rooms');

    // Case C: Default excludes inactive rooms
    const defaultSearchRes = await fetch(`${baseUrl}/rooms?search=${encodeURIComponent(SUFFIX)}`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(defaultSearchRes.status, 200);
    const defaultSearchData = await defaultSearchRes.json();
    const defaultRooms = defaultSearchData.data.rooms || defaultSearchData.data;
    const foundActive = defaultRooms.find((r: any) => r.id === roomId);
    const foundInactive = defaultRooms.find((r: any) => r.id === inactiveJson.data.id);
    assert.ok(foundActive, 'Active room must be returned by default');
    assert.equal(foundInactive, undefined, 'Inactive room must NOT be returned without includeInactive=true');

    // Case D: includeInactive=true includes inactive rooms
    const incSearchRes = await fetch(`${baseUrl}/rooms?search=${encodeURIComponent(SUFFIX)}&includeInactive=true`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(incSearchRes.status, 200);
    const incSearchData = await incSearchRes.json();
    const incRooms = incSearchData.data.rooms || incSearchData.data;
    const foundInactiveInc = incRooms.find((r: any) => r.id === inactiveJson.data.id);
    assert.ok(foundInactiveInc, 'Inactive room must be returned when includeInactive=true');

    // Case E: Optional query filter hardening check: ?search=&includeInactive= with valid pagination
    const emptyFilterRes = await fetch(`${baseUrl}/rooms?search=&includeInactive=&page=1&limit=10`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(emptyFilterRes.status, 200, 'Empty optional query filter string must be handled without error');

    // 4. Test PATCH /api/rooms/:id (SUPER_ADMIN only)
    // Case A: Non-superadmin is rejected with 403
    const caPatchRes = await fetch(`${baseUrl}/rooms/${roomId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${collegeAdminToken}`,
      },
      body: JSON.stringify({ name: `Renamed Room ${SUFFIX}` }),
    });
    assert.equal(caPatchRes.status, 403, 'COLLEGE_ADMIN cannot PATCH /api/rooms/:id');

    // Case B: SUPER_ADMIN updates room name and isActive
    const patchRes = await fetch(`${baseUrl}/rooms/${roomId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ name: `  Hall Alpha Renamed ${SUFFIX}  `, isActive: false }),
    });
    assert.equal(patchRes.status, 200, `SUPER_ADMIN patch room must return 200: ${await patchRes.clone().text()}`);
    const patchJson = await patchRes.json();
    assert.equal(patchJson.data.name, `Hall Alpha Renamed ${SUFFIX}`, 'Renamed room name must be trimmed');
    assert.equal(patchJson.data.isActive, false, 'isActive must be updated to false');

    // Verify AuditLog for update
    const updateAudit = await prisma.auditLog.findFirst({
      where: {
        action: 'UPDATE_ROOM',
        entityId: String(roomId),
      },
    });
    assert.ok(updateAudit, 'AuditLog must be recorded on room update');

    // 5. Test Legacy Route & Route Ordering: PATCH /api/rooms/:id/coordinates
    // Must remain functional per OD-30
    const coordRes = await fetch(`${baseUrl}/rooms/${roomId}/coordinates`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ latitude: 30.0444, longitude: 31.2357 }),
    });
    assert.equal(coordRes.status, 200, `Legacy PATCH /api/rooms/:id/coordinates must work: ${await coordRes.clone().text()}`);
    const coordJson = await coordRes.json();
    assert.equal(coordJson.data.latitude, 30.0444);
    assert.equal(coordJson.data.longitude, 31.2357);
  } finally {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    }
    await cleanup.teardown(prisma);
  }
});
