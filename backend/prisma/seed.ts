// ⚠️ ALWAYS run this after any migration: npx prisma db seed
// This file restores all essential data including superadmin,
// colleges, departments, users, and sample data.
//
// Safe migration sequence:
//   1. npx prisma migrate dev --name <migration_name>
//   2. npx prisma generate
//   3. npx prisma db seed   ← NEVER skip this step
require('dotenv').config();
import {  PrismaClient  } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Safety check — if real data exists, don't wipe anything
  const existingStudents = await prisma.student.count();
  const existingCourses = await prisma.course.count();

  if (existingStudents > 50 && existingCourses > 30) {
    console.log('⚠️  Database already has real data. Skipping destructive operations.');
    console.log(`   Students: ${existingStudents}, Courses: ${existingCourses}`);
    console.log('   To force reseed, run: npx prisma db seed -- --force');
    
    const forceFlag = process.argv.includes('--force');
    if (!forceFlag) {
      await prisma.$disconnect();
      return;
    }
    console.log('🔴 Force flag detected — proceeding with reseed...');
  }

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
    update: { role: 'SUPER_ADMIN', adminRole: null, twoFactorEnabled: false },
    create: {
      email: 'superadmin@university.com',
      password: superAdminPassword,
      role: 'SUPER_ADMIN',
      twoFactorEnabled: false,
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

  console.log('Seeding College Admin...');
  const collegeAdminPassword = await bcrypt.hash('CollegeAdmin123!', 10);
  await prisma.user.upsert({
    where: { email: 'college.admin@university.com' },
    update: { 
      role: 'COLLEGE_ADMIN', 
      password: collegeAdminPassword, 
      managedCollegeId: industryCollege.id, 
      adminRole: null 
    },
    create: {
      email: 'college.admin@university.com',
      password: collegeAdminPassword,
      role: 'COLLEGE_ADMIN',
      managedCollegeId: industryCollege.id,
    },
  });

  // Health Sciences college admin
  const healthAdminPassword = await bcrypt.hash('HealthAdmin123!', 10);
  await prisma.user.upsert({
    where: { email: 'health.admin@university.com' },
    update: {
      role: 'COLLEGE_ADMIN',
      password: healthAdminPassword,
      managedCollegeId: healthCollege.id,
      adminRole: null,
    },
    create: {
      email: 'health.admin@university.com',
      password: healthAdminPassword,
      role: 'COLLEGE_ADMIN',
      managedCollegeId: healthCollege.id,
    },
  });

  // Industry & Energy college admin (dedicated)
  const industryAdminPassword = await bcrypt.hash('IndustryAdmin123!', 10);
  const industryAdminUser = await prisma.user.upsert({
    where: { email: 'industry.admin@university.com' },
    update: {
      role: 'COLLEGE_ADMIN',
      password: industryAdminPassword,
      managedCollegeId: industryCollege.id,
      adminRole: null,
    },
    create: {
      email: 'industry.admin@university.com',
      password: industryAdminPassword,
      role: 'COLLEGE_ADMIN',
      managedCollegeId: industryCollege.id,
    },
  });

  // Set display names via Doctor records for all college admins
  // (User model has no 'name' field — names are derived from Doctor.firstName + lastName)
  const collegeAdminUser = await prisma.user.findUnique({ where: { email: 'college.admin@university.com' } });
  const healthAdminUser  = await prisma.user.findUnique({ where: { email: 'health.admin@university.com' } });

  if (collegeAdminUser) {
    await prisma.doctor.upsert({
      where: { userId: collegeAdminUser.id },
      update: { firstName: 'Industry', lastName: 'Admin' },
      create: { userId: collegeAdminUser.id, firstName: 'Industry', lastName: 'Admin' },
    });
  }
  if (healthAdminUser) {
    await prisma.doctor.upsert({
      where: { userId: healthAdminUser.id },
      update: { firstName: 'Health', lastName: 'Admin' },
      create: { userId: healthAdminUser.id, firstName: 'Health', lastName: 'Admin' },
    });
  }
  await prisma.doctor.upsert({
    where: { userId: industryAdminUser.id },
    update: { firstName: 'Industry', lastName: 'Admin' },
    create: { userId: industryAdminUser.id, firstName: 'Industry', lastName: 'Admin' },
  });

  console.log('Seeding Department Admins...');
  const deptAdminPassword = await bcrypt.hash('DeptAdmin123!', 10);
  
  // Existing default department admin
  await prisma.user.upsert({
    where: { email: 'dept.admin@university.com' },
    update: { 
      role: 'DEPARTMENT_ADMIN', 
      password: deptAdminPassword, 
      managedDepartmentId: ictDept.id, 
      adminRole: null 
    },
    create: {
      email: 'dept.admin@university.com',
      password: deptAdminPassword,
      role: 'DEPARTMENT_ADMIN',
      managedDepartmentId: ictDept.id,
    },
  });

  // Department admins for each department in College of Industry & Energy
  const industryDepts = [
    { id: 1, name: "Information & Communication Technology", cleanName: "informationcommunicationtechnology" },
    { id: 2, name: "Mechatronics Department", cleanName: "mechatronicsdepartment" },
    { id: 3, name: "Renewable Energy Department", cleanName: "renewableenergydepartment" },
    { id: 6, name: "Railway Technology", cleanName: "railwaytechnology" },
    { id: 7, name: "Automotive Technology", cleanName: "automotivetechnology" }
  ];

  for (const dept of industryDepts) {
    const email = `${dept.cleanName}.admin@university.com`;
    await prisma.user.upsert({
      where: { email },
      update: {
        role: 'DEPARTMENT_ADMIN',
        password: deptAdminPassword,
        managedDepartmentId: dept.id,
        adminRole: null
      },
      create: {
        email,
        password: deptAdminPassword,
        role: 'DEPARTMENT_ADMIN',
        managedDepartmentId: dept.id
      }
    });

    // Also support mechatronics.admin@university.com and renewableenergy.admin@university.com directly to match user expectations
    if (dept.id === 2 || dept.id === 3) {
      const shortCleanName = dept.id === 2 ? "mechatronics" : "renewableenergy";
      const shortEmail = `${shortCleanName}.admin@university.com`;
      await prisma.user.upsert({
        where: { email: shortEmail },
        update: {
          role: 'DEPARTMENT_ADMIN',
          password: deptAdminPassword,
          managedDepartmentId: dept.id,
          adminRole: null
        },
        create: {
          email: shortEmail,
          password: deptAdminPassword,
          role: 'DEPARTMENT_ADMIN',
          managedDepartmentId: dept.id
        }
      });
    }
  }

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

  console.log('Seeding Teaching Assistants...');
  const taPassword = await bcrypt.hash('TA123456!', 10);
  const taUser = await prisma.user.upsert({
    where: { email: 'ta@university.com' },
    update: {},
    create: {
      email: 'ta@university.com',
      password: taPassword,
      role: 'TEACHING_ASSISTANT'
    }
  });

  const ta = await prisma.teachingAssistant.upsert({
    where: { userId: taUser.id },
    update: { departmentId: ictDept.id },
    create: {
      userId: taUser.id,
      departmentId: ictDept.id,
      specialization: 'Programming'
    }
  });

  const ta1User = await prisma.user.upsert({
    where: { email: 'ta1@university.com' },
    update: {},
    create: {
      email: 'ta1@university.com',
      password: taPassword,
      role: 'TEACHING_ASSISTANT'
    }
  });
  await prisma.teachingAssistant.upsert({
    where: { userId: ta1User.id },
    update: { departmentId: 1 },
    create: {
      userId: ta1User.id,
      departmentId: 1,
      specialization: 'Information Technology'
    }
  });

  const ta2User = await prisma.user.upsert({
    where: { email: 'ta2@university.com' },
    update: {},
    create: {
      email: 'ta2@university.com',
      password: taPassword,
      role: 'TEACHING_ASSISTANT'
    }
  });
  await prisma.teachingAssistant.upsert({
    where: { userId: ta2User.id },
    update: { departmentId: 2 },
    create: {
      userId: ta2User.id,
      departmentId: 2,
      specialization: 'Mechatronics'
    }
  });

  const ta3User = await prisma.user.upsert({
    where: { email: 'ta3@university.com' },
    update: {},
    create: {
      email: 'ta3@university.com',
      password: taPassword,
      role: 'TEACHING_ASSISTANT'
    }
  });
  await prisma.teachingAssistant.upsert({
    where: { userId: ta3User.id },
    update: { departmentId: 4 },
    create: {
      userId: ta3User.id,
      departmentId: 4,
      specialization: 'Nursing'
    }
  });

  // 7. Enroll Student in Courses
  const ictCourses = await prisma.course.findMany({
    where: { departmentId: ictDept.id }
  });

  for (const course of ictCourses) {
    await prisma.enrollment.upsert({
      where: {
        studentId_courseId_semester_academicYear: {
          studentId: student.id,
          courseId: course.id,
          semester: 1,
          academicYear: 1
        }
      },
      update: {},
      create: {
        studentId: student.id,
        courseId: course.id,
        semester: 1,
        academicYear: 1,
        status: 'ENROLLED'
      }
    });
  }

  console.log('Seeding Schedule with TA...');
  if (ictCourses.length > 0) {
    const firstCourse = ictCourses[0];
    await prisma.schedule.deleteMany({
      where: { courseId: firstCourse.id, room: 'Lab 101' }
    });
    
    await prisma.schedule.create({
      data: {
        courseId: firstCourse.id,
        dayOfWeek: 'Monday',
        startTime: '10:00',
        endTime: '12:00',
        room: 'Lab 101',
        assistantId: ta.id
      }
    });
  }

  console.log('Seeding Realistic Doctors and TAs for Departments...');
  const newDocPassword = await bcrypt.hash('Doctor123!', 10);
  const newTaPassword = await bcrypt.hash('TA123456!', 10);

  const departmentsData = [
    {
      id: 1,
      name: 'ICT',
      doctors: ['Khaled Mansour', 'Nadia Samir', 'Tarek Fouad', 'Heba Nasser'],
      tas: ['Kareem Nabil', 'Nour Youssef']
    },
    {
      id: 2,
      name: 'Mechatronics',
      doctors: ['Youssef Ibrahim', 'Rania Khalil', 'Mostafa Sayed', 'Dina Wahba'],
      tas: ['Omar Tarek', 'Laila Mahmoud']
    },
    {
      id: 3,
      name: 'Renewable Energy',
      doctors: ['Hassan Ali', 'Mona Salem', 'Omar Farouk', 'Salma Yasser'],
      tas: ['Hisham Ali', 'Mervat Sayed']
    },
    {
      id: 6,
      name: 'Railway Technology',
      doctors: ['Ahmed Kamal', 'Tarek Amin', 'Hoda Samir', 'Nabil Fathy'],
      tas: ['Sameh Hassan', 'Shady Amin']
    },
    {
      id: 7,
      name: 'Automotive Technology',
      doctors: ['Mahmoud Ezzat', 'Yasser Sami', 'Fatma Zahran', 'Karim Nabil'],
      tas: ['Wael Mostafa', 'Ramy Ezzat']
    },
    {
      id: 4,
      name: 'Nursing Department',
      doctors: ['Amal Karim', 'Hoda Selim', 'Marwa Nabil', 'Samia Fathy'],
      tas: ['Nour Ali', 'Yasmine Tarek']
    },
    {
      id: 5,
      name: 'Medical Labs Department',
      doctors: ['Ehab Morsi', 'Dalia Ragab', 'Samir Lotfy', 'Noha Adel'],
      tas: ['Omar Khaled', 'Heba Said']
    },
    {
      id: 10,
      name: 'Radiology',
      doctors: ['Ashraf Zidan', 'Iman Fouad', 'Wael Barakat', 'Suzanne Makram'],
      tas: ['Kareem Hassan', 'Mona Adel']
    },
    {
      id: 8,
      name: 'Emergency Medical Services',
      doctors: ['Hany Gaber', 'Reham Sobhy', 'Tarek Osman', 'Mervat Aziz'],
      tas: ['Tarek Youssef', 'Dina Samir']
    },
    {
      id: 9,
      name: 'Prosthetics and Orthotics',
      doctors: ['Adel Fahmy', 'Shaimaa Gouda', 'Ramzy Halim', 'Fatma Ismail'],
      tas: ['Ahmed Zidan', 'Salma Fouad']
    }
  ];

  for (const dept of departmentsData) {
    // Doctors
    for (let i = 0; i < dept.doctors.length; i++) {
      const docName = dept.doctors[i];
      const [firstName, lastName] = docName.split(' ');
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@university.edu`;
      const doctorId = `DOC-${dept.id}-${i+1}`;
      
      const user = await prisma.user.upsert({
        where: { email },
        update: { role: 'DOCTOR', password: newDocPassword },
        create: { email, password: newDocPassword, role: 'DOCTOR' }
      });

      await prisma.doctor.upsert({
        where: { userId: user.id },
        update: { departmentId: dept.id },
        create: {
          userId: user.id,
          firstName,
          lastName,
          doctorId,
          departmentId: dept.id
        }
      });
    }

    // TAs
    for (let i = 0; i < dept.tas.length; i++) {
      const taName = dept.tas[i];
      const [firstName, lastName] = taName.split(' ');
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.ta@university.edu`;
      
      const user = await prisma.user.upsert({
        where: { email },
        update: { role: 'TEACHING_ASSISTANT', password: newTaPassword },
        create: { email, password: newTaPassword, role: 'TEACHING_ASSISTANT' }
      });

      await prisma.teachingAssistant.upsert({
        where: { userId: user.id },
        update: { departmentId: dept.id, specialization: dept.name },
        create: {
          userId: user.id,
          departmentId: dept.id,
          specialization: dept.name
        }
      });
    }
  }

    // ── NEW SEED APPENDED BELOW ──
  const hashedPassword = await bcrypt.hash('Student@123', 10);

  // STEP 1 — Fix existing courses: update doctorId where null
  console.log('STEP 1: Fixing existing courses doctorIds...');
  try {
    await prisma.course.update({ where: { id: 4 }, data: { doctorId: 1 } }).catch(() => {}); // ENG101
    await prisma.course.update({ where: { id: 1 }, data: { doctorId: 2 } }).catch(() => {}); // ICT101
    await prisma.course.update({ where: { id: 3 }, data: { doctorId: 3 } }).catch(() => {}); // MATH101
    await prisma.course.update({ where: { id: 2 }, data: { doctorId: 4 } }).catch(() => {}); // ICT102
    await prisma.course.update({ where: { id: 5 }, data: { doctorId: 5 } }).catch(() => {}); // PHY101
    console.log('✅ Doctor IDs updated for existing ICT courses');
  } catch (e) { console.error('Error in step 1:', e); }

  // STEP 2 — Delete all existing schedules
  console.log('STEP 2: Deleting all existing schedules...');
  try {
    await prisma.schedule.deleteMany({});
    console.log('✅ Existing schedules deleted');
  } catch (e) { console.error('Error in step 2:', e); }

  // STEP 3 — Add missing doctors for departments 6,7,8,9,10
  console.log('STEP 3: Adding missing doctors...');
  try {
    const deptsToUpdate = [
      { id: 6, names: ['Karim Saad', 'Walid Hamdi', 'Noha Rashad', 'Fares Galal', 'Iman Barakat'] },
      { id: 7, names: ['Samer Adel', 'Reem Khalifa', 'Tamer Sobhi', 'Doaa Mansour', 'Nabil Ezz'] },
      { id: 8, names: ['Wael Hafez', 'Amira Sadek'] }, // Only adding missing 2
      { id: 9, names: ['Sherif Anwar', 'Lobna Gamal', 'Adel Kamal', 'Maha Salah', 'Ziad Fawzy'] },
      { id: 10, names: ['Ghada Nour', 'Bassem Ramzy', 'Donia Mahmoud'] } // Adding missing 3
    ];

    for (const dept of deptsToUpdate) {
      for (const name of dept.names) {
        const [firstName, lastName] = name.split(' ');
        const email = `dr.${firstName.toLowerCase()}.${lastName.toLowerCase()}@university.edu`;
        const user = await prisma.user.upsert({
          where: { email },
          update: {},
          create: { email, password: hashedPassword, role: 'DOCTOR' }
        });
        await prisma.doctor.upsert({
          where: { userId: user.id },
          update: { departmentId: dept.id },
          create: {
            userId: user.id,
            firstName,
            lastName,
            departmentId: dept.id,
            doctorId: `DOC-${dept.id}-${user.id}`
          }
        });
      }
    }
    console.log('✅ Missing doctors added');
  } catch (e) { console.error('Error in step 3:', e); }

  // STEP 4 — Create realistic courses per department
  console.log('STEP 4: Creating realistic courses...');
  try {
    await prisma.course.deleteMany({ where: { id: { in: [26,27,28,29,30,31,32,33,34,35,36] } } }).catch(()=> {});

    const newCourses = [
      // Dept 1 - ICT
      { code: 'ICT201', name: 'Data Structures & Algorithms', nameAr: 'هياكل البيانات والخوارزميات', year: 2, sem: 1, deptId: 1, docId: 1 },
      { code: 'ICT202', name: 'Database Systems', nameAr: 'قواعد البيانات', year: 2, sem: 2, deptId: 1, docId: 2 },
      { code: 'ICT301', name: 'Network Security', nameAr: 'أمن الشبكات', year: 3, sem: 1, deptId: 1, docId: 3 },
      { code: 'ICT302', name: 'Web Development', nameAr: 'تطوير الويب', year: 3, sem: 2, deptId: 1, docId: 4 },
      // Dept 2 - Mechatronics
      { code: 'MECH101', name: 'Engineering Mechanics', nameAr: 'ميكانيكا الهندسة', year: 1, sem: 1, deptId: 2, docId: 6 },
      { code: 'MECH102', name: 'Electronics Fundamentals', nameAr: 'أساسيات الإلكترونيات', year: 1, sem: 2, deptId: 2, docId: 7 },
      { code: 'MECH201', name: 'Control Systems', nameAr: 'أنظمة التحكم', year: 2, sem: 1, deptId: 2, docId: 8 },
      { code: 'MECH202', name: 'Robotics', nameAr: 'الروبوتيكس', year: 2, sem: 2, deptId: 2, docId: 9 },
      { code: 'MECH301', name: 'Industrial Automation', nameAr: 'الأتمتة الصناعية', year: 3, sem: 1, deptId: 2, docId: 6 },
      { code: 'MECH302', name: 'PLC Programming', nameAr: 'برمجة المتحكمات', year: 3, sem: 2, deptId: 2, docId: 7 },
      // Dept 3 - Renewable Energy
      { code: 'RE101', name: 'Solar Energy Fundamentals', nameAr: 'أساسيات الطاقة الشمسية', year: 1, sem: 1, deptId: 3, docId: 10 },
      { code: 'RE102', name: 'Wind Energy Systems', nameAr: 'أنظمة طاقة الرياح', year: 1, sem: 2, deptId: 3, docId: 11 },
      { code: 'RE201', name: 'Energy Storage', nameAr: 'تخزين الطاقة', year: 2, sem: 1, deptId: 3, docId: 12 },
      { code: 'RE202', name: 'Smart Grid Systems', nameAr: 'أنظمة الشبكة الذكية', year: 2, sem: 2, deptId: 3, docId: 13 },
      { code: 'RE301', name: 'Energy Audit', nameAr: 'تدقيق الطاقة', year: 3, sem: 1, deptId: 3, docId: 10 },
      { code: 'RE302', name: 'Renewable Energy Projects', nameAr: 'مشاريع الطاقة المتجددة', year: 3, sem: 2, deptId: 3, docId: 11 },
      // Dept 4 - Nursing
      { code: 'NUR101', name: 'Fundamentals of Nursing', nameAr: 'أساسيات التمريض', year: 1, sem: 1, deptId: 4, docId: 22 },
      { code: 'NUR102', name: 'Anatomy & Physiology', nameAr: 'التشريح وعلم وظائف الأعضاء', year: 1, sem: 2, deptId: 4, docId: 23 },
      { code: 'NUR201', name: 'Medical-Surgical Nursing', nameAr: 'التمريض الطبي الجراحي', year: 2, sem: 1, deptId: 4, docId: 24 },
      { code: 'NUR202', name: 'Pediatric Nursing', nameAr: 'تمريض الأطفال', year: 2, sem: 2, deptId: 4, docId: 25 },
      { code: 'NUR301', name: 'Community Health Nursing', nameAr: 'تمريض صحة المجتمع', year: 3, sem: 1, deptId: 4, docId: 22 },
      { code: 'NUR302', name: 'Critical Care Nursing', nameAr: 'تمريض العناية المركزة', year: 3, sem: 2, deptId: 4, docId: 23 },
      // Dept 5 - Medical Labs
      { code: 'MLT101', name: 'Hematology', nameAr: 'علم الدم', year: 1, sem: 1, deptId: 5, docId: 26 },
      { code: 'MLT102', name: 'Clinical Biochemistry', nameAr: 'الكيمياء الحيوية السريرية', year: 1, sem: 2, deptId: 5, docId: 27 },
      { code: 'MLT201', name: 'Microbiology', nameAr: 'علم الأحياء الدقيقة', year: 2, sem: 1, deptId: 5, docId: 28 },
      { code: 'MLT202', name: 'Histology', nameAr: 'علم الأنسجة', year: 2, sem: 2, deptId: 5, docId: 26 },
      { code: 'MLT301', name: 'Clinical Pathology', nameAr: 'علم الأمراض السريري', year: 3, sem: 1, deptId: 5, docId: 27 },
      { code: 'MLT302', name: 'Lab Management', nameAr: 'إدارة المختبرات', year: 3, sem: 2, deptId: 5, docId: 28 }
    ];

    for (const c of newCourses) {
      await prisma.course.upsert({
        where: { courseCode: c.code },
        update: { name: c.name, year: c.year, semester: c.sem, departmentId: c.deptId, doctorId: c.docId },
        create: { courseCode: c.code, name: c.name, year: c.year, semester: c.sem, departmentId: c.deptId, doctorId: c.docId, credits: 3 }
      });
    }

    // Now for depts 6-10 where doctor IDs are dynamic, we need to fetch them
    const coursesDynamicDepts = [
      { deptId: 6, courses: [
        { code: 'RLW101', name: 'Railway Engineering Basics', year: 1, sem: 1 }, { code: 'RLW102', name: 'Track Geometry', year: 1, sem: 2 },
        { code: 'RLW201', name: 'Railway Signaling', year: 2, sem: 1 }, { code: 'RLW202', name: 'Rolling Stock', year: 2, sem: 2 },
        { code: 'RLW301', name: 'Railway Safety', year: 3, sem: 1 }, { code: 'RLW302', name: 'Rail Infrastructure', year: 3, sem: 2 }
      ]},
      { deptId: 7, courses: [
        { code: 'AUT101', name: 'Automotive Fundamentals', year: 1, sem: 1 }, { code: 'AUT102', name: 'Engine Technology', year: 1, sem: 2 },
        { code: 'AUT201', name: 'Vehicle Electronics', year: 2, sem: 1 }, { code: 'AUT202', name: 'Transmission Systems', year: 2, sem: 2 },
        { code: 'AUT301', name: 'Electric Vehicles', year: 3, sem: 1 }, { code: 'AUT302', name: 'Automotive Diagnostics', year: 3, sem: 2 }
      ]},
      { deptId: 8, courses: [
        { code: 'EMS101', name: 'Emergency Care Basics', year: 1, sem: 1 }, { code: 'EMS102', name: 'First Aid & CPR', year: 1, sem: 2 },
        { code: 'EMS201', name: 'Trauma Management', year: 2, sem: 1 }, { code: 'EMS202', name: 'Emergency Pharmacology', year: 2, sem: 2 },
        { code: 'EMS301', name: 'Disaster Management', year: 3, sem: 1 }, { code: 'EMS302', name: 'Advanced Life Support', year: 3, sem: 2 }
      ]},
      { deptId: 9, courses: [
        { code: 'PRO101', name: 'Anatomy for P&O', year: 1, sem: 1 }, { code: 'PRO102', name: 'Biomechanics', year: 1, sem: 2 },
        { code: 'PRO201', name: 'Lower Limb Prosthetics', year: 2, sem: 1 }, { code: 'PRO202', name: 'Upper Limb Orthotics', year: 2, sem: 2 },
        { code: 'PRO301', name: 'Pediatric P&O', year: 3, sem: 1 }, { code: 'PRO302', name: 'Advanced Prosthetics', year: 3, sem: 2 }
      ]},
      { deptId: 10, courses: [
        { code: 'RAD101', name: 'Radiographic Anatomy', year: 1, sem: 1 }, { code: 'RAD102', name: 'X-Ray Technology', year: 1, sem: 2 },
        { code: 'RAD201', name: 'CT Scanning', year: 2, sem: 1 }, { code: 'RAD202', name: 'MRI Fundamentals', year: 2, sem: 2 },
        { code: 'RAD301', name: 'Nuclear Medicine', year: 3, sem: 1 }, { code: 'RAD302', name: 'Radiation Protection', year: 3, sem: 2 }
      ]}
    ];

    for (const d of coursesDynamicDepts) {
      const deptDocs = await prisma.doctor.findMany({ where: { departmentId: d.deptId } });
      for (let i = 0; i < d.courses.length; i++) {
        const c = d.courses[i];
        const doc = deptDocs[i % deptDocs.length];
        await prisma.course.upsert({
          where: { courseCode: c.code },
          update: { name: c.name, year: c.year, semester: c.sem, departmentId: d.deptId, doctorId: doc?.id || null },
          create: { courseCode: c.code, name: c.name, year: c.year, semester: c.sem, departmentId: d.deptId, doctorId: doc?.id || null, credits: 3 }
        });
      }
    }
    console.log('✅ Realistic courses created');
  } catch (e) { console.error('Error in step 4:', e); }

  // STEP 5 — Add 3 Teaching Assistants per department
  console.log('STEP 5: Creating Teaching Assistants...');
  try {
    const taData = [
      { deptId: 1, clean: 'ict', names: ['Mahmoud Fathi', 'Yasmine Helmy', 'Bassem Nour'] },
      { deptId: 2, clean: 'mech', names: ['Kareem Zaki', 'Nermeen Hani', 'Taha Saeed'] },
      { deptId: 3, clean: 're', names: ['Lina Mostafa', 'Ahmed Sobhi', 'Rasha Fikry'] },
      { deptId: 4, clean: 'nur', names: ['Abeer Salem', 'Walaa Morsy', 'Osama Nabil'] },
      { deptId: 5, clean: 'mlt', names: ['Enas Wahid', 'Moustafa Galal', 'Shady Amin'] },
      { deptId: 6, clean: 'rlw', names: ['Younis Hamed', 'Nihal Fouad', 'Sameh Rizk'] },
      { deptId: 7, clean: 'aut', names: ['Alaa Badawi', 'Dena Refaat', 'Khaled Saber'] },
      { deptId: 8, clean: 'ems', names: ['Mervat Gouda', 'Tarek Ashraf', 'Hana Magdy'] },
      { deptId: 9, clean: 'pro', names: ['Ramy Hossam', 'Soha Lotfy', 'Amir Fahmy'] },
      { deptId: 10, clean: 'rad', names: ['Ghalia Zein', 'Manar Atef', 'Sherihan Wafi'] }
    ];

    for (const d of taData) {
      for (const name of d.names) {
        const [firstName, lastName] = name.split(' ');
        const email = `ta.${firstName.toLowerCase()}.${d.clean}@university.edu`;
        const user = await prisma.user.upsert({
          where: { email },
          update: {},
          create: { email, password: hashedPassword, role: 'TEACHING_ASSISTANT' }
        });
        await prisma.teachingAssistant.upsert({
          where: { userId: user.id },
          update: { departmentId: d.deptId },
          create: { userId: user.id, departmentId: d.deptId, specialization: name }
        });
      }
    }
    console.log('✅ Teaching Assistants created');
  } catch (e) { console.error('Error in step 5:', e); }

  // STEP 6 — Create 10 students per department (100 students total)
  console.log('STEP 6: Creating 100 students...');
  try {
    const maleNames = ['Omar', 'Ahmed', 'Mohamed', 'Khaled', 'Youssef', 'Tarek', 'Amr', 'Hassan', 'Mahmoud', 'Wael'];
    const femaleNames = ['Nour', 'Sara', 'Layla', 'Mona', 'Rania', 'Heba', 'Dina', 'Eman', 'Salma', 'Aya'];
    const lastNames = ['Ali', 'Hassan', 'Ibrahim', 'Saeed', 'Mahmoud', 'Fathy', 'Nasser', 'Kamal', 'Salem', 'Rashad'];

    const depts = [
      { id: 1, code: 'ICT' }, { id: 2, code: 'MEC' }, { id: 3, code: 'REN' }, { id: 4, code: 'NUR' }, { id: 5, code: 'MED' },
      { id: 6, code: 'RLW' }, { id: 7, code: 'AUT' }, { id: 8, code: 'EMS' }, { id: 9, code: 'PRO' }, { id: 10, code: 'RAD' }
    ];

    for (const dept of depts) {
      const deptCourses = await prisma.course.findMany({ where: { departmentId: dept.id } });
      for (let i = 0; i < 10; i++) {
        const isMale = i % 2 === 0;
        const firstName = isMale ? maleNames[i % maleNames.length] : femaleNames[i % femaleNames.length];
        const lastName = lastNames[i % lastNames.length];
        
        const email = `${dept.code.toLowerCase()}.${i+1}@student.university.edu`;
        const studentId = `${dept.code}-2024-${String(i+1).padStart(3, '0')}`;
        
        let year = 1;
        if (i >= 4 && i < 7) year = 2; // 3 students year 2
        else if (i >= 7) year = 3; // 3 students year 3

        const user = await prisma.user.upsert({
          where: { email },
          update: {},
          create: { email, password: hashedPassword, role: 'STUDENT' }
        });

        const student = await prisma.student.upsert({
          where: { userId: user.id },
          update: { year, departmentId: dept.id },
          create: {
            userId: user.id,
            firstName,
            lastName,
            studentId,
            year,
            departmentId: dept.id,
            isActive: true
          }
        });

        // Enroll in all dept courses
        for (const course of deptCourses) {
          await prisma.enrollment.upsert({
            where: { studentId_courseId_semester_academicYear: { studentId: student.id, courseId: course.id, semester: 1, academicYear: 2024 } },
            update: {},
            create: { studentId: student.id, courseId: course.id, semester: 1, academicYear: 2024, status: 'ENROLLED' }
          });
        }
      }
    }
    console.log('✅ 100 students created and enrolled');
  } catch (e) { console.error('Error in step 6:', e); }

  // STEP 7 — Create complete schedules for ALL courses
  console.log('STEP 7: Creating complete schedules...');
  try {
    const allCourses = await prisma.course.findMany();
    const deptRooms: Record<number, string[]> = {
      1: ["ICT Lab 1", "ICT Lab 2", "Hall A"],
      2: ["Mech Lab", "Workshop 1", "Hall B"],
      3: ["Energy Lab", "Solar Lab", "Hall C"],
      4: ["Nursing Lab", "Simulation Room", "Hall D"],
      5: ["Bio Lab", "Chem Lab", "Hall E"],
      6: ["Railway Lab", "Track Room", "Hall F"],
      7: ["Auto Workshop", "Engine Lab", "Hall G"],
      8: ["EMS Lab", "Skills Lab", "Hall H"],
      9: ["P&O Workshop", "Fitting Room", "Hall I"],
      10: ["X-Ray Lab", "MRI Room", "Hall J"]
    };

    for (const course of allCourses) {
      const year = course.year || 1;
      let day1 = 'SAT', day2 = 'TUE';
      if (year === 2) { day1 = 'SUN'; day2 = 'WED'; }
      if (year === 3) { day1 = 'MON'; day2 = 'THU'; }

      const deptId = course.departmentId as number;
      const rooms = deptRooms[deptId] || ["Hall A", "Lab 1", "Room 101"];
      
      // Lecture
      await prisma.schedule.create({
        data: { courseId: course.id, dayOfWeek: day1, startTime: '09:00', endTime: '11:00', room: rooms[2] } // Hall
      }).catch(()=>{});
      
      // Lab
      await prisma.schedule.create({
        data: { courseId: course.id, dayOfWeek: day2, startTime: '11:00', endTime: '13:00', room: rooms[0] } // Lab
      }).catch(()=>{});
    }
    console.log('✅ Complete schedules created for all courses');
  } catch (e) { console.error('Error in step 7:', e); }

  // STEP 8 — Create 2 exams per department
  console.log('STEP 8: Creating exams...');
  try {
    const deptsList = await prisma.department.findMany({ include: { courses: { take: 1 } } });
    const deptRooms: Record<number, string> = {
      1: "Hall A", 2: "Hall B", 3: "Hall C", 4: "Hall D", 5: "Hall E",
      6: "Hall F", 7: "Hall G", 8: "Hall H", 9: "Hall I", 10: "Hall J"
    };

    for (const dept of deptsList) {
      if (dept.courses.length > 0) {
        const course = dept.courses[0];
        const room = deptRooms[dept.id] || "Hall A";
        
        await prisma.exam.create({
          data: { courseId: course.id, type: 'MIDTERM', date: new Date('2026-07-15'), startTime: '09:00', endTime: '11:00', room }
        }).catch(()=>{});

        await prisma.exam.create({
          data: { courseId: course.id, type: 'FINAL', date: new Date('2026-08-20'), startTime: '09:00', endTime: '12:00', room }
        }).catch(()=>{});
      }
    }
    console.log('✅ 2 exams per department created');
  } catch (e) { console.error('Error in step 8:', e); }

  console.log('\n🎉 Clean Realistic Seed Complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
