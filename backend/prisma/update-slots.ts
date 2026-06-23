import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const timeMapping: Record<string, { start: string; end: string }> = {
  '08:00': { start: '09:00', end: '10:30' },
  '10:00': { start: '10:30', end: '12:00' },
  '12:00': { start: '12:00', end: '13:30' },
  '14:00': { start: '13:30', end: '15:00' },
  '16:00': { start: '15:00', end: '16:30' }
};

async function main() {
  console.log('Starting timetable slots update...');

  // 1. Update Schedule rows
  const schedules = await prisma.schedule.findMany();
  let updatedSchedules = 0;

  for (const schedule of schedules) {
    if (timeMapping[schedule.startTime]) {
      const newTimes = timeMapping[schedule.startTime];
      await prisma.schedule.update({
        where: { id: schedule.id },
        data: {
          startTime: newTimes.start,
          endTime: newTimes.end
        }
      });
      updatedSchedules++;
    }
  }
  console.log(`Updated ${updatedSchedules} Schedule records.`);

  // 2. Update JSON payload inside Timetable
  const timetables = await prisma.timetable.findMany();
  let updatedTimetables = 0;

  for (const timetable of timetables) {
    if (timetable.scheduleData && (timetable.scheduleData as any).slots) {
      const data: any = timetable.scheduleData;
      let modified = false;

      data.slots = data.slots.map((slot: any) => {
        if (slot.startTime && timeMapping[slot.startTime]) {
          modified = true;
          return {
            ...slot,
            startTime: timeMapping[slot.startTime].start,
            endTime: timeMapping[slot.startTime].end
          };
        }
        return slot;
      });

      if (modified) {
        await prisma.timetable.update({
          where: { id: timetable.id },
          data: { scheduleData: data }
        });
        updatedTimetables++;
      }
    }
  }
  console.log(`Updated ${updatedTimetables} Timetable JSON records.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
