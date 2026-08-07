
import { Hono } from 'hono';
import { getDrizzle } from '../utils/drizzle';
import { eq, or, and, sql, desc, gte } from 'drizzle-orm';
import { community, devotionPlan, sermonMedia, userMedia, journalEntry, userFeeling, affirmation, post, communityEvent } from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { adminAuthMiddleware } from '../middleware/adminAuth';
import { Bindings, Variables } from '../types';

var feed = new Hono<{Bindings: Bindings, Variables: Variables}>();
feed.use("*", authMiddleware);

feed.get("/", async (c) => {
  const userId = c.get("userId") as string;
  const db = getDrizzle(c.env.DB);
  
  const communities2 = await db.query.community.findMany({
    limit: 10,
    with: {
      communityMembers: { columns: { id: true } },
      posts: { columns: { id: true } }
    },
    orderBy: [desc(community.createdAt)]
  });
  
  const devotions2 = await db.query.devotionPlan.findMany({
    limit: 2,
    with: { devotionDays: true }
  });
  
  const videoItems = await db.query.sermonMedia.findMany({
    where: eq(sermonMedia.type, "VIDEO"),
    with: { mediaLikes: { columns: { id: true } } },
    orderBy: [desc(sermonMedia.createdAt)],
    limit: 4
  });
  
  const uVideoItems = await db.query.userMedia.findMany({
    where: eq(userMedia.type, "video"),
    with: { user: { columns: { firstName: true, lastName: true } } },
    orderBy: [desc(userMedia.createdAt)],
    limit: 4
  });
  
  const audioItems = await db.query.sermonMedia.findMany({
    where: eq(sermonMedia.type, "AUDIO"),
    with: { mediaLikes: { columns: { id: true } } },
    orderBy: [desc(sermonMedia.createdAt)],
    limit: 4
  });
  
  const uAudioItems = await db.query.userMedia.findMany({
    where: eq(userMedia.type, "audio"),
    with: { user: { columns: { firstName: true, lastName: true } } },
    orderBy: [desc(userMedia.createdAt)],
    limit: 4
  });
  
  let mediaItems = [
    ...videoItems.map((item: any) => ({ ...item, likes: item.mediaLikes.length, createdAt: item.createdAt })),
    ...uVideoItems.map((item: any) => ({
      id: item.id,
      title: item.title,
      author: `${item.user.firstName} ${item.user.lastName}`,
      mediaUrl: item.mediaUrl,
      imageUrl: item.imageUrl ?? "",
      type: "VIDEO",
      duration: "00:00",
      category: "Reel",
      likes: 0,
      createdAt: item.createdAt
    })),
    ...audioItems.map((item: any) => ({ ...item, likes: item.mediaLikes.length, createdAt: item.createdAt })),
    ...uAudioItems.map((item: any) => ({
      id: item.id,
      title: item.title,
      author: `${item.user.firstName} ${item.user.lastName}`,
      mediaUrl: item.mediaUrl,
      imageUrl: item.imageUrl ?? "",
      type: "AUDIO",
      duration: "00:00",
      category: "Reel",
      likes: 0,
      createdAt: item.createdAt
    }))
  ];
  
  mediaItems.sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime());
  
  const latestJournal = await db.query.journalEntry.findFirst({
    where: eq(journalEntry.userId, userId),
    orderBy: [desc(journalEntry.createdAt)]
  });
  
  const feelingRecord = await db.query.userFeeling.findFirst({
    where: eq(userFeeling.userId, userId)
  });
  const feeling = feelingRecord ? feelingRecord.feeling : null;
  
  let affirmations: any[] = [];
  if (feeling) {
    affirmations = await db.query.affirmation.findMany({
      where: eq(affirmation.feeling, feeling)
    });
  }
  
  if (affirmations.length === 0) {
    affirmations = await db.query.affirmation.findMany({
      where: sql`${affirmation.feeling} IS NULL`
    });
  }
  
  let affirmationText = "God loves me, and I know it";
  if (affirmations.length > 0) {
    const idx = Math.floor(Math.random() * affirmations.length);
    affirmationText = affirmations[idx].text;
  }
  
  const communitiesWithCount = communities2.map((c: any) => ({
    ...c,
    _count: {
      members: c.communityMembers.length,
      posts: c.posts.length
    }
  }));
  
  return c.json({
    communities: communitiesWithCount,
    recommendedDevotions: devotions2,
    recommendedMedia: mediaItems,
    latestJournal,
    affirmation: affirmationText
  });
});

feed.get("/explore", async (c) => {
  const db = getDrizzle(c.env.DB);
  
  const activePlans = await db.query.devotionPlan.findMany({
    limit: 4
  });
  
  const popularCommunities = await db.query.community.findMany({
    limit: 5,
    with: { communityMembers: { columns: { id: true } } }
  });
  
  // Drizzle doesn't support ordering by relation length directly in query builder without complex sql.
  // Given limit is small, we can fetch more and sort, or we can use subqueries.
  // Easiest is just to fetch recent ones and sort by likes locally since it's just explore feed.
  const trendingVideos = await db.query.sermonMedia.findMany({
    where: eq(sermonMedia.type, "VIDEO"),
    with: { mediaLikes: { columns: { id: true } } },
    orderBy: [desc(sermonMedia.createdAt)],
    limit: 20
  });
  trendingVideos.sort((a: any, b: any) => b.mediaLikes.length - a.mediaLikes.length);
  const topVideos = trendingVideos.slice(0, 4);
  
  const trendingAudios = await db.query.sermonMedia.findMany({
    where: eq(sermonMedia.type, "AUDIO"),
    with: { mediaLikes: { columns: { id: true } } },
    orderBy: [desc(sermonMedia.createdAt)],
    limit: 20
  });
  trendingAudios.sort((a: any, b: any) => b.mediaLikes.length - a.mediaLikes.length);
  const topAudios = trendingAudios.slice(0, 4);
  
  const recentPosts = await db.query.post.findMany({
    limit: 4,
    with: {
      user: {
        columns: {
          firstName: true,
          username: true,
          avatarUrl: true
        }
      },
      postReactions: true,
      community: true
    },
    orderBy: [desc(post.createdAt)]
  });
  
  const todayStr = new Date().toISOString();
  const upcomingEvents = await db.query.communityEvent.findMany({
    limit: 4,
    where: gte(communityEvent.date, todayStr),
    orderBy: [communityEvent.date],
    with: {
      community: {
        columns: {
          name: true,
          image: true
        }
      },
      eventAttendees: {
        columns: {
          userId: true
        }
      }
    }
  });
  
  const communitiesWithCount = popularCommunities.map((c: any) => ({
    ...c,
    _count: {
      members: c.communityMembers.length
    }
  }));
  
  // Aligning frontend keys: posts has reactions mapped to reactions
  const mappedPosts = recentPosts.map((p: any) => ({
    ...p,
    reactions: p.postReactions
  }));

  const mappedEvents = upcomingEvents.map((e: any) => ({
    ...e,
    attendees: e.eventAttendees
  }));

  return c.json({
    devotionPlans: activePlans,
    communities: communitiesWithCount,
    videos: topVideos.map((v: any) => ({ ...v, likes: v.mediaLikes.length })),
    audios: topAudios.map((a: any) => ({ ...a, likes: a.mediaLikes.length })),
    posts: mappedPosts,
    events: mappedEvents
  });
});

export default feed;
