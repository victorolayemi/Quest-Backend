ALTER TABLE "CommunityMessage" ADD COLUMN "title" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "isAutoRenewing" BOOLEAN NOT NULL DEFAULT true;
