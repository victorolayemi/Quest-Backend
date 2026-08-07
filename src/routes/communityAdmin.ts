import { Hono } from 'hono';
import { getDrizzle } from '../utils/drizzle';
import { Bindings, Variables } from '../types';
import { community, communityMember, post, groupMessage, comment, communityMessage, communityMessageComment, notification, communityEvent, communityDailyVerse, user } from '../db/schema';
import { eq, desc, and } from 'drizzle-orm';

const communityAdmin = new Hono<{Bindings: Bindings, Variables: Variables}>();

communityAdmin.get("/", async (c) => {
  const db = getDrizzle(c.env.DB);
  const communities = await db.query.community.findMany({
    with: {
      communityMembers: true,
      posts: true
    },
    orderBy: (co, { desc }) => [desc(co.createdAt)]
  });
  
  const mapped = communities.map(comm => {
    const { communityMembers, posts, ...rest } = comm;
    return {
      ...rest,
      _count: {
        members: communityMembers.length,
        posts: posts.length
      }
    };
  });

  return c.json({ communities: mapped });
});

communityAdmin.post("/", async (c) => {
  const db = getDrizzle(c.env.DB);
  let name2: string = "", description: string = "", guidelines: string = "", imageUrl: string = "";
  const contentType = c.req.header("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await c.req.formData();
    name2 = formData.get("name") as string;
    description = formData.get("description") as string;
    guidelines = formData.get("guidelines") as string;
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
  
  const adminUser = await db.query.user.findFirst({ where: eq(user.isAdmin, true) });
  const fallbackUser = await db.query.user.findFirst();
  const creatorId = adminUser?.id || fallbackUser?.id || "00000000-0000-0000-0000-000000000000";
  
  const [newCommunity] = await db.insert(community).values({
    id: crypto.randomUUID(),
    name: name2 || "Untitled Community",
    description: description || "",
    guidelines: guidelines || "",
    image: imageUrl,
    creatorId,
  }).returning();
  
  return c.json({ community: newCommunity });
});

communityAdmin.delete("/:id", async (c) => {
  const db = getDrizzle(c.env.DB);
  await db.delete(community).where(eq(community.id, c.req.param("id")));
  return c.json({ success: true });
});

communityAdmin.get("/:id", async (c) => {
  const db = getDrizzle(c.env.DB);
  const comm = await db.query.community.findFirst({
    where: eq(community.id, c.req.param("id")),
    with: {
      communityMembers: true,
      posts: true
    }
  });
  if (!comm) return c.json({ error: "Not found" }, 404);
  
  const { communityMembers, posts, ...rest } = comm;
  const mapped = {
    ...rest,
    _count: {
      members: communityMembers.length,
      posts: posts.length
    }
  };
  return c.json({ community: mapped });
});

communityAdmin.get("/:id/members", async (c) => {
  const db = getDrizzle(c.env.DB);
  const members = await db.query.communityMember.findMany({
    where: eq(communityMember.communityId, c.req.param("id")),
    with: {
      user: {
        columns: { id: true, firstName: true, lastName: true, username: true, email: true, avatarUrl: true }
      }
    },
    orderBy: (cm, { desc }) => [desc(cm.joinedAt)]
  });
  return c.json({ members });
});

communityAdmin.post("/:id/admins", async (c) => {
  const db = getDrizzle(c.env.DB);
  const communityId = c.req.param("id");
  const { userId } = await c.req.json();
  if (!userId) return c.json({ error: "userId is required" }, 400);
  
  let member = await db.query.communityMember.findFirst({
    where: and(eq(communityMember.communityId, communityId), eq(communityMember.userId, userId))
  });
  
  if (!member) {
    const [newMember] = await db.insert(communityMember).values({
      id: crypto.randomUUID(),
      communityId,
      userId,
      role: "ADMIN",
    }).returning();
    member = newMember;
  } else {
    const [updatedMember] = await db.update(communityMember)
      .set({ role: "ADMIN" })
      .where(eq(communityMember.id, member.id))
      .returning();
    member = updatedMember;
  }
  
  const memberWithUser = await db.query.communityMember.findFirst({
    where: eq(communityMember.id, member.id),
    with: {
      user: { columns: { id: true, firstName: true, lastName: true, username: true, email: true, avatarUrl: true } }
    }
  });
  
  return c.json({ success: true, member: memberWithUser });
});

communityAdmin.put("/:id/members/:userId/moderate", async (c) => {
  const db = getDrizzle(c.env.DB);
  const communityId = c.req.param("id");
  const userId = c.req.param("userId");
  const body = await c.req.json() as any;
  const { isSuspended, canPostForum, role } = body;
  
  let member = await db.query.communityMember.findFirst({
    where: and(eq(communityMember.communityId, communityId), eq(communityMember.userId, userId))
  });
  if (!member) return c.json({ error: "Member not found" }, 404);
  
  const dataToUpdate: any = {};
  if (isSuspended !== void 0) dataToUpdate.isSuspended = isSuspended;
  if (canPostForum !== void 0) dataToUpdate.canPostForum = canPostForum;
  if (role !== void 0) dataToUpdate.role = role;
  
  await db.update(communityMember)
    .set(dataToUpdate)
    .where(eq(communityMember.id, member.id));
    
  const updatedMember = await db.query.communityMember.findFirst({
    where: eq(communityMember.id, member.id),
    with: {
      user: { columns: { id: true, firstName: true, lastName: true, username: true, email: true, avatarUrl: true } }
    }
  });
  
  return c.json({ success: true, member: updatedMember });
});

communityAdmin.delete("/:id/members/:userId", async (c) => {
  const db = getDrizzle(c.env.DB);
  const communityId = c.req.param("id");
  const userId = c.req.param("userId");
  await db.delete(communityMember).where(and(
    eq(communityMember.communityId, communityId),
    eq(communityMember.userId, userId)
  ));
  return c.json({ success: true });
});

communityAdmin.get("/:id/posts", async (c) => {
  const db = getDrizzle(c.env.DB);
  const posts = await db.query.post.findMany({
    where: eq(post.communityId, c.req.param("id")),
    with: {
      user: { columns: { firstName: true, lastName: true, username: true, avatarUrl: true } },
      comments: true,
      postReactions: true
    },
    orderBy: (p, { desc }) => [desc(p.createdAt)]
  });
  
  const mapped = posts.map(p => {
    const { comments, postReactions, ...rest } = p;
    return {
      ...rest,
      _count: { comments: comments.length, reactions: postReactions.length }
    };
  });
  
  return c.json({ posts: mapped });
});

communityAdmin.get("/:id/forum", async (c) => {
  const db = getDrizzle(c.env.DB);
  const forumMessages = await db.query.groupMessage.findMany({
    where: eq(groupMessage.communityId, c.req.param("id")),
    with: {
      user: { columns: { firstName: true, lastName: true, username: true, avatarUrl: true } }
    },
    orderBy: (m, { desc }) => [desc(m.createdAt)]
  });
  
  // Map user to sender to match the original JSON response
  const mapped = forumMessages.map(m => {
    const { user, ...rest } = m;
    return { ...rest, sender: user };
  });
  
  return c.json({ forum: mapped });
});

communityAdmin.delete("/posts/:id", async (c) => {
  const db = getDrizzle(c.env.DB);
  await db.delete(post).where(eq(post.id, c.req.param("id")));
  return c.json({ success: true });
});

communityAdmin.get("/posts/:id", async (c) => {
  const db = getDrizzle(c.env.DB);
  const p = await db.query.post.findFirst({
    where: eq(post.id, c.req.param("id")),
    with: {
      user: { columns: { firstName: true, lastName: true, username: true, avatarUrl: true } },
      comments: {
        with: {
          user: { columns: { firstName: true, lastName: true, username: true, avatarUrl: true } }
        },
        orderBy: (co, { desc }) => [desc(co.createdAt)]
      },
      postReactions: true
    }
  });
  
  if (!p) return c.json({ post: null });
  
  const { postReactions, comments, ...rest } = p;
  const mapped = {
    ...rest,
    comments,
    _count: { comments: comments.length, reactions: postReactions.length }
  };
  return c.json({ post: mapped });
});

communityAdmin.delete("/posts/comments/:id", async (c) => {
  const db = getDrizzle(c.env.DB);
  const { reason } = await c.req.json();
  const commentId = c.req.param("id");

  const existingComment = await db.query.comment.findFirst({ where: eq(comment.id, commentId) });
  if (!existingComment) return c.json({ error: "Not found" }, 404);

  await db.delete(comment).where(eq(comment.id, commentId));

  await db.insert(notification).values({
    id: crypto.randomUUID(),
    userId: existingComment.userId,
    title: "Comment Deleted",
    message: `Your comment on a community post was deleted by an admin. Reason: ${reason}`,
    type: "SYSTEM",
  });

  return c.json({ success: true });
});

communityAdmin.delete("/forum/messages/:id", async (c) => {
  const db = getDrizzle(c.env.DB);
  await db.delete(groupMessage).where(eq(groupMessage.id, c.req.param("id")));
  return c.json({ success: true });
});

communityAdmin.delete("/comments/:id", async (c) => {
  const db = getDrizzle(c.env.DB);
  await db.delete(comment).where(eq(comment.id, c.req.param("id")));
  return c.json({ success: true });
});

communityAdmin.get("/:id/messages", async (c) => {
  const db = getDrizzle(c.env.DB);
  const messages = await db.query.communityMessage.findMany({
    where: eq(communityMessage.communityId, c.req.param("id")),
    with: {
      user: { columns: { firstName: true, lastName: true, username: true, avatarUrl: true } }
    },
    orderBy: (m, { desc }) => [desc(m.createdAt)]
  });
  
  const mapped = messages.map(m => {
    const { user, ...rest } = m;
    return { ...rest, sender: user };
  });
  
  return c.json({ messages: mapped });
});

communityAdmin.delete("/messages/:id", async (c) => {
  const db = getDrizzle(c.env.DB);
  await db.delete(communityMessage).where(eq(communityMessage.id, c.req.param("id")));
  return c.json({ success: true });
});

communityAdmin.get("/messages/:id", async (c) => {
  const db = getDrizzle(c.env.DB);
  const m = await db.query.communityMessage.findFirst({
    where: eq(communityMessage.id, c.req.param("id")),
    with: {
      user: { columns: { firstName: true, lastName: true, username: true, avatarUrl: true } },
      communityMessageComments: {
        with: {
          user: { columns: { firstName: true, lastName: true, username: true, avatarUrl: true } }
        },
        orderBy: (co, { desc }) => [desc(co.createdAt)]
      }
    }
  });
  
  if (!m) return c.json({ message: null });
  
  const { user, communityMessageComments, ...rest } = m;
  const mapped = {
    ...rest,
    sender: user,
    comments: communityMessageComments
  };
  
  return c.json({ message: mapped });
});

communityAdmin.delete("/messages/comments/:id", async (c) => {
  const db = getDrizzle(c.env.DB);
  const { reason } = await c.req.json();
  const commentId = c.req.param("id");

  const existingComment = await db.query.communityMessageComment.findFirst({ where: eq(communityMessageComment.id, commentId) });
  if (!existingComment) return c.json({ error: "Not found" }, 404);

  await db.delete(communityMessageComment).where(eq(communityMessageComment.id, commentId));

  await db.insert(notification).values({
    id: crypto.randomUUID(),
    userId: existingComment.userId,
    title: "Comment Deleted",
    message: `Your comment on a community message was deleted by an admin. Reason: ${reason}`,
    type: "SYSTEM",
  });

  return c.json({ success: true });
});

communityAdmin.get("/:id/events", async (c) => {
  const db = getDrizzle(c.env.DB);
  const events = await db.query.communityEvent.findMany({
    where: eq(communityEvent.communityId, c.req.param("id")),
    orderBy: (e, { desc }) => [desc(e.createdAt)]
  });
  return c.json({ events });
});

communityAdmin.delete("/events/:id", async (c) => {
  const db = getDrizzle(c.env.DB);
  await db.delete(communityEvent).where(eq(communityEvent.id, c.req.param("id")));
  return c.json({ success: true });
});

communityAdmin.post("/:id/verse-override", async (c) => {
  const db = getDrizzle(c.env.DB);
  const communityId = c.req.param("id");
  const { date, reference, text, explanation } = await c.req.json();
  if (!date || !reference || !text) {
    return c.json({ error: "date, reference, and text are required" }, 400);
  }
  
  const existing = await db.query.communityDailyVerse.findFirst({
    where: and(eq(communityDailyVerse.communityId, communityId), eq(communityDailyVerse.date, date))
  });
  
  let verse;
  if (existing) {
    const [updated] = await db.update(communityDailyVerse)
      .set({ reference, text, explanation })
      .where(eq(communityDailyVerse.id, existing.id))
      .returning();
    verse = updated;
  } else {
    const [inserted] = await db.insert(communityDailyVerse).values({
      id: crypto.randomUUID(),
      communityId,
      date,
      reference,
      text,
      explanation,
    }).returning();
    verse = inserted;
  }
  
  return c.json({ success: true, verse });
});

export default communityAdmin;
