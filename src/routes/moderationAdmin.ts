import { Hono } from 'hono';
import { getDrizzle } from '../utils/drizzle';
import { Bindings, Variables } from '../types';
import { FCMService } from '../services/fcm';
import { dispatchNotification } from '../services/notificationService';
import {
  report, post, groupMessage, communityMessage, directMessage, comment,
  communityMessageComment, userMedia, community, user, postReport, chatClear,
  appFeature
} from '../db/schema';
import { eq, and } from 'drizzle-orm';

const moderationAdmin = new Hono<{Bindings: Bindings, Variables: Variables}>();

// Get all reports (new Report table)
moderationAdmin.get("/reports", async (c) => {
  const db = getDrizzle(c.env.DB);

  const reports = await db.query.report.findMany({
    with: {
      user: { columns: { username: true, firstName: true, lastName: true } }
    },
    orderBy: (r, { desc }) => [desc(r.createdAt)]
  });

  const enrichedReports = await Promise.all(reports.map(async (rep) => {
    let content: any = null;
    let actualReportedUserId = rep.reportedUserId;

    if (rep.itemType === "POST") {
      const rows = await db.select().from(post).where(eq(post.id, rep.itemId));
      content = rows[0] || null;
      if (content && !actualReportedUserId) actualReportedUserId = content.userId;
    } else if (rep.itemType === "COMMUNITY_ADMIN_MESSAGE") {
      const rows = await db.select().from(groupMessage).where(eq(groupMessage.id, rep.itemId));
      content = rows[0] || null;
      if (content && !actualReportedUserId) actualReportedUserId = content.senderId;
    } else if (rep.itemType === "COMMUNITY_FORUM") {
      const rows = await db.select().from(communityMessage).where(eq(communityMessage.id, rep.itemId));
      content = rows[0] || null;
      if (content && !actualReportedUserId) actualReportedUserId = content.senderId;
    } else if (rep.itemType === "DIRECT_MESSAGE") {
      const rows = await db.select().from(directMessage).where(eq(directMessage.id, rep.itemId));
      content = rows[0] || null;
      if (content && !actualReportedUserId) actualReportedUserId = content.senderId;
    } else if (rep.itemType === "POST_COMMENT") {
      const rows = await db.select().from(comment).where(eq(comment.id, rep.itemId));
      content = rows[0] || null;
      if (content && !actualReportedUserId) actualReportedUserId = content.userId;
    } else if (rep.itemType === "MESSAGE_COMMENT") {
      const rows = await db.select().from(communityMessageComment).where(eq(communityMessageComment.id, rep.itemId));
      content = rows[0] || null;
      if (content && !actualReportedUserId) actualReportedUserId = content.userId;
    } else if (["VIDEO", "AUDIO", "VIDEO_REEL", "AUDIO_REEL"].includes(rep.itemType)) {
      const rows = await db.select().from(userMedia).where(eq(userMedia.id, rep.itemId));
      content = rows[0] || null;
      if (content && !actualReportedUserId) actualReportedUserId = content.userId;
    } else if (rep.itemType === "COMMUNITY") {
      const rows = await db.select().from(community).where(eq(community.id, rep.itemId));
      content = rows[0] || null;
      if (content && !actualReportedUserId && content.creatorId) actualReportedUserId = content.creatorId;
    }

    let reportedUser: any = null;
    if (actualReportedUserId) {
      const rows = await db.select({
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName
      }).from(user).where(eq(user.id, actualReportedUserId));
      reportedUser = rows[0] || null;
    }

    return {
      ...rep,
      reportedUserId: actualReportedUserId,
      reporter: rep.user,
      reportedUser,
      content
    };
  }));

  return c.json({ reports: enrichedReports });
});

// Get pending reports count
moderationAdmin.get("/reports/pending-count", async (c) => {
  const db = getDrizzle(c.env.DB);
  const rows = await db.select().from(report).where(eq(report.status, "PENDING"));
  return c.json({ count: rows.length });
});

