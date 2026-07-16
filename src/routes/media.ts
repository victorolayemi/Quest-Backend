import { Hono } from "hono";
import { getPrisma } from "../utils/prisma";
import { authMiddleware } from "../middleware/auth";
import { adminAuthMiddleware } from "../middleware/adminAuth";
import admin from "firebase-admin";

// src/routes/media.ts
import { Bindings, Variables } from "../types";
var media = new Hono<{ Bindings: Bindings; Variables: Variables }>();
media.get("/download/*", async (c) => {
  const path = c.req.path;
  const key = path.substring(path.indexOf("/download/") + 10);
  if (!c.env.MEDIA_BUCKET) {
    return c.text("R2 Bucket not configured", 500);
  }
  const object = await c.env.MEDIA_BUCKET.get(key);
  if (!object) {
    return c.text("File not found", 404);
  }
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  return new Response(object.body, { headers });
});
media.use("/videos", authMiddleware);
media.use("/videos/*", authMiddleware);
media.use("/audio", authMiddleware);
media.use("/audio/*", authMiddleware);
media.use("/upload", authMiddleware);
async function seedMediaIfEmpty(prisma: any) {
  const count = await prisma.sermonMedia.count();
  if (count === 0) {
    await prisma.sermonMedia.createMany({
      data: [
        // --- VIDEOS (HLS streams via Cloudflare Stream / public test streams) ---
        {
          title: "Walking in Faith Every Day",
          author: "Pastor Emmanuel",

          // Public HLS test stream – works immediately for dev testing
          mediaUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
          imageUrl:
            "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600",
          type: "VIDEO",
          duration: "12:45",
          category: "faith",
        },
        {
          title: "The Power of Prayer",
          author: "Rev. Sarah Johnson",

          mediaUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
          imageUrl:
            "https://images.unsplash.com/photo-1518099074172-2e47ee6cfdc0?w=600",
          type: "VIDEO",
          duration: "9:20",
          category: "prayer",
        },
        {
          title: "Grace Abounding \u2014 Sunday Sermon",
          author: "Bishop Adeyemi",

          mediaUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
          imageUrl:
            "https://images.unsplash.com/photo-1504052434569-70ad5836ab65?w=600",
          type: "VIDEO",
          duration: "28:10",
          category: "grace",
        },
        {
          title: "Leadership Lessons from David",
          author: "Pastor Chukwudi Obi",

          mediaUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
          imageUrl:
            "https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=600",
          type: "VIDEO",
          duration: "18:35",
          category: "leadership",
        },
        {
          title: "Unshakeable Hope in Christ",
          author: "Evang. Miriam Adebola",

          mediaUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
          imageUrl:
            "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600",
          type: "VIDEO",
          duration: "21:00",
          category: "faith",
        },
        {
          title: "Renewing Your Mind Daily",
          author: "Dr. Blessing Nwosu",

          mediaUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
          imageUrl:
            "https://images.unsplash.com/photo-1525013066836-c6090f0ad9d8?w=600",
          type: "VIDEO",
          duration: "14:50",
          category: "prayer",
        },
        {
          title: "Fruit of the Spirit \u2014 Part 1",
          author: "Pastor Tunde Bakare",

          mediaUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
          imageUrl:
            "https://images.unsplash.com/photo-1465101162946-4377e57745c3?w=600",
          type: "VIDEO",
          duration: "16:20",
          category: "grace",
        },
        {
          title: "Serving God with All Your Heart",
          author: "Rev. Funke Adeyemi",

          mediaUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
          imageUrl:
            "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600",
          type: "VIDEO",
          duration: "11:05",
          category: "leadership",
        },
        {
          title: "Finding Peace in the Storm",
          author: "Bishop Oluwaseun Adeyemi",

          mediaUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
          imageUrl:
            "https://images.unsplash.com/photo-1504598318550-17eba1008a68?w=600",
          type: "VIDEO",
          duration: "23:40",
          category: "prayer",
        },
        {
          title: "The Armor of God \u2014 Full Study",
          author: "Apostle Paul Enenche",

          mediaUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
          imageUrl:
            "https://images.unsplash.com/photo-1506748686214-e9df14d4d9d0?w=600",
          type: "VIDEO",
          duration: "35:15",
          category: "faith",
        },
        {
          title: "Overflow \u2014 Youth Conference 2025",
          author: "Minister Damilola Oyelaran",

          mediaUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
          imageUrl:
            "https://images.unsplash.com/photo-1560439513-74b037a25d84?w=600",
          type: "VIDEO",
          duration: "42:00",
          category: "grace",
        },
        {
          title: "Worship & Word \u2014 Sunday Special",
          author: "RCCG Lagos Province",

          mediaUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
          imageUrl:
            "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600",
          type: "VIDEO",
          duration: "55:30",
          category: "leadership",
        },
        // --- AUDIO ---
        {
          title: "Daily Grace Podcast Ep. 1",
          author: "Grace Ministry",

          mediaUrl: "/assets/media/grace_podcast.mp3",
          imageUrl:
            "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=600",
          type: "AUDIO",
          duration: "32:15",
          category: "grace",
        },
        {
          title: "Morning Devotion \u2014 Psalms",
          author: "Pastor Emmanuel",

          mediaUrl: "/assets/media/grace_podcast.mp3",
          imageUrl:
            "https://images.unsplash.com/photo-1494232410401-ad00d5433cfa?w=600",
          type: "AUDIO",
          duration: "18:00",
          category: "prayer",
        },
      ],
    });
  }
}
media.get("/categories", async (c) => {
  return c.json([
    { id: "faith", name: "Faith" },
    { id: "grace", name: "Grace" },
    { id: "leadership", name: "Leadership" },
    { id: "prayer", name: "Prayer" },
  ]);
});
media.get("/videos", async (c) => {
  const prisma = getPrisma(c.env.DB);
  // await seedMediaIfEmpty(prisma);
  const cursor = c.req.query("cursor");
  const search = c.req.query("search");
  const limit = Math.min(parseInt(c.req.query("limit") || "10"), 50);
  const userId = c.get("userId");

  let cursorDate = null;
  if (cursor) {
    let s = await prisma.sermonMedia.findUnique({ where: { id: cursor } });
    if (s) cursorDate = s.createdAt;
    else {
      let u = await prisma.userMedia.findUnique({ where: { id: cursor } });
      if (u) cursorDate = u.createdAt;
    }
  }

  const sVideos = await prisma.sermonMedia.findMany({
    where: {
      type: "VIDEO",
      ...(cursorDate ? { createdAt: { lt: cursorDate } } : {}),
      ...(search ? { title: { contains: search } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    include: {
      _count: {
        select: { mediaLikes: true },
      },
    },
  });

  const uVideos = await prisma.userMedia.findMany({
    where: {
      type: "video",
      ...(cursorDate ? { createdAt: { lt: cursorDate } } : {}),
      ...(search ? { title: { contains: search } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    include: { user: true },
  });

  let likedMediaIds: string[] = [];
  if (userId) {
    const allIds = [...sVideos.map((v) => v.id), ...uVideos.map((v) => v.id)];
    const likes = await prisma.mediaLike.findMany({
      where: { userId, mediaId: { in: allIds } },
      select: { mediaId: true },
    });
    likedMediaIds = likes.map((l: any) => l.mediaId);
  }

  const sItems = sVideos.map((v) => ({
    ...v,
    hasLiked: likedMediaIds.includes(v.id),
    likes: v._count.mediaLikes,
    mediaLikes: undefined,
    _count: undefined,
  }));

  const uItems = uVideos.map((v) => ({
    id: v.id,
    title: v.title,
    author: `${v.user.firstName} ${v.user.lastName}`,
    mediaUrl: v.mediaUrl,
    imageUrl: v.imageUrl || "",
    type: "VIDEO",
    duration: "00:00",
    category: "Reel",
    createdAt: v.createdAt,
    hasLiked: likedMediaIds.includes(v.id),
    likes: 0,
  }));

  const allItems = [...sItems, ...uItems].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const hasMore = allItems.length > limit;
  const itemsRaw = hasMore ? allItems.slice(0, limit) : allItems;
  const nextCursor = hasMore ? itemsRaw[itemsRaw.length - 1].id : null;

  return c.json({
    items: itemsRaw,
    nextCursor,
    hasMore,
  });
});
media.get("/videos/continue", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const record = await prisma.playProgress.findFirst({
    where: {
      userId,
      completed: false,
      media: { type: "VIDEO" },
    },
    orderBy: { updatedAt: "desc" },
    include: {
      media: {
        include: { _count: { select: { mediaLikes: true } } },
      },
    },
  });
  if (!record) return c.json({ item: null });
  const like = await prisma.mediaLike.findUnique({
    where: { userId_mediaId: { userId, mediaId: record.mediaId } },
  });
  const item = {
    ...record.media,
    hasLiked: !!like,
    likes: record.media._count.mediaLikes,
    _count: void 0,
    progressSeconds: record.progressSeconds,
  };
  return c.json({ item });
});
media.get("/videos/categories", async (c) => {
  return c.json([
    { id: "sermons", name: "Sermons" },
    { id: "interviews", name: "Interviews" },
  ]);
});
media.get("/videos/:id", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const item = await prisma.sermonMedia.findUnique({
    where: { id, type: "VIDEO" },
    include: {
      _count: {
        select: { mediaLikes: true },
      },
    },
  });
  if (!item) return c.json({ error: "Video not found" }, 404);
  let hasLiked = false;
  if (userId) {
    const like = await prisma.mediaLike.findUnique({
      where: { userId_mediaId: { userId, mediaId: id } },
    });
    hasLiked = !!like;
  }
  return c.json({
    ...item,
    hasLiked,
    likes: item._count.mediaLikes,
    _count: void 0,
  });
});
media.post("/videos/:id/like", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const sermonMedia = await prisma.sermonMedia.findUnique({ where: { id } });
  if (!sermonMedia) {
    return c.json({
      message: "Media not found in SermonMedia (likely a Reel)",
      likes: 0,
      hasLiked: false,
    });
  }

  const existingLike = await prisma.mediaLike.findFirst({
    where: {
      userId,
      mediaId: id,
    },
  });
  let updated;
  if (existingLike) {
    await prisma.mediaLike.delete({
      where: { id: existingLike.id },
    });
    updated = await prisma.sermonMedia.findUnique({
      where: { id },
      include: { _count: { select: { mediaLikes: true } } },
    });
  } else {
    await prisma.mediaLike.create({
      data: {
        userId,
        mediaId: id,
      },
    });
    updated = await prisma.sermonMedia.findUnique({
      where: { id },
      include: { _count: { select: { mediaLikes: true } } },
    });
  }
  return c.json({
    message: "Toggled like",
    likes: updated?._count?.mediaLikes || 0,
    hasLiked: !existingLike,
  });
});
media.post("/videos/:id/playback", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const mediaId = c.req.param("id");
  const body = await c.req.json();
  const { progressSeconds, completed } = body;
  const prisma = getPrisma(c.env.DB);

  const sermonMedia = await prisma.sermonMedia.findUnique({
    where: { id: mediaId },
  });
  if (!sermonMedia) {
    return c.json({
      success: true,
      message: "Playback tracked (UserMedia ignored)",
    });
  }

  const existing = await prisma.playProgress.findFirst({
    where: { userId, mediaId },
  });
  let record;
  if (existing) {
    record = await prisma.playProgress.update({
      where: { id: existing.id },
      data: {
        progressSeconds: progressSeconds ?? 0,
        completed: completed ?? false,
      },
    });
  } else {
    record = await prisma.playProgress.create({
      data: {
        userId,
        mediaId: mediaId as string,
        progressSeconds: progressSeconds ?? 0,
        completed: completed ?? false,
      },
    });
  }
  if (completed && (!existing || !existing.completed)) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        points: { increment: 20 },
        videoReelPoints: { increment: 20 },
      },
    });
  }
  return c.json(record);
});
media.get("/audio", async (c) => {
  const prisma = getPrisma(c.env.DB);
  // await seedMediaIfEmpty(prisma);
  const cursor = c.req.query("cursor");
  const search = c.req.query("search");
  const limit = Math.min(parseInt(c.req.query("limit") || "10"), 50);
  const userId = c.get("userId");

  let cursorDate = null;
  if (cursor) {
    let s = await prisma.sermonMedia.findUnique({ where: { id: cursor } });
    if (s) cursorDate = s.createdAt;
    else {
      let u = await prisma.userMedia.findUnique({ where: { id: cursor } });
      if (u) cursorDate = u.createdAt;
    }
  }

  const sAudios = await prisma.sermonMedia.findMany({
    where: {
      type: "AUDIO",
      ...(cursorDate ? { createdAt: { lt: cursorDate } } : {}),
      ...(search ? { title: { contains: search } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    include: {
      _count: {
        select: { mediaLikes: true },
      },
    },
  });

  const uAudios = await prisma.userMedia.findMany({
    where: {
      type: "audio",
      ...(cursorDate ? { createdAt: { lt: cursorDate } } : {}),
      ...(search ? { title: { contains: search } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    include: { user: true },
  });

  let likedMediaIds: string[] = [];
  if (userId) {
    const allIds = [...sAudios.map((v) => v.id), ...uAudios.map((v) => v.id)];
    const likes = await prisma.mediaLike.findMany({
      where: { userId, mediaId: { in: allIds } },
      select: { mediaId: true },
    });
    likedMediaIds = likes.map((l: any) => l.mediaId);
  }

  const sItems = sAudios.map((a) => ({
    ...a,
    hasLiked: likedMediaIds.includes(a.id),
    likes: a._count.mediaLikes,
    mediaLikes: undefined,
    _count: undefined,
  }));

  const uItems = uAudios.map((a) => ({
    id: a.id,
    title: a.title,
    author: `${a.user.firstName} ${a.user.lastName}`,
    mediaUrl: a.mediaUrl,
    imageUrl: "",
    type: "AUDIO",
    duration: "00:00",
    category: "Reel",
    createdAt: a.createdAt,
    hasLiked: likedMediaIds.includes(a.id),
    likes: 0,
  }));

  const allItems = [...sItems, ...uItems].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const hasMore = allItems.length > limit;
  const itemsRaw = hasMore ? allItems.slice(0, limit) : allItems;
  const nextCursor = hasMore ? itemsRaw[itemsRaw.length - 1].id : null;

  return c.json({
    items: itemsRaw,
    nextCursor,
    hasMore,
  });
});
media.get("/audio/continue", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const record = await prisma.playProgress.findFirst({
    where: {
      userId,
      completed: false,
      media: { type: "AUDIO" },
    },
    orderBy: { updatedAt: "desc" },
    include: {
      media: {
        include: { _count: { select: { mediaLikes: true } } },
      },
    },
  });
  if (!record) return c.json({ item: null });
  const like = await prisma.mediaLike.findUnique({
    where: { userId_mediaId: { userId, mediaId: record.mediaId } },
  });
  const item = {
    ...record.media,
    hasLiked: !!like,
    likes: record.media._count.mediaLikes,
    _count: void 0,
    progressSeconds: record.progressSeconds,
  };
  return c.json({ item });
});
media.get("/audio/categories", async (c) => {
  return c.json([
    { id: "podcasts", name: "Podcasts" },
    { id: "worship", name: "Worship Music" },
    { id: "audiobooks", name: "Audiobooks" },
  ]);
});
media.get("/audio/:id", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const item = await prisma.sermonMedia.findUnique({
    where: { id, type: "AUDIO" },
    include: {
      _count: {
        select: { mediaLikes: true },
      },
    },
  });
  if (!item) return c.json({ error: "Audio not found" }, 404);
  let hasLiked = false;
  if (userId) {
    const like = await prisma.mediaLike.findUnique({
      where: { userId_mediaId: { userId, mediaId: id } },
    });
    hasLiked = !!like;
  }
  return c.json({
    ...item,
    hasLiked,
    likes: item._count.mediaLikes,
    _count: void 0,
  });
});
media.post("/audio/:id/like", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const sermonMedia = await prisma.sermonMedia.findUnique({ where: { id } });
  if (!sermonMedia) {
    return c.json({
      message: "Media not found in SermonMedia (likely a Reel)",
      likes: 0,
      hasLiked: false,
    });
  }

  const existingLike = await prisma.mediaLike.findUnique({
    where: {
      userId_mediaId: {
        userId,
        mediaId: id,
      },
    },
  });
  let updated;
  if (existingLike) {
    await prisma.mediaLike.delete({ where: { id: existingLike.id } });
    updated = await prisma.sermonMedia.findUnique({
      where: { id },
      include: { _count: { select: { mediaLikes: true } } },
    });
  } else {
    await prisma.mediaLike.create({ data: { userId, mediaId: id } });
    updated = await prisma.sermonMedia.findUnique({
      where: { id },
      include: { _count: { select: { mediaLikes: true } } },
    });
  }
  return c.json({
    message: "Toggled like",
    likes: updated?._count?.mediaLikes || 0,
    hasLiked: !existingLike,
  });
});
media.post("/audio/:id/playback", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const mediaId = c.req.param("id");
  const body = await c.req.json();
  const { progressSeconds, completed } = body;
  const prisma = getPrisma(c.env.DB);

  const sermonMedia = await prisma.sermonMedia.findUnique({
    where: { id: mediaId },
  });
  if (!sermonMedia) {
    return c.json({
      success: true,
      message: "Playback tracked (UserMedia ignored)",
    });
  }

  const existing = await prisma.playProgress.findFirst({
    where: { userId, mediaId },
  });
  let record;
  if (existing) {
    record = await prisma.playProgress.update({
      where: { id: existing.id },
      data: { progressSeconds, completed },
    });
  } else {
    record = await prisma.playProgress.create({
      data: { userId, mediaId: mediaId as string, progressSeconds, completed },
    });
  }
  if (completed && (!existing || !existing.completed)) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        points: { increment: 20 },
        audioReelPoints: { increment: 20 },
      },
    });
  }
  return c.json(record);
});
media.get("/upload/limit-check", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const activeSubscription = await prisma.subscription.findFirst({
    where: { userId, status: "active", expiresAt: { gt: new Date() } },
  });
  if (activeSubscription) {
    return c.json({ limitReached: false, isPro: true, used: 0, limit: -1 });
  }
  const feature = await prisma.appFeature.findUnique({
    where: { key: "free_media_posts_limit" },
  });
  let limit = 3;
  if (feature?.value) {
    const parsed = parseInt(feature.value, 10);
    if (!isNaN(parsed)) limit = parsed;
  }
  const used = await prisma.userMedia.count({ where: { userId } });
  return c.json({ limitReached: used >= limit, isPro: false, used, limit });
});

