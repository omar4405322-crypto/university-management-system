import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function runQuery(sql: string) {
  try {
    const result = await prisma.$queryRawUnsafe(sql);
    console.log(JSON.stringify(result, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
  } catch (error) {
    console.error('Error running SQL:', error);
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--file' && args[1]) {
    const filePath = path.resolve(args[1]);
    const sql = fs.readFileSync(filePath, 'utf8');
    await runQuery(sql);
  } else if (args[0] === '--query' && args[1]) {
    await runQuery(args[1]);
  } else {
    console.error('Usage: ts-node run_sql.ts --file <path> OR --query "<sql>"');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
