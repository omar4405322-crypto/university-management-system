-- CreateTable
CREATE TABLE "AttendanceStatusWeight" (
    "id" SERIAL NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "updatedById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceStatusWeight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceStatusWeight_status_key" ON "AttendanceStatusWeight"("status");

-- CreateIndex
CREATE INDEX "AttendanceStatusWeight_updatedById_idx" ON "AttendanceStatusWeight"("updatedById");

-- AddForeignKey (Restrict)
ALTER TABLE "AttendanceStatusWeight" ADD CONSTRAINT "AttendanceStatusWeight_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Check Constraints for AttendanceStatusWeight
ALTER TABLE "AttendanceStatusWeight" ADD CONSTRAINT "AttendanceStatusWeight_status_check"
    CHECK ("status" IN ('LATE', 'EXCUSED', 'PENDING_REVIEW'));

ALTER TABLE "AttendanceStatusWeight" ADD CONSTRAINT "AttendanceStatusWeight_weight_check"
    CHECK ("weight" >= 0 AND "weight" <= 1 AND "weight" != 'NaN'::double precision AND "weight" != 'Infinity'::double precision AND "weight" != '-Infinity'::double precision AND ROUND("weight"::numeric, 2) = "weight"::numeric);

-- Check Constraints for AttendanceSession sessionPoints
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_sessionPoints_check"
    CHECK ("sessionPoints" IS NULL OR ("sessionPoints" >= 0 AND "sessionPoints" != 'NaN'::double precision AND "sessionPoints" != 'Infinity'::double precision AND "sessionPoints" != '-Infinity'::double precision AND ROUND("sessionPoints"::numeric, 2) = "sessionPoints"::numeric));
