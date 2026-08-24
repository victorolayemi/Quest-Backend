import { FCMService } from '../services/fcm';
import { dispatchNotification } from '../services/notificationService';

import { Hono } from 'hono';
import { getDrizzle } from '../utils/drizzle';
import { eq, desc, count, countDistinct, gte } from 'drizzle-orm';
import { 
  user, adminAuditLog, appFeature, notification, 
  community, post, subscription, report, feedback
} from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { adminAuthMiddleware } from '../middleware/adminAuth';
import * as firebaseAdmin from 'firebase-admin';

// src/routes/admin.ts
import { Bindings, Variables } from '../types';
var admin = new Hono<{Bindings: Bindings, Variables: Variables}>();
admin.use("*", adminAuthMiddleware);

admin.post("/upload", async (c) => {
  const formData = await c.req.formData();
  const file = formData.get("file") as File;
  if (!file || !file.size) return c.json({ error: "No file provided" }, 400);

  const fileKey = `admin-uploads/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
  const fileBuffer = await file.arrayBuffer();
  if (c.env.MEDIA_BUCKET) {
    await c.env.MEDIA_BUCKET.put(fileKey, fileBuffer, {
      httpMetadata: { contentType: file.type }
    });
  }
  
  const origin = new URL(c.req.url).origin;
  const url = `${origin}/api/v1/media/download/${fileKey}`;
  return c.json({ url });
});

async function hashPassword2(password: string, existingSalt?: string) {
  const encoder2 = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    encoder2.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  let salt;
  if (existingSalt) {
    salt = new Uint8Array((existingSalt.match(/.{1,2}/g) || []).map((byte: any) => parseInt(byte, 16)));
  } else {
    salt = crypto.getRandomValues(new Uint8Array(16));
  }
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 1e5,
      hash: "SHA-256"
    },
    passwordKey,
    256
  );
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b: number) => b.toString(16).padStart(2, "0")).join("");
  const saltHex = Array.from(salt).map((b: number) => b.toString(16).padStart(2, "0")).join("");
  return `${saltHex}:${hashHex}`;
}

admin.get("/users", async (c) => {
  const db = getDrizzle(c.env.DB);
  try {
    const users2 = await db.query.user.findMany({
      columns: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        isAdmin: true,
        isBanned: true,
        isCommunityRestricted: true,
        createdAt: true,
      },
      with: {
        subscriptions: {
          where: eq(subscription.status, "active"),
          columns: { status: true }
        }
      },
      orderBy: [desc(user.createdAt)]
    });
    return c.json({ users: users2 });
  } catch (error: any) {
    return c.json({ error: "Failed to fetch users" }, 500);
  }
});

admin.patch("/users/:id/role", async (c) => {
  const db = getDrizzle(c.env.DB);
  const id = c.req.param("id");
  try {
    const body = await c.req.json() as any;
    const { isAdmin } = body;
    const [updatedUser] = await db.update(user).set({ isAdmin }).where(eq(user.id, id)).returning();
    return c.json({ user: updatedUser });
  } catch (error: any) {
    return c.json({ error: "Failed to update user role" }, 500);
  }
});

admin.patch("/users/:id/ban", async (c) => {
  const db = getDrizzle(c.env.DB);
  const id = c.req.param("id");
  try {
    const body = await c.req.json() as any;
    const { isBanned } = body;
    const [updatedUser] = await db.update(user).set({ isBanned }).where(eq(user.id, id)).returning();
    return c.json({ user: updatedUser });
  } catch (error: any) {
    return c.json({ error: "Failed to update ban status" }, 500);
  }
});

admin.patch("/users/:id/restrict", async (c) => {
  const db = getDrizzle(c.env.DB);
  const id = c.req.param("id");
  try {
    const body = await c.req.json() as any;
    const { isRestricted } = body;
    
    // For a general restriction, we restrict from community and set a media restriction for 7 days
    const mediaRestrictionExpiry = isRestricted 
      ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const [updatedUser] = await db.update(user).set({ 
        isCommunityRestricted: isRestricted,
        mediaRestrictionExpiry
    }).where(eq(user.id, id)).returning();
    
    return c.json({ user: updatedUser });
  } catch (error: any) {
    return c.json({ error: "Failed to update restriction status" }, 500);
  }
});

admin.get("/users/:id/profile", async (c) => {
  const db = getDrizzle(c.env.DB);
  const id = c.req.param("id");
  try {
    const profileUser = await db.query.user.findFirst({
      where: eq(user.id, id),
      with: {
        loginHistories: { orderBy: (h, { desc }) => [desc(h.createdAt)] },
        communityMembers: { with: { community: true } },
        posts: { orderBy: (p, { desc }) => [desc(p.createdAt)] },
        friendRequests_receiverId: { with: { user_senderId: true } },
        friendRequests_senderId: { with: { user_receiverId: true } },
        earnedBadges: { with: { badge: true } },
        userPlanProgresses: true
      }
    });
    if (!profileUser) return c.json({ error: "User not found" }, 404);
    const { password, ...safeUser } = profileUser;
    return c.json({ profile: safeUser });
  } catch (error: any) {
    return c.json({ error: "Failed to fetch user profile" }, 500);
  }
});

admin.patch("/users/:id/profile", async (c) => {
  const db = getDrizzle(c.env.DB);
  const id = c.req.param("id");
  try {
    const body = await c.req.json() as any;
    const { firstName, lastName, username, bio, avatarUrl } = body;
    
    const updateData: any = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (username !== undefined) updateData.username = username;
    if (bio !== undefined) updateData.bio = bio;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
    
    const [updatedUser] = await db.update(user).set(updateData).where(eq(user.id, id)).returning();
    const { password, ...safeUser } = updatedUser;
    return c.json({ user: safeUser });
  } catch (error: any) {
    return c.json({ error: "Failed to update user profile" }, 500);
  }
});

admin.patch("/users/:id/password", async (c) => {
  const db = getDrizzle(c.env.DB);
  const id = c.req.param("id");
  try {
    const body = await c.req.json() as any;
    const { newPassword } = body;
    if (!newPassword || newPassword.length < 6) {
      return c.json({ error: "Password must be at least 6 characters" }, 400);
    }
    const hashedPassword = await hashPassword2(newPassword);
    await db.update(user).set({ password: hashedPassword }).where(eq(user.id, id));
    return c.json({ message: "Password updated successfully" });
  } catch (error: any) {
    return c.json({ error: "Failed to update password" }, 500);
  }
});

admin.patch("/users/:id/badge", async (c) => {
  const db = getDrizzle(c.env.DB);
  const id = c.req.param("id");
  const adminUserId = c.get("userId") as string;
  
  try {
    const body = await c.req.json() as any;
    const { badge, reason } = body;
    
    if (!reason || reason.trim() === '') {
      return c.json({ error: "Audit reason is required for assigning badges" }, 400);
    }

    const validBadges = ["NONE", "BLUE", "GOLD"];
    if (!validBadges.includes(badge)) {
      return c.json({ error: "Invalid badge level" }, 400);
    }

    const [updatedUser] = await db.update(user).set({ verificationBadge: badge }).where(eq(user.id, id)).returning();

    await db.insert(adminAuditLog).values({
        id: crypto.randomUUID(),
        adminId: adminUserId,
        targetId: id,
        action: `SET_BADGE_${badge}`,
        reason: reason
    });

    return c.json({ message: "Badge updated successfully", user: { id: updatedUser.id, verificationBadge: updatedUser.verificationBadge } });
  } catch (error: any) {
    return c.json({ error: "Failed to update badge" }, 500);
  }
});

admin.get("/features", async (c) => {
  const db = getDrizzle(c.env.DB);
  try {
    const features = await db.query.appFeature.findMany();
    return c.json({ features });
  } catch (error: any) {
    return c.json({ error: "Failed to fetch features" }, 500);
  }
});

admin.patch("/features/:key", async (c) => {
  const db = getDrizzle(c.env.DB);
  const key = c.req.param("key");
  try {
    const body = await c.req.json() as any;
    const { isEnabled, value } = body;
    
    const [feature] = await db.insert(appFeature).values({
        id: crypto.randomUUID(),
        key,
        isEnabled,
        value
    }).onConflictDoUpdate({
        target: appFeature.key,
        set: { isEnabled, value }
    }).returning();
    
    return c.json({ feature });
  } catch (error: any) {
    return c.json({ error: "Failed to update feature" }, 500);
  }
});

admin.post("/users/:id/notify", async (c) => {
  const db = getDrizzle(c.env.DB);
  const id = c.req.param("id");
  try {
    const { title, body, data } = await c.req.json() as any;
    if (!title || !body) return c.json({ error: "Title and body are required" }, 400);
    
    const notifyUser = await db.query.user.findFirst({ where: eq(user.id, id), columns: { fcmToken: true } });
    if (!notifyUser || !notifyUser.fcmToken) return c.json({ error: "User does not have a registered push token" }, 400);
    
    if (!c.env.FIREBASE_CLIENT_EMAIL || !c.env.FIREBASE_PRIVATE_KEY) {
      return c.json({ error: "Firebase credentials are not configured on the server" }, 500);
    }
    
    await db.insert(notification).values({
        id: crypto.randomUUID(),
        userId: id,
        title,
        message: body,
        type: "SYSTEM"
    });
    
    try {
      const fcm = new FCMService(c.env.FIREBASE_CLIENT_EMAIL, c.env.FIREBASE_PRIVATE_KEY);
      await fcm.sendNotification({
        token: notifyUser.fcmToken,
        notification: { title, body },
        data
      });
    } catch (pushError: any) {
      console.error("Push notification failed:", pushError.message);
      return c.json({ success: true, message: "Notification saved, but push failed: " + pushError.message });
    }
    return c.json({ success: true, message: "Notification sent and saved" });
  } catch (error: any) {
    console.error("Failed to notify user:", error);
    return c.json({ error: error.message || "Failed to send notification" }, 500);
  }
});

admin.post("/notify-all", async (c) => {
  const db = getDrizzle(c.env.DB);
  try {
    const { title, body, data } = await c.req.json() as any;
    if (!title || !body) return c.json({ error: "Title and body are required" }, 400);
    
    const users2 = await db.query.user.findMany({
      columns: { id: true, fcmToken: true }
    });
    
    if (users2.length === 0) return c.json({ error: "No users found" }, 400);
    
    let fcm = null;
    if (c.env.FIREBASE_CLIENT_EMAIL && c.env.FIREBASE_PRIVATE_KEY) {
      fcm = new FCMService(c.env.FIREBASE_CLIENT_EMAIL, c.env.FIREBASE_PRIVATE_KEY);
    }
    let sentCount = 0;
    let failCount = 0;
    
    await Promise.all(users2.map(async (u: any) => {
      try {
        await db.insert(notification).values({
            id: crypto.randomUUID(),
            userId: u.id,
            title,
            message: body,
            type: "SYSTEM"
        });
        
        if (fcm && u.fcmToken) {
          await fcm.sendNotification({
            token: u.fcmToken,
            notification: { title, body },
            data
          });
          sentCount++;
        }
      } catch (e) {
        failCount++;
      }
    }));
    return c.json({ success: true, sentCount, failCount, message: `Sent to ${sentCount} devices, created ${users2.length} DB records, failed for ${failCount}` });
  } catch (error: any) {
    return c.json({ error: error.message || "Failed to send global notification" }, 500);
  }
});

admin.get("/dashboard-stats", async (c) => {
  const db = getDrizzle(c.env.DB);
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();

    const [
      [{ value: totalUsers }],
      [{ value: bannedUsers }],
      [{ value: adminUsers }],
      [{ value: newUsers30d }],
      [{ value: totalCommunities }],
      [{ value: totalPosts }],
      [{ value: activeSubscriptions }],
      [{ value: pendingReports }],
      recentUsers,
      recentPosts
    ] = await Promise.all([
      db.select({ value: count() }).from(user),
      db.select({ value: count() }).from(user).where(eq(user.isBanned, true)),
      db.select({ value: count() }).from(user).where(eq(user.isAdmin, true)),
      db.select({ value: count() }).from(user).where(gte(user.createdAt, thirtyDaysAgoStr)),
      db.select({ value: count() }).from(community),
      db.select({ value: count() }).from(post),
      db.select({ value: count() }).from(subscription).where(eq(subscription.status, 'active')),
      db.select({ value: count() }).from(report).where(eq(report.status, 'PENDING')),
      db.query.user.findMany({
        where: gte(user.createdAt, thirtyDaysAgoStr),
        columns: { createdAt: true }
      }),
      db.query.post.findMany({
        where: gte(post.createdAt, thirtyDaysAgoStr),
        columns: { createdAt: true }
      })
    ]);

    const groupByDate = (data: { createdAt: string | null }[]) => {
      const grouped = data.reduce((acc: any, item) => {
        if (!item.createdAt) return acc;
        const dateStr = new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        acc[dateStr] = (acc[dateStr] || 0) + 1;
        return acc;
      }, {});
      return Object.keys(grouped).map(key => ({ name: key, value: grouped[key] }));
    };

    return c.json({
      metrics: {
        totalUsers,
        bannedUsers,
        adminUsers,
        newUsers30d,
        totalCommunities,
        totalPosts,
        activeSubscriptions,
        pendingReports
      },
      charts: {
        userGrowth: groupByDate(recentUsers),
        contentGrowth: groupByDate(recentPosts)
      }
    });
  } catch (error: any) {
    console.error("Dashboard Stats Error:", error);
    return c.json({ error: "Failed to fetch dashboard stats" }, 500);
  }
});

admin.get("/subscriptions", async (c) => {
  const db = getDrizzle(c.env.DB);
  try {
    const subscriptions = await db.query.subscription.findMany({
      with: {
        user: { columns: { id: true, username: true, email: true, firstName: true, lastName: true, avatarUrl: true } }
      },
      orderBy: [desc(subscription.createdAt)]
    });

    const totalActive = subscriptions.filter(s => s.status === "active").length;
    const totalExpired = subscriptions.filter(s => s.status === "expired").length;
    const totalCancelled = subscriptions.filter(s => s.status === "cancelled").length;
    
    const appleActive = subscriptions.filter(s => s.status === "active" && s.platform === "apple").length;
    const googleActive = subscriptions.filter(s => s.status === "active" && s.platform === "google").length;
    
    const estimatedMRR = totalActive * 4.99;

    return c.json({
      analytics: {
        totalActive,
        totalExpired,
        totalCancelled,
        appleActive,
        googleActive,
        estimatedMRR
      },
      auditLog: subscriptions
    });
  } catch (error: any) {
    return c.json({ error: "Failed to fetch subscriptions" }, 500);
  }
});

admin.get("/feedback", async (c) => {
  const db = getDrizzle(c.env);
  try {
    const feedbacks = await db
      .select({
        id: feedback.id,
        userId: feedback.userId,
        type: feedback.type,
        content: feedback.content,
        status: feedback.status,
        createdAt: feedback.createdAt,
        user: {
          id: user.id,
          username: user.username,
          avatarUrl: user.avatarUrl,
        }
      })
      .from(feedback)
      .leftJoin(user, eq(feedback.userId, user.id))
      .orderBy(desc(feedback.createdAt));

    return c.json({ feedbacks });
  } catch (error: any) {
    console.error("Failed to fetch feedback:", error);
    return c.json({ error: "Failed to fetch feedback" }, 500);
  }
});

admin.put("/feedback/:id/status", async (c) => {
  const db = getDrizzle(c.env);
  const feedbackId = c.req.param("id");
  try {
    const { status } = await c.req.json();
    if (!status) return c.json({ error: "Status is required" }, 400);

    const result = await db.update(feedback)
      .set({ status })
      .where(eq(feedback.id, feedbackId))
      .returning();

    return c.json({ feedback: result[0] });
  } catch (error: any) {
    console.error("Failed to update feedback status:", error);
    return c.json({ error: "Failed to update feedback status" }, 500);
  }
});

export default admin;
