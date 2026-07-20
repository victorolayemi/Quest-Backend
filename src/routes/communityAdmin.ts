import { Hono } from 'hono';
import { getPrisma } from '../utils/prisma';
import { authMiddleware } from '../middleware/auth';
import { adminAuthMiddleware } from '../middleware/adminAuth';
import admin from 'firebase-admin';

// src/routes/communityAdmin.ts
import { Bindings, Variables } from '../types';
var communityAdmin = new Hono<{Bindings: Bindings, Variables: Variables}>();
communityAdmin.get("/", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const communities2 = await prisma.community.findMany({
    include: { _count: { select: { members: true, posts: true } } },
    orderBy: { createdAt: "desc" }
  });
  return c.json({ communities: communities2 });
});
communityAdmin.post("/", async (c) => {
  const prisma = getPrisma(c.env.DB);
  let name2, description, guidelines, imageUrl;
  const contentType = c.req.header("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await c.req.formData();
    name2 = formData.get("name");
    description = formData.get("description");
    guidelines = formData.get("guidelines");
    const file = formData.get("image") as unknown as File;
    if (file && file.size > 0) {
      const fileKey = `communities/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const fileBuffer = await file.arrayBuffer();
      if (c.env.MEDIA_BUCKET) {
        await c.env.MEDIA_BUCKET.put(fileKey, fileBuffer, {
          httpMetadata: { contentType: file.type }
        });
        const origin = new URL(c.req.url).origin;
        imageUrl = `${origin}/api/v1/media/download/${fileKey}`;
      }
    }
  } else {
    const body = await c.req.json() as any;
    name2 = body.name;
    description = body.description;
    guidelines = body.guidelines;
    imageUrl = body.image;
  }
  if (!imageUrl) {
    imageUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name2 || "Community")}&background=6366f1&color=fff&size=200`;
  }
  const adminUser = await prisma.user.findFirst({ where: { isAdmin: true } });
  const fallbackUser = await prisma.user.findFirst();
  const creatorId = adminUser?.id || fallbackUser?.id || "00000000-0000-0000-0000-000000000000";
  const community = await prisma.community.create({
    data: {
      name: name2 || "Untitled Community",
      description: description || "",
      guidelines: guidelines || "",
      image: imageUrl,
      creatorId
    }
  });
  return c.json({ community });
});
communityAdmin.delete("/:id", async (c) => {
  const prisma = getPrisma(c.env.DB);
  await prisma.community.delete({ where: { id: c.req.param("id") } });
  return c.json({ success: true });
});
communityAdmin.get("/:id", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const community = await prisma.community.findUnique({
    where: { id: c.req.param("id") },
    include: { _count: { select: { members: true, posts: true } } }
  });
  if (!community) return c.json({ error: "Not found" }, 404);
  return c.json({ community });
});

communityAdmin.get("/:id/members", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const members = await prisma.communityMember.findMany({
    where: { communityId: c.req.param("id") },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, username: true, email: true, avatarUrl: true } }
    },
    orderBy: { joinedAt: "desc" }
  });
  return c.json({ members });
});
communityAdmin.post("/:id/admins", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const communityId = c.req.param("id");
  const { userId } = await c.req.json();
  if (!userId) return c.json({ error: "userId is required" }, 400);
  let member = await prisma.communityMember.findFirst({
    where: { communityId, userId }
  });
  if (!member) {
    member = await prisma.communityMember.create({
      data: {
        communityId,
        userId,
        role: "ADMIN"
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, username: true, email: true, avatarUrl: true } }
      }
    });
  } else {
    member = await prisma.communityMember.update({
      where: { id: member.id },
      data: { role: "ADMIN" },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, username: true, email: true, avatarUrl: true } }
      }
    });
  }
  return c.json({ success: true, member });
});
communityAdmin.put("/:id/members/:userId/moderate", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const communityId = c.req.param("id");
  const userId = c.req.param("userId");
  const body = await c.req.json() as any;
  const { isSuspended, canPostForum, role } = body;
  let member = await prisma.communityMember.findFirst({
    where: { communityId, userId }
  });
  if (!member) return c.json({ error: "Member not found" }, 404);
  const dataToUpdate: any = {};
  if (isSuspended !== void 0) dataToUpdate.isSuspended = isSuspended;
  if (canPostForum !== void 0) dataToUpdate.canPostForum = canPostForum;
  if (role !== void 0) dataToUpdate.role = role;
  member = await prisma.communityMember.update({
    where: { id: member.id },
    data: dataToUpdate,
    include: {
      user: { select: { id: true, firstName: true, lastName: true, username: true, email: true, avatarUrl: true } }
    }
  });
  return c.json({ success: true, member });
});
communityAdmin.delete("/:id/members/:userId", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const communityId = c.req.param("id");
  const userId = c.req.param("userId");
  await prisma.communityMember.deleteMany({
    where: { communityId, userId }
  });
  return c.json({ success: true });
});
communityAdmin.get("/:id/posts", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const posts = await prisma.post.findMany({
    where: { communityId: c.req.param("id") },
    include: {
      user: { select: { firstName: true, lastName: true, username: true, avatarUrl: true } },
      _count: { select: { comments: true, reactions: true } }
    },
    orderBy: { createdAt: "desc" }
  });
  return c.json({ posts });
});

