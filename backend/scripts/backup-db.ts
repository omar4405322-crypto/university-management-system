import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const backupDir = path.join(__dirname, '../backups');
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFile = path.join(backupDir, `backup-${timestamp}.sql`);

// Parse DATABASE_URL
const dbUrl = process.env.DATABASE_URL!;
const match = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
if (!match) {
  console.error('❌ Could not parse DATABASE_URL');
  process.exit(1);
}

const [, user, password, host, port, database] = match;

console.log(`📦 Backing up database "${database}" to:`);
console.log(`   ${backupFile}`);

try {
  process.env.PGPASSWORD = password;
  execSync(
    `pg_dump -h ${host} -p ${port} -U ${user} -d ${database} -f "${backupFile}" --no-password`,
    { stdio: 'inherit' }
  );
  
  const stats = fs.statSync(backupFile);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
  console.log(`✅ Backup complete! Size: ${sizeMB} MB`);
  console.log(`   File: ${backupFile}`);
} catch (err) {
  console.error('❌ Backup failed:', err);
  console.log('💡 Make sure pg_dump is installed (comes with PostgreSQL)');
  process.exit(1);
}
