
import { FCMService } from '../services/fcm';
import { dispatchNotification } from '../services/notificationService';
import { Hono } from 'hono';
import { getDrizzle } from '../utils/drizzle';
import { eq, or, and } from 'drizzle-orm';
import { 
  quiz, 
  challenge, 
  challengeParticipant, 
  user 
} from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { adminAuthMiddleware } from '../middleware/adminAuth';

import { Bindings, Variables } from '../types';
var challenges = new Hono<{Bindings: Bindings, Variables: Variables}>();
challenges.use("*", authMiddleware);

function generateInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

challenges.post("/invite/link", async (c) => {
  const userId = c.get("userId") as string;
  const body = await c.req.json() as any;
  const { quizId, type } = body;
  const db = getDrizzle(c.env.DB);
  
  let quizObj = await db.query.quiz.findFirst();
  if (!quizObj) {
    const newQuizId = crypto.randomUUID();
    const [newQuiz] = await db.insert(quiz).values({
      id: newQuizId,
      title: "Exodus Trivia",
      category: "exodus",
      difficulty: "medium"
    }).returning();
    quizObj = newQuiz;
  }
  
  const code = generateInviteCode();
  
  const [newChallenge] = await db.insert(challenge).values({
    id: crypto.randomUUID(),
    creatorId: userId,
    quizId: quizId || quizObj.id,
    type: type || "ASYNC",
    inviteCode: code,
    status: "PENDING"
  }).returning();
  
  return c.json({
    message: "Challenge invite code generated",
    inviteCode: code,
    challenge: newChallenge
  });
});

challenges.post("/invite/send", async (c) => {
  const userId = c.get("userId") as string;
  const body = await c.req.json() as any;
  const { friendId, quizId, type } = body;
  const db = getDrizzle(c.env.DB);
  
  const code = generateInviteCode();
  
  const [newChallenge] = await db.insert(challenge).values({
    id: crypto.randomUUID(),
    creatorId: userId,
    opponentId: friendId,
    quizId,
    type: type || "ASYNC",
    inviteCode: code,
    status: "PENDING"
  }).returning();
  
  await db.insert(challengeParticipant).values([
    {
      id: crypto.randomUUID(),
      challengeId: newChallenge.id,
      userId
    },
    {
      id: crypto.randomUUID(),
      challengeId: newChallenge.id,
      userId: friendId
    }
  ]);
  
  const fcm = new FCMService(c.env.FIREBASE_CLIENT_EMAIL, c.env.FIREBASE_PRIVATE_KEY);
  const sender = await db.query.user.findFirst({ 
    where: eq(user.id, userId),
    columns: { firstName: true, username: true } 
  });
  const senderName = sender?.firstName || sender?.username || "Someone";
  
  await dispatchNotification({
    db,
    userId: friendId,
    title: "New Challenge",
    message: `${senderName} challenged you to a quiz.`,
    type: "CHALLENGE_INVITE",
    pushSettingKey: "pushChallengeUpdates",
    fcm,
    data: { type: "CHALLENGE_INVITE", challengeId: newChallenge.id }
  });
  
  return c.json({
    message: "Challenge sent to friend",
    challenge: newChallenge
  });
});

challenges.get("/invite/:code", async (c) => {
  const code = c.req.param("code");
  const db = getDrizzle(c.env.DB);
  
  const challengeObj = await db.query.challenge.findFirst({
    where: eq(challenge.inviteCode, code),
    with: {
      user_creatorId: { columns: { id: true, username: true, avatarUrl: true } },
      user_opponentId: { columns: { id: true, username: true, avatarUrl: true } }
    }
  });
  
  if (!challengeObj) {
    return c.json({ error: "Challenge code not found" }, 404);
  }
  return c.json(challengeObj);
});

challenges.post("/invite/:code/accept", async (c) => {
  const userId = c.get("userId") as string;
  const code = c.req.param("code");
  const db = getDrizzle(c.env.DB);
  
  const challengeObj = await db.query.challenge.findFirst({
    where: eq(challenge.inviteCode, code)
  });
  
  if (!challengeObj) {
    return c.json({ error: "Challenge not found" }, 404);
  }
  if (challengeObj.creatorId === userId) {
    return c.json({ error: "Cannot accept your own challenge" }, 400);
  }
  
  const [updated] = await db.update(challenge).set({
    opponentId: userId,
    status: "ACTIVE"
  }).where(eq(challenge.id, challengeObj.id)).returning();
  
  const creatorPart = await db.query.challengeParticipant.findFirst({
    where: and(eq(challengeParticipant.challengeId, challengeObj.id), eq(challengeParticipant.userId, challengeObj.creatorId))
  });
  if (!creatorPart) {
    await db.insert(challengeParticipant).values({
      id: crypto.randomUUID(),
      challengeId: challengeObj.id,
      userId: challengeObj.creatorId
    });
  }
  
  const oppPart = await db.query.challengeParticipant.findFirst({
    where: and(eq(challengeParticipant.challengeId, challengeObj.id), eq(challengeParticipant.userId, userId))
  });
  if (!oppPart) {
    await db.insert(challengeParticipant).values({
      id: crypto.randomUUID(),
      challengeId: challengeObj.id,
      userId
    });
  }
  
  return c.json({
    message: "Challenge accepted successfully",
    challenge: updated
  });
});