communityAdmin.get("/:id/forum", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const forumMessages = await prisma.groupMessage.findMany({
    where: { communityId: c.req.param("id") },
    include: {
      sender: { select: { firstName: true, lastName: true, username: true, avatarUrl: true } }
    },
    orderBy: { createdAt: "desc" }
  });
  return c.json({ forum: forumMessages });
});
communityAdmin.delete("/posts/:id", async (c) => {
  const prisma = getPrisma(c.env.DB);
  await prisma.post.delete({ where: { id: c.req.param("id") } });
  return c.json({ success: true });
});

communityAdmin.get("/posts/:id", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const post = await prisma.post.findUnique({
    where: { id: c.req.param("id") },
    include: {
      user: { select: { firstName: true, lastName: true, username: true, avatarUrl: true } },
      _count: { select: { comments: true, reactions: true } },
      comments: {
        include: {
          user: { select: { firstName: true, lastName: true, username: true, avatarUrl: true } }
        },
        orderBy: { createdAt: 'desc' }
      }
    }
  });
  return c.json({ post });
});

communityAdmin.delete("/posts/comments/:id", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const { reason } = await c.req.json();
  const commentId = c.req.param("id");

  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment) return c.json({ error: "Not found" }, 404);

  await prisma.comment.delete({ where: { id: commentId } });

  await prisma.notification.create({
    data: {
      userId: comment.userId,
      title: "Comment Deleted",
      message: `Your comment on a community post was deleted by an admin. Reason: ${reason}`,
      type: "SYSTEM"
    }
  });

  return c.json({ success: true });
});

communityAdmin.delete("/forum/messages/:id", async (c) => {
  const prisma = getPrisma(c.env.DB);
  await prisma.groupMessage.delete({ where: { id: c.req.param("id") } });
  return c.json({ success: true });
});
communityAdmin.delete("/comments/:id", async (c) => {
  const prisma = getPrisma(c.env.DB);
  await prisma.comment.delete({ where: { id: c.req.param("id") } });
  return c.json({ success: true });
});
communityAdmin.get("/:id/messages", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const messages = await prisma.communityMessage.findMany({
    where: { communityId: c.req.param("id") },
    include: {
      sender: { select: { firstName: true, lastName: true, username: true, avatarUrl: true } }
    },
    orderBy: { createdAt: "desc" }
  });
  return c.json({ messages });
});
communityAdmin.delete("/messages/:id", async (c) => {
  const prisma = getPrisma(c.env.DB);
  await prisma.communityMessage.delete({ where: { id: c.req.param("id") } });
  return c.json({ success: true });
});

communityAdmin.get("/messages/:id", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const message = await prisma.communityMessage.findUnique({
    where: { id: c.req.param("id") },
    include: {
      sender: { select: { firstName: true, lastName: true, username: true, avatarUrl: true } },
      comments: {
        include: {
          user: { select: { firstName: true, lastName: true, username: true, avatarUrl: true } }
        },
        orderBy: { createdAt: 'desc' }
      }
    }
  });
  return c.json({ message });
});

communityAdmin.delete("/messages/comments/:id", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const { reason } = await c.req.json();
  const commentId = c.req.param("id");

  const comment = await prisma.communityMessageComment.findUnique({ where: { id: commentId } });
  if (!comment) return c.json({ error: "Not found" }, 404);

  await prisma.communityMessageComment.delete({ where: { id: commentId } });

  await prisma.notification.create({
    data: {
      userId: comment.userId,
      title: "Comment Deleted",
      message: `Your comment on a community message was deleted by an admin. Reason: ${reason}`,
      type: "SYSTEM"
    }
  });

  return c.json({ success: true });
});
communityAdmin.get("/:id/events", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const events = await prisma.communityEvent.findMany({
    where: { communityId: c.req.param("id") },
    orderBy: { createdAt: "desc" }
  });
  return c.json({ events });
});
communityAdmin.delete("/events/:id", async (c) => {
  const prisma = getPrisma(c.env.DB);
  await prisma.communityEvent.delete({ where: { id: c.req.param("id") } });
  return c.json({ success: true });
});
communityAdmin.post("/:id/verse-override", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const communityId = c.req.param("id");
  const { date, reference, text, explanation } = await c.req.json();
  if (!date || !reference || !text) {
    return c.json({ error: "date, reference, and text are required" }, 400);
  }
  const verse = await prisma.communityDailyVerse.upsert({
    where: {
      communityId_date: {
        communityId,
        date
      }
    },
    create: {
      communityId,
      date,
      reference,
      text,
      explanation
    },
    update: {
      reference,
      text,
      explanation
    }
  });
  return c.json({ success: true, verse });
});


export default communityAdmin;
