import {  execSync  } from 'child_process'; 
import dotenv from 'dotenv';
dotenv.config({ path: '.env.test' }); 

export default async () => { 
  if (!process.env.DATABASE_URL?.includes('test')) {
    throw new Error('TEST ABORTED: DATABASE_URL does not point to a test database. Set DATABASE_URL in .env.test');
  } 
  try { 
    execSync('npx prisma migrate deploy', { 
      env: { ...process.env }, 
      stdio: 'inherit' 
    }); 
  } catch (e) { 
    console.error('Migration failed:', e.message); 
    throw e; 
  } 
}; 
