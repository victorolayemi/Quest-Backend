import { Hono } from 'hono';
import { getDrizzle } from '../../utils/drizzle';
import { Bindings, Variables } from '../../types';
import { checkAndDeductCoins } from '../../utils/economy';
import { authMiddleware, checkCommunityRestriction } from '../../middleware/auth';
import { adminAuthMiddleware } from '../../middleware/adminAuth';
import { FCMService } from '../../services/fcm';
import { dispatchNotification } from '../../services/notificationService';
import { community, communityMember, communityJoinRequest, user } from '../../db/schema';
import { eq, or, and, not, like, sql, inArray, desc, asc } from 'drizzle-orm';
import crypto from 'crypto';

const app = new Hono<{Bindings: Bindings, Variables: Variables}>();

app.post("/:id/join", async (c) => {
  const userId = c.get("userId");
  const communityId = c.req.param("id");
  const db = getDrizzle(c.env.DB);
  
  const existing = await db.query.communityMember.findFirst({
    where: and(eq(communityMember.communityId, communityId), eq(communityMember.userId, userId as string))
  });
  if (existing) {
    return c.json({ message: "Already a member" });
  }
  
  const com = await db.query.community.findFirst({ where: eq(community.id, communityId) });
  if (!com) return c.json({ error: "Community not found" }, 404);
  
  if (com.isPrivate) {
    const existingReq = await db.query.communityJoinRequest.findFirst({
      where: and(eq(communityJoinRequest.communityId, communityId), eq(communityJoinRequest.userId, userId as string), eq(communityJoinRequest.status, "PENDING"))
    });
    if (existingReq) {
      return c.json({ message: "Request already pending" });
    }
    
    await db.insert(communityJoinRequest).values({
      id: crypto.randomUUID(),
      communityId,
      userId: userId as string,
      status: "PENDING",
    });
    
    // Notify admins and owner
    const admins = await db.query.communityMember.findMany({
      where: and(eq(communityMember.communityId, communityId), eq(communityMember.role, "ADMIN"))
    });
    
    const notifyUserIds = new Set<string>();
    if (com.creatorId) notifyUserIds.add(com.creatorId);
    admins.forEach(a => notifyUserIds.add(a.userId));
    
    const requester = await db.query.user.findFirst({
      where: eq(user.id, userId as string)
    });
    const requesterName = requester ? `${requester.firstName || ''} ${requester.lastName || ''}`.trim() : 'Someone';
    const finalName = requesterName.length > 0 ? requesterName : 'Someone';
    
    const fcm = new FCMService(c.env.FIREBASE_CLIENT_EMAIL, c.env.FIREBASE_PRIVATE_KEY);
    for (const adminUserId of notifyUserIds) {
      await dispatchNotification({
        db,
        userId: adminUserId,
        title: "Join Request",
        message: `${finalName} requested to join ${com.name}`,
        type: "COMMUNITY_JOIN_REQUEST",
        fcm,
        data: { communityId }
      });
    }
    
    return c.json({ message: "Request sent" });
  }
  
  const [member] = await db.insert(communityMember).values({
    id: crypto.randomUUID(),
    communityId,
    userId,
    role: "MEMBER",
    
    
  }).returning();
  
  return c.json({ message: "Joined successfully", member });
});

app.get("/:id/requests", async (c) => {
  const userId = c.get("userId");
  const communityId = c.req.param("id");
  const db = getDrizzle(c.env.DB);
  
  const isAdmin = await db.query.communityMember.findFirst({
    where: and(eq(communityMember.communityId, communityId), eq(communityMember.userId, userId as string), eq(communityMember.role, "ADMIN"))
  });
  if (!isAdmin) return c.json({ error: "Forbidden" }, 403);
  
  const requests = await db.query.communityJoinRequest.findMany({
    where: and(eq(communityJoinRequest.communityId, communityId), eq(communityJoinRequest.status, "PENDING")),
    with: {
      user: { columns: { id: true, firstName: true, lastName: true, avatarUrl: true } }
    },
    orderBy: [desc(communityJoinRequest.createdAt)]
  });
  return c.json({ requests });
});

app.post("/:id/requests/:reqId/approve", async (c) => {
  const userId = c.get("userId");
  const communityId = c.req.param("id");
  const reqId = c.req.param("reqId");
  const db = getDrizzle(c.env.DB);
  
  const isAdmin = await db.query.communityMember.findFirst({
    where: and(eq(communityMember.communityId, communityId), eq(communityMember.userId, userId as string), eq(communityMember.role, "ADMIN"))
  });
  if (!isAdmin) return c.json({ error: "Forbidden" }, 403);
  
  const joinReq = await db.query.communityJoinRequest.findFirst({ where: eq(communityJoinRequest.id, reqId) });
  if (!joinReq || joinReq.communityId !== communityId) return c.json({ error: "Not found" }, 404);
  if (joinReq.status !== "PENDING") return c.json({ error: "Already processed" }, 400);
  
  await db.transaction(async (tx) => {
    await tx.update(communityJoinRequest).set({ status: "APPROVED",  }).where(eq(communityJoinRequest.id, reqId));
    await tx.insert(communityMember).values({
      id: crypto.randomUUID(),
      communityId,
      userId: joinReq.userId,
      role: "MEMBER",
      
      
    });
  });
  
  return c.json({ message: "Request approved" });
});

