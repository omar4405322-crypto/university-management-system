-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(10,2) USING ROUND("amount"::numeric, 2);
