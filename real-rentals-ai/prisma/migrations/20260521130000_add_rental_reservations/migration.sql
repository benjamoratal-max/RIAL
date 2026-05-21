-- AlterTable Payment
ALTER TABLE "Payment" ADD COLUMN "paymentType" TEXT;

-- CreateTable RentalReservation
CREATE TABLE "RentalReservation" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "propertyId" INTEGER NOT NULL,
    "leaseRequestId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending_deposit',
    "durationMonths" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3),
    "monthlyRent" DOUBLE PRECISION NOT NULL,
    "securityDeposit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "depositAmount" DOUBLE PRECISION NOT NULL,
    "balanceAmount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "depositPaidAt" TIMESTAMP(3),
    "balanceDueAt" TIMESTAMP(3),
    "balancePaidAt" TIMESTAMP(3),
    "depositPaymentId" INTEGER,
    "balancePaymentId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalReservation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RentalReservation_leaseRequestId_key" ON "RentalReservation"("leaseRequestId");
CREATE INDEX "RentalReservation_userId_idx" ON "RentalReservation"("userId");
CREATE INDEX "RentalReservation_propertyId_idx" ON "RentalReservation"("propertyId");
CREATE INDEX "RentalReservation_status_idx" ON "RentalReservation"("status");
CREATE INDEX "RentalReservation_balanceDueAt_idx" ON "RentalReservation"("balanceDueAt");

ALTER TABLE "RentalReservation" ADD CONSTRAINT "RentalReservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RentalReservation" ADD CONSTRAINT "RentalReservation_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RentalReservation" ADD CONSTRAINT "RentalReservation_leaseRequestId_fkey" FOREIGN KEY ("leaseRequestId") REFERENCES "LeaseRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