app.post("/:id/requests/:reqId/reject", async (c) => {
  const userId = c.get("userId");
  const communityId = c.req.param("id");
  const reqId = c.req.param("reqId");
  const db = getDrizzle(c.env.DB);
  
  const isAdmin = await db.query.communityMember.findFirst({
    where: and(eq(communityMember.communityId, communityId), eq(communityMember.userId, userId as string), eq(communityMember.role, "ADMIN"))
  });
  if (!isAdmin) return c.json({ error: "Forbidden" }, 403);
  
  const joinReq = await db.query.communityJoinRequest.findFirst({ where: eq(communityJoinRequest.id, reqId) });
  if (!joinReq || joinReq.communityId !== communityId) return c.json({ error: "Not found" }, 404);
  if (joinReq.status !== "PENDING") return c.json({ error: "Already processed" }, 400);
  
  await db.update(communityJoinRequest).set({ status: "REJECTED",  }).where(eq(communityJoinRequest.id, reqId));
  
  return c.json({ message: "Request rejected" });
});

app.post("/:id/leave", async (c) => {
  const userId = c.get("userId");
  const communityId = c.req.param("id");
  const db = getDrizzle(c.env.DB);
  
  const existing = await db.query.communityMember.findFirst({
    where: and(eq(communityMember.communityId, communityId), eq(communityMember.userId, userId as string))
  });
  if (!existing) {
    return c.json({ error: "Not a member of this community" }, 400);
  }
  
  await db.delete(communityMember).where(eq(communityMember.id, existing.id));
  return c.json({ message: "Left community successfully" });
});

app.get("/:id/members", async (c) => {
  const communityId = c.req.param("id");
  const db = getDrizzle(c.env.DB);
  
  const list = await db.query.communityMember.findMany({
    where: eq(communityMember.communityId, communityId),
    with: {
      user: { columns: { id: true, firstName: true, lastName: true, username: true, avatarUrl: true } }
    }
  });
  
  return c.json(list.map((m: any) => ({
    ...m.user,
    role: m.role,
    isSuspended: Boolean(m.isSuspended),
    canPostForum: Boolean(m.canPostForum)
  })));
});

app.put("/:id/members/:userId/moderate", async (c) => {
  const communityId = c.req.param("id");
  const targetUserId = c.req.param("userId");
  const adminId = c.get("userId");
  const body = await c.req.json() as any;
  const { isSuspended, canPostForum } = body;
  const db = getDrizzle(c.env.DB);
  
  const adminMember = await db.query.communityMember.findFirst({
    where: and(eq(communityMember.communityId, communityId), eq(communityMember.userId, adminId))
  });
  if (!adminMember || adminMember.role !== "ADMIN") {
    return c.json({ error: "Only admins can moderate members" }, 403);
  }
  
  const targetMember = await db.query.communityMember.findFirst({
    where: and(eq(communityMember.communityId, communityId), eq(communityMember.userId, targetUserId)),
    with: { user: true }
  });
  if (!targetMember) {
    return c.json({ error: "Member not found" }, 404);
  }
  if (targetMember.role === "ADMIN") {
    return c.json({ error: "Cannot moderate other admins" }, 403);
  }
  
  const updateData: any = {  };
  if (isSuspended !== undefined) updateData.isSuspended = isSuspended ? 1 : 0;
  if (canPostForum !== undefined) updateData.canPostForum = canPostForum ? 1 : 0;
  
  const [updatedMember] = await db.update(communityMember).set(updateData).where(eq(communityMember.id, targetMember.id)).returning();
  
  if (isSuspended !== undefined && Boolean(isSuspended) !== Boolean(targetMember.isSuspended)) {
    const fcm = new FCMService(c.env.FIREBASE_CLIENT_EMAIL, c.env.FIREBASE_PRIVATE_KEY);
    await dispatchNotification({
      db,
      userId: targetMember.userId,
      title: isSuspended ? "Community Suspension" : "Community Suspension Lifted",
      message: isSuspended ? "You have been suspended from the community." : "Your suspension has been lifted. You can now access the community again.",
      type: "COMMUNITY_SUSPENSION",
      pushSettingKey: "pushCommunityUpdates",
      fcm,
      data: { type: "COMMUNITY_SUSPENSION", communityId }
    });
  }
  
  return c.json({
    ...updatedMember,
    isSuspended: Boolean(updatedMember.isSuspended),
    canPostForum: Boolean(updatedMember.canPostForum)
  });
});

export default app;
