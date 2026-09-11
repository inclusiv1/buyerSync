-- CreateTable
CREATE TABLE "AssistantThread" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastMessageAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AssistantThread_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "BuyerGroup" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AssistantThread_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssistantMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "requestKey" TEXT,
    "authorId" TEXT,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "citations" TEXT NOT NULL DEFAULT '[]',
    "toolSummaries" TEXT NOT NULL DEFAULT '[]',
    "provider" TEXT,
    "model" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "totalTokens" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AssistantMessage_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "BuyerGroup" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AssistantMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "AssistantThread" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AssistantMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssistantToolRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "messageId" TEXT,
    "invokedById" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "isWrite" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "idempotencyKey" TEXT,
    "inputSummary" TEXT,
    "outputSummary" TEXT,
    "errorCategory" TEXT,
    "errorMessage" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AssistantToolRun_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "BuyerGroup" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AssistantToolRun_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "AssistantThread" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AssistantToolRun_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "AssistantMessage" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AssistantToolRun_invokedById_fkey" FOREIGN KEY ("invokedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AssistantThread_groupId_lastMessageAt_id_idx" ON "AssistantThread"("groupId", "lastMessageAt", "id");

-- CreateIndex
CREATE INDEX "AssistantThread_createdById_idx" ON "AssistantThread"("createdById");

-- CreateIndex
CREATE INDEX "AssistantMessage_threadId_createdAt_id_idx" ON "AssistantMessage"("threadId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "AssistantMessage_groupId_createdAt_id_idx" ON "AssistantMessage"("groupId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "AssistantMessage_authorId_idx" ON "AssistantMessage"("authorId");

-- CreateIndex
CREATE UNIQUE INDEX "AssistantToolRun_groupId_idempotencyKey_key" ON "AssistantToolRun"("groupId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "AssistantToolRun_threadId_createdAt_id_idx" ON "AssistantToolRun"("threadId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "AssistantToolRun_messageId_idx" ON "AssistantToolRun"("messageId");

-- CreateIndex
CREATE INDEX "AssistantToolRun_invokedById_idx" ON "AssistantToolRun"("invokedById");