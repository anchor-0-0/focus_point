-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "billable_hours" INTEGER,
ADD COLUMN     "hourly_rate_snapshot" DECIMAL(12,2),
ADD COLUMN     "session_amount" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);
