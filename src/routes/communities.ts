
import { FCMService } from '../services/fcm';
import { dispatchNotification } from '../services/notificationService';

import { Hono } from 'hono';
import { getPrisma } from '../utils/prisma';
import { authMiddleware } from '../middleware/auth';
import { adminAuthMiddleware } from '../middleware/adminAuth';
import admin from 'firebase-admin';

// src/routes/communities.ts
import { Bindings, Variables } from '../types';
var communities = new Hono<{Bindings: Bindings, Variables: Variables}>();
communities.use("*", authMiddleware);
async function seedCommunityIfEmpty(prisma: any) {
  const count = await prisma.community.count();
  if (count === 0) {
    return await prisma.community.create({
      data: {
        name: "Lekki Christian Youth",
        description: "A gathering of young believers in Lekki studying the word, sharing experiences, and raising leaders.",
        image: "/assets/images/community_lekki.jpg",
        guidelines: "Be respectful, share edifying content, stay focus on Christ.",
        events: {
          create: [
            {
              title: "Weekly Fellowship Study",
              description: "Our standard weekly physical and virtual Bible study.",
              date: "2026-05-25",
              time: "06:00 PM",
              location: "Lekki Phase 1 Center / Zoom"
            }
          ]
        }
      }
    });
  }
}
communities.get("/posts/all", async (c) => {
  const userId = c.get("userId");
  const cursor = c.req.query("cursor");
  const prisma = getPrisma(c.env.DB);
  const memberships = await prisma.communityMember.findMany({
    where: { userId },
    select: { communityId: true }
  });
  const joinedCommunityIds = memberships.map((m: any) => m.communityId);
  const posts = await prisma.post.findMany({
    where: {
      communityId: { in: joinedCommunityIds }
    },
    take: 20,
    ...cursor ? { skip: 1, cursor: { id: cursor } } : {},
    include: {
      user: { select: { firstName: true, lastName: true, username: true, avatarUrl: true } },
      community: { select: { name: true } },
      reactions: true,
      _count: { select: { comments: true } }
    },
    orderBy: { createdAt: "desc" }
  });
  return c.json(posts);
});
communities.get("/", async (c) => {
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const q = c.req.query("q");
  await seedCommunityIfEmpty(prisma);
  const whereClause: any = {
    members: {
      some: {
        userId
      }
    }
  };
  if (q) {
    whereClause.OR = [
      { name: { contains: q } },
      { description: { contains: q } }
    ];
  }
  const list = await prisma.community.findMany({
    where: whereClause,
    include: {
      _count: { select: { members: true } }
    }
  });
  return c.json(list);
});
communities.get("/search", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const q = c.req.query("q");
  await seedCommunityIfEmpty(prisma);
  const whereClause: any = {};
  if (q) {
    whereClause.OR = [
      { name: { contains: q } },
      { description: { contains: q } }
    ];
  }
  const list = await prisma.community.findMany({
    where: whereClause,
    include: {
      _count: { select: { members: true } }
    }
  });
  return c.json(list);
});
communities.get("/recommended", async (c) => {
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const q = c.req.query("q");
  await seedCommunityIfEmpty(prisma);
  const whereClause: any = {
    members: {
      none: {
        userId
      }
    }
  };
  if (q) {
    whereClause.OR = [
      { name: { contains: q } },
      { description: { contains: q } }
    ];
  }
  const list = await prisma.community.findMany({
    where: whereClause,
    take: 3,
    include: {
      _count: { select: { members: true } }
    }
  });
  return c.json(list);
});
communities.post("/", async (c) => {
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const feature = await prisma.appFeature.findUnique({
    where: { key: "community_creation_requires_subscription" }
  });
  const requiresSub = feature ? feature.isEnabled : true;
  if (requiresSub) {
    const activeSubscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: "active",
        expiresAt: { gt: /* @__PURE__ */ new Date() }
      }
    });
    if (!activeSubscription) {
      return c.json({ error: "You must be subscribed to create a community." }, 403);
    }
  }
  const body = await c.req.json() as any;
  const { name: name2, description, image, guidelines, isPrivate = false } = body;
  if (!name2 || !description) {
    return c.json({ error: "Name and description are required" }, 400);
  }
  try {
    const com = await prisma.community.create({
      data: {
        name: name2,
        description,
        image,
        guidelines,
        isPrivate,
        creatorId: userId,
        members: {
          create: [{ userId, role: "ADMIN" }]
        }
      }
    });
    return c.json(com, 201);
  } catch (error) {
    console.error("Create community error:", error);
    return c.json({ error: "Failed to create community" }, 500);
  }
});

