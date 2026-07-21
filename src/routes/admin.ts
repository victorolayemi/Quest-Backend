
import { FCMService } from '../services/fcm';
import { dispatchNotification } from '../services/notificationService';

import { Hono } from 'hono';
import { getPrisma } from '../utils/prisma';
import { authMiddleware } from '../middleware/auth';
import { adminAuthMiddleware } from '../middleware/adminAuth';
import * as firebaseAdmin from 'firebase-admin';

// src/routes/admin.ts
import { Bindings, Variables } from '../types';
var admin = new Hono<{Bindings: Bindings, Variables: Variables}>();
admin.use("*", adminAuthMiddleware);
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
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${saltHex}:${hashHex}`;
}
admin.get("/users", async (c) => {
  const prisma = getPrisma(c.env.DB);
  try {
    const users2 = await prisma.user.findMany({
      select: {
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
        subscriptions: {
          where: { status: "active" },
          select: { status: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    return c.json({ users: users2 });
  } catch (error: any) {
    return c.json({ error: "Failed to fetch users" }, 500);
  }
});
admin.patch("/users/:id/role", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const id = c.req.param("id");
  try {
    const body = await c.req.json();
    const { isAdmin } = body;
    const user = await prisma.user.update({
      where: { id },
      data: { isAdmin }
    });
    return c.json({ user });
  } catch (error: any) {
    return c.json({ error: "Failed to update user role" }, 500);
  }
});
admin.patch("/users/:id/ban", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const id = c.req.param("id");
  try {
    const body = await c.req.json();
    const { isBanned } = body;
    const user = await prisma.user.update({
      where: { id },
      data: { isBanned }
    });
    return c.json({ user });
  } catch (error: any) {
    return c.json({ error: "Failed to update ban status" }, 500);
  }
});
admin.patch("/users/:id/restrict", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const id = c.req.param("id");
  try {
    const body = await c.req.json();
    const { isRestricted } = body;
    
    // For a general restriction, we restrict from community and set a media restriction for 7 days
    const mediaRestrictionExpiry = isRestricted 
      ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
      : null;

    const user = await prisma.user.update({
      where: { id },
      data: { 
        isCommunityRestricted: isRestricted,
        mediaRestrictionExpiry
      }
    });
    return c.json({ user });
  } catch (error: any) {
    return c.json({ error: "Failed to update restriction status" }, 500);
  }
});
admin.get("/users/:id/profile", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const id = c.req.param("id");
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        loginHistory: { orderBy: { createdAt: "desc" } },
        communityMemberships: { include: { community: true } },
        posts: { orderBy: { createdAt: "desc" } },
        recvFriendRequests: { include: { sender: true } },
        sentFriendRequests: { include: { receiver: true } },
        earnedBadges: { include: { badge: true } },
        devotionProgress: true
      }
    });
    if (!user) return c.json({ error: "User not found" }, 404);
    const { password, ...safeUser } = user;
    return c.json({ profile: safeUser });
  } catch (error: any) {
    return c.json({ error: "Failed to fetch user profile" }, 500);
  }
});
admin.patch("/users/:id/profile", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const id = c.req.param("id");
  try {
    const body = await c.req.json();
    const { firstName, lastName, username, bio, avatarUrl } = body;
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...firstName !== void 0 && { firstName },
        ...lastName !== void 0 && { lastName },
        ...username !== void 0 && { username },
        ...bio !== void 0 && { bio },
        ...avatarUrl !== void 0 && { avatarUrl }
      }
    });
    const { password, ...safeUser } = user;
    return c.json({ user: safeUser });
  } catch (error: any) {
    return c.json({ error: "Failed to update user profile" }, 500);
  }
});
admin.patch("/users/:id/password", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const id = c.req.param("id");
  try {
    const body = await c.req.json();
    const { newPassword } = body;
    if (!newPassword || newPassword.length < 6) {
      return c.json({ error: "Password must be at least 6 characters" }, 400);
    }
    const hashedPassword = await hashPassword2(newPassword);
    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword }
    });
    return c.json({ message: "Password updated successfully" });
  } catch (error: any) {
    return c.json({ error: "Failed to update password" }, 500);
  }
});
admin.get("/features", async (c) => {
  const prisma = getPrisma(c.env.DB);
  try {
    const features = await prisma.appFeature.findMany();
    return c.json({ features });
  } catch (error: any) {
    return c.json({ error: "Failed to fetch features" }, 500);
  }
});
admin.patch("/features/:key", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const key = c.req.param("key");
  try {
    const body = await c.req.json();
    const { isEnabled, value } = body;
    const feature = await prisma.appFeature.upsert({
      where: { key },
      update: { isEnabled, value },
      create: { key, isEnabled, value }
    });
    return c.json({ feature });
  } catch (error: any) {
    return c.json({ error: "Failed to update feature" }, 500);
  }
});
admin.post("/users/:id/notify", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const id = c.req.param("id");
  try {
    const { title, body, data } = await c.req.json();
    if (!title || !body) return c.json({ error: "Title and body are required" }, 400);
    const user = await prisma.user.findUnique({ where: { id }, select: { fcmToken: true } });
    if (!user || !user.fcmToken) return c.json({ error: "User does not have a registered push token" }, 400);
    if (!c.env.FIREBASE_CLIENT_EMAIL || !c.env.FIREBASE_PRIVATE_KEY) {
      return c.json({ error: "Firebase credentials are not configured on the server" }, 500);
    }
    await prisma.notification.create({
      data: {
        userId: id,
        title,
        message: body,
        type: "SYSTEM"
      }
    });
    try {
      const fcm = new FCMService(c.env.FIREBASE_CLIENT_EMAIL, c.env.FIREBASE_PRIVATE_KEY);
      await fcm.sendNotification({
        token: user.fcmToken,
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
  const prisma = getPrisma(c.env.DB);
  try {
    const { title, body, data } = await c.req.json();
    if (!title || !body) return c.json({ error: "Title and body are required" }, 400);
    const users2 = await prisma.user.findMany({
      select: { id: true, fcmToken: true }
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
        await prisma.notification.create({
          data: {
            userId: u.id,
            title,
            message: body,
            type: "SYSTEM"
          }
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
  const prisma = getPrisma(c.env.DB);
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalUsers,
      bannedUsers,
      adminUsers,
      newUsers30d,
      totalCommunities,
      totalPosts,
      activeSubscriptions,
      pendingReports,
      recentUsers,
      recentPosts
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isBanned: true } }),
      prisma.user.count({ where: { isAdmin: true } }),
      prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.community.count(),
      prisma.post.count(),
      prisma.subscription.count({ where: { status: 'active' } }),
      prisma.report.count({ where: { status: 'PENDING' } }),
      prisma.user.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { createdAt: true }
      }),
      prisma.post.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { createdAt: true }
      })
    ]);

    const groupByDate = (data: { createdAt: Date }[]) => {
      const grouped = data.reduce((acc: any, item) => {
        const dateStr = item.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
  const prisma = getPrisma(c.env.DB);
  try {
    const subscriptions = await prisma.subscription.findMany({
      include: {
        user: { select: { id: true, username: true, email: true, firstName: true, lastName: true, avatarUrl: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    const totalActive = subscriptions.filter(s => s.status === "active").length;
    const totalExpired = subscriptions.filter(s => s.status === "expired").length;
    const totalCancelled = subscriptions.filter(s => s.status === "cancelled").length;
    
    const appleActive = subscriptions.filter(s => s.status === "active" && s.platform === "apple").length;
    const googleActive = subscriptions.filter(s => s.status === "active" && s.platform === "google").length;
    
    // Estimate MRR (Monthly Recurring Revenue). Assuming an average plan price is 4.99 
    // Usually this comes from the product catalog, but for quick stats we use an estimate or sum by product ID
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

export default admin;
