-- CreateTable
ALTER TABLE "Invitation" ADD COLUMN "invitedRole" TEXT NOT NULL DEFAULT 'co_buyer';

-- CreateTable
CREATE TABLE "DecisionCriterion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'custom',
    "weight" REAL NOT NULL DEFAULT 1,
    "scaleMax" INTEGER NOT NULL DEFAULT 10,
    "isDealbreaker" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DecisionCriterion_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "BuyerGroup" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "DecisionSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DecisionSubmission_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DecisionSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "CriterionRating" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "dealbreakerTriggered" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CriterionRating_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CriterionRating_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "DecisionCriterion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CriterionRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "CapExItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "amount" REAL NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CapExItem_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "WalkthroughInspection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "notes" TEXT,
    "media" TEXT,
    "items" TEXT,
    "inspectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WalkthroughInspection_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WalkthroughInspection_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "AgentComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "inspectionId" TEXT,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentComment_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AgentComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "DecisionCriterion_groupId_idx" ON "DecisionCriterion"("groupId");
CREATE UNIQUE INDEX "DecisionSubmission_propertyId_userId_key" ON "DecisionSubmission"("propertyId", "userId");
CREATE UNIQUE INDEX "CriterionRating_propertyId_criterionId_userId_key" ON "CriterionRating"("propertyId", "criterionId", "userId");
CREATE INDEX "CriterionRating_propertyId_idx" ON "CriterionRating"("propertyId");
CREATE INDEX "CapExItem_propertyId_idx" ON "CapExItem"("propertyId");
CREATE INDEX "WalkthroughInspection_propertyId_idx" ON "WalkthroughInspection"("propertyId");
CREATE INDEX "AgentComment_propertyId_idx" ON "AgentComment"("propertyId");