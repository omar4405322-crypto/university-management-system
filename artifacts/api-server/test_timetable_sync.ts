import { PrismaClient } from '@prisma/client';
import { TimetableService } from './src/services/timetable.service';
const prisma = new PrismaClient();

async function main() {
  const department = await prisma.department.findFirst({
    include: { college: true }
  });
  if (!department) throw new Error("No department found");

  const course = await prisma.course.findFirst({
    where: { departmentId: department.id }
  });
  if (!course) throw new Error("No course found in dept");

  console.log("Creating timetable...");
  
  // Call the controller logic indirectly or just use Prisma $transaction like the controller does.
  // Wait, I will just call the service! No, we updated the controller.
  // It's easier to just hit the actual DB like the controller would, or import the controller?
  // I can just test using HTTP if the server is running, or import the controller.
  const created = await prisma.$transaction(async (tx) => {
    const timetable = await tx.timetable.create({
      data: {
        collegeId: department.collegeId,
        departmentId: department.id,
        academicYear: 2026,
        semester: 1,
        title: "Test Timetable Sync",
        description: "",
        scheduleData: {
          slots: [
            { day: 'Monday', startTime: '08:00', endTime: '10:00', room: '101', courseName: course.name }
          ]
        },
        fileUrl: "",
        status: "PUBLISHED"
      }
    });

    await TimetableService.syncTimetableSchedules(tx, timetable, timetable.scheduleData);
    return timetable;
  });

  console.log("Timetable created:", created.id);

  const schedules = await prisma.schedule.findMany({
    where: { timetableId: created.id }
  });
  console.log("Synced schedules:", schedules.length);
  if (schedules.length === 1 && schedules[0].timetableSlotKey === `Monday_08:00_${course.id}`) {
    console.log("Sync successful!");
  } else {
    console.error("Sync failed:", schedules);
  }

  // Update schedule directly (Flow A detachment)
  console.log("Detaching schedule (manual edit)...");
  await prisma.schedule.update({
    where: { id: schedules[0].id },
    data: { timetableId: null, timetableSlotKey: null }
  });

  // Re-save timetable
  console.log("Updating timetable...");
  await prisma.$transaction(async (tx) => {
    const updated = await tx.timetable.update({
      where: { id: created.id },
      data: {
        scheduleData: {
          slots: [
            { day: 'Tuesday', startTime: '10:00', endTime: '12:00', room: '102', courseName: course.name }
          ]
        }
      }
    });
    await TimetableService.syncTimetableSchedules(tx, updated, updated.scheduleData);
  });

  const finalSchedules = await prisma.schedule.findMany({
    where: { courseId: course.id }
  });
  
  console.log("Final schedules for course:");
  for (const s of finalSchedules) {
    console.log(`- Day: ${s.dayOfWeek}, Room: ${s.room}, TimetableId: ${s.timetableId}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
