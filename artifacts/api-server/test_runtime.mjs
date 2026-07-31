import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

const signToken = (user) => {
  return jwt.sign({ id: user.id, tokenVersion: user.tokenVersion }, process.env.JWT_SECRET || 'secret', {
    expiresIn: '1d',
    issuer: 'Smart University Platform',
    audience: 'University Users'
  });
};

const run = async () => {
  const doctors = await prisma.user.findMany({ include: { doctor: true }, where: { role: 'DOCTOR' }, take: 2 });
  if (doctors.length < 2) {
      console.log('Not enough doctors in DB to test IDOR.');
      process.exit(0);
  }
  const doctorA = doctors[0];
  const doctorB = doctors[1];
  
  const tokenA = signToken(doctorA);
  const tokenB = signToken(doctorB);

  let slotA = await prisma.scheduleSlot.findFirst({ where: { doctorId: doctorA.doctor.id } });
  if (!slotA) {
      const course = await prisma.course.findFirst();
      slotA = await prisma.scheduleSlot.create({
          data: {
              doctorId: doctorA.doctor.id,
              courseId: course.id,
              dayOfWeek: 'MONDAY',
              startTime: '08:00',
              endTime: '22:00',
              slotType: 'LECTURE'
          }
      });
  }

  console.log("Starting session for Doctor A...");
  const startRes = await fetch('http://localhost:5000/api/attendance/session/start', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ scheduleSlotId: slotA.id })
  });
  
  const sessionData = await startRes.json();
  if (!sessionData.success) {
      console.log('Failed to start session', sessionData);
      process.exit(1);
  }
  const sessionId = sessionData.data.sessionId;
  console.log("Session ID:", sessionId);

  console.log("\n=== IDOR TEST ===");
  console.log("Doctor B trying to access Doctor A's session code...");
  const idorRes = await fetch(`http://localhost:5000/api/attendance/session/${sessionId}/current-code`, {
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });
  console.log('Doctor B status:', idorRes.status);
  console.log('Doctor B response:', await idorRes.json());

  console.log("\n=== DOUBLE SCAN TEST ===");
  const codeRes = await fetch(`http://localhost:5000/api/attendance/session/${sessionId}/current-code`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  const codeData = await codeRes.json();
  const token = codeData.data.token;
  console.log("Generated Token:", token);

  const student = await prisma.user.findFirst({ where: { role: 'STUDENT' } });
  const tokenStudent = signToken(student);

  const scanPayload = {
    sessionId,
    token,
    deviceId: 'test-device-1'
  };

  console.log("Student Scan 1...");
  const scan1 = await fetch('http://localhost:5000/api/attendance/scan-qr', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenStudent}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(scanPayload)
  });
  console.log('Scan 1 status:', scan1.status);
  console.log('Scan 1 response:', await scan1.json());

  console.log("\nStudent Scan 2 (Duplicate)...");
  const scan2 = await fetch('http://localhost:5000/api/attendance/scan-qr', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenStudent}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(scanPayload)
  });
  console.log('Scan 2 status:', scan2.status);
  console.log('Scan 2 response:', await scan2.json());

  process.exit(0);
};

run().catch(console.error);
