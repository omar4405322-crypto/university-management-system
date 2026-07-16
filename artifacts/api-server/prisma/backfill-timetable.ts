import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Starting timetable backfill...');

  const timetables = await prisma.timetable.findMany({
    where: { status: 'PUBLISHED' },
  });

  let createdCount = 0;
  let updatedCount = 0;

  for (const timetable of timetables) {
    const scheduleData = timetable.scheduleData as any;
    if (!scheduleData || !scheduleData.slots) continue;

    console.log(`Processing timetable ID: ${timetable.id}`);

    // Inside a transaction for this timetable
    await prisma.$transaction(async (tx) => {
      const existingSchedules = await tx.schedule.findMany({
        where: { timetableId: timetable.id }
      });
      const slots = scheduleData.slots || [];

      for (const slot of slots) {
        if (!slot.courseName) continue;
        
        const course = await tx.course.findFirst({
          where: { name: slot.courseName, departmentId: timetable.departmentId },
        });
        if (!course) {
          console.warn(`Course not found for name: ${slot.courseName} in dept ${timetable.departmentId}`);
          continue;
        }

        const slotKey = `${slot.day}_${slot.startTime}_${course.id}`;
        
        // Find existing schedule by course, day, starttime (legacy matching before keys)
        const legacyMatch = await tx.schedule.findFirst({
          where: {
            courseId: course.id,
            dayOfWeek: slot.day,
            startTime: slot.startTime,
            room: slot.room || ''
          }
        });

        if (legacyMatch) {
          await tx.schedule.update({
            where: { id: legacyMatch.id },
            data: {
              timetableId: timetable.id,
              timetableSlotKey: slotKey,
              endTime: slot.endTime, // ensure sync
            }
          });
          updatedCount++;
        } else {
          // If it doesn't exist at all, we create it
          await tx.schedule.create({
            data: {
              courseId: course.id,
              dayOfWeek: slot.day,
              startTime: slot.startTime,
              endTime: slot.endTime,
              room: slot.room || '',
              timetableId: timetable.id,
              timetableSlotKey: slotKey,
            }
          });
          createdCount++;
        }
      }
    });
  }

  console.log(`Backfill completed. Created: ${createdCount}, Updated: ${updatedCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
