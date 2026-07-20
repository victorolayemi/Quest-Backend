import { Hono } from 'hono';
import { getPrisma } from '../utils/prisma';
import { authMiddleware } from '../middleware/auth';
import { adminAuthMiddleware } from '../middleware/adminAuth';
import admin from 'firebase-admin';

// src/routes/contentAdmin.ts
import { Bindings, Variables } from '../types';
var contentAdmin = new Hono<{Bindings: Bindings, Variables: Variables}>();
contentAdmin.get("/devotions/plans", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const plans = await prisma.devotionPlan.findMany({
    include: { _count: { select: { days: true } } }
  });
  return c.json({ plans });
});
contentAdmin.post("/devotions/plans", async (c) => {
  const prisma = getPrisma(c.env.DB);
  let data: any = {};
  const contentType = c.req.header("content-type") || "";
  
  if (contentType.includes("multipart/form-data")) {
    const formData = await c.req.formData();
    data = {
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      authorName: formData.get("authorName") as string,
      authorHandle: formData.get("authorHandle") as string,
      tag: formData.get("tag") as string,
      durationDays: parseInt(formData.get("durationDays") as string, 10) || 1,
    };
    const file = formData.get("image") as unknown as File;
    if (file && file.size > 0 && c.env.MEDIA_BUCKET) {
      const fileKey = `devotions/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const fileBuffer = await file.arrayBuffer();
      await c.env.MEDIA_BUCKET.put(fileKey, fileBuffer, {
        httpMetadata: { contentType: file.type }
      });
      const origin = new URL(c.req.url).origin;
      data.image = `${origin}/api/v1/media/download/${fileKey}`;
    }
  } else {
    data = await c.req.json();
  }

  const plan = await prisma.devotionPlan.create({ data });
  return c.json({ plan });
});
contentAdmin.delete("/devotions/plans/:id", async (c) => {
  const prisma = getPrisma(c.env.DB);
  await prisma.devotionPlan.delete({ where: { id: c.req.param("id") } });
  return c.json({ success: true });
});
contentAdmin.put("/devotions/plans/:id", async (c) => {
  const prisma = getPrisma(c.env.DB);
  let updateData: any = {};
  const contentType = c.req.header("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await c.req.formData();
    updateData = {
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      authorName: formData.get("authorName") as string,
      authorHandle: formData.get("authorHandle") as string,
      tag: formData.get("tag") as string,
      durationDays: parseInt(formData.get("durationDays") as string, 10) || 1,
    };
    const file = formData.get("image") as unknown as File;
    if (file && file.size > 0 && c.env.MEDIA_BUCKET) {
      const fileKey = `devotions/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const fileBuffer = await file.arrayBuffer();
      await c.env.MEDIA_BUCKET.put(fileKey, fileBuffer, {
        httpMetadata: { contentType: file.type }
      });
      const origin = new URL(c.req.url).origin;
      updateData.image = `${origin}/api/v1/media/download/${fileKey}`;
    }
  } else {
    const body = await c.req.json();
    const { _count, id, createdAt, days, ...data } = body;
    updateData = data;
  }

  const plan = await prisma.devotionPlan.update({
    where: { id: c.req.param("id") },
    data: updateData
  });
  return c.json({ plan });
});
contentAdmin.get("/devotions/plans/:planId/days", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const days = await prisma.devotionDay.findMany({
    where: { planId: c.req.param("planId") },
    orderBy: { dayNumber: "asc" }
  });
  return c.json({ days });
});
contentAdmin.post("/devotions/days", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const body = await c.req.json();
  const day2 = await prisma.devotionDay.create({ data: body });
  return c.json({ day: day2 });
});
contentAdmin.delete("/devotions/days/:id", async (c) => {
  const prisma = getPrisma(c.env.DB);
  await prisma.devotionDay.delete({ where: { id: c.req.param("id") } });
  return c.json({ success: true });
});
contentAdmin.put("/devotions/days/:id", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const body = await c.req.json();
  const day2 = await prisma.devotionDay.update({
    where: { id: c.req.param("id") },
    data: body
  });
  return c.json({ day: day2 });
});
contentAdmin.post("/devotions/bulk-import", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const body = await c.req.json();
  const plansData = body.plans;

  if (!Array.isArray(plansData)) {
    return c.json({ error: "Invalid data format" }, 400);
  }

  const createdPlans = [];
  for (const p of plansData) {
    const { days, ...planData } = p;
    const plan = await prisma.devotionPlan.create({
      data: {
        ...planData,
        days: {
          create: days
        }
      }
    });
    createdPlans.push(plan);
  }

  return c.json({ success: true, created: createdPlans.length });
});
contentAdmin.get("/daily-bread", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const breads = await prisma.dailyBread.findMany({ orderBy: { date: "desc" } });
  return c.json({ breads });
});
contentAdmin.post("/daily-bread", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const body = await c.req.json();
  const bread = await prisma.dailyBread.create({ data: body });
  return c.json({ bread });
});
contentAdmin.delete("/daily-bread/:id", async (c) => {
  const prisma = getPrisma(c.env.DB);
  await prisma.dailyBread.delete({ where: { id: c.req.param("id") } });
  return c.json({ success: true });
});
contentAdmin.get("/affirmations", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const affirmations = await prisma.affirmation.findMany({ orderBy: { createdAt: "desc" } });
  return c.json({ affirmations });
});
contentAdmin.post("/affirmations", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const body = await c.req.json();
  const affirmation = await prisma.affirmation.create({ data: body });
  return c.json({ affirmation });
});
contentAdmin.delete("/affirmations/:id", async (c) => {
  const prisma = getPrisma(c.env.DB);
  await prisma.affirmation.delete({ where: { id: c.req.param("id") } });
  return c.json({ success: true });
});
contentAdmin.get("/books", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const books2 = await prisma.book.findMany({ orderBy: { createdAt: "desc" } });
  return c.json({ books: books2 });
});
contentAdmin.post("/books", async (c) => {
  const prisma = getPrisma(c.env.DB);
  let title, author, description, topic, downloadUrl, imageUrl;

  try {
    const formData = await c.req.formData();
    
    title = (formData.get("title") as string) || "Untitled";
    author = (formData.get("author") as string) || "Unknown";
    description = (formData.get("description") as string) || "";
    topic = (formData.get("topic") as string) || "General";
    
    const file = formData.get("file");
    if (file && (file as File).size > 0 && c.env.MEDIA_BUCKET) {
      const fileKey = `uploads/books-${Date.now()}-${(file as File).name}`;
      const fileBuffer = await (file as File).arrayBuffer();
      await c.env.MEDIA_BUCKET.put(fileKey, fileBuffer, {
        httpMetadata: { contentType: (file as File).type },
      });
      const origin = new URL(c.req.url).origin;
      downloadUrl = `${origin}/api/v1/media/download/${fileKey}`;
    }

    const thumbnail = formData.get("thumbnail");
    if (thumbnail && (thumbnail as File).size > 0 && c.env.MEDIA_BUCKET) {
      const thumbKey = `uploads/books-thumb-${Date.now()}-${(thumbnail as File).name}`;
      const thumbBuffer = await (thumbnail as File).arrayBuffer();
      await c.env.MEDIA_BUCKET.put(thumbKey, thumbBuffer, {
        httpMetadata: { contentType: (thumbnail as File).type },
      });
      const origin = new URL(c.req.url).origin;
      imageUrl = `${origin}/api/v1/media/download/${thumbKey}`;
    }
  } catch (e) {
    const body = await c.req.json();
    title = body.title;
    author = body.author || "Unknown";
    description = body.description || "";
    topic = body.topic || "General";
    downloadUrl = body.downloadUrl || "";
    imageUrl = body.imageUrl || "";
  }

  const book = await prisma.book.create({ 
    data: {
      title,
      author,
      description,
      topic,
      downloadUrl: downloadUrl || "",
      imageUrl: imageUrl || ""
    } 
  });
  return c.json({ book });
});

