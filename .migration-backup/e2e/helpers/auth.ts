import { APIRequestContext } from '@playwright/test'; 
 
 export async function loginAs( 
   request: APIRequestContext, 
   email: string, 
   password: string 
 ): Promise<string> { 
   const res = await request.post('/api/auth/login', { 
     data: { email, password }, 
   }); 
   const body = await res.json(); 
   return body.data.accessToken; 
 } 
 
 export const ACCOUNTS = { 
   superAdmin: { email: 'superadmin@university.com', password: 'SuperAdmin123!' }, 
   doctor:     { email: 'doctor@university.com',     password: 'Password123!' }, 
   student:    { email: 'student@university.com',    password: 'Password123!' }, 
 }; 
