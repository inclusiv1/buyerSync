-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "profileSlug" TEXT NOT NULL,
    "avatar" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BuyerGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "primaryBuyerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "GroupMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "permissions" TEXT,
    "invitedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    CONSTRAINT "GroupMembership_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "BuyerGroup" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GroupMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "invitedEmail" TEXT NOT NULL,
    "invitedPhone" TEXT,
    "token" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" DATETIME NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    CONSTRAINT "Invitation_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "BuyerGroup" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Invitation_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "mlsId" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "lat" REAL,
    "lng" REAL,
    "price" REAL,
    "beds" INTEGER,
    "baths" REAL,
    "sqft" REAL,
    "lotSize" REAL,
    "yearBuilt" INTEGER,
    "propertyType" TEXT,
    "hoa" REAL,
    "taxInfo" TEXT,
    "photos" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "addedById" TEXT NOT NULL,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Property_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "BuyerGroup" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "visitDate" DATETIME,
    "visibility" TEXT NOT NULL DEFAULT 'shared',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attachments" TEXT,
    CONSTRAINT "Note_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "isShared" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "ChecklistItem_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "BuyerGroup" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserItemWeight" (
    "userId" TEXT NOT NULL,
    "checklistItemId" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,

    PRIMARY KEY ("userId", "checklistItemId"),
    CONSTRAINT "UserItemWeight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserItemWeight_checklistItemId_fkey" FOREIGN KEY ("checklistItemId") REFERENCES "ChecklistItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PropertyItemStatus" (
    "propertyId" TEXT NOT NULL,
    "checklistItemId" TEXT NOT NULL,
    "checkedByUserId" TEXT NOT NULL,
    "isMet" TEXT NOT NULL,
    "notes" TEXT,

    PRIMARY KEY ("propertyId", "checklistItemId", "checkedByUserId"),
    CONSTRAINT "PropertyItemStatus_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PropertyItemStatus_checklistItemId_fkey" FOREIGN KEY ("checklistItemId") REFERENCES "ChecklistItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PropertyItemStatus_checkedByUserId_fkey" FOREIGN KEY ("checkedByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SearchCriteria" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "minPrice" REAL,
    "maxPrice" REAL,
    "minBeds" INTEGER,
    "minBaths" REAL,
    "minSqft" REAL,
    "propertyTypes" TEXT,
    "yearBuiltMin" INTEGER,
    "yearBuiltMax" INTEGER,
    "lotSizeMin" REAL,
    "hoaMax" REAL,
    "schoolRating" INTEGER,
    CONSTRAINT "SearchCriteria_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "BuyerGroup" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InterestRateSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "source" TEXT NOT NULL,
    "rateType" TEXT NOT NULL,
    "rate" REAL NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PropertyScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "userId" TEXT,
    "score" REAL NOT NULL,
    "type" TEXT NOT NULL,
    "calculatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PropertyScore_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_profileSlug_key" ON "User"("profileSlug");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMembership_groupId_userId_key" ON "GroupMembership"("groupId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");

-- CreateIndex
CREATE UNIQUE INDEX "SearchCriteria_groupId_key" ON "SearchCriteria"("groupId");

-- CreateIndex
CREATE INDEX "PropertyScore_propertyId_idx" ON "PropertyScore"("propertyId");
