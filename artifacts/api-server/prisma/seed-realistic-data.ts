import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const realisticData: Record<string, any> = {
  "Information & Communication Technology": {
    courses: [
      { name: "Introduction to Programming", nameAr: "مقدمة في البرمجة", code: "ICT101", credits: 3 },
      { name: "Discrete Mathematics", nameAr: "الرياضيات المتقطعة", code: "ICT102", credits: 3 },
      { name: "Digital Logic Design", nameAr: "تصميم المنطق الرقمي", code: "ICT103", credits: 3 }
    ],
    doctors: [
      { f: "Ahmed", l: "Hassan", nameAr: "أحمد حسن" },
      { f: "Mona", l: "Ali", nameAr: "منى علي" },
      { f: "Khalid", l: "Youssef", nameAr: "خالد يوسف" }
    ],
    tas: [
      { f: "Sara", l: "Mahmoud", nameAr: "سارة محمود" },
      { f: "Omar", l: "Adel", nameAr: "عمر عادل" }
    ],
    rooms: { lecture: ["Hall A", "Room 201", "Lecture Theater 1"], lab: ["Computer Lab 1", "Network Lab"] }
  },
  "Mechatronics Department": {
    courses: [
      { name: "Engineering Drawing", nameAr: "الرسم الهندسي", code: "MTR101", credits: 3 },
      { name: "Applied Physics", nameAr: "الفيزياء التطبيقية", code: "MTR102", credits: 4 },
      { name: "Circuit Analysis I", nameAr: "تحليل الدوائر 1", code: "MTR103", credits: 3 }
    ],
    doctors: [
      { f: "Tarek", l: "Nabil", nameAr: "طارق نبيل" },
      { f: "Hoda", l: "Samir", nameAr: "هدى سمير" }
    ],
    tas: [
      { f: "Omar", l: "Farouk", nameAr: "عمر فاروق" }
    ],
    rooms: { lecture: ["Hall B", "Room 305"], lab: ["Mechatronics Lab", "Physics Lab"] }
  },
  "Renewable Energy Department": {
    courses: [
      { name: "Renewable Energy Principles", nameAr: "مبادئ الطاقة المتجددة", code: "REN101", credits: 3 },
      { name: "Thermodynamics", nameAr: "الديناميكا الحرارية", code: "REN102", credits: 4 }
    ],
    doctors: [
      { f: "Ibrahim", l: "Salem", nameAr: "إبراهيم سالم" },
      { f: "Rania", l: "Magdy", nameAr: "رانيا مجدي" }
    ],
    tas: [
      { f: "Youssef", l: "Kamal", nameAr: "يوسف كمال" }
    ],
    rooms: { lecture: ["Hall C", "Room 401"], lab: ["Energy Lab", "Thermodynamics Lab"] }
  },
  "Railway Technology": {
    courses: [
      { name: "Railway Systems Overview", nameAr: "نظرة عامة على أنظمة السكك الحديدية", code: "RWY101", credits: 3 },
      { name: "Transportation Safety", nameAr: "سلامة النقل", code: "RWY102", credits: 3 }
    ],
    doctors: [
      { f: "Mahmoud", l: "El-Sayed", nameAr: "محمود السيد" },
      { f: "Asmaa", l: "Gamal", nameAr: "أسماء جمال" }
    ],
    tas: [
      { f: "Karim", l: "Wael", nameAr: "كريم وائل" }
    ],
    rooms: { lecture: ["Room 101", "Room 102"], lab: ["Railway Simulation Lab"] }
  },
  "Automotive Technology": {
    courses: [
      { name: "Automotive Fundamentals", nameAr: "أساسيات السيارات", code: "AUT101", credits: 3 },
      { name: "Internal Combustion Engines", nameAr: "محركات الاحتراق الداخلي", code: "AUT102", credits: 4 }
    ],
    doctors: [
      { f: "Hisham", l: "Fawzy", nameAr: "هشام فوزي" },
      { f: "Nadia", l: "Adel", nameAr: "نادية عادل" }
    ],
    tas: [
      { f: "Mostafa", l: "Saeed", nameAr: "مصطفى سعيد" }
    ],
    rooms: { lecture: ["Hall D", "Room 501"], lab: ["Auto Workshop 1", "Engine Lab"] }
  },
  "Nursing Department": {
    courses: [
      { name: "Anatomy & Physiology", nameAr: "علم التشريح ووظائف الأعضاء", code: "NUR101", credits: 4 },
      { name: "Fundamentals of Nursing", nameAr: "أساسيات التمريض", code: "NUR102", credits: 4 },
      { name: "Medical Terminology", nameAr: "المصطلحات الطبية", code: "NUR103", credits: 2 }
    ],
    doctors: [
      { f: "Laila", l: "Othman", nameAr: "ليلى عثمان" },
      { f: "Samira", l: "Zaki", nameAr: "سميرة زكي" },
      { f: "Yasser", l: "Amin", nameAr: "ياسر أمين" }
    ],
    tas: [
      { f: "Fatma", l: "Salah", nameAr: "فاطمة صلاح" },
      { f: "Nour", l: "Eldin", nameAr: "نور الدين" }
    ],
    rooms: { lecture: ["Hall 1", "Hall 2"], lab: ["Nursing Skills Lab 1", "Nursing Skills Lab 2"] }
  },
  "Medical Labs Department": {
    courses: [
      { name: "General Chemistry", nameAr: "الكيمياء العامة", code: "LAB101", credits: 4 },
      { name: "Biology Principles", nameAr: "مبادئ علم الأحياء", code: "LAB102", credits: 3 }
    ],
    doctors: [
      { f: "Hany", l: "Rizk", nameAr: "هاني رزق" },
      { f: "Noha", l: "Mounir", nameAr: "نهى منير" }
    ],
    tas: [
      { f: "Ali", l: "Hassan", nameAr: "علي حسن" }
    ],
    rooms: { lecture: ["Room 601", "Room 602"], lab: ["Chemistry Lab", "Biology Lab"] }
  },
  "Emergency Medical Services": {
    courses: [
      { name: "First Aid & CPR", nameAr: "الإسعافات الأولية والإنعاش", code: "EMS101", credits: 3 },
      { name: "Emergency Patient Care", nameAr: "رعاية مرضى الطوارئ", code: "EMS102", credits: 4 }
    ],
    doctors: [
      { f: "Waleed", l: "Essam", nameAr: "وليد عصام" },
      { f: "Dina", l: "Tawfik", nameAr: "دينا توفيق" }
    ],
    tas: [
      { f: "Tamer", l: "Hosny", nameAr: "تامر حسني" }
    ],
    rooms: { lecture: ["Hall E", "Room 701"], lab: ["Simulation Center", "Clinical Skills Lab"] }
  },
  "Prosthetics and Orthotics": {
    courses: [
      { name: "Biomechanics", nameAr: "الميكانيكا الحيوية", code: "PRO101", credits: 3 },
      { name: "Materials Science in Prosthetics", nameAr: "علم المواد في الأطراف الصناعية", code: "PRO102", credits: 3 }
    ],
    doctors: [
      { f: "Samir", l: "Galal", nameAr: "سمير جلال" },
      { f: "Shaimaa", l: "Taha", nameAr: "شيماء طه" }
    ],
    tas: [
      { f: "Hazem", l: "Ali", nameAr: "حازم علي" }
    ],
    rooms: { lecture: ["Room 801", "Room 802"], lab: ["Prosthetics Workshop", "Biomechanics Lab"] }
  },
  "Radiology": {
    courses: [
      { name: "Radiologic Physics", nameAr: "فيزياء الأشعة", code: "RAD101", credits: 3 },
      { name: "Imaging Procedures I", nameAr: "إجراءات التصوير 1", code: "RAD102", credits: 4 }
    ],
    doctors: [
      { f: "Ayman", l: "Saad", nameAr: "أيمن سعد" },
      { f: "Reem", l: "Hassan", nameAr: "ريم حسن" }
    ],
    tas: [
      { f: "Salma", l: "Nour", nameAr: "سلمى نور" }
    ],
    rooms: { lecture: ["Room 901", "Hall F"], lab: ["X-Ray Simulation Lab", "Imaging Lab"] }
  }
};