communities.get("/messages/saved", async (c) => {
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  
  try {
    const savedMessages = await prisma.communityMessageBookmark.findMany({
      where: { userId },
      include: {
        message: {
          include: {
            sender: {
              select: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    
    const formatted = savedMessages.map((bm: any) => ({
      id: bm.message.id,
      title: bm.message.title,
      text: bm.message.text,
      imageUrl: bm.message.imageUrl,
      createdAt: bm.message.createdAt,
      likesCount: bm.message.likesCount,
      sender: {
        ...bm.message.sender,
        fullName: bm.message.sender?.firstName ? `${bm.message.sender.firstName} ${bm.message.sender.lastName || ''}`.trim() : null
      }
    }));
    
    return c.json(formatted);
  } catch (error) {
    return c.json({ error: "Failed to fetch saved messages" }, 500);
  }
});

communities.get("/:id", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const com = await prisma.community.findUnique({
    where: { id },
    include: {
      _count: { select: { members: true } }
    }
  });
  if (!com) return c.json({ error: "Community not found" }, 404);
  const member = await prisma.communityMember.findFirst({
    where: { communityId: id, userId }
  });
  return c.json({
    ...com,
    hasJoined: !!member,
    member: member ? {
      role: member.role,
      isSuspended: member.isSuspended,
      canPostForum: member.canPostForum
    } : null
  });
});
communities.post("/:id/join", async (c) => {
  const userId = c.get("userId");
  const communityId = c.req.param("id");
  const prisma = getPrisma(c.env.DB);
  const existing = await prisma.communityMember.findFirst({
    where: { communityId, userId }
  });
  if (existing) {
    return c.json({ message: "Already a member" });
  }
  const com = await prisma.community.findUnique({
    where: { id: communityId }
  });
  if (!com) return c.json({ error: "Community not found" }, 404);
  if (com.isPrivate) {
    const existingReq = await prisma.communityJoinRequest.findFirst({
      where: { communityId, userId, status: "PENDING" }
    });
    if (existingReq) {
      return c.json({ message: "Request already pending" });
    }
    await prisma.communityJoinRequest.create({
      data: {
        communityId,
        userId,
        status: "PENDING"
      }
    });
    return c.json({ message: "Request sent" });
  }
  const member = await prisma.communityMember.create({
    data: {
      communityId,
      userId,
      role: "MEMBER"
    }
  });
  return c.json({ message: "Joined successfully", member });
});
communities.get("/:id/requests", async (c) => {
  const userId = c.get("userId");
  const communityId = c.req.param("id");
  const prisma = getPrisma(c.env.DB);
  const isAdmin = await prisma.communityMember.findFirst({
    where: { communityId, userId, role: "ADMIN" }
  });
  if (!isAdmin) return c.json({ error: "Forbidden" }, 403);
  const requests = await prisma.communityJoinRequest.findMany({
    where: { communityId, status: "PENDING" },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } }
    },
    orderBy: { createdAt: "desc" }
  });
  return c.json({ requests });
});
communities.post("/:id/requests/:reqId/approve", async (c) => {
  const userId = c.get("userId");
  const communityId = c.req.param("id");
  const reqId = c.req.param("reqId");
  const prisma = getPrisma(c.env.DB);
  const isAdmin = await prisma.communityMember.findFirst({
    where: { communityId, userId, role: "ADMIN" }
  });
  if (!isAdmin) return c.json({ error: "Forbidden" }, 403);
  const joinReq = await prisma.communityJoinRequest.findUnique({ where: { id: reqId } });
  if (!joinReq || joinReq.communityId !== communityId) return c.json({ error: "Not found" }, 404);
  if (joinReq.status !== "PENDING") return c.json({ error: "Already processed" }, 400);
  await prisma.$transaction([
    prisma.communityJoinRequest.update({
      where: { id: reqId },
      data: { status: "APPROVED" }
    }),
    prisma.communityMember.create({
      data: {
        communityId,
        userId: joinReq.userId,
        role: "MEMBER"
      }
    })
  ]);
  return c.json({ message: "Request approved" });
});
communities.post("/:id/requests/:reqId/reject", async (c) => {
  const userId = c.get("userId");
  const communityId = c.req.param("id");
  const reqId = c.req.param("reqId");
  const prisma = getPrisma(c.env.DB);
  const isAdmin = await prisma.communityMember.findFirst({
    where: { communityId, userId, role: "ADMIN" }
  });
  if (!isAdmin) return c.json({ error: "Forbidden" }, 403);
  const joinReq = await prisma.communityJoinRequest.findUnique({ where: { id: reqId } });
  if (!joinReq || joinReq.communityId !== communityId) return c.json({ error: "Not found" }, 404);
  if (joinReq.status !== "PENDING") return c.json({ error: "Already processed" }, 400);
  await prisma.communityJoinRequest.update({
    where: { id: reqId },
    data: { status: "REJECTED" }
  });
  return c.json({ message: "Request rejected" });
});
communities.post("/:id/leave", async (c) => {
  const userId = c.get("userId");
  const communityId = c.req.param("id");
  const prisma = getPrisma(c.env.DB);
  const existing = await prisma.communityMember.findFirst({
    where: { communityId, userId }
  });
  if (!existing) {
    return c.json({ error: "Not a member of this community" }, 400);
  }
  await prisma.communityMember.delete({ where: { id: existing.id } });
  return c.json({ message: "Left community successfully" });
});
communities.post("/:id/share", async (c) => {
  return c.json({ shareUrl: `https://quest-app.com/com/${c.req.param("id")}` });
});
communities.get("/:id/members", async (c) => {
  const communityId = c.req.param("id");
  const prisma = getPrisma(c.env.DB);
  const list = await prisma.communityMember.findMany({
    where: { communityId },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, username: true, avatarUrl: true } }
    }
  });
  return c.json(list.map((m: any) => ({
    ...m.user,
    role: m.role,
    isSuspended: m.isSuspended,
    canPostForum: m.canPostForum
  })));
});
communities.get("/:id/guidelines", async (c) => {
  const id = c.req.param("id");
  const prisma = getPrisma(c.env.DB);
  const com = await prisma.community.findUnique({ where: { id } });
  if (!com) return c.json({ error: "Community not found" }, 404);
  return c.json({ guidelines: com.guidelines });
});
communities.post("/:id/report", async (c) => {
  return c.json({ message: "Report submitted successfully" });
});
communities.get("/:id/posts", async (c) => {
  const communityId = c.req.param("id");
  const cursor = c.req.query("cursor");
  const prisma = getPrisma(c.env.DB);
  const list = await prisma.post.findMany({
    where: { communityId },
    take: 20,
    ...cursor ? { skip: 1, cursor: { id: cursor } } : {},
    include: {
      user: { select: { firstName: true, lastName: true, username: true, avatarUrl: true } },
      reactions: true,
      _count: { select: { comments: true } }
    },
    orderBy: { createdAt: "desc" }
  });
  return c.json(list);
});
communities.get("/:id/posts/:postId", async (c) => {
  const postId = c.req.param("postId");
  const prisma = getPrisma(c.env.DB);
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      user: { select: { firstName: true, lastName: true, username: true, avatarUrl: true } },
      reactions: true,
      comments: {
        include: { user: { select: { username: true, avatarUrl: true } } }
      }
    }
  });
  if (!post) return c.json({ error: "Post not found" }, 404);
  return c.json(post);
});
communities.post("/posts", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json() as any;
  const { communityId, text, image } = body;
  const prisma = getPrisma(c.env.DB);
  const community = await prisma.community.findUnique({
    where: { id: communityId }
  });
  const member = await prisma.communityMember.findFirst({
    where: { communityId, userId }
  });
  if (!community || !member) {
    return c.json({ error: "Community or member not found" }, 404);
  }
  if (member.role !== "ADMIN") {
    if (community.isForumDisabledGlobally) {
      return c.json({ error: "Forum posting is currently disabled globally for this community." }, 403);
    }
    if (!member.canPostForum) {
      return c.json({ error: "You have been restricted from posting in this forum." }, 403);
    }
  }
  const post = await prisma.post.create({
    data: {
      communityId,
      userId,
      text,
      image
    },
    include: {
      user: { select: { firstName: true, username: true, avatarUrl: true } }
    }
  });
  const members = await prisma.communityMember.findMany({
    where: { communityId, userId: { not: userId } },
    select: { userId: true }
  });
  const fcm = new FCMService(c.env.FIREBASE_CLIENT_EMAIL, c.env.FIREBASE_PRIVATE_KEY);
  const authorName = post.user.firstName || post.user.username || "Someone";
  for (const member2 of members) {
    await dispatchNotification({
      prisma,
      userId: member2.userId,
      title: "New Community Post",
      message: `${authorName} made a new post in the community.`,
      type: "COMMUNITY_POST",
      pushSettingKey: "pushCommunityPosts",
      fcm,
      data: { type: "COMMUNITY_POST", postId: post.id, communityId }
    });
  }
  return c.json(post);
});
communities.put("/posts/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = await c.req.json() as any;
  const { text } = body;
  const prisma = getPrisma(c.env.DB);
  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) return c.json({ error: "Post not found" }, 404);
  if (post.userId !== userId) return c.json({ error: "Forbidden" }, 403);
  const updated = await prisma.post.update({
    where: { id },
    data: { text }
  });
  return c.json(updated);
});
communities.delete("/posts/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const prisma = getPrisma(c.env.DB);
  const post = await prisma.post.findUnique({ where: { id }, include: { user: true } });
  if (!post) return c.json({ error: "Post not found" }, 404);
  const member = await prisma.communityMember.findFirst({
    where: { communityId: post.communityId, userId }
  });
  const isAdmin = member?.role === "ADMIN";
  if (post.userId !== userId && !isAdmin) {
    return c.json({ error: "Forbidden" }, 403);
  }
  await prisma.post.delete({ where: { id } });
  if (isAdmin && post.userId !== userId) {
    const fcm = new FCMService(c.env.FIREBASE_CLIENT_EMAIL, c.env.FIREBASE_PRIVATE_KEY);
    await dispatchNotification({
      prisma,
      userId: post.userId,
      title: "Post Deleted",
      message: "Your post was deleted by a community admin.",
      type: "POST_DELETED",
      pushSettingKey: "pushCommunityPosts",
      fcm,
      data: { type: "POST_DELETED", communityId: post.communityId }
    });
  }
  return c.json({ message: "Post deleted successfully" });
});
communities.post("/posts/:id/report", async (c) => {
  const userId = c.get("userId");
  const postId = c.req.param("id");
  const body = await c.req.json() as any;
  const { reason = "Inappropriate content" } = body;
  const prisma = getPrisma(c.env.DB);
  const report = await prisma.postReport.create({
    data: {
      postId,
      userId,
      reason
    }
  });
  return c.json({ message: "Post reported successfully", report });
});
communities.post("/posts/:id/react", async (c) => {
  const userId = c.get("userId");
  const postId = c.req.param("id");
  const body = await c.req.json() as any;
  const { emoji } = body;
  const prisma = getPrisma(c.env.DB);
  const existing = await prisma.postReaction.findFirst({
    where: { postId, userId, emoji }
  });
  if (existing) {
    await prisma.postReaction.delete({ where: { id: existing.id } });
    return c.json({ message: "Reaction removed", reacted: false });
  }
  const reaction = await prisma.postReaction.create({
    data: { postId, userId, emoji },
    include: { user: { select: { firstName: true, username: true } } }
  });
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (post && post.userId !== userId) {
    const fcm = new FCMService(c.env.FIREBASE_CLIENT_EMAIL, c.env.FIREBASE_PRIVATE_KEY);
    const reactorName = reaction.user.firstName || reaction.user.username || "Someone";
    await dispatchNotification({
      prisma,
      userId: post.userId,
      title: "New Reaction",
      message: `${reactorName} reacted ${emoji} to your post.`,
      type: "POST_REACTION",
      pushSettingKey: "pushCommunityPosts",
      fcm,
      data: { type: "POST_REACTION", postId }
    });
  }
  return c.json({ message: "Reaction added", reacted: true, reaction });
});
communities.post("/posts/:id/share", async (c) => {
  return c.json({ shareUrl: `https://quest-app.com/posts/${c.req.param("id")}` });
});
communities.get("/posts/:postId/comments", async (c) => {
  const postId = c.req.param("postId");
  const prisma = getPrisma(c.env.DB);
  const list = await prisma.comment.findMany({
    where: { postId, parentId: null },
    include: {
      user: { select: { id: true, username: true, avatarUrl: true, firstName: true, lastName: true } },
      reactions: true,
      replies: {
        include: {
          user: { select: { id: true, username: true, avatarUrl: true, firstName: true, lastName: true } },
          reactions: true
        },
        orderBy: { createdAt: "asc" }
      }
    },
    orderBy: { createdAt: "asc" }
  });
  return c.json(list);
});
communities.post("/posts/:postId/comments", async (c) => {
  const userId = c.get("userId");
  const postId = c.req.param("postId");
  const body = await c.req.json() as any;
  const { text, parentId } = body;
  const prisma = getPrisma(c.env.DB);
  const comment = await prisma.comment.create({
    data: {
      postId,
      userId,
      text,
      parentId: parentId || null
    },
    include: {
      user: { select: { id: true, username: true, avatarUrl: true, firstName: true, lastName: true } },
      reactions: true,
      replies: {
        include: {
          user: { select: { id: true, username: true, avatarUrl: true, firstName: true, lastName: true } },
          reactions: true
        }
      }
    }
  });
  const fcm = new FCMService(c.env.FIREBASE_CLIENT_EMAIL, c.env.FIREBASE_PRIVATE_KEY);
  const commenterName = comment.user.firstName || comment.user.username || "Someone";
  if (parentId) {
    const parentComment = await prisma.comment.findUnique({ where: { id: parentId } });
    if (parentComment && parentComment.userId !== userId) {
      await dispatchNotification({
        prisma,
        userId: parentComment.userId,
        title: "New Reply",
        message: `${commenterName} replied to your comment.`,
        type: "COMMENT_REPLY",
        pushSettingKey: "pushCommunityPosts",
        fcm,
        data: { type: "COMMENT_REPLY", postId }
      });
    }
  } else {
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (post && post.userId !== userId) {
      await dispatchNotification({
        prisma,
        userId: post.userId,
        title: "New Comment",
        message: `${commenterName} commented on your post.`,
        type: "POST_COMMENT",
        pushSettingKey: "pushCommunityPosts",
        fcm,
        data: { type: "POST_COMMENT", postId }
      });
    }
  }
  return c.json(comment);
});
communities.post("/posts/:postId/comments/:commentId/react", async (c) => {
  const userId = c.get("userId");
  const commentId = c.req.param("commentId");
  const body = await c.req.json() as any;
  const { emoji = "\u{1F44D}" } = body;
  const prisma = getPrisma(c.env.DB);
  const existing = await prisma.commentReaction.findFirst({
    where: { commentId, userId, emoji }
  });
  if (existing) {
    await prisma.commentReaction.delete({ where: { id: existing.id } });
    return c.json({ message: "Reaction removed", reacted: false });
  }
  const reaction = await prisma.commentReaction.create({
    data: { commentId, userId, emoji },
    include: { user: { select: { firstName: true, username: true } } }
  });
  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (comment && comment.userId !== userId) {
    const fcm = new FCMService(c.env.FIREBASE_CLIENT_EMAIL, c.env.FIREBASE_PRIVATE_KEY);
    const reactorName = reaction.user.firstName || reaction.user.username || "Someone";
    await dispatchNotification({
      prisma,
      userId: comment.userId,
      title: "New Reaction",
      message: `${reactorName} reacted ${emoji} to your comment.`,
      type: "COMMENT_REACTION",
      pushSettingKey: "pushCommunityPosts",
      fcm,
      data: { type: "COMMENT_REACTION", postId: comment.postId }
    });
  }
  return c.json({ message: "Reaction added", reacted: true, reaction });
});
communities.put("/comments/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = await c.req.json() as any;
  const { text } = body;
  const prisma = getPrisma(c.env.DB);
  const comment = await prisma.comment.findUnique({ where: { id } });
  if (!comment) return c.json({ error: "Comment not found" }, 404);
  if (comment.userId !== userId) return c.json({ error: "Forbidden" }, 403);
  const updated = await prisma.comment.update({
    where: { id },
    data: { text }
  });
  return c.json(updated);
});
communities.delete("/comments/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const prisma = getPrisma(c.env.DB);
  const comment = await prisma.comment.findUnique({ where: { id }, include: { post: true, user: true } });
  if (!comment) return c.json({ error: "Comment not found" }, 404);
  const member = await prisma.communityMember.findFirst({
    where: { communityId: comment.post.communityId, userId }
  });
  const isAdmin = member?.role === "ADMIN";
  if (comment.userId !== userId && !isAdmin) {
    return c.json({ error: "Forbidden" }, 403);
  }
  await prisma.comment.delete({ where: { id } });
  if (isAdmin && comment.userId !== userId) {
    const fcm = new FCMService(c.env.FIREBASE_CLIENT_EMAIL, c.env.FIREBASE_PRIVATE_KEY);
    await dispatchNotification({
      prisma,
      userId: comment.userId,
      title: "Comment Deleted",
      message: "Your comment was deleted by a community admin.",
      type: "COMMENT_DELETED",
      pushSettingKey: "pushCommunityPosts",
      fcm,
      data: { type: "COMMENT_DELETED", communityId: comment.post.communityId }
    });
  }
  return c.json({ message: "Comment deleted successfully" });
});
communities.get("/:id/events", async (c) => {
  const communityId = c.req.param("id");
  const cursor = c.req.query("cursor");
  const prisma = getPrisma(c.env.DB);
  const list = await prisma.communityEvent.findMany({
    where: { communityId },
    include: {
      attendees: true
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    ...cursor ? { cursor: { id: cursor }, skip: 1 } : {}
  });
  return c.json(list);
});
communities.post("/:id/events", async (c) => {
  const communityId = c.req.param("id");
  const userId = c.get("userId");
  const body = await c.req.json() as any;
  const { title, description, date, time, location, link, imageUrl } = body;
  const prisma = getPrisma(c.env.DB);
  const member = await prisma.communityMember.findFirst({
    where: { communityId, userId },
    include: { user: true }
  });
  if (!member || member.role !== "ADMIN") {
    return c.json({ error: "Only admins can create events" }, 403);
  }
  const event = await prisma.communityEvent.create({
    data: {
      communityId,
      title,
      description,
      date,
      time,
      location,
      link,
      imageUrl,
      attendees: {
        create: [
          { userId }
        ]
      }
    }
  });
  const members = await prisma.communityMember.findMany({
    where: { communityId, userId: { not: userId } },
    select: { userId: true }
  });
  const fcm = new FCMService(c.env.FIREBASE_CLIENT_EMAIL, c.env.FIREBASE_PRIVATE_KEY);
  for (const m of members) {
    await dispatchNotification({
      prisma,
      userId: m.userId,
      title: "New Community Event",
      message: `A new event "${title}" was created in your community.`,
      type: "COMMUNITY_EVENT",
      pushSettingKey: "pushCommunityUpdates",
      fcm,
      data: { type: "COMMUNITY_EVENT", eventId: event.id, communityId }
    });
  }
  return c.json(event);
});
communities.put("/:id/events/:eventId", async (c) => {
  const communityId = c.req.param("id");
  const eventId = c.req.param("eventId");
  const userId = c.get("userId");
  const body = await c.req.json() as any;
  const { title, description, date, time, location, link, imageUrl } = body;
  const prisma = getPrisma(c.env.DB);
  const member = await prisma.communityMember.findFirst({
    where: { communityId, userId }
  });
  if (!member || member.role !== "ADMIN") {
    return c.json({ error: "Only admins can edit events" }, 403);
  }
  const event = await prisma.communityEvent.findUnique({ where: { id: eventId } });
  if (!event || event.communityId !== communityId) return c.json({ error: "Event not found" }, 404);
  const updated = await prisma.communityEvent.update({
    where: { id: eventId },
    data: { title, description, date, time, location, link, imageUrl }
  });
  return c.json(updated);
});
communities.delete("/:id/events/:eventId", async (c) => {
  const communityId = c.req.param("id");
  const eventId = c.req.param("eventId");
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const member = await prisma.communityMember.findFirst({
    where: { communityId, userId }
  });
  if (!member || member.role !== "ADMIN") {
    return c.json({ error: "Only admins can delete events" }, 403);
  }
  const event = await prisma.communityEvent.findUnique({ where: { id: eventId } });
  if (!event || event.communityId !== communityId) return c.json({ error: "Event not found" }, 404);
  await prisma.communityEvent.delete({ where: { id: eventId } });
  const members = await prisma.communityMember.findMany({
    where: { communityId, userId: { not: userId } },
    select: { userId: true }
  });
  const fcm = new FCMService(c.env.FIREBASE_CLIENT_EMAIL, c.env.FIREBASE_PRIVATE_KEY);
  for (const m of members) {
    await dispatchNotification({
      prisma,
      userId: m.userId,
      title: "Event Canceled",
      message: `The event "${event.title}" has been canceled.`,
      type: "COMMUNITY_EVENT_CANCELED",
      pushSettingKey: "pushCommunityUpdates",
      fcm,
      data: { type: "COMMUNITY_EVENT_CANCELED", eventId, communityId }
    });
  }
  return c.json({ message: "Event deleted successfully" });
});
communities.get("/events/:id", async (c) => {
  const id = c.req.param("id");
  const prisma = getPrisma(c.env.DB);
  const event = await prisma.communityEvent.findUnique({
    where: { id },
    include: {
      attendees: {
        include: { user: { select: { username: true, avatarUrl: true } } }
      }
    }
  });
  if (!event) return c.json({ error: "Event not found" }, 404);
  return c.json(event);
});
communities.post("/events/:id/attend", async (c) => {
  const userId = c.get("userId");
  const eventId = c.req.param("id");
  const prisma = getPrisma(c.env.DB);
  const existing = await prisma.eventAttendee.findFirst({
    where: { eventId, userId }
  });
  if (existing) return c.json({ message: "Already attending" });
  const attendee = await prisma.eventAttendee.create({
    data: { eventId, userId }
  });
  return c.json({ message: "RSVP confirmed", attendee });
});
communities.post("/events/:id/unattend", async (c) => {
  const userId = c.get("userId");
  const eventId = c.req.param("id");
  const prisma = getPrisma(c.env.DB);
  const existing = await prisma.eventAttendee.findFirst({
    where: { eventId, userId }
  });
  if (!existing) return c.json({ error: "Not attending this event" }, 400);
  await prisma.eventAttendee.delete({ where: { id: existing.id } });
  return c.json({ message: "RSVP canceled" });
});
communities.get("/events/:id/attendees", async (c) => {
  const eventId = c.req.param("id");
  const prisma = getPrisma(c.env.DB);
  const list = await prisma.eventAttendee.findMany({
    where: { eventId },
    include: {
      user: { select: { username: true, avatarUrl: true } }
    }
  });
  return c.json(list.map((a: any) => a.user));
});
communities.get("/:id/forum", async (c) => {
  const communityId = c.req.param("id");
  const cursor = c.req.query("cursor");
  const prisma = getPrisma(c.env.DB);
  const list = await prisma.groupMessage.findMany({
    where: { communityId },
    include: { sender: { select: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
    ...cursor ? { cursor: { id: cursor }, skip: 1 } : {}
  });
  return c.json(list);
});
communities.get("/me/messages", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const userId = c.get("userId");
  const cursor = c.req.query("cursor");
  const take = parseInt(c.req.query("limit") || "20", 10);
  try {
    const messages = await prisma.communityMessage.findMany({
      where: {
        community: {
          members: {
            some: { userId }
          }
        }
      },
      take,
      ...cursor ? { skip: 1, cursor: { id: cursor } } : {},
      orderBy: { createdAt: "desc" },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            avatarUrl: true
          }
        },
        community: {
          select: {
            id: true,
            name: true,
            image: true
          }
        },
        likes: { where: { userId } },
        bookmarks: { where: { userId } },
        _count: {
          select: {
            likes: true,
            comments: true
          }
        }
      }
    });
    const formattedMessages = messages.map((msg: any) => ({
      ...msg,
      likesCount: msg._count.likes,
      commentsCount: msg._count.comments,
      sharesCount: msg.sharesCount,
      isLiked: msg.likes.length > 0,
      isBookmarked: msg.bookmarks.length > 0
    }));
    return c.json({
      data: formattedMessages,
      nextCursor: messages.length === take ? messages[take - 1].id : null
    });
  } catch (error) {
    console.error("Error fetching my admin messages:", error);
    return c.json({ error: "Failed to fetch admin messages" }, 500);
  }
});
communities.get("/:id/messages", async (c) => {
  const communityId = c.req.param("id");
  const cursor = c.req.query("cursor");
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const list = await prisma.communityMessage.findMany({
    where: { communityId },
    include: { sender: { select: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
    ...cursor ? { cursor: { id: cursor }, skip: 1 } : {}
  });
  let userLikes: any[] = [];
  let userBookmarks: any[] = [];
  if (userId) {
    const messageIds = list.map((m: any) => m.id);
    if (messageIds.length > 0) {
      userLikes = await prisma.communityMessageLike.findMany({
        where: { userId, messageId: { in: messageIds } }
      });
      userBookmarks = await prisma.communityMessageBookmark.findMany({
        where: { userId, messageId: { in: messageIds } }
      });
    }
  }
  const result = list.map((m: any) => ({
    ...m,
    hasLiked: userLikes.some((l: any) => l.messageId === m.id),
    hasBookmarked: userBookmarks.some((b: any) => b.messageId === m.id)
  }));
  return c.json(result);
});
communities.post("/:id/messages", async (c) => {
  const communityId = c.req.param("id");
  const senderId = c.get("userId");
  const body = await c.req.json() as any;
  const { text, title, imageUrl, videoUrl, videoThumbnail, audioUrl, audioThumbnail } = body;
  const prisma = getPrisma(c.env.DB);
  const member = await prisma.communityMember.findFirst({
    where: { communityId, userId: senderId }
  });
  if (!member || member.role !== "ADMIN") {
    return c.json({ error: "Only admins can post messages" }, 403);
  }
  const msg = await prisma.communityMessage.create({
    data: {
      communityId,
      senderId,
      text,
      title,
      imageUrl,
      videoUrl,
      videoThumbnail,
      audioUrl,
      audioThumbnail
    },
    include: {
      sender: { select: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true } }
    }
  });
  const members = await prisma.communityMember.findMany({
    where: { communityId, userId: { not: senderId } },
    select: { userId: true }
  });
  const fcm = new FCMService(c.env.FIREBASE_CLIENT_EMAIL, c.env.FIREBASE_PRIVATE_KEY);
  const senderName = msg.sender.firstName || msg.sender.username || "Someone";
  for (const member2 of members) {
    await dispatchNotification({
      prisma,
      userId: member2.userId,
      title: "New Community Message",
      message: `${senderName}: ${text || "Sent an attachment"}`,
      type: "COMMUNITY_MESSAGE",
      pushSettingKey: "pushCommunityForum",
      fcm,
      data: { type: "COMMUNITY_MESSAGE", communityId }
    });
  }
  return c.json(msg);
});
communities.post("/:id/forum/messages", async (c) => {
  const communityId = c.req.param("id");
  const senderId = c.get("userId");
  const body = await c.req.json() as any;
  const { text, imageUrl, videoUrl, videoThumbnail, audioUrl, audioThumbnail } = body;
  const prisma = getPrisma(c.env.DB);
  const member = await prisma.communityMember.findFirst({
    where: { communityId, userId: senderId }
  });
  if (!member) {
    return c.json({ error: "Only members can post messages in the forum" }, 403);
  }
  const msg = await prisma.groupMessage.create({
    data: {
      communityId,
      senderId,
      text,
      imageUrl,
      videoUrl,
      videoThumbnail,
      audioUrl,
      audioThumbnail
    },
    include: {
      sender: { select: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true } }
    }
  });
  const members = await prisma.communityMember.findMany({
    where: { communityId, userId: { not: senderId } },
    select: { userId: true }
  });
  const fcm = new FCMService(c.env.FIREBASE_CLIENT_EMAIL, c.env.FIREBASE_PRIVATE_KEY);
  const senderName = msg.sender.firstName || msg.sender.username || "Someone";
  for (const member2 of members) {
    await dispatchNotification({
      prisma,
      userId: member2.userId,
      title: "New Forum Message",
      message: `${senderName}: ${text || "Sent an attachment"}`,
      type: "COMMUNITY_FORUM",
      pushSettingKey: "pushCommunityForum",
      fcm,
      data: { type: "COMMUNITY_FORUM", communityId }
    });
  }
  return c.json(msg);
});
communities.put("/:id/settings", async (c) => {
  const communityId = c.req.param("id");
  const adminId = c.get("userId");
  const body = await c.req.json() as any;
  const { isForumDisabledGlobally } = body;
  const prisma = getPrisma(c.env.DB);
  const member = await prisma.communityMember.findFirst({
    where: { communityId, userId: adminId }
  });
  if (!member || member.role !== "ADMIN") {
    return c.json({ error: "Only admins can update community settings" }, 403);
  }
  const updated = await prisma.community.update({
    where: { id: communityId },
    data: {
      isForumDisabledGlobally: isForumDisabledGlobally !== void 0 ? isForumDisabledGlobally : void 0
    }
  });
  return c.json(updated);
});
communities.put("/:id/members/:userId/moderate", async (c) => {
  const communityId = c.req.param("id");
  const targetUserId = c.req.param("userId");
  const adminId = c.get("userId");
  const body = await c.req.json() as any;
  const { isSuspended, canPostForum } = body;
  const prisma = getPrisma(c.env.DB);
  const adminMember = await prisma.communityMember.findFirst({
    where: { communityId, userId: adminId }
  });
  if (!adminMember || adminMember.role !== "ADMIN") {
    return c.json({ error: "Only admins can moderate members" }, 403);
  }
  const targetMember = await prisma.communityMember.findFirst({
    where: { communityId, userId: targetUserId },
    include: { user: true }
  });
  if (!targetMember) {
    return c.json({ error: "Member not found" }, 404);
  }
  if (targetMember.role === "ADMIN") {
    return c.json({ error: "Cannot moderate other admins" }, 403);
  }
  const updatedMember = await prisma.communityMember.update({
    where: { id: targetMember.id },
    data: {
      isSuspended: isSuspended !== void 0 ? isSuspended : targetMember.isSuspended,
      canPostForum: canPostForum !== void 0 ? canPostForum : targetMember.canPostForum
    }
  });
  if (isSuspended !== void 0 && isSuspended !== targetMember.isSuspended) {
    const fcm = new FCMService(c.env.FIREBASE_CLIENT_EMAIL, c.env.FIREBASE_PRIVATE_KEY);
    await dispatchNotification({
      prisma,
      userId: targetMember.userId,
      title: isSuspended ? "Community Suspension" : "Community Suspension Lifted",
      message: isSuspended ? "You have been suspended from the community." : "Your suspension has been lifted. You can now access the community again.",
      type: "COMMUNITY_SUSPENSION",
      pushSettingKey: "pushCommunityUpdates",
      fcm,
      data: { type: "COMMUNITY_SUSPENSION", communityId }
    });
  }
  return c.json(updatedMember);
});
communities.delete("/messages/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const prisma = getPrisma(c.env.DB);
  const msg = await prisma.communityMessage.findUnique({ where: { id } });
  if (!msg) return c.json({ error: "Message not found" }, 404);
  const member = await prisma.communityMember.findFirst({
    where: { communityId: msg.communityId, userId }
  });
  if (member?.role !== "ADMIN" && msg.senderId !== userId) {
    return c.json({ error: "Forbidden" }, 403);
  }
  await prisma.communityMessage.delete({ where: { id } });
  return c.json({ message: "Message deleted successfully" });
});
communities.delete("/forum/messages/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const prisma = getPrisma(c.env.DB);
  const msg = await prisma.groupMessage.findUnique({ where: { id } });
  if (!msg) return c.json({ error: "Message not found" }, 404);
  const member = await prisma.communityMember.findFirst({
    where: { communityId: msg.communityId, userId }
  });
  if (member?.role !== "ADMIN" && msg.senderId !== userId) {
    return c.json({ error: "Forbidden" }, 403);
  }
  await prisma.groupMessage.delete({ where: { id } });
  return c.json({ message: "Message deleted successfully" });
});
communities.get("/:id/verse-today", async (c) => {
  const communityId = c.req.param("id");
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const community = await prisma.community.findUnique({
    where: { id: communityId }
  });
  if (!community) return c.json({ error: "Community not found" }, 404);
  const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  let verse = await prisma.communityDailyVerse.findUnique({
    where: {
      communityId_date: {
        communityId,
        date: todayStr
      }
    }
  });
  if (!verse) {
    const verses = [
      { reference: "John 3:16", text: "For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life.", explanation: "A reflection on God\u2019s boundless love and the gift of eternal life." },
      { reference: "Philippians 4:13", text: "I can do all things through him who strengthens me.", explanation: "A reminder of the strength and empowerment we receive from Christ." },
      { reference: "Proverbs 3:5-6", text: "Trust in the Lord with all your heart, and do not lean on your own understanding. In all your ways acknowledge him, and he will make straight your paths.", explanation: "Encouragement to trust God fully in every aspect of life." },
      { reference: "Jeremiah 29:11", text: "For I know the plans I have for you, declares the Lord, plans for welfare and not for evil, to give you a future and a hope.", explanation: "God has a purposeful and hopeful plan for our lives." },
      { reference: "Romans 8:28", text: "And we know that for those who love God all things work together for good, for those who are called according to his purpose.", explanation: "Assurance that God works all things out for our ultimate good." },
      { reference: "Isaiah 41:10", text: "Fear not, for I am with you; be not dismayed, for I am your God; I will strengthen you, I will help you, I will uphold you with my righteous right hand.", explanation: "A comforting promise of God\u2019s presence and support in times of fear." },
      { reference: "Psalm 23:1", text: "The Lord is my shepherd; I shall not want.", explanation: "A beautiful declaration of God\u2019s provision and care as our Shepherd." }
    ];
    let hash = 0;
    const str = todayStr + communityId;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % verses.length;
    const verseData = verses[index];
    verse = await prisma.communityDailyVerse.create({
      data: {
        communityId,
        date: todayStr,
        reference: verseData.reference,
        text: verseData.text,
        explanation: verseData.explanation
      }
    });
  }
  const userLike = await prisma.communityDailyVerseLike.findUnique({
    where: {
      userId_verseId: {
        userId,
        verseId: verse.id
      }
    }
  });
  return c.json({
    ...verse,
    hasLiked: !!userLike,
    backgroundImageUrl: community.image
  });
});
communities.post("/:id/verse-today/like", async (c) => {
  const communityId = c.req.param("id");
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const verse = await prisma.communityDailyVerse.findUnique({
    where: { communityId_date: { communityId, date: todayStr } }
  });
  if (!verse) return c.json({ error: "Verse not found" }, 404);
  const existingLike = await prisma.communityDailyVerseLike.findUnique({
    where: { userId_verseId: { userId, verseId: verse.id } }
  });
  if (existingLike) {
    await prisma.communityDailyVerseLike.delete({ where: { id: existingLike.id } });
    await prisma.communityDailyVerse.update({
      where: { id: verse.id },
      data: { likesCount: { decrement: 1 } }
    });
    return c.json({ liked: false });
  } else {
    await prisma.communityDailyVerseLike.create({
      data: { userId, verseId: verse.id }
    });
    await prisma.communityDailyVerse.update({
      where: { id: verse.id },
      data: { likesCount: { increment: 1 } }
    });
    return c.json({ liked: true });
  }
});
communities.post("/:id/verse-today/share", async (c) => {
  const communityId = c.req.param("id");
  const prisma = getPrisma(c.env.DB);
  const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const verse = await prisma.communityDailyVerse.findUnique({
    where: { communityId_date: { communityId, date: todayStr } }
  });
  if (!verse) return c.json({ error: "Verse not found" }, 404);
  await prisma.communityDailyVerse.update({
    where: { id: verse.id },
    data: { sharesCount: { increment: 1 } }
  });
  return c.json({ success: true });
});
communities.post("/:id/messages/:msgId/like", async (c) => {
  const msgId = c.req.param("msgId");
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const message2 = await prisma.communityMessage.findUnique({ where: { id: msgId } });
  if (!message2) return c.json({ error: "Message not found" }, 404);
  const existingLike = await prisma.communityMessageLike.findUnique({
    where: { userId_messageId: { userId, messageId: msgId } }
  });
  if (existingLike) {
    await prisma.communityMessageLike.delete({ where: { id: existingLike.id } });
    await prisma.communityMessage.update({
      where: { id: msgId },
      data: { likesCount: { decrement: 1 } }
    });
    return c.json({ liked: false });
  } else {
    await prisma.communityMessageLike.create({
      data: { userId, messageId: msgId }
    });
    await prisma.communityMessage.update({
      where: { id: msgId },
      data: { likesCount: { increment: 1 } }
    });
    return c.json({ liked: true });
  }
});
communities.post("/:id/messages/:msgId/bookmark", async (c) => {
  const msgId = c.req.param("msgId");
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const message2 = await prisma.communityMessage.findUnique({ where: { id: msgId } });
  if (!message2) return c.json({ error: "Message not found" }, 404);
  const existingBookmark = await prisma.communityMessageBookmark.findUnique({
    where: { userId_messageId: { userId, messageId: msgId } }
  });
  if (existingBookmark) {
    await prisma.communityMessageBookmark.delete({ where: { id: existingBookmark.id } });
    await prisma.communityMessage.update({
      where: { id: msgId },
      data: { bookmarksCount: { decrement: 1 } }
    });
    return c.json({ bookmarked: false });
  } else {
    await prisma.communityMessageBookmark.create({
      data: { userId, messageId: msgId }
    });
    await prisma.communityMessage.update({
      where: { id: msgId },
      data: { bookmarksCount: { increment: 1 } }
    });
    return c.json({ bookmarked: true });
  }
});
communities.post("/:id/messages/:msgId/share", async (c) => {
  const msgId = c.req.param("msgId");
  const prisma = getPrisma(c.env.DB);
  const message2 = await prisma.communityMessage.findUnique({ where: { id: msgId } });
  if (!message2) return c.json({ error: "Message not found" }, 404);
  await prisma.communityMessage.update({
    where: { id: msgId },
    data: { sharesCount: { increment: 1 } }
  });
  return c.json({ success: true });
});
communities.get("/:id/messages/:msgId/comments", async (c) => {
  const msgId = c.req.param("msgId");
  const prisma = getPrisma(c.env.DB);
  const comments = await prisma.communityMessageComment.findMany({
    where: { messageId: msgId, parentId: null },
    include: {
      user: { select: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true } },
      replies: {
        include: {
          user: { select: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true } }
        },
        orderBy: { createdAt: "asc" }
      }
    },
    orderBy: { createdAt: "desc" }
  });
  return c.json(comments);
});
communities.post("/:id/messages/:msgId/comments", async (c) => {
  const msgId = c.req.param("msgId");
  const userId = c.get("userId");
  const body = await c.req.json() as any;
  const { text, parentId } = body;
  const prisma = getPrisma(c.env.DB);
  if (!text || text.trim() === "") {
    return c.json({ error: "Text is required" }, 400);
  }
  const comment = await prisma.communityMessageComment.create({
    data: {
      userId,
      messageId: msgId,
      text,
      parentId: parentId || null
    },
    include: {
      user: { select: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true } }
    }
  });
  await prisma.communityMessage.update({
    where: { id: msgId },
    data: { commentsCount: { increment: 1 } }
  });
  return c.json(comment);
});
communities.put("/messages/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = await c.req.json() as any;
  const prisma = getPrisma(c.env.DB);
  const msg = await prisma.communityMessage.findUnique({ where: { id } });
  if (!msg) return c.json({ error: "Message not found" }, 404);
  if (msg.senderId !== userId) return c.json({ error: "Not authorized" }, 403);
  const data: any = {};
  if (body.text !== void 0) data.text = body.text;
  if (body.imageUrl !== void 0) data.imageUrl = body.imageUrl;
  if (body.videoUrl !== void 0) data.videoUrl = body.videoUrl;
  if (body.audioUrl !== void 0) data.audioUrl = body.audioUrl;
  if (body.videoThumbnail !== void 0) data.videoThumbnail = body.videoThumbnail;
  if (body.audioThumbnail !== void 0) data.audioThumbnail = body.audioThumbnail;
  const updated = await prisma.communityMessage.update({
    where: { id },
    data
  });
  return c.json(updated);
});
communities.post("/:id/messages/:msgId/react", async (c) => {
  const msgId = c.req.param("msgId");
  const userId = c.get("userId");
  const { emoji } = await c.req.json();
  const prisma = getPrisma(c.env.DB);
  const existing = await prisma.communityMessageReaction.findUnique({
    where: { userId_messageId_emoji: { userId, messageId: msgId, emoji } }
  });
  if (existing) {
    await prisma.communityMessageReaction.delete({ where: { id: existing.id } });
    return c.json({ added: false });
  } else {
    await prisma.communityMessageReaction.create({
      data: { userId, messageId: msgId, emoji }
    });
    return c.json({ added: true });
  }
});
communities.post("/:id/messages/comments/:commentId/like", async (c) => {
  const commentId = c.req.param("commentId");
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const existing = await prisma.communityMessageCommentLike.findUnique({
    where: { userId_commentId: { userId, commentId } }
  });
  if (existing) {
    await prisma.communityMessageCommentLike.delete({ where: { id: existing.id } });
    await prisma.communityMessageComment.update({
      where: { id: commentId },
      data: { likesCount: { decrement: 1 } }
    });
    return c.json({ liked: false });
  } else {
    await prisma.communityMessageCommentLike.create({
      data: { userId, commentId }
    });
    await prisma.communityMessageComment.update({
      where: { id: commentId },
      data: { likesCount: { increment: 1 } }
    });
    return c.json({ liked: true });
  }
});


export default communities;
export { seedCommunityIfEmpty };