challenges.post("/battle/create", async (c) => {
  const userId = c.get("userId") as string;
  const body = await c.req.json() as any;
  const { quizId } = body;
  const db = getDrizzle(c.env.DB);
  
  const code = generateInviteCode();
  const [battle] = await db.insert(challenge).values({
    id: crypto.randomUUID(),
    creatorId: userId,
    quizId,
    type: "BATTLE",
    inviteCode: code,
    status: "PENDING"
  }).returning();
  
  return c.json({
    message: "Battle room created. Invite opponent with code.",
    code,
    battle
  });
});

challenges.post("/battle/:id/join", async (c) => {
  const userId = c.get("userId") as string;
  const id = c.req.param("id");
  const db = getDrizzle(c.env.DB);
  
  const battle = await db.query.challenge.findFirst({ where: eq(challenge.id, id) });
  if (!battle) return c.json({ error: "Battle not found" }, 404);
  
  const [updated] = await db.update(challenge).set({
    opponentId: userId,
    status: "ACTIVE"
  }).where(eq(challenge.id, id)).returning();
  
  return c.json({
    message: "Joined battle room successfully",
    battle: updated
  });
});

challenges.get("/battle/:id", async (c) => {
  const id = c.req.param("id");
  const db = getDrizzle(c.env.DB);
  
  const battle = await db.query.challenge.findFirst({
    where: eq(challenge.id, id),
    with: {
      challengeParticipants: {
        with: { user: { columns: { username: true, avatarUrl: true } } }
      }
    }
  });
  
  if (!battle) return c.json({ error: "Battle not found" }, 404);
  return c.json(battle);
});

challenges.post("/battle/:id/answer", async (c) => {
  const userId = c.get("userId") as string;
  const id = c.req.param("id");
  const body = await c.req.json() as any;
  const { score, completed } = body;
  const db = getDrizzle(c.env.DB);
  
  const participant = await db.query.challengeParticipant.findFirst({
    where: and(eq(challengeParticipant.challengeId, id), eq(challengeParticipant.userId, userId))
  });
  
  if (!participant) {
    return c.json({ error: "Participant not found in battle" }, 404);
  }
  
  const updateData: any = {};
  if (score !== undefined) updateData.score = score;
  if (completed !== undefined) updateData.completed = completed;
  
  let updated = participant;
  if (Object.keys(updateData).length > 0) {
    const [updatedPart] = await db.update(challengeParticipant).set(updateData).where(eq(challengeParticipant.id, participant.id)).returning();
    updated = updatedPart;
  }
  
  const allParts = await db.query.challengeParticipant.findMany({
    where: eq(challengeParticipant.challengeId, id)
  });
  const allCompleted = allParts.every((p: any) => p.completed);
  if (allCompleted) {
    await db.update(challenge).set({ status: "COMPLETED" }).where(eq(challenge.id, id));
  }
  
  return c.json(updated);
});

challenges.get("/battle/:id/result", async (c) => {
  const id = c.req.param("id");
  const db = getDrizzle(c.env.DB);
  
  const battle = await db.query.challenge.findFirst({
    where: eq(challenge.id, id),
    with: {
      challengeParticipants: {
        with: { user: { columns: { username: true, avatarUrl: true } } },
        orderBy: (p: any, { desc }: any) => [desc(p.score)]
      }
    }
  });
  
  if (!battle) return c.json({ error: "Battle not found" }, 404);
  
  return c.json({
    battleStatus: battle.status,
    results: battle.challengeParticipants
  });
});

challenges.post("/async/send", async (c) => {
  const userId = c.get("userId") as string;
  const body = await c.req.json() as any;
  const { opponentId, quizId } = body;
  const db = getDrizzle(c.env.DB);
  
  const code = generateInviteCode();
  const [newChallenge] = await db.insert(challenge).values({
    id: crypto.randomUUID(),
    creatorId: userId,
    opponentId,
    quizId,
    type: "ASYNC",
    inviteCode: code,
    status: "PENDING"
  }).returning();
  
  await db.insert(challengeParticipant).values([
    { id: crypto.randomUUID(), challengeId: newChallenge.id, userId },
    { id: crypto.randomUUID(), challengeId: newChallenge.id, userId: opponentId }
  ]);
  
  const fcm = new FCMService(c.env.FIREBASE_CLIENT_EMAIL, c.env.FIREBASE_PRIVATE_KEY);
  const sender = await db.query.user.findFirst({ where: eq(user.id, userId), columns: { firstName: true, username: true } });
  const senderName = sender?.firstName || sender?.username || "Someone";
  
  await dispatchNotification({
    db,
    userId: opponentId,
    title: "New Async Challenge",
    message: `${senderName} challenged you to an async quiz.`,
    type: "CHALLENGE_INVITE",
    pushSettingKey: "pushChallengeUpdates",
    fcm,
    data: { type: "CHALLENGE_INVITE", challengeId: newChallenge.id }
  });
  
  return c.json(newChallenge);
});

