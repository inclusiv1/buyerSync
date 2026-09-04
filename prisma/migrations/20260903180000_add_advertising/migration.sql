-- CreateTable
CREATE TABLE "AdCampaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "advertiserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "destinationUrl" TEXT NOT NULL,
    "placement" TEXT NOT NULL DEFAULT 'any',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
    "startsAt" DATETIME,
    "endsAt" DATETIME,
    "rejectionReason" TEXT,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AdCampaign_advertiserId_fkey" FOREIGN KEY ("advertiserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AdCampaign_advertiserId_idx" ON "AdCampaign"("advertiserId");

-- CreateIndex
CREATE INDEX "AdCampaign_status_paymentStatus_placement_idx" ON "AdCampaign"("status", "paymentStatus", "placement");