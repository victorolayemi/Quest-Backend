import { Hono } from 'hono';
import { getDrizzle } from '../utils/drizzle';
import { eq, desc, sql } from 'drizzle-orm';
import { devotionPlan, book, devotionDay, dailyBread, affirmation, sermonMedia, userMedia } from '../db/schema';
import { adminAuthMiddleware } from '../middleware/adminAuth';
import { Bindings, Variables } from '../types';

var contentAdmin = new Hono<{Bindings: Bindings, Variables: Variables}>();
contentAdmin.use("*", adminAuthMiddleware);

contentAdmin.get("/approvals/pending", async (c) => {
  const db = getDrizzle(c.env.DB);
  
  const pendingDevotions = await db.query.devotionPlan.findMany({
    where: eq(devotionPlan.status, "PENDING_REVIEW"),
    with: { user: { columns: { username: true, email: true, firstName: true, lastName: true } } },
    orderBy: [desc(devotionPlan.createdAt)]
  });
  
  const pendingBooks = await db.query.book.findMany({
    where: eq(book.status, "PENDING_REVIEW"),
    with: { user: { columns: { username: true, email: true, firstName: true, lastName: true } } },
    orderBy: [desc(book.createdAt)]
  });
  
  const mappedDevotions = pendingDevotions.map(d => ({
    id: d.id,
    type: "DEVOTION",
    title: d.title,
    authorName: d.user ? `${d.user.firstName} ${d.user.lastName}` : d.authorName,
    submittedAt: d.createdAt
  }));
  
  const mappedBooks = pendingBooks.map(b => ({
    id: b.id,
    type: "BOOK",
    title: b.title,
    authorName: b.user ? `${b.user.firstName} ${b.user.lastName}` : b.author,
    submittedAt: b.createdAt
  }));
  
  return c.json([...mappedDevotions, ...mappedBooks].sort((a, b) => new Date(b.submittedAt as string).getTime() - new Date(a.submittedAt as string).getTime()));
});

contentAdmin.post("/approvals/:type/:id", async (c) => {
  const db = getDrizzle(c.env.DB);
  const type = c.req.param("type").toUpperCase();
  const id = c.req.param("id");
  const body = await c.req.json() as any;
  const { action } = body;
  const newStatus = action === "APPROVE" ? "APPROVED" : "REJECTED";
  
  if (type === "DEVOTION") {
    const [updated] = await db.update(devotionPlan).set({ status: newStatus }).where(eq(devotionPlan.id, id)).returning();
    return c.json({ success: true, status: updated.status });
  } else if (type === "BOOK") {
    const [updated] = await db.update(book).set({ status: newStatus }).where(eq(book.id, id)).returning();
    return c.json({ success: true, status: updated.status });
  }
  
  return c.json({ error: "Invalid type" }, 400);
});

contentAdmin.get("/devotions/plans", async (c) => {
  const db = getDrizzle(c.env.DB);
  const plansData = await db.query.devotionPlan.findMany({});
  
  const mapped = await Promise.all(plansData.map(async (p) => {
    const [dc] = await db.select({ count: sql<number>`count(*)` }).from(devotionDay).where(eq(devotionDay.planId, p.id));
    return { ...p, _count: { days: Number(dc.count) } };
  }));
  return c.json({ plans: mapped });
});

contentAdmin.post("/devotions/plans", async (c) => {
  const db = getDrizzle(c.env.DB);
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

  const [plan] = await db.insert(devotionPlan).values({ id: crypto.randomUUID(), ...data }).returning();
  return c.json({ plan });
});

contentAdmin.delete("/devotions/plans/:id", async (c) => {
  const db = getDrizzle(c.env.DB);
  await db.delete(devotionPlan).where(eq(devotionPlan.id, c.req.param("id") as string));
  return c.json({ success: true });
});

