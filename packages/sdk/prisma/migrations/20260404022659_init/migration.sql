-- CreateEnum
CREATE TYPE "ChatChannelType" AS ENUM ('DIRECT', 'GROUP');

-- CreateEnum
CREATE TYPE "ChatMessageType" AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE', 'ADMIN', 'POLL');

-- CreateEnum
CREATE TYPE "ChatMemberRole" AS ENUM ('OPERATOR', 'MEMBER');

-- CreateEnum
CREATE TYPE "ChatPushTrigger" AS ENUM ('ALL', 'MENTION_ONLY', 'OFF');

-- CreateEnum
CREATE TYPE "ChatCountPreference" AS ENUM ('ALL', 'UNREAD_MESSAGE_COUNT_ONLY', 'OFF');

-- CreateEnum
CREATE TYPE "ChatScheduledStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "ChatPollStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "ChatReportCategory" AS ENUM ('SPAM', 'HARASSMENT', 'INAPPROPRIATE', 'OTHER');

-- CreateTable
CREATE TABLE "ChatChannel" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "ChatChannelType" NOT NULL,
    "name" TEXT,
    "coverUrl" TEXT,
    "customType" TEXT,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB DEFAULT '{}',
    "lastMessageAt" TIMESTAMP(3),
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ChatChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatChannelMember" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "role" "ChatMemberRole" NOT NULL DEFAULT 'MEMBER',
    "isMuted" BOOLEAN NOT NULL DEFAULT false,
    "mutedUntil" TIMESTAMP(3),
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "bannedUntil" TIMESTAMP(3),
    "banDescription" TEXT,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "hidePrevMessages" BOOLEAN NOT NULL DEFAULT false,
    "pushTrigger" "ChatPushTrigger" NOT NULL DEFAULT 'ALL',
    "countPreference" "ChatCountPreference" NOT NULL DEFAULT 'ALL',
    "lastReadAt" TIMESTAMP(3),
    "lastReadMessageId" TEXT,
    "lastDeliveredAt" TIMESTAMP(3),
    "historyResetAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatChannelMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "type" "ChatMessageType" NOT NULL DEFAULT 'TEXT',
    "text" TEXT,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "thumbnailUrl" TEXT,
    "parentMessageId" TEXT,
    "isForwarded" BOOLEAN NOT NULL DEFAULT false,
    "forwardedFromId" TEXT,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "linkMetadata" JSONB,
    "mentionedUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB,
    "pollId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatReaction" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatPinnedMessage" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "pinnedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatPinnedMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatScheduledMessage" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "type" "ChatMessageType" NOT NULL DEFAULT 'TEXT',
    "text" TEXT,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "thumbnailUrl" TEXT,
    "mentionedUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "ChatScheduledStatus" NOT NULL DEFAULT 'PENDING',
    "sentMessageId" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatScheduledMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatPoll" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "allowMultipleVotes" BOOLEAN NOT NULL DEFAULT false,
    "allowUserSuggestion" BOOLEAN NOT NULL DEFAULT false,
    "closeAt" TIMESTAMP(3),
    "status" "ChatPollStatus" NOT NULL DEFAULT 'OPEN',
    "voterCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatPoll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatPollOption" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "voteCount" INTEGER NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatPollOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatPollVote" (
    "id" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatPollVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatUserBlock" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatUserBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatReport" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "category" "ChatReportCategory" NOT NULL,
    "description" TEXT,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "channelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatChannel_tenantId_updatedAt_idx" ON "ChatChannel"("tenantId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "ChatChannel_tenantId_type_idx" ON "ChatChannel"("tenantId", "type");

-- CreateIndex
CREATE INDEX "ChatChannel_deletedAt_idx" ON "ChatChannel"("deletedAt");

-- CreateIndex
CREATE INDEX "ChatChannelMember_userId_tenantId_leftAt_idx" ON "ChatChannelMember"("userId", "tenantId", "leftAt");

-- CreateIndex
CREATE INDEX "ChatChannelMember_channelId_isBanned_idx" ON "ChatChannelMember"("channelId", "isBanned");

-- CreateIndex
CREATE INDEX "ChatChannelMember_channelId_isMuted_idx" ON "ChatChannelMember"("channelId", "isMuted");

-- CreateIndex
CREATE INDEX "ChatChannelMember_channelId_role_idx" ON "ChatChannelMember"("channelId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "ChatChannelMember_channelId_userId_key" ON "ChatChannelMember"("channelId", "userId");

-- CreateIndex
CREATE INDEX "ChatMessage_channelId_createdAt_idx" ON "ChatMessage"("channelId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ChatMessage_channelId_deletedAt_createdAt_idx" ON "ChatMessage"("channelId", "deletedAt", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ChatMessage_channelId_parentMessageId_createdAt_idx" ON "ChatMessage"("channelId", "parentMessageId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ChatMessage_tenantId_idx" ON "ChatMessage"("tenantId");

-- CreateIndex
CREATE INDEX "ChatMessage_senderId_idx" ON "ChatMessage"("senderId");

-- CreateIndex
CREATE INDEX "ChatMessage_pollId_idx" ON "ChatMessage"("pollId");

-- CreateIndex
CREATE INDEX "ChatReaction_messageId_idx" ON "ChatReaction"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatReaction_messageId_userId_key_key" ON "ChatReaction"("messageId", "userId", "key");

-- CreateIndex
CREATE INDEX "ChatPinnedMessage_channelId_idx" ON "ChatPinnedMessage"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatPinnedMessage_channelId_messageId_key" ON "ChatPinnedMessage"("channelId", "messageId");

-- CreateIndex
CREATE INDEX "ChatScheduledMessage_channelId_status_scheduledAt_idx" ON "ChatScheduledMessage"("channelId", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "ChatScheduledMessage_status_scheduledAt_idx" ON "ChatScheduledMessage"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "ChatScheduledMessage_senderId_idx" ON "ChatScheduledMessage"("senderId");

-- CreateIndex
CREATE INDEX "ChatPoll_channelId_idx" ON "ChatPoll"("channelId");

-- CreateIndex
CREATE INDEX "ChatPollOption_pollId_idx" ON "ChatPollOption"("pollId");

-- CreateIndex
CREATE INDEX "ChatPollVote_userId_idx" ON "ChatPollVote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatPollVote_optionId_userId_key" ON "ChatPollVote"("optionId", "userId");

-- CreateIndex
CREATE INDEX "ChatUserBlock_blockerId_tenantId_idx" ON "ChatUserBlock"("blockerId", "tenantId");

-- CreateIndex
CREATE INDEX "ChatUserBlock_blockedId_tenantId_idx" ON "ChatUserBlock"("blockedId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatUserBlock_blockerId_blockedId_key" ON "ChatUserBlock"("blockerId", "blockedId");

-- CreateIndex
CREATE INDEX "ChatReport_tenantId_targetType_idx" ON "ChatReport"("tenantId", "targetType");

-- CreateIndex
CREATE INDEX "ChatReport_reporterId_idx" ON "ChatReport"("reporterId");

-- AddForeignKey
ALTER TABLE "ChatChannelMember" ADD CONSTRAINT "ChatChannelMember_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "ChatChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "ChatChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatReaction" ADD CONSTRAINT "ChatReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatPinnedMessage" ADD CONSTRAINT "ChatPinnedMessage_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "ChatChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatScheduledMessage" ADD CONSTRAINT "ChatScheduledMessage_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "ChatChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatPollOption" ADD CONSTRAINT "ChatPollOption_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "ChatPoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatPollVote" ADD CONSTRAINT "ChatPollVote_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "ChatPollOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