contentAdmin.put("/books/:id", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const id = c.req.param("id");
  let title, author, description, topic, downloadUrl, imageUrl;

  try {
    const formData = await c.req.formData();
    
    title = formData.get("title") as string;
    author = formData.get("author") as string;
    description = formData.get("description") as string;
    topic = formData.get("topic") as string;
    
    const file = formData.get("file");
    if (file && (file as File).size > 0 && c.env.MEDIA_BUCKET) {
      const fileKey = `uploads/books-${Date.now()}-${(file as File).name}`;
      const fileBuffer = await (file as File).arrayBuffer();
      await c.env.MEDIA_BUCKET.put(fileKey, fileBuffer, {
        httpMetadata: { contentType: (file as File).type },
      });
      const origin = new URL(c.req.url).origin;
      downloadUrl = `${origin}/api/v1/media/download/${fileKey}`;
    }

    const thumbnail = formData.get("thumbnail");
    if (thumbnail && (thumbnail as File).size > 0 && c.env.MEDIA_BUCKET) {
      const thumbKey = `uploads/books-thumb-${Date.now()}-${(thumbnail as File).name}`;
      const thumbBuffer = await (thumbnail as File).arrayBuffer();
      await c.env.MEDIA_BUCKET.put(thumbKey, thumbBuffer, {
        httpMetadata: { contentType: (thumbnail as File).type },
      });
      const origin = new URL(c.req.url).origin;
      imageUrl = `${origin}/api/v1/media/download/${thumbKey}`;
    }
  } catch (e) {
    const body = await c.req.json();
    title = body.title;
    author = body.author;
    description = body.description;
    topic = body.topic;
    downloadUrl = body.downloadUrl;
    imageUrl = body.imageUrl;
  }

  const updateData: any = {};
  if (title !== undefined) updateData.title = title;
  if (author !== undefined) updateData.author = author;
  if (description !== undefined) updateData.description = description;
  if (topic !== undefined) updateData.topic = topic;
  if (downloadUrl !== undefined) updateData.downloadUrl = downloadUrl;
  if (imageUrl !== undefined) updateData.imageUrl = imageUrl;

  const book = await prisma.book.update({ 
    where: { id },
    data: updateData
  });
  return c.json({ book });
});
contentAdmin.delete("/books/:id", async (c) => {
  const prisma = getPrisma(c.env.DB);
  await prisma.book.delete({ where: { id: c.req.param("id") } });
  return c.json({ success: true });
});
contentAdmin.get("/media", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const media2 = await prisma.sermonMedia.findMany({ orderBy: { createdAt: "desc" } });
  const userMedia = await prisma.userMedia.findMany({ include: { user: true }, orderBy: { createdAt: "desc" } });
  const uMapped = userMedia.map(m => ({
    id: m.id,
    title: m.title,
    author: m.user ? `${m.user.firstName} ${m.user.lastName}` : 'Unknown',
    mediaUrl: m.mediaUrl,
    imageUrl: m.imageUrl || "",
    type: m.type,
    duration: "00:00",
    category: "Reel",
    createdAt: m.createdAt
  }));
  const all = [...media2, ...uMapped].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return c.json({ media: all });
});
contentAdmin.post("/media", async (c) => {
  const prisma = getPrisma(c.env.DB);
  let title, author, category, type, mediaUrl, imageUrl, duration;

  try {
    const formData = await c.req.formData();
    
    title = (formData.get("title") as string) || "Untitled";
    author = (formData.get("author") as string) || "Unknown";
    category = (formData.get("category") as string) || "Sermon";
    type = ((formData.get("type") as string) || "VIDEO").toUpperCase();
    
    const file = formData.get("file");
    if (!file) {
      return c.json({ error: "Media file is required" }, 400);
    }

    const fileKey = `uploads/sermon-${Date.now()}-${(file as File).name}`;
    const fileBuffer = await (file as File).arrayBuffer();
    if (c.env.MEDIA_BUCKET) {
      await c.env.MEDIA_BUCKET.put(fileKey, fileBuffer, {
        httpMetadata: { contentType: (file as File).type },
      });
    }

    const origin = new URL(c.req.url).origin;
    mediaUrl = `${origin}/api/v1/media/download/${fileKey}`;

    const thumbnail = formData.get("thumbnail");
    imageUrl = "https://via.placeholder.com/600x400?text=No+Thumbnail";
    if (thumbnail && (thumbnail as File).size > 0 && c.env.MEDIA_BUCKET) {
      const thumbKey = `uploads/sermon-thumb-${Date.now()}-${(thumbnail as File).name}`;
      const thumbBuffer = await (thumbnail as File).arrayBuffer();
      await c.env.MEDIA_BUCKET.put(thumbKey, thumbBuffer, {
        httpMetadata: { contentType: (thumbnail as File).type },
      });
      imageUrl = `${origin}/api/v1/media/download/${thumbKey}`;
    }

    duration = "00:00";
  } catch (e) {
    // Fallback if not multipart/form-data
    const body = await c.req.json();
    title = body.title;
    author = body.author || "Unknown";
    category = body.category || "Sermon";
    type = body.type || "VIDEO";
    mediaUrl = body.mediaUrl;
    imageUrl = body.imageUrl || "https://via.placeholder.com/600x400?text=No+Thumbnail";
    duration = body.duration || "00:00";
  }

  const media2 = await prisma.sermonMedia.create({ 
    data: {
      title,
      author,
      category,
      type,
      mediaUrl,
      imageUrl,
      duration
    }
  });
  return c.json({ media: media2 });
});
contentAdmin.put("/media/:id", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const id = c.req.param("id");
  let title, author, category, type, mediaUrl, imageUrl, duration;

  try {
    const formData = await c.req.formData();
    
    title = formData.get("title") as string;
    author = formData.get("author") as string;
    category = formData.get("category") as string;
    type = formData.get("type") as string;
    if (type) type = type.toUpperCase();
    
    const file = formData.get("file");
    if (file && (file as File).size > 0 && c.env.MEDIA_BUCKET) {
      const fileKey = `uploads/sermon-${Date.now()}-${(file as File).name}`;
      const fileBuffer = await (file as File).arrayBuffer();
      await c.env.MEDIA_BUCKET.put(fileKey, fileBuffer, {
        httpMetadata: { contentType: (file as File).type },
      });
      const origin = new URL(c.req.url).origin;
      mediaUrl = `${origin}/api/v1/media/download/${fileKey}`;
    }

    const thumbnail = formData.get("thumbnail");
    if (thumbnail && (thumbnail as File).size > 0 && c.env.MEDIA_BUCKET) {
      const thumbKey = `uploads/sermon-thumb-${Date.now()}-${(thumbnail as File).name}`;
      const thumbBuffer = await (thumbnail as File).arrayBuffer();
      await c.env.MEDIA_BUCKET.put(thumbKey, thumbBuffer, {
        httpMetadata: { contentType: (thumbnail as File).type },
      });
      const origin = new URL(c.req.url).origin;
      imageUrl = `${origin}/api/v1/media/download/${thumbKey}`;
    }
  } catch (e) {
    // Fallback if not multipart/form-data
    const body = await c.req.json();
    title = body.title;
    author = body.author;
    category = body.category;
    type = body.type;
    mediaUrl = body.mediaUrl;
    imageUrl = body.imageUrl;
    duration = body.duration;
  }

  const updateData: any = {};
  if (title !== undefined) updateData.title = title;
  if (author !== undefined) updateData.author = author;
  if (category !== undefined) updateData.category = category;
  if (type !== undefined) updateData.type = type;
  if (mediaUrl !== undefined) updateData.mediaUrl = mediaUrl;
  if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
  if (duration !== undefined) updateData.duration = duration;

  try {
    const media2 = await prisma.sermonMedia.update({ 
      where: { id },
      data: updateData
    });
    return c.json({ media: media2 });
  } catch (err) {
    // Attempt to update userMedia if sermonMedia fails
    try {
      const mediaUser = await prisma.userMedia.update({
        where: { id },
        data: {
          title: title !== undefined ? title : undefined,
          mediaUrl: mediaUrl !== undefined ? mediaUrl : undefined,
          imageUrl: imageUrl !== undefined ? imageUrl : undefined,
          type: type !== undefined ? type : undefined,
        }
      });
      return c.json({ media: mediaUser });
    } catch (e2) {
      return c.json({ error: "Media not found or failed to update" }, 404);
    }
  }
});
contentAdmin.delete("/media/:id", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const id = c.req.param("id");
  try {
    await prisma.sermonMedia.delete({ where: { id } });
  } catch (e) {
    try {
      await prisma.userMedia.delete({ where: { id } });
    } catch (e2) {
      // Ignore if not found
    }
  }
  return c.json({ success: true });
});


export default contentAdmin;