contentAdmin.put("/devotions/plans/:id", async (c) => {
  const db = getDrizzle(c.env.DB);
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
    const body = await c.req.json() as any;
    const { _count, id, createdAt, days, ...data } = body;
    updateData = data;
  }

  const [plan] = await db.update(devotionPlan).set(updateData).where(eq(devotionPlan.id, c.req.param("id") as string)).returning();
  return c.json({ plan });
});

contentAdmin.get("/devotions/plans/:planId/days", async (c) => {
  const db = getDrizzle(c.env.DB);
  const days = await db.query.devotionDay.findMany({
    where: eq(devotionDay.planId, c.req.param("planId") as string),
    orderBy: (d, { asc }) => [asc(d.dayNumber)]
  });
  return c.json({ days });
});

contentAdmin.post("/devotions/days", async (c) => {
  const db = getDrizzle(c.env.DB);
  const body = await c.req.json() as any;
  const [day2] = await db.insert(devotionDay).values({ id: crypto.randomUUID(), ...body }).returning();
  return c.json({ day: day2 });
});

contentAdmin.delete("/devotions/days/:id", async (c) => {
  const db = getDrizzle(c.env.DB);
  await db.delete(devotionDay).where(eq(devotionDay.id, c.req.param("id") as string));
  return c.json({ success: true });
});

contentAdmin.put("/devotions/days/:id", async (c) => {
  const db = getDrizzle(c.env.DB);
  const body = await c.req.json() as any;
  const [day2] = await db.update(devotionDay).set(body).where(eq(devotionDay.id, c.req.param("id") as string)).returning();
  return c.json({ day: day2 });
});

contentAdmin.post("/devotions/bulk-import", async (c) => {
  const db = getDrizzle(c.env.DB);
  const body = await c.req.json() as any;
  const plansData = body.plans;

  if (!Array.isArray(plansData)) {
    return c.json({ error: "Invalid data format" }, 400);
  }

  const createdPlans = [];
  for (const p of plansData) {
    const { days, ...planData } = p;
    const [plan] = await db.insert(devotionPlan).values({ id: crypto.randomUUID(), ...planData }).returning();
    if (days && days.length > 0) {
      const daysToInsert = days.map((d: any) => ({ ...d, id: crypto.randomUUID(), planId: plan.id }));
      await db.insert(devotionDay).values(daysToInsert);
    }
    createdPlans.push(plan);
  }

  return c.json({ success: true, created: createdPlans.length });
});

contentAdmin.get("/daily-bread", async (c) => {
  const db = getDrizzle(c.env.DB);
  const breads = await db.query.dailyBread.findMany({ orderBy: [desc(dailyBread.date)] });
  return c.json({ breads });
});

contentAdmin.post("/daily-bread", async (c) => {
  const db = getDrizzle(c.env.DB);
  const body = await c.req.json() as any;
  const [bread] = await db.insert(dailyBread).values({ id: crypto.randomUUID(), ...body }).returning();
  return c.json({ bread });
});

contentAdmin.delete("/daily-bread/:id", async (c) => {
  const db = getDrizzle(c.env.DB);
  await db.delete(dailyBread).where(eq(dailyBread.id, c.req.param("id") as string));
  return c.json({ success: true });
});

contentAdmin.get("/affirmations", async (c) => {
  const db = getDrizzle(c.env.DB);
  const affirmations = await db.query.affirmation.findMany({ orderBy: [desc(affirmation.createdAt)] });
  return c.json({ affirmations });
});

contentAdmin.post("/affirmations", async (c) => {
  const db = getDrizzle(c.env.DB);
  const body = await c.req.json() as any;
  const [newAffirmation] = await db.insert(affirmation).values({ id: crypto.randomUUID(), ...body }).returning();
  return c.json({ affirmation: newAffirmation });
});

contentAdmin.delete("/affirmations/:id", async (c) => {
  const db = getDrizzle(c.env.DB);
  await db.delete(affirmation).where(eq(affirmation.id, c.req.param("id") as string));
  return c.json({ success: true });
});

contentAdmin.get("/books", async (c) => {
  const db = getDrizzle(c.env.DB);
  const books2 = await db.query.book.findMany({ orderBy: [desc(book.createdAt)] });
  return c.json({ books: books2 });
});