async function cleanOldData() {
  console.log("Cleaning up old placeholder data...");
  
  await prisma.scheduleSlot.deleteMany();
  await prisma.sectionGroupMapping.deleteMany();
  await prisma.courseSection.deleteMany();
  await prisma.course.deleteMany();
  
  await prisma.student.deleteMany();
  await prisma.studentGroup.deleteMany();
  await prisma.timetable.deleteMany();

  await prisma.doctor.deleteMany();
  await prisma.teachingAssistant.deleteMany();
  
  await prisma.user.deleteMany({
    where: {
      role: { in: ['STUDENT', 'DOCTOR', 'TEACHING_ASSISTANT'] }
    }
  });
}

async function main() {
  const commonPassword = await bcrypt.hash('Password123!', 10);
  
  await cleanOldData();
  
  const departments = await prisma.department.findMany({ include: { college: true } });
  
  console.log(`Found ${departments.length} departments. Seeding realistic data...`);
  
  const report: any[] = [];
  
  for (const dept of departments) {
    const data = realisticData[dept.name];
    if (!data) {
      console.warn(`No realistic data mapped for department: ${dept.name}`);
      continue;
    }
    
    // Seed Doctors
    const deptDoctors = [];
    for (let i = 0; i < data.doctors.length; i++) {
      const docData = data.doctors[i];
      const email = `dr.${docData.f.toLowerCase()}.${docData.l.toLowerCase()}@test.com`;
      const docId = `DOC-${dept.id}-${i+1}`;
      const user = await prisma.user.create({
        data: { email, password: commonPassword, role: 'DOCTOR' }
      });
      const doctor = await prisma.doctor.create({
        data: {
          userId: user.id,
          firstName: docData.f,
          lastName: docData.l,
          doctorId: docId,
          departmentId: dept.id,
        }
      });
      deptDoctors.push(doctor);
    }
    
    // Seed TAs
    const deptTAs = [];
    for (let i = 0; i < data.tas.length; i++) {
      const taData = data.tas[i];
      const email = `ta.${taData.f.toLowerCase()}.${taData.l.toLowerCase()}@test.com`;
      const empId = `TA-${dept.id}-${i+1}`;
      const user = await prisma.user.create({
        data: { email, password: commonPassword, role: 'TEACHING_ASSISTANT' }
      });
      const ta = await prisma.teachingAssistant.create({
        data: {
          userId: user.id,
          employeeId: empId,
          firstName: taData.f,
          lastName: taData.l,
          departmentId: dept.id,
        }
      });
      deptTAs.push(ta);
    }
    
    // Seed Courses
    const deptCourses = [];
    for (const cData of data.courses) {
      const course = await prisma.course.create({
        data: {
          courseCode: cData.code,
          name: cData.name,
          departmentId: dept.id,
          credits: cData.credits,
          year: 1,
          semester: 1
        }
      });
      deptCourses.push(course);
    }
    
    // Seed Timetable
    const timetable = await prisma.timetable.create({
      data: {
        collegeId: dept.collegeId,
        departmentId: dept.id,
        academicYear: 1,
        semester: 1,
        title: `${dept.name} - Year 1 Sem 1 Timetable`,
        status: 'PUBLISHED'
      }
    });
    
    // Seed Student Group
    const groupName = `Year 1 - Group A`;
    const group = await prisma.studentGroup.create({
      data: { name: groupName, departmentId: dept.id, rangeStartName: 'Student 1', rangeEndName: 'Student 3' }
    });
    
    // Seed 3 Students
    for (let i = 0; i < 3; i++) {
      const email = `student${i+1}.${dept.id}@test.com`;
      const sId = `STU-${dept.id}-2026-00${i+1}`;
      const user = await prisma.user.create({
        data: { email, password: commonPassword, role: 'STUDENT' }
      });
      await prisma.student.create({
        data: {
          userId: user.id,
          firstName: `Student`,
          lastName: `${i+1}`,
          studentId: sId,
          departmentId: dept.id,
          year: 1,
          groupId: group.id
        }
      });
    }

    // Seed ScheduleSlots (directly — no CourseSection needed)
    let slotsCount = 0;
    let docIndex = 0;
    let taIndex = 0;
    
    const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY'];
    
    for (let i = 0; i < deptCourses.length; i++) {
      const course = deptCourses[i];
      
      const assignedDoc = deptDoctors[docIndex % deptDoctors.length];
      docIndex++;
      
      // Lecture Slot
      const lectureDay = days[i % days.length];
      const lectureRoom = data.rooms.lecture[i % data.rooms.lecture.length];
      await prisma.scheduleSlot.create({
        data: {
          courseId: course.id,
          doctorId: assignedDoc.id,
          groupId: group.id,
          timetableId: timetable.id,
          dayOfWeek: lectureDay,
          startTime: '09:00',
          endTime: '11:00',
          room: lectureRoom,
          slotType: 'LECTURE',
          slotType: 'LECTURE'
        }
      });
      slotsCount++;
      
      // Lab / Tutorial Slot
      const isLab = i % 2 === 0;
      const labDay = days[(i + 2) % days.length];
      const labRoom = isLab ? data.rooms.lab[i % data.rooms.lab.length] : data.rooms.lecture[(i+1) % data.rooms.lecture.length];
      const assignedTA = deptTAs[taIndex % deptTAs.length];
      taIndex++;
      
      await prisma.scheduleSlot.create({
        data: {
          courseId: course.id,
          doctorId: assignedDoc.id,
          groupId: group.id,
          timetableId: timetable.id,
          dayOfWeek: labDay,
          startTime: '12:00',
          endTime: '14:00',
          room: labRoom,
          slotType: isLab ? 'LAB' : 'SECTION',
          slotType: isLab ? 'LAB' : 'SECTION',
          teachingAssistantId: assignedTA.id
        }
      });
      slotsCount++;
    }
    
    report.push({
      Department: dept.name,
      Courses: deptCourses.length,
      Doctors: deptDoctors.length,
      TAs: deptTAs.length,
      ScheduleSlots: slotsCount
    });
  }
  
  console.table(report);
  console.log('\n✅ Realistic data seeding complete.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
