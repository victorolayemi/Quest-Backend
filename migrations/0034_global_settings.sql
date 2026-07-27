-- CreateTable
CREATE TABLE "GlobalSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "videoUploadSizeLimitMB" INTEGER NOT NULL DEFAULT 50,
    "videoUploadDurationLimitSec" INTEGER NOT NULL DEFAULT 300,
    "audioUploadSizeLimitMB" INTEGER NOT NULL DEFAULT 50,
    "audioUploadDurationLimitSec" INTEGER NOT NULL DEFAULT 1800,
    "devotionVideoSizeLimitMB" INTEGER NOT NULL DEFAULT 50,
    "devotionVideoDurationLimitSec" INTEGER NOT NULL DEFAULT 300,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GlobalSettings_pkey" PRIMARY KEY ("id")
);