contentAdmin.post("/books", async (c) => {
  const db = getDrizzle(c.env.DB);
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
    const body = await c.req.json() as any;
    title = body.title;
    author = body.author || "Unknown";
    description = body.description || "";
    topic = body.topic || "General";
    downloadUrl = body.downloadUrl || "";
    imageUrl = body.imageUrl || "";
  }

  const [newBook] = await db.insert(book).values({
      id: crypto.randomUUID(),
      title,
      author,
      description,
      topic,
      downloadUrl: downloadUrl || "",
      imageUrl: imageUrl || ""
  }).returning();
  return c.json({ book: newBook });
});

contentAdmin.put("/books/:id", async (c) => {
  const db = getDrizzle(c.env.DB);
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
    const body = await c.req.json() as any;
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

  const [updatedBook] = await db.update(book).set(updateData).where(eq(book.id, id as string)).returning();
  return c.json({ book: updatedBook });
});

contentAdmin.delete("/books/:id", async (c) => {
  const db = getDrizzle(c.env.DB);
  await db.delete(book).where(eq(book.id, c.req.param("id") as string));
  return c.json({ success: true });
});

contentAdmin.get("/media", async (c) => {
  const db = getDrizzle(c.env.DB);
  const media2 = await db.query.sermonMedia.findMany({ orderBy: [desc(sermonMedia.createdAt)] });
  const userMedias = await db.query.userMedia.findMany({ with: { user: true }, orderBy: [desc(userMedia.createdAt)] });
  const uMapped = userMedias.map(m => ({
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
  const all = [...media2, ...uMapped].sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime());
  return c.json({ media: all });
});

contentAdmin.post("/media", async (c) => {
  const db = getDrizzle(c.env.DB);
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
    const body = await c.req.json() as any;
    title = body.title;
    author = body.author || "Unknown";
    category = body.category || "Sermon";
    type = body.type || "VIDEO";
    mediaUrl = body.mediaUrl;
    imageUrl = body.imageUrl || "https://via.placeholder.com/600x400?text=No+Thumbnail";
    duration = body.duration || "00:00";
  }

  const [media2] = await db.insert(sermonMedia).values({
      id: crypto.randomUUID(),
      title,
      author,
      category,
      type,
      mediaUrl,
      imageUrl,
      duration
  }).returning();
  return c.json({ media: media2 });
});

contentAdmin.put("/media/:id", async (c) => {
  const db = getDrizzle(c.env.DB);
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
    const body = await c.req.json() as any;
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
    const [media2] = await db.update(sermonMedia).set(updateData).where(eq(sermonMedia.id, id as string)).returning();
    if (!media2) throw new Error('Not found');
    return c.json({ media: media2 });
  } catch (err) {
    // Attempt to update userMedia if sermonMedia fails
    try {
      const updatePayload: any = {};
      if (title !== undefined) updatePayload.title = title;
      if (mediaUrl !== undefined) updatePayload.mediaUrl = mediaUrl;
      if (imageUrl !== undefined) updatePayload.imageUrl = imageUrl;
      if (type !== undefined) updatePayload.type = type;
      const [mediaUser] = await db.update(userMedia).set(updatePayload).where(eq(userMedia.id, id as string)).returning();
      if (!mediaUser) throw new Error('Not found');
      return c.json({ media: mediaUser });
    } catch (e2) {
      return c.json({ error: "Media not found or failed to update" }, 404);
    }
  }
});

contentAdmin.delete("/media/:id", async (c) => {
  const db = getDrizzle(c.env.DB);
  const id = c.req.param("id");
  try {
    await db.delete(sermonMedia).where(eq(sermonMedia.id, id as string));
  } catch (e) {
    try {
      await db.delete(userMedia).where(eq(userMedia.id, id as string));
    } catch (e2) {
      // Ignore if not found
    }
  }
  return c.json({ success: true });
});

export default contentAdmin;