media.post("/upload", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const formData = await c.req.formData();
  const file = formData.get("file");
  const title = formData.get("title") || "Untitled";

  let fileType = (file as File).type || "";
  let derivedType = "audio";
  if (fileType.startsWith("video/")) {
    derivedType = "video";
  } else {
    const name = ((file as File).name || "").toLowerCase();
    if (
      name.endsWith(".mp4") ||
      name.endsWith(".mov") ||
      name.endsWith(".mkv") ||
      name.endsWith(".webm") ||
      name.endsWith(".avi")
    ) {
      derivedType = "video";
    }
  }
  const type = formData.get("type") || derivedType;
  const isEdit = formData.get("isEdit") === "true";
  const isReel = formData.get("isReel") === "true";
  if (!file) {
    return c.json({ error: 'No file provided in form-data key "file"' }, 400);
  }
  if (isReel && !isEdit) {
    const activeSubscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: "active",
        expiresAt: { gt: /* @__PURE__ */ new Date() },
      },
    });
    if (!activeSubscription) {
      const feature = await prisma.appFeature.findUnique({
        where: { key: "free_media_posts_limit" },
      });
      let limit = 3;
      if (feature && feature.value) {
        const parsedLimit = parseInt(feature.value, 10);
        if (!isNaN(parsedLimit)) {
          limit = parsedLimit;
        }
      }
      const uploadCount = await prisma.userMedia.count({
        where: { userId },
      });
      if (uploadCount >= limit) {
        return c.json(
          {
            error: `Upload limit reached. Please subscribe to upload more media.`,
          },
          403,
        );
      }
    }
  }
  const fileKey = `uploads/${Date.now()}-${(file as File).name}`;
  const fileBuffer = await (file as File).arrayBuffer();
  if (c.env.MEDIA_BUCKET) {
    await c.env.MEDIA_BUCKET.put(fileKey, fileBuffer, {
      httpMetadata: { contentType: (file as File).type },
    });
  }
  const origin = new URL(c.req.url).origin;
  const fileUrl = `${origin}/api/v1/media/download/${fileKey}`;

  const thumbnail = formData.get("thumbnail");
  let imageUrl = null;
  if (thumbnail && c.env.MEDIA_BUCKET) {
    const thumbKey = `uploads/${Date.now()}-thumb-${(thumbnail as File).name}`;
    const thumbBuffer = await (thumbnail as File).arrayBuffer();
    await c.env.MEDIA_BUCKET.put(thumbKey, thumbBuffer, {
      httpMetadata: { contentType: (thumbnail as File).type },
    });
    imageUrl = `${origin}/api/v1/media/download/${thumbKey}`;
  }

  if (isReel && !isEdit) {
    await prisma.userMedia.create({
      data: {
        userId,
        title: title as string,
        mediaUrl: fileUrl,
        imageUrl,
        type: type as string,
      },
    });
  }
  return c.json({
    message: "File uploaded successfully to R2",
    fileUrl,
    imageUrl,
    url: fileUrl,
  });
});
media.delete("/file", async (c) => {
  const body = await c.req.json();
  const { fileUrl } = body;
  if (!fileUrl) {
    return c.json({ error: "fileUrl is required" }, 400);
  }
  const downloadPath = "/api/v1/media/download/";
  const idx = fileUrl.indexOf(downloadPath);
  if (idx === -1) {
    return c.json({ error: "Invalid fileUrl format" }, 400);
  }
  const key = fileUrl.substring(idx + downloadPath.length);
  if (c.env.MEDIA_BUCKET) {
    try {
      await c.env.MEDIA_BUCKET.delete(key);
    } catch (e) {
      console.error("Error deleting file from R2:", e);
      return c.json({ error: "Failed to delete file from R2" }, 500);
    }
  } else {
    return c.json({ error: "R2 Bucket not configured" }, 500);
  }
  return c.json({ message: "File deleted permanently" });
});

export default media;
