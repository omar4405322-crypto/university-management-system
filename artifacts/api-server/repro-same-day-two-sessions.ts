import 'dotenv/config';
import speakeasy from 'speakeasy';
import prisma from './src/utils/prismaClient.js';
import attendanceEngine from './src/attendance/attendance.engine.js';

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log('[REPRO] Looking up some existing entities...');

  const college = await prisma.college.findFirst();
  if (!college) {
    console.error('[REPRO] No college in DB. Run seed first.');
    process.exit(1);
  }

  const department = await prisma.department.findFirst({ where: { collegeId: college.id } });
  if (!department) {
    console.error('[REPRO] No department in DB. Run seed first.');
    process.exit(2);
  }

  let student = await prisma.student.findFirst({ where: { departmentId: department.id } });
  if (!student) {
    student = await prisma.student.create({
      data: {
        studentId: `REPRO-${Date.now()}`,
        firstName: 'Repro',
        lastName: 'Student',
        gender: 'MALE',
        nationality: 'EG',
        email: `repro-${Date.now()}@example.com`,
        phone: `01${Date.now().toString().slice(-9)}`,
        department: { connect: { id: department.id } },
      },
    });
    console.log(`[REPRO] Created repro student id=${student.id}`);
  } else {
    console.log(`[REPRO] Using existing student id=${student.id}`);
  }

  let course = await prisma.course.findFirst({ where: { departmentId: department.id } });
  if (!course) {
    course = await prisma.course.create({
      data: {
        name: 'Repro Course Same-Day Two Sessions',
        code: `REPRO-${Date.now()}`,
        creditHours: 3,
        department: { connect: { id: department.id } },
        college: { connect: { id: college.id } },
      },
    });
    console.log(`[REPRO] Created repro course id=${course.id}`);
  } else {
    console.log(`[REPRO] Using existing course id=${course.id}`);
  }

  let group = await prisma.studentGroup.findFirst();
  if (!group) {
    group = await prisma.studentGroup.create({
      data: {
        name: `Repro Group ${Date.now()}`,
        department: { connect: { id: department.id } },
      },
    });
  }

  // Ensure enrollment
  await prisma.enrollment.upsert({
    where: {
      studentId_courseId_semester_academicYear: {
        studentId: student.id,
        courseId: course.id,
        semester: 1,
        academicYear: 2025,
      },
    },
    create: {
      student: { connect: { id: student.id } },
      course: { connect: { id: course.id } },
      semester: 1,
      academicYear: 2025,
      status: 'ENROLLED',
    },
    update: { status: 'ENROLLED' },
  });

  // Delete any previous repro attendance for this student + today for clean repro
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  await prisma.attendance.deleteMany({
    where: { studentId: student.id, date: today },
  });

  // Create schedule slots for today (two slots = two sessions for the same course same day)
  const nowHour = new Date().getHours();
  const dowMap: Record<number, string> = {
    0: 'SUNDAY', 1: 'MONDAY', 2: 'TUESDAY', 3: 'WEDNESDAY', 4: 'THURSDAY', 5: 'FRIDAY', 6: 'SATURDAY',
  };
  const dowStr = dowMap[today.getDay()] || 'WEDNESDAY';

  const slot1 = await prisma.scheduleSlot.create({
    data: {
      course: { connect: { id: course.id } },
      group: { connect: { id: group.id } },
      dayOfWeek: dowStr,
      startTime: `${String(Math.max(8, nowHour - 2)).padStart(2, '0')}:00`,
      endTime: `${String(Math.max(8, nowHour - 2) + 1).padStart(2, '0')}:00`,
      slotType: 'LECTURE',
    },
  });
  const slot2 = await prisma.scheduleSlot.create({
    data: {
      course: { connect: { id: course.id } },
      group: { connect: { id: group.id } },
      dayOfWeek: dowStr,
      startTime: `${String(Math.max(9, nowHour - 1)).padStart(2, '0')}:00`,
      endTime: `${String(Math.max(9, nowHour - 1) + 1).padStart(2, '0')}:00`,
      slotType: 'LECTURE',
    },
  });
  console.log(`[REPRO] Created slot1 id=${slot1.id} slot2 id=${slot2.id} for course id=${course.id}`);

  // Start two AttendanceSessions (same doctor = same user, but we need a User record with a doctor)
  // Use any existing user with doctor role or any admin user; fallback to first user in DB
  let user = await prisma.user.findFirst({ where: { role: { in: ['ADMIN', 'DOCTOR'] } } });
  if (!user) {
    console.error('[REPRO] No ADMIN/DOCTOR user in DB. Run seed first.');
    process.exit(3);
  }

  let doctor = await prisma.doctor.findFirst();
  if (!doctor) {
    doctor = await prisma.doctor.create({
      data: {
        title: 'DR',
        user: { connect: { id: user.id } },
        department: { connect: { id: department.id } },
      },
    });
  }

  const session1 = await prisma.attendanceSession.create({
    data: {
      scheduleSlot: { connect: { id: slot1.id } },
      doctor: { connect: { id: doctor.id } },
      isActive: true,
      secretKey: 'repro-secret-1',
      radius: 120,
      codeStepSeconds: 20,
      latitude: 30.0444,
      longitude: 31.2357,
      gracePeriodMins: 15,
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  const session2 = await prisma.attendanceSession.create({
    data: {
      scheduleSlot: { connect: { id: slot2.id } },
      doctor: { connect: { id: doctor.id } },
      isActive: true,
      secretKey: 'repro-secret-2',
      radius: 120,
      codeStepSeconds: 20,
      latitude: 30.0444,
      longitude: 31.2357,
      gracePeriodMins: 15,
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  console.log(`[REPRO] Created session1 id=${session1.id} session2 id=${session2.id}`);

  // Simulate QR check-in for session 1
  console.log('[REPRO] Calling engine.recordAttendance for session 1 via QR...');
  const token1 = speakeasy.totp({ secret: session1.secretKey, encoding: 'base32', step: 20 });
  try {
    const r1 = await attendanceEngine.recordAttendance({
      method: 'QR',
      payload: {
        studentId: student.id,
        token: token1,
        sessionId: session1.id,
        latitude: 30.0444,
        longitude: 31.2357,
        deviceId: 'repro-device-1',
      },
      ctx: { userId: user.id, ipAddress: '127.0.0.1', sessionId: session1.id, studentId: student.id },
    });
    console.log('[REPRO] session 1 QR check-in OK:', {
      attendanceId: r1.attendance.id,
      method: r1.attendance.method,
      status: r1.attendance.status,
      sessionId: r1.attendance.sessionId,
    });
  } catch (err: any) {
    console.error('[REPRO] session 1 QR check-in FAILED unexpectedly:', err.message, err.stack);
    process.exit(4);
  }

  await sleep(200);

  // Simulate QR check-in for session 2 — THIS IS WHERE THE UNIQUE CONSTRAINT USED TO FIRE
  console.log('[REPRO] Calling engine.recordAttendance for session 2 via QR (crash scenario before fix)...');
  const token2 = speakeasy.totp({ secret: session2.secretKey, encoding: 'base32', step: 20 });
  try {
    const r2 = await attendanceEngine.recordAttendance({
      method: 'QR',
      payload: {
        studentId: student.id,
        token: token2,
        sessionId: session2.id,
        latitude: 30.0444,
        longitude: 31.2357,
        deviceId: 'repro-device-1',
      },
      ctx: { userId: user.id, ipAddress: '127.0.0.1', sessionId: session2.id, studentId: student.id },
    });
    console.log('[REPRO] session 2 QR check-in OK (FIX WORKS):', {
      attendanceId: r2.attendance.id,
      method: r2.attendance.method,
      status: r2.attendance.status,
      sessionId: r2.attendance.sessionId,
    });
  } catch (err: any) {
    if (/Unique constraint failed.*studentId.*courseId.*date/.test(err.message) ||
        /Unique constraint failed.*\(`studentId`, `courseId`, `date`\)/.test(err.message)) {
      console.error('[REPRO] FAIL — session 2 hit the unique constraint (BUG NOT FIXED):', err.message);
      process.exit(5);
    }
    console.error('[REPRO] session 2 failed with DIFFERENT error:', err.message, err.stack);
    process.exit(6);
  }

  console.log('[REPRO] Manual mark session 2 student to LATE (LATE→PRESENT bug repro path)...');
  const rManual = await attendanceEngine.recordAttendance({
    method: 'MANUAL',
    payload: {
      studentId: student.id,
      status: 'LATE',
      sessionId: session2.id,
    },
    ctx: { userId: user.id, ipAddress: '127.0.0.1', sessionId: session2.id, studentId: student.id },
  });
  console.log('[REPRO] Manual LATE session 2 OK:', {
    attendanceId: rManual.attendance.id,
    method: rManual.attendance.method,
    status: rManual.attendance.status,
    sessionId: rManual.attendance.sessionId,
  });

  console.log('[REPRO] Manual mark back to PRESENT (regression for old Task 2 fix check)...');
  const rManual2 = await attendanceEngine.recordAttendance({
    method: 'MANUAL',
    payload: {
      studentId: student.id,
      status: 'PRESENT',
      sessionId: session2.id,
    },
    ctx: { userId: user.id, ipAddress: '127.0.0.1', sessionId: session2.id, studentId: student.id },
  });
  console.log('[REPRO] Manual PRESENT session 2 OK:', {
    attendanceId: rManual2.attendance.id,
    status: rManual2.attendance.status,
    wasChange: rManual2.isNew,
  });

  console.log('[REPRO] ALL PASSED. Cleaning up repro sessions/slots...');
  try {
    await prisma.attendance.deleteMany({ where: { studentId: student.id, date: today } });
    await prisma.attendanceSession.deleteMany({ where: { id: { in: [session1.id, session2.id] } } });
    await prisma.scheduleSlot.deleteMany({ where: { id: { in: [slot1.id, slot2.id] } } });
    console.log('[REPRO] Cleanup done.');
  } catch (err: any) {
    console.warn('[REPRO] Cleanup non-fatal error:', err.message);
  }
}

run()
  .catch((err) => {
    console.error('[REPRO] Unhandled:', err.message, err.stack);
    process.exit(99);
  })
  .finally(() => prisma.$disconnect());
