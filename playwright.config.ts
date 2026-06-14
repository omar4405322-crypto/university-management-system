import { defineConfig } from '@playwright/test'; 
 
 export default defineConfig({ 
   testDir: './e2e', 
   timeout: 30000, 
   retries: 1, 
   use: { 
     baseURL: 'http://localhost:5002', 
     extraHTTPHeaders: { 
       'Content-Type': 'application/json', 
     }, 
   }, 
   // API tests only — no browser needed 
   projects: [ 
     { 
       name: 'api', 
       use: {}, 
     }, 
   ], 
 }); 
