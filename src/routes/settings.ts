import { Hono } from "hono";
import { getPrisma } from "../utils/prisma";
import { authMiddleware } from "../middleware/auth";
import { adminAuthMiddleware } from "../middleware/adminAuth";

const settings = new Hono<{ Bindings: { DB: D1Database } }>();

// Public endpoint to get non-sensitive settings (e.g., OTP enabled)
settings.get("/public", async (c) => {
  const prisma = getPrisma(c.env.DB);
  let globalSettings = await prisma.globalSettings.findUnique({ where: { id: "default" } });
  
  if (!globalSettings) {
    globalSettings = await prisma.globalSettings.create({
      data: { id: "default" }
    });
  }
  
  return c.json({ 
    settings: {
      registrationOtpEnabled: globalSettings.registrationOtpEnabled
    } 
  });
});

// User endpoint to get current settings
settings.get("/", authMiddleware, async (c) => {
  const prisma = getPrisma(c.env.DB);
  let globalSettings = await prisma.globalSettings.findUnique({ where: { id: "default" } });
  
  if (!globalSettings) {
    globalSettings = await prisma.globalSettings.create({
      data: { id: "default" }
    });
  }
  
  return c.json({ settings: globalSettings });
});

// Admin endpoint to update settings
settings.put("/admin", adminAuthMiddleware, async (c) => {
  const prisma = getPrisma(c.env.DB);
  const body = await c.req.json();
  
  let globalSettings = await prisma.globalSettings.findUnique({ where: { id: "default" } });
  if (!globalSettings) {
    globalSettings = await prisma.globalSettings.create({ data: { id: "default" } });
  }

  const updatedSettings = await prisma.globalSettings.update({
    where: { id: "default" },
    data: {
      videoUploadSizeLimitMB: body.videoUploadSizeLimitMB ?? globalSettings.videoUploadSizeLimitMB,
      videoUploadDurationLimitSec: body.videoUploadDurationLimitSec ?? globalSettings.videoUploadDurationLimitSec,
      audioUploadSizeLimitMB: body.audioUploadSizeLimitMB ?? globalSettings.audioUploadSizeLimitMB,
      audioUploadDurationLimitSec: body.audioUploadDurationLimitSec ?? globalSettings.audioUploadDurationLimitSec,
      devotionVideoSizeLimitMB: body.devotionVideoSizeLimitMB ?? globalSettings.devotionVideoSizeLimitMB,
      devotionVideoDurationLimitSec: body.devotionVideoDurationLimitSec ?? globalSettings.devotionVideoDurationLimitSec,
      registrationOtpEnabled: body.registrationOtpEnabled ?? globalSettings.registrationOtpEnabled,
    }
  });

  return c.json({ message: "Settings updated successfully", settings: updatedSettings });
});

export default settings;
