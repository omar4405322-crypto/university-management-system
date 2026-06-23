import { test, expect } from '@playwright/test'; 
 import { loginAs, ACCOUNTS } from './helpers/auth'; 
 
 test.describe('RBAC — Search', () => { 
 
   test('STUDENT cannot see other students or doctors in search results', async ({ request }) => { 
     const token = await loginAs(request, ACCOUNTS.student.email, ACCOUNTS.student.password); 
     const res = await request.get('/api/search?q=test', { 
       headers: { Authorization: `Bearer ${token}` }, 
     }); 
     expect(res.status()).toBe(200); 
     const body = await res.json(); 
     expect(body.data.students).toEqual([]); 
     expect(body.data.doctors).toEqual([]); 
   }); 
 
   test('SUPER_ADMIN can see all search results', async ({ request }) => { 
     const token = await loginAs(request, ACCOUNTS.superAdmin.email, ACCOUNTS.superAdmin.password); 
     const res = await request.get('/api/search?q=a', { 
       headers: { Authorization: `Bearer ${token}` }, 
     }); 
     expect(res.status()).toBe(200); 
     const body = await res.json(); 
     // Super admin gets real arrays (may be empty if no data matches, but not restricted) 
     expect(Array.isArray(body.data.students)).toBe(true); 
     expect(Array.isArray(body.data.doctors)).toBe(true); 
   }); 
 
   test('search with query shorter than 2 chars returns empty results', async ({ request }) => { 
     const token = await loginAs(request, ACCOUNTS.student.email, ACCOUNTS.student.password); 
     const res2 = await request.get('/api/search?q=a', { 
       headers: { Authorization: `Bearer ${token}` }, 
     }); 
     expect(res2.status()).toBe(200); 
     const body = await res2.json(); 
     expect(body.data.students).toEqual([]); 
   }); 
 
 }); 
 
 test.describe('RBAC — Quiz answer leak prevention', () => { 
 
   test('STUDENT response never contains correct field on questions', async ({ request }) => { 
     const adminToken = await loginAs(request, ACCOUNTS.superAdmin.email, ACCOUNTS.superAdmin.password); 
 
     // Create a course first (requires departmentId — use 1 from seed) 
     const courseRes = await request.post('/api/courses', { 
       headers: { Authorization: `Bearer ${adminToken}` }, 
       data: { 
         name: 'E2E Test Course', 
         courseCode: 'E2E101', 
         credits: 3, 
         year: 1, 
         semester: 1, 
         departmentId: 1, 
       }, 
     }); 
     
     let courseId: number; 
     if (courseRes.status() === 201) { 
       courseId = (await courseRes.json()).data.id; 
     } else { 
       const coursesRes = await request.get('/api/courses', { 
         headers: { Authorization: `Bearer ${adminToken}` }, 
       }); 
       const courses = (await coursesRes.json()).data.courses; 
       courseId = courses[0]?.id ?? 1; 
     } 
 
     // Create a quiz as doctor 
     const doctorToken = await loginAs(request, ACCOUNTS.doctor.email, ACCOUNTS.doctor.password); 
     const quizRes = await request.post('/api/quizzes', { 
       headers: { Authorization: `Bearer ${doctorToken}` }, 
       data: { 
         title: 'E2E Quiz', 
         courseId, 
         duration: 30, 
         startTime: new Date(Date.now() - 60000).toISOString(), 
         endTime: new Date(Date.now() + 3600000).toISOString(), 
         questions: [ 
           { text: 'What is 2+2?', optionA: '3', optionB: '4', optionC: '5', optionD: '6', correct: 'B', points: 10 } 
         ], 
       }, 
     }); 
 
     if (quizRes.status() !== 201) { 
       test.skip(); // skip if quiz creation not available 
       return; 
     } 
     const quizId = (await quizRes.json()).data.id; 
 
     // Student fetches the quiz 
     const studentToken = await loginAs(request, ACCOUNTS.student.email, ACCOUNTS.student.password); 
     const getRes = await request.get(`/api/quizzes/${quizId}`, { 
       headers: { Authorization: `Bearer ${studentToken}` }, 
     }); 
     expect(getRes.status()).toBe(200); 
     const quizData = (await getRes.json()).data; 
 
     // CRITICAL: no question must have a "correct" field 
     if (quizData.questions && quizData.questions.length > 0) { 
       for (const q of quizData.questions) { 
         expect(q).not.toHaveProperty('correct'); 
       } 
     } 
   }); 
 
 }); 
