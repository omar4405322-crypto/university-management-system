require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main(){
  const pass = await bcrypt.hash('CollegeAdmin123!',10);
  const pass2 = await bcrypt.hash('DeptAdmin123!',10);

  await prisma.user.upsert({
    where: { email: 'collegeadmin@university.com' },
    update: { role: 'COLLEGE_ADMIN', managedCollegeId: 1, password: pass },
    create: { email: 'collegeadmin@university.com', password: pass, role: 'COLLEGE_ADMIN', managedCollegeId: 1 }
  });

  await prisma.user.upsert({
    where: { email: 'departmentadmin@university.com' },
    update: { role: 'DEPARTMENT_ADMIN', managedDepartmentId: 1, password: pass2 },
    create: { email: 'departmentadmin@university.com', password: pass2, role: 'DEPARTMENT_ADMIN', managedDepartmentId: 1 }
  });

  console.log('Created test admins');
}

main().then(()=> process.exit(0)).catch(e=>{ console.error(e); process.exit(1)}).finally(()=> prisma.$disconnect());
