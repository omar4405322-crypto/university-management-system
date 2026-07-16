import prisma from './utils/prismaClient.js';
import { autoDivideStudents } from './controllers/studentGroups.controller.js';

// Mock Express req/res
const req: any = {
  params: { departmentId: '1' },
  body: { numberOfGroups: 4 }
};

const res: any = {
  status: (code: number) => {
    console.log('HTTP Status:', code);
    return res;
  },
  json: (data: any) => {
    console.log('Response JSON:', JSON.stringify(data, null, 2));
    return res;
  }
};

async function run() {
  console.log('Running autoDivideStudents test...');
  try {
    await autoDivideStudents(req, res);
  } catch (err) {
    console.error('Fatal error during test execution:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
