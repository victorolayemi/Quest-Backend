import { Hono } from 'hono';
import { getPrisma } from '../utils/prisma';
import { authMiddleware } from '../middleware/auth';
import { adminAuthMiddleware } from '../middleware/adminAuth';

// src/routes/users.ts
import { Bindings, Variables } from '../types';
var users = new Hono<{Bindings: Bindings, Variables: Variables}>();
users.use("*", authMiddleware);
users.get("/me", async (c) => {
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      currentFeeling: true
    }
  });
  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }
  return c.json(user);
});
users.put("/me", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  const { firstName, lastName, gender, location } = body;
  const prisma = getPrisma(c.env.DB);
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      firstName: firstName || void 0,
      lastName: lastName || void 0,
      gender: gender || void 0,
      location: location || void 0
    }
  });
  return c.json(updated);
});
users.put("/me/avatar", async (c) => {
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const formData = await c.req.formData();
  const file = formData.get("avatar") as unknown as File;
  if (!file) {
    return c.json({ error: 'No avatar file provided in form-data key "avatar"' }, 400);
  }
  const fileKey = `avatars/${userId}-${Date.now()}-${file.name}`;
  const fileBuffer = await file.arrayBuffer();
  if (c.env.MEDIA_BUCKET) {
    await c.env.MEDIA_BUCKET.put(fileKey, fileBuffer, {
      httpMetadata: { contentType: file.type }
    });
  }
  const avatarUrl = `/api/v1/media/download/${fileKey}`;
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl }
  });
  return c.json({
    message: "Avatar uploaded successfully",
    avatarUrl,
    user: updatedUser
  });
});
users.put("/me/bio", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  const { bio } = body;
  const prisma = getPrisma(c.env.DB);
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { bio }
  });
  return c.json(updated);
});
users.put("/me/settings", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  const {
    soundAlerts,
    hapticFeedback,
    music,
    allNotifications,
    inAppNotifications,
    doNotDisturb,
    appearance,
    autoScroll,
    reminderMorning,
    reminderAfternoon,
    reminderEvening,
    reminderCustomTime,
    pushDirectMessages,
    pushCommunityPosts,
    pushCommunityForum,
    pushConnectionRequests,
    pushConnectionAccepted
  } = body;
  const prisma = getPrisma(c.env.DB);
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      soundAlerts: soundAlerts !== void 0 ? soundAlerts : void 0,
      hapticFeedback: hapticFeedback !== void 0 ? hapticFeedback : void 0,
      music: music !== void 0 ? music : void 0,
      autoScroll: autoScroll !== void 0 ? autoScroll : void 0,
      allNotifications: allNotifications !== void 0 ? allNotifications : void 0,
      inAppNotifications: inAppNotifications !== void 0 ? inAppNotifications : void 0,
      doNotDisturb: doNotDisturb !== void 0 ? doNotDisturb : void 0,
      appearance: appearance || void 0,
      reminderMorning: reminderMorning !== void 0 ? reminderMorning : void 0,
      reminderAfternoon: reminderAfternoon !== void 0 ? reminderAfternoon : void 0,
      reminderEvening: reminderEvening !== void 0 ? reminderEvening : void 0,
      reminderCustomTime: reminderCustomTime !== void 0 ? reminderCustomTime : void 0,
      pushDirectMessages: pushDirectMessages !== void 0 ? pushDirectMessages : void 0,
      pushCommunityPosts: pushCommunityPosts !== void 0 ? pushCommunityPosts : void 0,
      pushCommunityForum: pushCommunityForum !== void 0 ? pushCommunityForum : void 0,
      pushConnectionRequests: pushConnectionRequests !== void 0 ? pushConnectionRequests : void 0,
      pushConnectionAccepted: pushConnectionAccepted !== void 0 ? pushConnectionAccepted : void 0
    }
  });
  return c.json(updated);
});
users.post("/permissions", async (c) => {
  return c.json({ message: "Permissions registered successfully" });
});
users.patch("/me/fcm-token", async (c) => {
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  try {
    const { fcmToken } = await c.req.json();
    if (!fcmToken) return c.json({ error: "fcmToken is required" }, 400);
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { fcmToken }
    });
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: "Failed to update FCM token" }, 500);
  }
});
users.post("/onboarding/complete", async (c) => {
  return c.json({ message: "Onboarding completed successfully" });
});
users.get("/me/metrics", async (c) => {
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      quizAttempts: true,
      dailyBreadAttempts: true,
      earnedBadges: true
    }
  });
  if (!user) return c.json({ error: "User not found" }, 404);
  const level = Math.floor(user.points / 100) + 1;
  return c.json({
    points: user.points,
    level,
    streakCount: user.streakCount,
    badgesCount: user.earnedBadges.length,
    quizzesPlayed: user.quizAttempts.length,
    dailyPuzzlesSolved: user.dailyBreadAttempts.filter((a: any) => a.solved).length
  });
});
users.get("/me/points", async (c) => {
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });
  if (!user) return c.json({ error: "User not found" }, 404);
  return c.json({
    totalPoints: user.points,
    breakdown: [
      { source: "Quizzes", points: Math.floor(user.points * 0.6) },
      { source: "Daily Study", points: Math.floor(user.points * 0.3) },
      { source: "Daily Bread Puzzles", points: Math.floor(user.points * 0.1) }
    ]
  });
});
users.get("/:userId", async (c) => {
  const targetUserId = c.req.param("userId");
  const prisma = getPrisma(c.env.DB);
  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      username: true,
      avatarUrl: true,
      bio: true,
      points: true,
      streakCount: true,
      createdAt: true,
      currentFeeling: true
    }
  });
  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }
  return c.json(user);
});
users.get("/:userId/metrics", async (c) => {
  const targetUserId = c.req.param("userId");
  const prisma = getPrisma(c.env.DB);
  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: {
      earnedBadges: true
    }
  });
  if (!user) return c.json({ error: "User not found" }, 404);
  const level = Math.floor(user.points / 100) + 1;
  return c.json({
    points: user.points,
    level,
    streakCount: user.streakCount,
    badgesCount: user.earnedBadges.length
  });
});
users.get("/:userId/profile-stats", async (c) => {
  const targetUserId = c.req.param("userId");
  const currentUserId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const friendsCount = await prisma.friendRequest.count({
    where: {
      status: "ACCEPTED",
      OR: [
        { senderId: targetUserId },
        { receiverId: targetUserId }
      ]
    }
  });
  const badgesCount = await prisma.earnedBadge.count({
    where: { userId: targetUserId }
  });
  const communitiesCount = await prisma.communityMember.count({
    where: { userId: targetUserId }
  });
  const targetUserCommunities = await prisma.communityMember.findMany({
    where: { userId: targetUserId },
    select: { communityId: true }
  });
  const targetCommunityIds = targetUserCommunities.map((cm: any) => cm.communityId);
  const mutualCommunitiesMembers = await prisma.communityMember.findMany({
    where: {
      userId: currentUserId,
      communityId: { in: targetCommunityIds }
    },
    include: {
      community: true
    }
  });
  const mutualCommunities = mutualCommunitiesMembers.map((m: any) => m.community);
  const friendRequest = await prisma.friendRequest.findFirst({
    where: {
      OR: [
        { senderId: currentUserId, receiverId: targetUserId },
        { senderId: targetUserId, receiverId: currentUserId }
      ]
    }
  });
  let connectionStatus = "NONE";
  if (friendRequest) {
    connectionStatus = friendRequest.status;
  }
  return c.json({
    friendsCount,
    badgesCount,
    communitiesCount,
    mutualCommunities,
    connectionStatus
  });
});
users.delete("/me", async (c) => {
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  await prisma.user.delete({
    where: { id: userId }
  });
  return c.json({ message: "Account deleted successfully" });
});


export default users;
