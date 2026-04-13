/*
  Warnings:

  - You are about to drop the column `message` on the `LeaseRequest` table. All the data in the column will be lost.
  - You are about to drop the column `startDate` on the `LeaseRequest` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LeaseRequest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "propertyId" INTEGER NOT NULL,
    "durationMonths" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeaseRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LeaseRequest_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_LeaseRequest" ("createdAt", "durationMonths", "id", "propertyId", "status", "userId") SELECT "createdAt", "durationMonths", "id", "propertyId", "status", "userId" FROM "LeaseRequest";
DROP TABLE "LeaseRequest";
ALTER TABLE "new_LeaseRequest" RENAME TO "LeaseRequest";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
