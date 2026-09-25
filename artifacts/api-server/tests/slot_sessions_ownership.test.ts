import assert from 'node:assert/strict';
import http from 'node:http';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'slot-sessions-ownership-test-secret-2026';

const [
  { default: app },
  { default: prisma },
  { generateAccessToken },
  { AttendanceSessionService },
] = await Promise.all([
  import('../src/app'),
  import('../src/utils/prismaClient'),
  import('../src/utils/jwt.utils'),
  import('../src/services/attendance-session.service'),
]);

const originalUserFindUnique = prisma.user.findUnique;
const originalDoctorFindUnique = prisma.doctor.findUnique;
const originalSlotFindUnique = prisma.scheduleSlot.findUnique;
const originalSessionFindMany = prisma.attendanceSession.findMany;
const originalSessionCount = prisma.attendanceSession.count;

// Doctor 1 (id: 101, userId: 1)
// Doctor 2 (id: 102, userId: 2)
// Slot 500 belongs to Doctor 1 (doctorId: 101)
(prisma.scheduleSlot.findUnique as any) = async ({ where }: any) => {
  if (where.id === 500) {
    return {
      id: 500,
      doctorId: 101,
      teachingAssistantId: null,
      courseId: 10,
    };
  }
  return null;
};

(prisma.doctor.findUnique as any) = async ({ where }: any) => {
  if (where.userId === 1) return { id: 101, userId: 1 };
  if (where.userId === 2) return { id: 102, userId: 2 };
  return null;
};

(prisma.user.findUnique as any) = async ({ where }: any) => {
  if (where.id === 1) {
    return { id: 1, email: 'dr1@example.test', role: 'DOCTOR', tokenVersion: 0, isActive: true };
  }
  if (where.id === 2) {
    return { id: 2, email: 'dr2@example.test', role: 'DOCTOR', tokenVersion: 0, isActive: true };
  }
  return null;
};

(prisma.attendanceSession.findMany as any) = async () => [];
(prisma.attendanceSession.count as any) = async () => 0;

// 1. Direct Service Level Ownership Verification
const doctor1Actor = { id: 1, email: 'dr1@example.test', role: 'DOCTOR' as const };
const doctor2Actor = { id: 2, email: 'dr2@example.test', role: 'DOCTOR' as const };

// Doctor 2 attempting to view sessions for Slot 500 (taught by Doctor 1) must be rejected with 403
await assert.rejects(
  async () => {
    await AttendanceSessionService.getSlotSessions(doctor2Actor, 500);
  },
  (err: any) => {
    assert.equal(err.statusCode, 403);
    assert.match(err.message, /Not authorized to view sessions for this slot/);
    return true;
  },
  'Doctor 2 must not be allowed to view sessions for a slot taught by Doctor 1'
);

// Doctor 1 viewing their own slot sessions must succeed
const ownSessions = await AttendanceSessionService.getSlotSessions(doctor1Actor, 500);
assert.deepEqual(ownSessions.data, []);

// 2. HTTP Endpoint Verification
const server = http.createServer(app);
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address() as any;
const baseUrl = `http://127.0.0.1:${address.port}/api`;
const doctor1Token = generateAccessToken(1, 0);
const doctor2Token = generateAccessToken(2, 0);

try {
  // Doctor 2 requests Slot 500 over HTTP -> 403 Forbidden
  const resForbidden = await fetch(`${baseUrl}/attendance/slot/500/sessions`, {
    headers: { authorization: `Bearer ${doctor2Token}` },
  });
  assert.equal(resForbidden.status, 403, 'Unauthorized doctor must receive 403 on /slot/:slotId/sessions');
  const jsonForbidden = (await resForbidden.json()) as any;
  assert.equal(jsonForbidden.success, false);

  // Doctor 1 requests Slot 500 over HTTP -> 200 OK
  const resSuccess = await fetch(`${baseUrl}/attendance/slot/500/sessions`, {
    headers: { authorization: `Bearer ${doctor1Token}` },
  });
  assert.equal(resSuccess.status, 200, 'Assigned doctor must receive 200 on /slot/:slotId/sessions');
  const jsonSuccess = (await resSuccess.json()) as any;
  assert.equal(jsonSuccess.success, true);
} finally {
  prisma.user.findUnique = originalUserFindUnique;
  prisma.doctor.findUnique = originalDoctorFindUnique;
  prisma.scheduleSlot.findUnique = originalSlotFindUnique;
  prisma.attendanceSession.findMany = originalSessionFindMany;
  prisma.attendanceSession.count = originalSessionCount;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
}

console.log('BUG-2: getSlotSessions ownership security checks passed');
