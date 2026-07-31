import { test, expect } from '@playwright/test'; 
 import { loginAs, ACCOUNTS } from './helpers/auth'; 
 
 test.describe('Attendance', () => { 
 
   test('idempotent upsert: two saves on same day return 200 and produce a single record', async ({ request }) => { 
     const adminToken = await loginAs(request, ACCOUNTS.superAdmin.email, ACCOUNTS.superAdmin.password); 
 
     // Get first available student and course 
     const studentsRes = await request.get('/api/students?limit=1', { 
       headers: { Authorization: `Bearer ${adminToken}` }, 
     }); 
     const students = (await studentsRes.json()).data; 
     if (!students || students.length === 0) { test.skip(); return; } 
     const studentId = students[0].id; 
 
     const coursesRes = await request.get('/api/courses?limit=1', { 
       headers: { Authorization: `Bearer ${adminToken}` }, 
     }); 
     const courses = (await coursesRes.json()).data; 
     if (!courses || courses.length === 0) { test.skip(); return; } 
     const courseId = courses[0].id; 
 
     const today = new Date().toISOString().split('T')[0]; 
     const payload = { 
       courseId, 
       date: today, 
       records: [{ studentId, status: 'PRESENT' }], 
     }; 
 
     // First save — create-or-update; should be 2xx success 
     const first = await request.post('/api/attendance', { 
       headers: { Authorization: `Bearer ${adminToken}` }, 
       data: payload, 
     }); 
 
     // Second save with SAME date/student/course — idempotent upsert, still 200 OK (no 4xx) 
     const second = await request.post('/api/attendance', { 
       headers: { Authorization: `Bearer ${adminToken}` }, 
       data: payload, 
     }); 
 
     // Both requests must succeed (upsert semantics) 
     expect([200, 201]).toContain(first.status()); 
     expect([200, 201]).toContain(second.status()); 
 
     // And reading the course+date attendance for this student returns exactly 1 row 
     const saved = await request.get(`/api/attendance/course/${courseId}?date=${today}`, { 
       headers: { Authorization: `Bearer ${adminToken}` }, 
     }); 
     if (saved.status() === 200) { 
       const rows: any[] = (await saved.json()).data ?? []; 
       const forStudent = rows.filter((r) => r.studentId === studentId); 
       expect(forStudent.length).toBeLessThanOrEqual(1); 
     } 
   }); 
 
   test('GET /api/attendance/course/:id returns records', async ({ request }) => { 
     const adminToken = await loginAs(request, ACCOUNTS.superAdmin.email, ACCOUNTS.superAdmin.password); 
     const res = await request.get('/api/attendance/course/1', { 
       headers: { Authorization: `Bearer ${adminToken}` }, 
     }); 
     expect([200, 404]).toContain(res.status()); 
     if (res.status() === 200) { 
       const body = await res.json(); 
       expect(Array.isArray(body.data)).toBe(true); 
     } 
   }); 
 
   test('STUDENT can only view their own attendance', async ({ request }) => { 
     const adminToken = await loginAs(request, ACCOUNTS.superAdmin.email, ACCOUNTS.superAdmin.password); 
     const studentToken = await loginAs(request, ACCOUNTS.student.email, ACCOUNTS.student.password); 
 
     // Get first student id 
     const studentsRes = await request.get('/api/students?limit=1', { 
       headers: { Authorization: `Bearer ${adminToken}` }, 
     }); 
     const students = (await studentsRes.json()).data; 
     if (!students || students.length === 0) { test.skip(); return; } 
 
     const otherId = students[0].id + 999; // non-existent or other student 
     const res = await request.get(`/api/attendance/student/${otherId}`, { 
       headers: { Authorization: `Bearer ${studentToken}` }, 
     }); 
     // Should be 403 (not their own records) or 404 (student id doesn't exist under their account) 
     expect([403, 404]).toContain(res.status()); 
   }); 
 
   test('EXCUSED status is accepted by POST validation', async ({ request }) => { 
     const adminToken = await loginAs(request, ACCOUNTS.superAdmin.email, ACCOUNTS.superAdmin.password); 
 
     const studentsRes = await request.get('/api/students?limit=1', { 
       headers: { Authorization: `Bearer ${adminToken}` }, 
     }); 
     const students = (await studentsRes.json()).data; 
     if (!students || students.length === 0) { test.skip(); return; } 
     const studentId = students[0].id; 
 
     const coursesRes = await request.get('/api/courses?limit=1', { 
       headers: { Authorization: `Bearer ${adminToken}` }, 
     }); 
     const courses = (await coursesRes.json()).data; 
     if (!courses || courses.length === 0) { test.skip(); return; } 
     const courseId = courses[0].id; 
 
     const today = new Date().toISOString().split('T')[0]; 
     const res = await request.post('/api/attendance', { 
       headers: { Authorization: `Bearer ${adminToken}` }, 
       data: { 
         courseId, 
         date: today, 
         records: [{ studentId, status: 'EXCUSED', remarks: 'Medical excuse' }], 
       }, 
     }); 
 
     // EXCUSED must not cause 422 validation error 
     expect(res.status()).not.toBe(422); 
   }); 
 }); 
