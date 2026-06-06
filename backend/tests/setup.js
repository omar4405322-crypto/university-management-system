const { execSync } = require('child_process'); 
require('dotenv').config({ path: '.env.test' }); 

module.exports = async () => { 
  process.env.DATABASE_URL = process.env.DATABASE_URL; 
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
