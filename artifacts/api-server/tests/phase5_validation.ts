import { PrismaClient } from '@prisma/client';
import { StudentGroupsService } from '../src/services/studentGroups.service';
import { autoDivideStudents, splitGroup } from '../src/controllers/studentGroups.controller';

const prisma = new PrismaClient();

// Mock request/response for controller tests
function createMockRes() {
  const res: any = {};
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (data: any) => { res.data = data; return res; };
  return res;
}

async function runTests() {
  console.log("=== Running Phase 5 Validation Tests ===\n");

  // Clean up
  await prisma.scheduleSlot.deleteMany({});
  await prisma.student.deleteMany({});
  await prisma.studentGroup.deleteMany({});
  await prisma.department.deleteMany({});
  await prisma.college.deleteMany({});
  await prisma.user.deleteMany({});

  const college = await prisma.college.create({ data: { name: 'Test College' } });
  const dept = await prisma.department.create({ data: { name: 'Test Dept', collegeId: college.id } });

  // Create 600 students
  const studentsToInsert = Array.from({ length: 600 }).map((_, i) => ({
    userId: i + 1000,
    firstName: `Student${String.fromCharCode(65 + (i % 26))}`,
    lastName: `Last${i.toString().padStart(3, '0')}`,
    studentId: `S${i}`,
    departmentId: dept.id
  }));
  studentsToInsert.sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));

  await prisma.user.createMany({
    data: studentsToInsert.map(s => ({ id: s.userId, email: `s${s.userId}@test.com`, password: 'pw' }))
  });
  await prisma.student.createMany({ data: studentsToInsert });

  // 1. Auto-divide into 4 groups
  console.log("Test 1: Auto-divide 600 students into 4 groups");
  let req: any = { params: { departmentId: dept.id.toString() }, body: { numberOfGroups: 4 } };
  let res = createMockRes();
  await autoDivideStudents(req, res);
  console.log("Result:", res.data);

  let groups = await prisma.studentGroup.findMany({ where: { departmentId: dept.id }, include: { _count: { select: { students: true } } }, orderBy: { name: 'asc' } });
  console.log("Groups created:", groups.map(g => `${g.name}: ${g._count.students} students`).join(', '));
  console.log("Alphabetical correctness:", groups.map(g => `${g.name} (${g.rangeStartName} - ${g.rangeEndName})`).join(' | '));

  // 2. Auto-divide by maxGroupSize (170)
  console.log("\nTest 2: Auto-divide by maxGroupSize (170)");
  req = { params: { departmentId: dept.id.toString() }, body: { maxGroupSize: 170, confirmed: true } };
  res = createMockRes();
  await autoDivideStudents(req, res);
  console.log("Result:", res.data);

  groups = await prisma.studentGroup.findMany({ where: { departmentId: dept.id }, include: { _count: { select: { students: true } } }, orderBy: { name: 'asc' } });
  console.log("Groups created:", groups.map(g => `${g.name}: ${g._count.students} students`).join(', '));

  // 3. Splitting group A into 3 subgroups
  console.log("\nTest 3: Splitting group A into 3 subgroups");
  const groupA = groups.find(g => g.name === 'A');
  req = { params: { groupId: groupA!.id.toString() }, body: { numberOfSubgroups: 3 } };
  res = createMockRes();
  await splitGroup(req, res);
  console.log("Result:", res.data);

  const afterSplitGroupA = await prisma.studentGroup.findUnique({ where: { id: groupA!.id }, include: { _count: { select: { students: true } } } });
  const subgroupsOfA = await prisma.studentGroup.findMany({ where: { parentGroupId: groupA!.id }, include: { _count: { select: { students: true } } }, orderBy: { name: 'asc' } });

  console.log(`Group A direct students: ${afterSplitGroupA!._count.students}`);
  console.log("Subgroups of A:", subgroupsOfA.map(g => `${g.name}: ${g._count.students} students`).join(', '));

  // 4. Splitting with zero dependent slots
  console.log("\nTest 4: Splitting group B with zero slots (requires confirmation?)");
  const groupB = groups.find(g => g.name === 'B');
  req = { params: { groupId: groupB!.id.toString() }, body: { numberOfSubgroups: 2 } };
  res = createMockRes();
  await splitGroup(req, res);
  console.log("Result:", res.data);

  // 5. Splitting with dependent schedule slots
  console.log("\nTest 5: Splitting group C with dependent slots");
  const groupC = groups.find(g => g.name === 'C');
  const course = await prisma.course.create({ data: { name: 'CS101', courseCode: 'CS101', departmentId: dept.id } });
  await prisma.scheduleSlot.create({
    data: { courseId: course.id, groupId: groupC!.id, dayOfWeek: 'Monday', startTime: '08:00', endTime: '10:00', slotType: 'SECTION', slotType: 'LECTURE' }
  });

  req = { params: { groupId: groupC!.id.toString() }, body: { numberOfSubgroups: 2 } };
  res = createMockRes();
  await splitGroup(req, res);
  console.log("Requires confirmation?", res.data.requiresConfirmation);
  if (res.data.requiresConfirmation) {
    req.body.confirmed = true;
    res = createMockRes();
    await splitGroup(req, res);
    console.log("After confirmation, success:", res.data.success);
  }

  // 6. & 7. Edge insertions
  console.log("\nTest 6 & 7: New student insertion logic");
  // A new student falling before the first range
  const newUserBefore = await prisma.user.create({ data: { email: 'before@test.com', password: 'pw' } });
  const beforeStudent = await prisma.student.create({ data: { userId: newUserBefore.id, firstName: 'AAAAA', lastName: 'Test', studentId: 'S_BEFORE', departmentId: dept.id } });
  await StudentGroupsService.assignStudentToGroup(beforeStudent);

  // A new student falling after the last range
  const newUserAfter = await prisma.user.create({ data: { email: 'after@test.com', password: 'pw' } });
  const afterStudent = await prisma.student.create({ data: { userId: newUserAfter.id, firstName: 'ZZZZZ', lastName: 'Test', studentId: 'S_AFTER', departmentId: dept.id } });
  await StudentGroupsService.assignStudentToGroup(afterStudent);

  // A new student falling inside A2's range
  const newUserMiddle = await prisma.user.create({ data: { email: 'mid@test.com', password: 'pw' } });
  const midStudent = await prisma.student.create({ data: { userId: newUserMiddle.id, firstName: 'StudentB', lastName: 'Last005', studentId: 'S_MID', departmentId: dept.id } });
  await StudentGroupsService.assignStudentToGroup(midStudent);

  const beforeCheck = await prisma.student.findUnique({ where: { id: beforeStudent.id }, include: { group: true } });
  const afterCheck = await prisma.student.findUnique({ where: { id: afterStudent.id }, include: { group: true } });
  const midCheck = await prisma.student.findUnique({ where: { id: midStudent.id }, include: { group: true } });

  console.log("Student Before assigned to:", beforeCheck?.group?.name);
  console.log("Student After assigned to:", afterCheck?.group?.name);
  console.log("Student Middle assigned to:", midCheck?.group?.name);

  // Check if boundary group's range was extended
  const firstLeafGroup = await prisma.studentGroup.findUnique({ where: { id: beforeCheck?.group?.id } });
  const lastLeafGroup = await prisma.studentGroup.findUnique({ where: { id: afterCheck?.group?.id } });
  console.log("First Leaf Group Range Start Name:", firstLeafGroup?.rangeStartName);
  console.log("Last Leaf Group Range End Name:", lastLeafGroup?.rangeEndName);


  // 8. computeAttendees on root vs leaf
  console.log("\nTest 8: computeAttendees on root vs leaf");
  const attendeesRoot = await StudentGroupsService.computeAttendees(groupA!.id);
  const attendeesLeaf = await StudentGroupsService.computeAttendees(subgroupsOfA[0].id);

  console.log("Attendees for Group A (Root):", attendeesRoot.length);
  console.log("Attendees for Group A1 (Leaf):", attendeesLeaf.length);

}

runTests().catch(e => console.error(e)).finally(() => prisma.$disconnect());
