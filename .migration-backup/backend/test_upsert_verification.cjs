// ============================================================
// STEP 7: VERIFY prisma.attendance.upsert() behavior
// Tests:
//   A) Upserting an EXISTING (student, course, date) triplet
//      should UPDATE the row (NOT insert a new one)
//   B) Upserting a NEW (student, course, date) triplet
//      should INSERT a new row
// ============================================================

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const startOfDay = (isoDateStr) => {
    const d = new Date(isoDateStr);
    d.setUTCHours(0, 0, 0, 0);
    return d;
};

(async () => {
    try {
        console.log('\n============================================');
        console.log(' PRISMA UPSERT VERIFICATION SUITE');
        console.log('============================================\n');

        // -------------------------------------------------------
        // PRE-TEST SNAPSHOT
        // -------------------------------------------------------
        console.log('--- PRE-TEST: Current Attendance Records (expect 4) ---');
        const initialRecords = await prisma.attendance.findMany({
            orderBy: { id: 'asc' }
        });
        console.log(`Total count: ${initialRecords.length}`);
        initialRecords.forEach(r => {
            console.log(`  id=${r.id} student=${r.studentId} course=${r.courseId} date=${r.date.toISOString()} status=${r.status}`);
        });
        if (initialRecords.length !== 4) {
            console.error('FAIL: Expected 4 records, got', initialRecords.length);
            process.exit(1);
        }
        console.log('✅ Correct initial count (4)\n');

        // -------------------------------------------------------
        // TEST A: UPSERT EXISTING TRIPLET -> EXPECT UPDATE
        // -------------------------------------------------------
        console.log('--- TEST A: Upsert EXISTING triplet expecting UPDATE ---');
        console.log('Target: studentId=2502, courseId=55, 2026-07-29 (id=6, status=PRESENT)');
        console.log('Change: status PRESENT -> EXCUSED, remarks="Updated via upsert test"');

        const existingStudentId = 2502;
        const existingCourseId = 55;
        const existingDate = startOfDay('2026-07-29');

        const testAStart = Date.now();
        const testAResult = await prisma.attendance.upsert({
            where: {
                studentId_courseId_date: {
                    studentId: existingStudentId,
                    courseId: existingCourseId,
                    date: existingDate
                }
            },
            create: {
                studentId: existingStudentId,
                courseId: existingCourseId,
                date: existingDate,
                status: 'EXCUSED',
                remarks: 'This should NOT be used because WHERE matched'
            },
            update: {
                status: 'EXCUSED',
                remarks: 'Updated via prisma upsert - TEST A PASSED'
            }
        });
        const testADuration = Date.now() - testAStart;

        const countAfterA = await prisma.attendance.count();
        const updatedRow = await prisma.attendance.findUnique({
            where: { id: testAResult.id }
        });

        console.log(`Upsert returned id=${testAResult.id} (should be 6, the existing id)`);
        console.log(`Row count after upsert: ${countAfterA} (should STILL be 4, NOT 5)`);
        console.log(`Updated record status: ${updatedRow.status} (should be EXCUSED)`);
        console.log(`Updated record remarks: ${updatedRow.remarks}`);

        let testAPassed = true;
        if (testAResult.id !== 6) {
            console.error('❌ FAIL: Upsert returned NEW id instead of 6. It inserted rather than updated.');
            testAPassed = false;
        } else {
            console.log('✅ Upsert returned the EXISTING record id (6) = UPDATE path taken');
        }
        if (countAfterA !== 4) {
            console.error(`❌ FAIL: Row count changed to ${countAfterA}. Upsert INSERTED instead of UPDATED.`);
            testAPassed = false;
        } else {
            console.log('✅ Row count unchanged (still 4) = No duplicate created');
        }
        if (updatedRow.status !== 'EXCUSED') {
            console.error(`❌ FAIL: Status was not updated. Got ${updatedRow.status}, wanted EXCUSED.`);
            testAPassed = false;
        } else {
            console.log('✅ Status correctly updated from PRESENT -> EXCUSED');
        }
        if (updatedRow.remarks !== 'Updated via prisma upsert - TEST A PASSED') {
            console.error(`❌ FAIL: Remarks not updated. Got: ${updatedRow.remarks}`);
            testAPassed = false;
        } else {
            console.log('✅ Remarks field correctly updated by update block');
        }
        console.log(`TEST A DURATION: ${testADuration}ms`);

        if (!testAPassed) {
            console.log('\n❌ TEST A FAILED. Aborting tests before cleanup.');
            console.log('\nDATA STATE AFTER FAILED TEST A:');
            const afterFail = await prisma.attendance.findMany({ orderBy: { id: 'asc' } });
            afterFail.forEach(r => {
                console.log(`  id=${r.id} student=${r.studentId} course=${r.courseId} date=${r.date.toISOString()} status=${r.status}`);
            });
            await prisma.$disconnect();
            process.exit(1);
        }
        console.log('\n✅ TEST A PASSED: Existing record UPDATED, no new row created.\n');

        // -------------------------------------------------------
        // TEST B: UPSERT NEW TRIPLET -> EXPECT INSERT
        // (Sanity check that upsert still works for new data.)
        // We will then clean up this new row afterwards.
        // -------------------------------------------------------
        console.log('--- TEST B: Upsert NEW (non-existent) triplet expecting INSERT ---');
        console.log('Target: studentId=2502, courseId=55, 2026-07-31 (no existing row)');

        const newDate = startOfDay('2026-07-31');

        const testBStart = Date.now();
        const testBResult = await prisma.attendance.upsert({
            where: {
                studentId_courseId_date: {
                    studentId: existingStudentId,
                    courseId: existingCourseId,
                    date: newDate
                }
            },
            create: {
                studentId: existingStudentId,
                courseId: existingCourseId,
                date: newDate,
                status: 'LATE',
                remarks: 'Created via prisma upsert - TEST B'
            },
            update: {
                status: 'LATE',
                remarks: 'This block NOT used - no match'
            }
        });
        const testBDuration = Date.now() - testBStart;

        const countAfterB = await prisma.attendance.count();
        console.log(`Upsert returned id=${testBResult.id} (should be a NEW id, not 6/10/11/14)`);
        console.log(`Row count after upsert: ${countAfterB} (should now be 5)`);

        let testBPassed = true;
        const newRowId = testBResult.id;
        if ([6, 10, 11, 14].includes(newRowId)) {
            console.error('❌ FAIL: Upsert returned an existing id, not a new one.');
            testBPassed = false;
        } else {
            console.log(`✅ Upsert returned NEW id (${newRowId}) = INSERT path taken`);
        }
        if (countAfterB !== 5) {
            console.error(`❌ FAIL: Expected 5 rows after insert, got ${countAfterB}`);
            testBPassed = false;
        } else {
            console.log('✅ Row count increased by exactly 1 (4 -> 5)');
        }
        if (testBResult.status !== 'LATE') {
            console.error(`❌ FAIL: New row status wrong: ${testBResult.status}`);
            testBPassed = false;
        } else {
            console.log('✅ New row status correctly = LATE');
        }
        console.log(`TEST B DURATION: ${testBDuration}ms`);

        if (!testBPassed) {
            console.log('\n❌ TEST B FAILED. Aborting before cleanup.');
            await prisma.$disconnect();
            process.exit(1);
        }
        console.log('\n✅ TEST B PASSED: New record correctly INSERTED.\n');

        // -------------------------------------------------------
        // CLEANUP: Delete the test row we created in Test B
        // -------------------------------------------------------
        console.log('--- CLEANUP: Remove test row created in Test B ---');
        console.log(`Deleting test row id=${newRowId}`);
        await prisma.attendance.delete({ where: { id: newRowId } });
        const countAfterCleanup = await prisma.attendance.count();
        console.log(`Count after cleanup: ${countAfterCleanup} (should be 4 again)`);
        if (countAfterCleanup !== 4) {
            console.error('❌ CLEANUP FAIL: Count != 4');
        } else {
            console.log('✅ Cleanup successful (count = 4)');
        }

        // -------------------------------------------------------
        // RESTORE: Change the record from Test A back to PRESENT
        // (Leave the DB in the same logical state we found it,
        //  minus the 10 duplicates we legitimately removed earlier.)
        // -------------------------------------------------------
        console.log('\n--- RESTORE: Revert id=6 back to PRESENT (pre-test state) ---');
        await prisma.attendance.update({
            where: { id: 6 },
            data: {
                status: 'PRESENT',
                remarks: null
            }
        });
        const restoredRow = await prisma.attendance.findUnique({ where: { id: 6 } });
        console.log(`id=6 restored: status=${restoredRow.status}, remarks=${restoredRow.remarks || '(empty)'}`);
        console.log('✅ Pre-test state restored.');

        // -------------------------------------------------------
        // FINAL STATE
        // -------------------------------------------------------
        console.log('\n============================================');
        console.log(' FINAL ATTENDANCE STATE');
        console.log('============================================');
        const finalRecords = await prisma.attendance.findMany({ orderBy: { id: 'asc' } });
        console.log(`Final total count: ${finalRecords.length}`);
        finalRecords.forEach(r => {
            console.log(`  id=${r.id} student=${r.studentId} course=${r.courseId} date=${r.date.toISOString()} status=${r.status}`);
        });

        console.log('\n============================================');
        console.log(' ALL TESTS PASSED ✅✅✅');
        console.log('============================================');
        console.log('  A) Upsert on existing (studentId, courseId, date) -> UPDATES (no duplicate)');
        console.log('  B) Upsert on new triplet                    -> INSERTS correctly');
        console.log('  The @@unique constraint is WORKING.');
        console.log('============================================\n');

        await prisma.$disconnect();
        process.exit(0);
    } catch (e) {
        console.error('\n❌ FATAL ERROR during test execution:');
        console.error(e);
        try { await prisma.$disconnect(); } catch(_) {}
        process.exit(1);
    }
})();