// Update report status
moderationAdmin.put("/reports/:id/status", async (c) => {
  const db = getDrizzle(c.env.DB);
  const { status } = await c.req.json() as any;
  const [updatedReport] = await db.update(report)
    .set({ status })
    .where(eq(report.id, c.req.param("id")))
    .returning();
  return c.json({ success: true, report: updatedReport });
});

// Execute action on report
moderationAdmin.post("/reports/:id/action", async (c) => {
  const db = getDrizzle(c.env.DB);
  const { action, mediaRestrictionDays = 7 } = await c.req.json() as any;

  const rows = await db.select().from(report).where(eq(report.id, c.req.param("id")));
  const rep = rows[0];

  if (!rep) {
    return c.json({ error: "Report not found" }, 404);
  }

  try {
    switch (action) {
      case "DELETE_ITEM":
        if (rep.itemType === "POST") {
          await db.delete(post).where(eq(post.id, rep.itemId));
        } else if (rep.itemType === "COMMUNITY_ADMIN_MESSAGE") {
          await db.delete(groupMessage).where(eq(groupMessage.id, rep.itemId));
        } else if (rep.itemType === "COMMUNITY_FORUM") {
          await db.delete(communityMessage).where(eq(communityMessage.id, rep.itemId));
        } else if (rep.itemType === "DIRECT_MESSAGE") {
          await db.delete(directMessage).where(eq(directMessage.id, rep.itemId));
        } else if (rep.itemType === "POST_COMMENT") {
          await db.delete(comment).where(eq(comment.id, rep.itemId));
        } else if (rep.itemType === "MESSAGE_COMMENT") {
          await db.delete(communityMessageComment).where(eq(communityMessageComment.id, rep.itemId));
        } else if (["VIDEO", "AUDIO", "VIDEO_REEL", "AUDIO_REEL"].includes(rep.itemType)) {
          await db.delete(userMedia).where(eq(userMedia.id, rep.itemId));
        }
        break;

      case "BAN_USER":
        if (rep.reportedUserId) {
          await db.update(user)
            .set({ isBanned: true })
            .where(eq(user.id, rep.reportedUserId));
        }
        break;

      case "RESTRICT_USER_COMMUNITY":
        if (rep.reportedUserId) {
          await db.update(user)
            .set({ isCommunityRestricted: true })
            .where(eq(user.id, rep.reportedUserId));
        }
        break;

      case "RESTRICT_USER_MEDIA":
        if (rep.reportedUserId) {
          const featureRows = await db.select().from(appFeature).where(eq(appFeature.key, "media_restriction_days"));
          const feature = featureRows[0];
          const days = feature && feature.value ? parseInt(feature.value) : mediaRestrictionDays;

          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + days);

          await db.update(user)
            .set({ mediaRestrictionExpiry: expiryDate.toISOString() })
            .where(eq(user.id, rep.reportedUserId));
        }
        break;

      case "ISSUE_WARNING":
        if (rep.reportedUserId) {
          const fcm = new FCMService(c.env.FIREBASE_CLIENT_EMAIL, c.env.FIREBASE_PRIVATE_KEY);
          await dispatchNotification({
            db,
            userId: rep.reportedUserId,
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

// Legacy endpoint (backwards compatibility)
moderationAdmin.delete("/reports/legacy/:id", async (c) => {
  const db = getDrizzle(c.env.DB);
  await db.delete(postReport).where(eq(postReport.id, c.req.param("id")));
  return c.json({ success: true });
});

moderationAdmin.delete("/posts/:id", async (c) => {
  const db = getDrizzle(c.env.DB);
  await db.delete(post).where(eq(post.id, c.req.param("id")));
  return c.json({ success: true });
});

moderationAdmin.get("/chat-clears", async (c) => {
  const db = getDrizzle(c.env.DB);
  const clears = await db.query.chatClear.findMany({
    with: {
      user: { columns: { username: true } }
    },
    orderBy: (cc, { desc }) => [desc(cc.clearedAt)]
  });
  return c.json({ clears });
});

export default moderationAdmin;
