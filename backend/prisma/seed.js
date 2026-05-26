require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const superAdminPassword = await bcrypt.hash('SuperAdmin123!', 10);
  const commonPassword = await bcrypt.hash('Password123!', 10);

  console.log('Seeding Colleges and Departments...');
  
  // 1. Colleges
  const industryCollege = await prisma.college.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: "College of Industry & Energy",
      nameAr: "كلية الصناعة والطاقة",
      description: "Focuses on modern industrial technologies and renewable energy."
    }
  });

  const healthCollege = await prisma.college.upsert({
    where: { id: 2 },
    update: {},
    create: {
      id: 2,
      name: "College of Health Sciences",
      nameAr: "كلية العلوم الصحية",
      description: "Dedicated to medical and healthcare education."
    }
  });

  // 2. Departments
  const ictDept = await prisma.department.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: "Information & Communication Technology",
      nameAr: "تكنولوجيا المعلومات والاتصالات",
      collegeId: industryCollege.id
    }
  });

  const mechDept = await prisma.department.upsert({
    where: { id: 2 },
    update: {},
    create: {
      id: 2,
      name: "Mechatronics Department",
      nameAr: "قسم الميكاترونيكس",
      collegeId: industryCollege.id
    }
  });

  const renewDept = await prisma.department.upsert({
    where: { id: 3 },
    update: {},
    create: {
      id: 3,
      name: "Renewable Energy Department",
      nameAr: "قسم الطاقة المتجددة",
      collegeId: industryCollege.id
    }
  });

  const nursingDept = await prisma.department.upsert({
    where: { id: 4 },
    update: {},
    create: {
      id: 4,
      name: "Nursing Department",
      nameAr: "قسم التمريض",
      collegeId: healthCollege.id
    }
  });

  const labsDept = await prisma.department.upsert({
    where: { id: 5 },
    update: {},
    create: {
      id: 5,
      name: "Medical Labs Department",
      nameAr: "قسم المختبرات الطبية",
      collegeId: healthCollege.id
    }
  });

  const railwayDept = await prisma.department.upsert({
    where: { id: 6 },
    update: {},
    create: {
      id: 6,
      name: "Railway Technology",
      nameAr: "تكنولوجيا السكك الحديدية",
      collegeId: industryCollege.id
    }
  });

  const autoDept = await prisma.department.upsert({
    where: { id: 7 },
    update: {},
    create: {
      id: 7,
      name: "Automotive Technology",
      nameAr: "تكنولوجيا السيارات",
      collegeId: industryCollege.id
    }
  });

  const emsDept = await prisma.department.upsert({
    where: { id: 8 },
    update: {},
    create: {
      id: 8,
      name: "Emergency Medical Services",
      nameAr: "خدمات الطوارئ الطبية",
      collegeId: healthCollege.id
    }
  });

  const prostheticsDept = await prisma.department.upsert({
    where: { id: 9 },
    update: {},
    create: {
      id: 9,
      name: "Prosthetics and Orthotics",
      nameAr: "الأطراف الصناعية والأجهزة التعويضية",
      collegeId: healthCollege.id
    }
  });

  const radiologyDept = await prisma.department.upsert({
    where: { id: 10 },
    update: {},
    create: {
      id: 10,
      name: "Radiology",
      nameAr: "الأشعة",
      collegeId: healthCollege.id
    }
  });

  console.log('Seeding Super Admin...');
  // 3. Super Admin
  await prisma.user.upsert({
    where: { email: 'superadmin@university.com' },
    update: { role: 'SUPER_ADMIN' },
    create: {
      email: 'superadmin@university.com',
      password: superAdminPassword,
      role: 'SUPER_ADMIN',
      adminRole: 'SUPER_ADMIN'
    }
  });

  console.log('Seeding ICT Curriculum (Year 1 Semester 1)...');
  // 4. ICT Curriculum Courses
  const coursesData = [
    { code: 'ICT101', name: 'Introduction to Programming', credits: 3 },
    { code: 'ICT102', name: 'Computer Architecture', credits: 3 },
    { code: 'MATH101', name: 'Calculus I', credits: 4 },
    { code: 'ENG101', name: 'English Composition I', credits: 3 },
    { code: 'PHY101', name: 'Physics for Engineers', credits: 4 },
  ];

  for (const course of coursesData) {
    await prisma.course.upsert({
      where: { courseCode: course.code },
      update: { 
        departmentId: ictDept.id,
        year: 1,
        semester: 1
      },
      create: {
        courseCode: course.code,
        name: course.name,
        credits: course.credits,
        departmentId: ictDept.id,
        year: 1,
        semester: 1
      }
    });
  }

  console.log('Seeding Sample Doctor and Student...');
  // 5. Sample Doctor
  const doctorUser = await prisma.user.upsert({
    where: { email: 'doctor@university.com' },
    update: {},
    create: {
      email: 'doctor@university.com',
      password: commonPassword,
      role: 'DOCTOR'
    }
  });

  await prisma.doctor.upsert({
    where: { userId: doctorUser.id },
    update: { 
      departmentId: ictDept.id,
      doctorId: 'DOC20260001'
    },
    create: {
      userId: doctorUser.id,
      firstName: 'Ahmed',
      lastName: 'Ali',
      doctorId: 'DOC20260001',
      departmentId: ictDept.id
    }
  });

  // 6. Sample Student
  const studentUser = await prisma.user.upsert({
    where: { email: 'student@university.com' },
    update: {},
    create: {
      email: 'student@university.com',
      password: commonPassword,
      role: 'STUDENT'
    }
  });

  const student = await prisma.student.upsert({
    where: { userId: studentUser.id },
    update: { 
      departmentId: ictDept.id,
      studentId: 'STU20260001'
    },
    create: {
      userId: studentUser.id,
      firstName: 'Omar',
      lastName: 'Hassan',
      studentId: 'STU20260001',
      departmentId: ictDept.id,
      enrolledAt: new Date()
    }
  });

  // 7. Enroll Student in Courses
  const ictCourses = await prisma.course.findMany({
    where: { departmentId: ictDept.id }
  });

  await prisma.student.update({
    where: { id: student.id },
    data: {
      courses: {
        connect: ictCourses.map(c => ({ id: c.id }))
      }
    }
  });

  console.log('Seed data created successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
