import { Hono } from 'hono';
import { getPrisma } from '../utils/prisma';
import { authMiddleware } from '../middleware/auth';
import { adminAuthMiddleware } from '../middleware/adminAuth';
import admin from 'firebase-admin';

// src/routes/feed.ts
import { Bindings, Variables } from '../types';
var feed = new Hono<{Bindings: Bindings, Variables: Variables}>();
feed.use("*", authMiddleware);
feed.get("/", async (c) => {
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const communities2 = await prisma.community.findMany({
    take: 10,
    include: {
      _count: { select: { members: true, posts: true } }
    },
    orderBy: { createdAt: "desc" }
  });
  const devotions2 = await prisma.devotionPlan.findMany({
    take: 2,
    include: { days: true }
  });
  const videoItems = await prisma.sermonMedia.findMany({
    where: { type: "VIDEO" },
    include: { _count: { select: { mediaLikes: true } } },
    take: 4
  });
  const audioItems = await prisma.sermonMedia.findMany({
    where: { type: "AUDIO" },
    include: { _count: { select: { mediaLikes: true } } },
    take: 4
  });
  const mediaItems = [...videoItems, ...audioItems].map((item) => ({
    ...item,
    likes: item._count.mediaLikes
  }));
  const latestJournal = await prisma.journalEntry.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" }
  });
  const feelingRecord = await prisma.userFeeling.findUnique({
    where: { userId }
  });
  const feeling = feelingRecord ? feelingRecord.feeling : null;
  let affirmations: any[] = [];
  if (feeling) {
    affirmations = await prisma.affirmation.findMany({
      where: { feeling }
    });
  }
  if (affirmations.length === 0) {
    affirmations = await prisma.affirmation.findMany({
      where: { feeling: null }
    });
  }
  let affirmationText = "God loves me, and I know it";
  if (affirmations.length > 0) {
    const idx = Math.floor(Math.random() * affirmations.length);
    affirmationText = affirmations[idx].text;
  }
  return c.json({
    communities: communities2,
    recommendedDevotions: devotions2,
    recommendedMedia: mediaItems,
    latestJournal,
    affirmation: affirmationText
  });
});
feed.get("/explore", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const activePlans = await prisma.devotionPlan.findMany({
    take: 4
  });
  const popularCommunities = await prisma.community.findMany({
    take: 5,
    include: { _count: { select: { members: true } } }
  });
  const trendingVideos = await prisma.sermonMedia.findMany({
    where: { type: "VIDEO" },
    orderBy: { mediaLikes: { _count: "desc" } },
    include: { _count: { select: { mediaLikes: true } } },
    take: 4
  });
  const trendingAudios = await prisma.sermonMedia.findMany({
    where: { type: "AUDIO" },
    orderBy: { mediaLikes: { _count: "desc" } },
    include: { _count: { select: { mediaLikes: true } } },
    take: 4
  });
  const recentPosts = await prisma.post.findMany({
    take: 4,
    include: {
      user: {
        select: {
          firstName: true,
          username: true,
          avatarUrl: true
        }
      },
      reactions: true,
      community: true
    },
    orderBy: { createdAt: "desc" }
  });
  const upcomingEvents = await prisma.communityEvent.findMany({
    take: 4,
    orderBy: { date: "asc" },
    where: {
      date: {
        gte: (/* @__PURE__ */ new Date()).toISOString()
      }
    },
    include: {
      community: {
        select: {
          name: true,
          image: true
        }
      },
      attendees: {
        select: {
          userId: true
        }
      }
    }
  });
  return c.json({
    devotionPlans: activePlans,
    communities: popularCommunities,
    videos: trendingVideos.map((v: any) => ({ ...v, likes: v._count.mediaLikes })),
    audios: trendingAudios.map((a: any) => ({ ...a, likes: a._count.mediaLikes })),
    posts: recentPosts,
    events: upcomingEvents
  });
});


export default feed;
