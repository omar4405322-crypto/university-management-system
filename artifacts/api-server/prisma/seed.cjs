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
  const adminPassword = await bcrypt.hash('Admin123!', 10);
  // 3. Super Admin
  await prisma.user.upsert({
    where: { email: 'superadmin@university.com' },
    update: { role: 'SUPER_ADMIN', adminRole: null, twoFactorEnabled: true },
    create: {
      email: 'superadmin@university.com',
      password: superAdminPassword,
      role: 'SUPER_ADMIN',
      twoFactorEnabled: true,
    }
  });

  // Admin account (matches README / login placeholder)
  await prisma.user.upsert({
    where: { email: 'admin@university.com' },
    update: { role: 'ADMIN', password: adminPassword, adminRole: null },
    create: {
      email: 'admin@university.com',
      password: adminPassword,
      role: 'ADMIN',
    },
  });

  // College Admin (scoped to College of Industry & Energy)
  await prisma.user.upsert({
    where: { email: 'collegeadmin@university.com' },
    update: {
      role: 'COLLEGE_ADMIN',
      password: commonPassword,
      managedCollegeId: industryCollege.id,
      collegeId: industryCollege.id,
      adminRole: null,
    },
    create: {
      email: 'collegeadmin@university.com',
      password: commonPassword,
      role: 'COLLEGE_ADMIN',
      managedCollegeId: industryCollege.id,
      collegeId: industryCollege.id,
    },
  });

  // Department Admin (scoped to Information & Communication Technology Department)
  await prisma.user.upsert({
    where: { email: 'deptadmin@university.com' },
    update: {
      role: 'DEPARTMENT_ADMIN',
      password: commonPassword,
      managedDepartmentId: ictDept.id,
      departmentId: ictDept.id,
      collegeId: industryCollege.id,
      adminRole: null,
    },
    create: {
      email: 'deptadmin@university.com',
      password: commonPassword,
      role: 'DEPARTMENT_ADMIN',
      managedDepartmentId: ictDept.id,
      departmentId: ictDept.id,
      collegeId: industryCollege.id,
    },
  });

  console.log('Seeding Comprehensive Curriculum Courses for All Departments...');
  const coursesData = [
    // ICT (Dept 1)
    { code: 'ICT101', name: 'Introduction to Programming', credits: 3, deptId: ictDept.id, yr: 1, sem: 1 },
    { code: 'ICT102', name: 'Computer Architecture', credits: 3, deptId: ictDept.id, yr: 1, sem: 1 },
    { code: 'MATH101', name: 'Calculus I', credits: 4, deptId: ictDept.id, yr: 1, sem: 1 },
    { code: 'ENG101', name: 'English Composition I', credits: 3, deptId: ictDept.id, yr: 1, sem: 1 },
    { code: 'PHY101', name: 'Physics for Engineers', credits: 4, deptId: ictDept.id, yr: 1, sem: 1 },
    { code: 'ICT103', name: 'Object-Oriented Programming', credits: 3, deptId: ictDept.id, yr: 1, sem: 2 },
    { code: 'ICT201', name: 'Data Structures & Algorithms', credits: 3, deptId: ictDept.id, yr: 2, sem: 1 },
    { code: 'ICT202', name: 'Database Management Systems', credits: 3, deptId: ictDept.id, yr: 2, sem: 2 },
    { code: 'ICT301', name: 'Computer Networks', credits: 3, deptId: ictDept.id, yr: 3, sem: 1 },
    { code: 'ICT302', name: 'Software Engineering', credits: 3, deptId: ictDept.id, yr: 3, sem: 2 },
    { code: 'ICT401', name: 'Cybersecurity Fundamentals', credits: 3, deptId: ictDept.id, yr: 4, sem: 1 },

    // Mechatronics (Dept 2)
    { code: 'MTR101', name: 'Circuit Analysis I', credits: 3, deptId: mechDept.id, yr: 1, sem: 1 },
    { code: 'MTR102', name: 'Applied Physics', credits: 3, deptId: mechDept.id, yr: 1, sem: 1 },
    { code: 'MTR103', name: 'Engineering Drawing', credits: 3, deptId: mechDept.id, yr: 1, sem: 1 },
    { code: 'MTR104', name: 'Engineering Mathematics I', credits: 4, deptId: mechDept.id, yr: 1, sem: 1 },
    { code: 'MTR105', name: 'Digital Logic Design', credits: 3, deptId: mechDept.id, yr: 1, sem: 2 },
    { code: 'MTR201', name: 'Embedded Systems', credits: 3, deptId: mechDept.id, yr: 2, sem: 1 },
    { code: 'MTR202', name: 'Control Systems I', credits: 3, deptId: mechDept.id, yr: 2, sem: 2 },
    { code: 'MTR301', name: 'Robotics & Automation', credits: 3, deptId: mechDept.id, yr: 3, sem: 1 },
    { code: 'MTR401', name: 'Mechatronics Capstone', credits: 4, deptId: mechDept.id, yr: 4, sem: 1 },

    // Renewable Energy (Dept 3)
    { code: 'REN101', name: 'Fundamentals of Renewable Energy', credits: 3, deptId: renewDept.id, yr: 1, sem: 1 },
    { code: 'REN102', name: 'Thermodynamics I', credits: 3, deptId: renewDept.id, yr: 1, sem: 2 },
    { code: 'REN201', name: 'Solar Energy Systems', credits: 3, deptId: renewDept.id, yr: 2, sem: 1 },
    { code: 'REN202', name: 'Wind Power Engineering', credits: 3, deptId: renewDept.id, yr: 2, sem: 2 },
    { code: 'REN301', name: 'Bioenergy & Fuel Cells', credits: 3, deptId: renewDept.id, yr: 3, sem: 1 },
    { code: 'REN401', name: 'Energy Grid Integration', credits: 4, deptId: renewDept.id, yr: 4, sem: 1 },

    // Nursing (Dept 4)
    { code: 'NRS101', name: 'Fundamentals of Nursing', credits: 4, deptId: nursingDept.id, yr: 1, sem: 1 },
    { code: 'NRS102', name: 'Human Anatomy & Physiology I', credits: 4, deptId: nursingDept.id, yr: 1, sem: 1 },
    { code: 'NRS103', name: 'Microbiology for Health Sciences', credits: 3, deptId: nursingDept.id, yr: 1, sem: 2 },
    { code: 'NRS201', name: 'Medical-Surgical Nursing I', credits: 4, deptId: nursingDept.id, yr: 2, sem: 1 },
    { code: 'NRS202', name: 'Pharmacology in Nursing', credits: 3, deptId: nursingDept.id, yr: 2, sem: 2 },
    { code: 'NRS301', name: 'Pediatric Nursing', credits: 3, deptId: nursingDept.id, yr: 3, sem: 1 },
    { code: 'NRS401', name: 'Critical Care Nursing', credits: 4, deptId: nursingDept.id, yr: 4, sem: 1 },

    // Medical Labs (Dept 5)
    { code: 'MLB101', name: 'Introduction to Medical Laboratory', credits: 3, deptId: labsDept.id, yr: 1, sem: 1 },
    { code: 'MLB102', name: 'Clinical Biochemistry I', credits: 3, deptId: labsDept.id, yr: 1, sem: 2 },
    { code: 'MLB201', name: 'Hematology & Blood Banking', credits: 4, deptId: labsDept.id, yr: 2, sem: 1 },
    { code: 'MLB202', name: 'Clinical Microbiology', credits: 3, deptId: labsDept.id, yr: 2, sem: 2 },
    { code: 'MLB301', name: 'Diagnostic Immunology', credits: 3, deptId: labsDept.id, yr: 3, sem: 1 },
    { code: 'MLB401', name: 'Molecular Diagnostics', credits: 4, deptId: labsDept.id, yr: 4, sem: 1 },

    // Railway Technology (Dept 6)
    { code: 'RLW101', name: 'Railway Infrastructure & Track Design', credits: 3, deptId: railwayDept.id, yr: 1, sem: 1 },
    { code: 'RLW102', name: 'Train Control Systems', credits: 3, deptId: railwayDept.id, yr: 1, sem: 2 },
    { code: 'RLW201', name: 'Electric Traction Systems', credits: 3, deptId: railwayDept.id, yr: 2, sem: 1 },
    { code: 'RLW301', name: 'High-Speed Railway Operations', credits: 3, deptId: railwayDept.id, yr: 3, sem: 1 },

    // Automotive Technology (Dept 7)
    { code: 'AUT101', name: 'Automotive Engine Fundamentals', credits: 3, deptId: autoDept.id, yr: 1, sem: 1 },
    { code: 'AUT102', name: 'Automotive Electrical Systems', credits: 3, deptId: autoDept.id, yr: 1, sem: 2 },
    { code: 'AUT201', name: 'Electric & Hybrid Vehicles', credits: 4, deptId: autoDept.id, yr: 2, sem: 1 },
    { code: 'AUT301', name: 'Vehicle Dynamics & Telematics', credits: 3, deptId: autoDept.id, yr: 3, sem: 1 },

    // Emergency Medical Services (Dept 8)
    { code: 'EMS101', name: 'Emergency Care & Assessment', credits: 4, deptId: emsDept.id, yr: 1, sem: 1 },
    { code: 'EMS102', name: 'Trauma & Cardiac Life Support', credits: 3, deptId: emsDept.id, yr: 1, sem: 2 },
    { code: 'EMS201', name: 'Advanced Resuscitation Protocols', credits: 4, deptId: emsDept.id, yr: 2, sem: 1 },
    { code: 'EMS301', name: 'Disaster Management & Triage', credits: 3, deptId: emsDept.id, yr: 3, sem: 1 },

    // Prosthetics and Orthotics (Dept 9)
    { code: 'PRO101', name: 'Anatomy for Prosthetics', credits: 3, deptId: prostheticsDept.id, yr: 1, sem: 1 },
    { code: 'PRO102', name: 'Materials Science in Orthotics', credits: 3, deptId: prostheticsDept.id, yr: 1, sem: 2 },
    { code: 'PRO201', name: 'Lower Limb Prosthetics', credits: 4, deptId: prostheticsDept.id, yr: 2, sem: 1 },
    { code: 'PRO301', name: 'Bionic & Robotic Limbs', credits: 4, deptId: prostheticsDept.id, yr: 3, sem: 1 },

    // Radiology (Dept 10)
    { code: 'RAD101', name: 'Radiographic Physics & Protection', credits: 3, deptId: radiologyDept.id, yr: 1, sem: 1 },
    { code: 'RAD102', name: 'Sectional Anatomy', credits: 3, deptId: radiologyDept.id, yr: 1, sem: 2 },
    { code: 'RAD201', name: 'CT & MRI Imaging Techniques', credits: 4, deptId: radiologyDept.id, yr: 2, sem: 1 },
    { code: 'RAD301', name: 'Ultrasound & Interventional Radiology', credits: 4, deptId: radiologyDept.id, yr: 3, sem: 1 },
  ];

  for (const course of coursesData) {
    await prisma.course.upsert({
      where: { courseCode: course.code },
      update: { 
        departmentId: course.deptId,
        year: course.yr,
        semester: course.sem
      },
      create: {
        courseCode: course.code,
        name: course.name,
        credits: course.credits,
        departmentId: course.deptId,
        year: course.yr,
        semester: course.sem
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
  const currentAcademicYear = new Date().getFullYear();
  const ictCourses = await prisma.course.findMany({
    where: { departmentId: ictDept.id }
  });

  for (const c of ictCourses) {
    await prisma.enrollment.upsert({
      where: {
        studentId_courseId_semester_academicYear: {
          studentId: student.id,
          courseId: c.id,
          semester: 1,
          academicYear: currentAcademicYear
        }
      },
      update: {},
      create: {
        studentId: student.id,
        courseId: c.id,
        semester: 1,
        academicYear: currentAcademicYear,
        status: 'ENROLLED'
      }
    });
  }

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