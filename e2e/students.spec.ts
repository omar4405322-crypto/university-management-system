import { test, expect } from '@playwright/test'; 
 import { loginAs, ACCOUNTS } from './helpers/auth'; 
 
 test.describe('Students CRUD', () => { 
 
   let adminToken: string; 
   let createdStudentId: number; 
 
   test.beforeAll(async ({ request }) => { 
     adminToken = await loginAs(request, ACCOUNTS.superAdmin.email, ACCOUNTS.superAdmin.password); 
   }); 
 
   test('GET /api/students returns paginated list', async ({ request }) => { 
     const res = await request.get('/api/students?page=1&limit=5', { 
       headers: { Authorization: `Bearer ${adminToken}` }, 
     }); 
     expect(res.status()).toBe(200); 
     const body = await res.json(); 
     expect(body.success).toBe(true); 
     expect(Array.isArray(body.data)).toBe(true); 
   }); 
 
   test('POST /api/students creates a student', async ({ request }) => { 
     const uniqueId = Date.now().toString().slice(-6); 
     const res = await request.post('/api/students', { 
       headers: { Authorization: `Bearer ${adminToken}` }, 
       data: { 
         email: `e2e.student.${uniqueId}@test.com`, 
         password: 'Password123!', 
         firstName: 'E2E', 
         lastName: 'Student', 
         studentId: `STU${uniqueId}`, 
         year: 1, 
         departmentId: 1, 
       }, 
     }); 
     expect(res.status()).toBe(201); 
     const body = await res.json(); 
     expect(body.success).toBe(true); 
     createdStudentId = body.data.id; 
   }); 
 
   test('GET /api/students/:id returns created student', async ({ request }) => { 
     if (!createdStudentId) test.skip(); 
     const res = await request.get(`/api/students/${createdStudentId}`, { 
       headers: { Authorization: `Bearer ${adminToken}` }, 
     }); 
     expect(res.status()).toBe(200); 
     const body = await res.json(); 
     expect(body.data.id).toBe(createdStudentId); 
   }); 
 
   test('PUT /api/students/:id updates student', async ({ request }) => { 
     if (!createdStudentId) test.skip(); 
     const res = await request.put(`/api/students/${createdStudentId}`, { 
       headers: { Authorization: `Bearer ${adminToken}` }, 
       data: { firstName: 'Updated', lastName: 'Name' }, 
     }); 
     expect(res.status()).toBe(200); 
     const body = await res.json(); 
     expect(body.success).toBe(true); 
   }); 
 
   test('DELETE /api/students/:id deletes student', async ({ request }) => { 
     if (!createdStudentId) test.skip(); 
     const res = await request.delete(`/api/students/${createdStudentId}`, { 
       headers: { Authorization: `Bearer ${adminToken}` }, 
     }); 
     expect(res.status()).toBe(200); 
   }); 
 
   test('GET /api/students/:id after delete returns 404', async ({ request }) => { 
     if (!createdStudentId) test.skip(); 
     const res = await request.get(`/api/students/${createdStudentId}`, { 
       headers: { Authorization: `Bearer ${adminToken}` }, 
     }); 
     expect(res.status()).toBe(404); 
   }); 
 
   test('STUDENT cannot access other students list', async ({ request }) => { 
     const studentToken = await loginAs(request, ACCOUNTS.student.email, ACCOUNTS.student.password); 
     const res = await request.get('/api/students', { 
       headers: { Authorization: `Bearer ${studentToken}` }, 
     }); 
     // Should be 403 forbidden 
     expect([403, 401]).toContain(res.status()); 
   }); 
 
 }); 
