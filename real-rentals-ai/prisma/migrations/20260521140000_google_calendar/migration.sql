-- AlterTable
ALTER TABLE "BrokerProfile" ADD COLUMN "googleCalendarRefreshToken" TEXT,
ADD COLUMN "googleCalendarConnectedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Showing" ADD COLUMN "googleEventId" TEXT,
ADD COLUMN "googleHtmlLink" TEXT;
