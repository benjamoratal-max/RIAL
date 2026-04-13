-- CreateTable
CREATE TABLE "LeaseContract" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "leaseRequestId" INTEGER NOT NULL,
    "pdfUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeaseContract_leaseRequestId_fkey" FOREIGN KEY ("leaseRequestId") REFERENCES "LeaseRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "LeaseContract_leaseRequestId_key" ON "LeaseContract"("leaseRequestId");
