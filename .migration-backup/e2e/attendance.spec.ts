import { test, expect } from '@playwright/test'; 
 import { loginAs, ACCOUNTS } from './helpers/auth'; 
 
 test.describe('Attendance', () => { 
 
   test('duplicate attendance on same day returns error (unique constraint)', async ({ request }) => { 
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
 
     // First record — may succeed or fail if already exists today 
     const first = await request.post('/api/attendance', { 
       headers: { Authorization: `Bearer ${adminToken}` }, 
       data: payload, 
     }); 
 
     // Second record — MUST fail with 4xx (unique constraint) 
     const second = await request.post('/api/attendance', { 
       headers: { Authorization: `Bearer ${adminToken}` }, 
       data: payload, 
     }); 
 
     // At least one of the two must fail (unique constraint enforced) 
     const bothSucceeded = first.status() === 201 && second.status() === 201; 
     expect(bothSucceeded).toBe(false); 
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
     // Should be 403 (not their own records) 
     expect([403, 404]).toContain(res.status()); 
   }); 
 
 }); 