challenges.post("/async/:id/respond", async (c) => {
  const userId = c.get("userId") as string;
  const id = c.req.param("id");
  const body = await c.req.json() as any;
  const { score } = body;
  const db = getDrizzle(c.env.DB);
  
  const participant = await db.query.challengeParticipant.findFirst({
    where: and(eq(challengeParticipant.challengeId, id), eq(challengeParticipant.userId, userId))
  });
  
  if (!participant) return c.json({ error: "Participant not in challenge" }, 404);
  
  await db.update(challengeParticipant).set({
    score,
    completed: true
  }).where(eq(challengeParticipant.id, participant.id));
  
  const allParts = await db.query.challengeParticipant.findMany({ where: eq(challengeParticipant.challengeId, id) });
  
  if (allParts.every((p: any) => p.completed)) {
    await db.update(challenge).set({ status: "COMPLETED" }).where(eq(challenge.id, id));
  }
  
  const opponentParticipant = allParts.find((p: any) => p.userId !== userId);
  if (opponentParticipant) {
    const fcm = new FCMService(c.env.FIREBASE_CLIENT_EMAIL, c.env.FIREBASE_PRIVATE_KEY);
    const sender = await db.query.user.findFirst({ where: eq(user.id, userId), columns: { firstName: true, username: true } });
    const senderName = sender?.firstName || sender?.username || "Someone";
    await dispatchNotification({
      db,
      userId: opponentParticipant.userId,
      title: "Challenge Updated",
      message: `${senderName} has completed their turn.`,
      type: "CHALLENGE_TURN",
      pushSettingKey: "pushChallengeUpdates",
      fcm,
      data: { type: "CHALLENGE_TURN", challengeId: id }
    });
  }
  return c.json({ message: "Response submitted successfully" });
});

challenges.get("/async/pending", async (c) => {
  const userId = c.get("userId") as string;
  const db = getDrizzle(c.env.DB);
  
  const list = await db.query.challenge.findMany({
    where: and(
      eq(challenge.opponentId, userId),
      eq(challenge.status, "PENDING"),
      eq(challenge.type, "ASYNC")
    ),
    with: {
      user_creatorId: { columns: { username: true, avatarUrl: true } }
    }
  });
  
  return c.json(list);
});

challenges.get("/async/history", async (c) => {
  const userId = c.get("userId") as string;
  const db = getDrizzle(c.env.DB);
  
  const list = await db.query.challenge.findMany({
    where: and(
      or(eq(challenge.creatorId, userId), eq(challenge.opponentId, userId)),
      eq(challenge.status, "COMPLETED")
    ),
    with: {
      challengeParticipants: { with: { user: { columns: { username: true } } } }
    }
  });
  
  return c.json(list);
});

challenges.get("/", async (c) => {
  const userId = c.get("userId") as string;
  const db = getDrizzle(c.env.DB);
  
  const list = await db.query.challenge.findMany({
    where: or(eq(challenge.creatorId, userId), eq(challenge.opponentId, userId)),
    with: {
      challengeParticipants: true
    }
  });
  return c.json(list);
});

challenges.get("/:id", async (c) => {
  const id = c.req.param("id");
  const db = getDrizzle(c.env.DB);
  
  const details = await db.query.challenge.findFirst({
    where: eq(challenge.id, id),
    with: {
      challengeParticipants: true
    }
  });
  
  if (!details) return c.json({ error: "Challenge not found" }, 404);
  return c.json(details);
});

challenges.delete("/:id", async (c) => {
  const userId = c.get("userId") as string;
  const id = c.req.param("id");
  const db = getDrizzle(c.env.DB);
  
  const challengeObj = await db.query.challenge.findFirst({ where: eq(challenge.id, id) });
  if (!challengeObj) return c.json({ error: "Challenge not found" }, 404);
  if (challengeObj.creatorId !== userId) return c.json({ error: "Forbidden: Only creator can cancel" }, 403);
  
  await db.delete(challenge).where(eq(challenge.id, id));
  
  return c.json({ message: "Challenge canceled successfully" });
});

export default challenges;
