import { Hono } from 'hono';
import { getPrisma } from '../utils/prisma';
import { Bindings, Variables } from '../types';
import { FCMService } from '../services/fcm';
import { dispatchNotification } from '../services/notificationService';

const moderationAdmin = new Hono<{Bindings: Bindings, Variables: Variables}>();

// Get all reports (new Report table)
moderationAdmin.get("/reports", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const reports = await prisma.report.findMany({
    include: {
      user: { select: { username: true, firstName: true, lastName: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  const enrichedReports = await Promise.all(reports.map(async (report) => {
    let content = null;
    let actualReportedUserId = report.reportedUserId;

    if (report.itemType === "POST") {
      content = await prisma.post.findUnique({ where: { id: report.itemId } });
      if (content && !actualReportedUserId) actualReportedUserId = content.userId;
    } else if (report.itemType === "COMMUNITY_ADMIN_MESSAGE") {
      content = await prisma.groupMessage.findUnique({ where: { id: report.itemId } });
      if (content && !actualReportedUserId) actualReportedUserId = content.senderId;
    } else if (report.itemType === "COMMUNITY_FORUM") {
      content = await prisma.communityMessage.findUnique({ where: { id: report.itemId } });
      if (content && !actualReportedUserId) actualReportedUserId = content.senderId;
    } else if (report.itemType === "DIRECT_MESSAGE") {
      content = await prisma.directMessage.findUnique({ where: { id: report.itemId } });
      if (content && !actualReportedUserId) actualReportedUserId = content.senderId;
    } else if (report.itemType === "POST_COMMENT") {
      content = await prisma.comment.findUnique({ where: { id: report.itemId } });
      if (content && !actualReportedUserId) actualReportedUserId = content.userId;
    } else if (report.itemType === "MESSAGE_COMMENT") {
      content = await prisma.communityMessageComment.findUnique({ where: { id: report.itemId } });
      if (content && !actualReportedUserId) actualReportedUserId = content.userId;
    } else if (report.itemType === "VIDEO" || report.itemType === "AUDIO" || report.itemType === "VIDEO_REEL" || report.itemType === "AUDIO_REEL") {
      content = await prisma.userMedia.findUnique({ where: { id: report.itemId } });
      if (content && !actualReportedUserId) actualReportedUserId = content.userId;
    } else if (report.itemType === "COMMUNITY") {
      content = await prisma.community.findUnique({ where: { id: report.itemId } });
      if (content && !actualReportedUserId && content.creatorId) actualReportedUserId = content.creatorId;
    }

    let reportedUser = null;
    if (actualReportedUserId) {
      reportedUser = await prisma.user.findUnique({
        where: { id: actualReportedUserId },
        select: { id: true, username: true, firstName: true, lastName: true }
      });
    }

    return {
      ...report,
      reportedUserId: actualReportedUserId,
      reporter: report.user,
      reportedUser,
      content
    };
  }));

  return c.json({ reports: enrichedReports });
});

// Get pending reports count
moderationAdmin.get("/reports/pending-count", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const count = await prisma.report.count({
    where: { status: "PENDING" }
  });
  return c.json({ count });
});

// Update report status
moderationAdmin.put("/reports/:id/status", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const { status } = await c.req.json();
  const report = await prisma.report.update({
    where: { id: c.req.param("id") },
    data: { status }
  });
  return c.json({ success: true, report });
});

// Execute action on report
moderationAdmin.post("/reports/:id/action", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const { action, mediaRestrictionDays = 7 } = await c.req.json();
  const report = await prisma.report.findUnique({
    where: { id: c.req.param("id") }
  });

  if (!report) {
    return c.json({ error: "Report not found" }, 404);
  }

  try {
    switch (action) {
      case "DELETE_ITEM":
        // Depending on itemType, delete the item
        if (report.itemType === "POST") {
          await prisma.post.delete({ where: { id: report.itemId } });
        } else if (report.itemType === "COMMUNITY_ADMIN_MESSAGE") {
          await prisma.groupMessage.delete({ where: { id: report.itemId } });
        } else if (report.itemType === "COMMUNITY_FORUM") {
          await prisma.communityMessage.delete({ where: { id: report.itemId } });
        } else if (report.itemType === "DIRECT_MESSAGE") {
          await prisma.directMessage.delete({ where: { id: report.itemId } });
        } else if (report.itemType === "POST_COMMENT") {
          await prisma.comment.delete({ where: { id: report.itemId } });
        } else if (report.itemType === "MESSAGE_COMMENT") {
          await prisma.communityMessageComment.delete({ where: { id: report.itemId } });
        } else if (report.itemType === "VIDEO" || report.itemType === "AUDIO" || report.itemType === "VIDEO_REEL" || report.itemType === "AUDIO_REEL") {
          await prisma.userMedia.delete({ where: { id: report.itemId } });
        }
        break;
      
      case "BAN_USER":
        if (report.reportedUserId) {
          await prisma.user.update({
            where: { id: report.reportedUserId },
            data: { isBanned: true }
          });
        }
        break;

      case "RESTRICT_USER_COMMUNITY":
        if (report.reportedUserId) {
          await prisma.user.update({
            where: { id: report.reportedUserId },
            data: { isCommunityRestricted: true }
          });
        }
        break;

      case "RESTRICT_USER_MEDIA":
        if (report.reportedUserId) {
          // Get configurable days
          const feature = await prisma.appFeature.findUnique({ where: { key: "media_restriction_days" } });
          const days = feature && feature.value ? parseInt(feature.value) : mediaRestrictionDays;
          
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + days);
          
          await prisma.user.update({
            where: { id: report.reportedUserId },
            data: { mediaRestrictionExpiry: expiryDate }
          });
        }
        break;

      case "ISSUE_WARNING":
        if (report.reportedUserId) {
          const fcm = new FCMService(c.env.FCM_PROJECT_ID, c.env.FCM_CLIENT_EMAIL, c.env.FCM_PRIVATE_KEY);
          await dispatchNotification({
            prisma,
            userId: report.reportedUserId,
            title: "Warning: Community Guidelines Violation",
            message: "Your recent content or behavior was reported and found to violate our community guidelines. Please review our guidelines to avoid account restriction.",
            type: "SYSTEM",
            fcm
          });
        }
        break;

      default:
        return c.json({ error: "Invalid action" }, 400);
    }
    return c.json({ success: true });
  } catch (err) {
    console.error("Action error:", err);
    return c.json({ error: "Failed to execute action" }, 500);
  }
});

// Old endpoints (for backwards compatibility if needed, or remove them)
moderationAdmin.delete("/reports/legacy/:id", async (c) => {
  const prisma = getPrisma(c.env.DB);
  await prisma.postReport.delete({ where: { id: c.req.param("id") } });
  return c.json({ success: true });
});

moderationAdmin.delete("/posts/:id", async (c) => {
  const prisma = getPrisma(c.env.DB);
  await prisma.post.delete({ where: { id: c.req.param("id") } });
  return c.json({ success: true });
});

moderationAdmin.get("/chat-clears", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const clears = await prisma.chatClear.findMany({
    include: { user: { select: { username: true } } },
    orderBy: { clearedAt: "desc" }
  });
  return c.json({ clears });
});

export default moderationAdmin;
