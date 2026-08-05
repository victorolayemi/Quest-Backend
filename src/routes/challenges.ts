
import { FCMService } from '../services/fcm';
import { dispatchNotification } from '../services/notificationService';

import { Hono } from 'hono';
import { getPrisma } from '../utils/prisma';
import { authMiddleware } from '../middleware/auth';
import { adminAuthMiddleware } from '../middleware/adminAuth';

// src/routes/challenges.ts
import { Bindings, Variables } from '../types';
var challenges = new Hono<{Bindings: Bindings, Variables: Variables}>();
challenges.use("*", authMiddleware);
function generateInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}
challenges.post("/invite/link", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  const { quizId, type } = body;
  const prisma = getPrisma(c.env.DB);
  let quiz = await prisma.quiz.findFirst();
  if (!quiz) {
    quiz = await prisma.quiz.create({
      data: {
        title: "Exodus Trivia",
        category: "exodus",
        difficulty: "medium"
      }
    });
  }
  const code = generateInviteCode();
  const challenge = await prisma.challenge.create({
    data: {
      creatorId: userId,
      quizId: quizId || quiz.id,
      type: type || "ASYNC",
      inviteCode: code,
      status: "PENDING"
    }
  });
  return c.json({
    message: "Challenge invite code generated",
    inviteCode: code,
    challenge
  });
});
challenges.post("/invite/send", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  const { friendId, quizId, type } = body;
  const prisma = getPrisma(c.env.DB);
  const code = generateInviteCode();
  const challenge = await prisma.challenge.create({
    data: {
      creatorId: userId,
      opponentId: friendId,
      quizId,
      type: type || "ASYNC",
      inviteCode: code,
      status: "PENDING"
    }
  });
  await prisma.challengeParticipant.create({
    data: { challengeId: challenge.id, userId }
  });
  await prisma.challengeParticipant.create({
    data: { challengeId: challenge.id, userId: friendId }
  });
  const fcm = new FCMService(c.env.FIREBASE_CLIENT_EMAIL, c.env.FIREBASE_PRIVATE_KEY);
  const sender = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, username: true } });
  const senderName = sender?.firstName || sender?.username || "Someone";
  await dispatchNotification({
    prisma,
    userId: friendId,
    title: "New Challenge",
    message: `${senderName} challenged you to a quiz.`,
    type: "CHALLENGE_INVITE",
    pushSettingKey: "pushChallengeUpdates",
    fcm,
    data: { type: "CHALLENGE_INVITE", challengeId: challenge.id }
  });
  return c.json({
    message: "Challenge sent to friend",
    challenge
  });
});
challenges.get("/invite/:code", async (c) => {
  const code = c.req.param("code");
  const prisma = getPrisma(c.env.DB);
  const challenge = await prisma.challenge.findUnique({
    where: { inviteCode: code },
    include: {
      creator: { select: { id: true, username: true, avatarUrl: true } },
      opponent: { select: { id: true, username: true, avatarUrl: true } }
    }
  });
  if (!challenge) {
    return c.json({ error: "Challenge code not found" }, 404);
  }
  return c.json(challenge);
});
challenges.post("/invite/:code/accept", async (c) => {
  const userId = c.get("userId");
  const code = c.req.param("code");
  const prisma = getPrisma(c.env.DB);
  const challenge = await prisma.challenge.findUnique({
    where: { inviteCode: code }
  });
  if (!challenge) {
    return c.json({ error: "Challenge not found" }, 404);
  }
  if (challenge.creatorId === userId) {
    return c.json({ error: "Cannot accept your own challenge" }, 400);
  }
  const updated = await prisma.challenge.update({
    where: { id: challenge.id },
    data: {
      opponentId: userId,
      status: "ACTIVE"
    }
  });
  const creatorPart = await prisma.challengeParticipant.findFirst({
    where: { challengeId: challenge.id, userId: challenge.creatorId }
  });
  if (!creatorPart) {
    await prisma.challengeParticipant.create({
      data: { challengeId: challenge.id, userId: challenge.creatorId }
    });
  }
  const oppPart = await prisma.challengeParticipant.findFirst({
    where: { challengeId: challenge.id, userId }
  });
  if (!oppPart) {
    await prisma.challengeParticipant.create({
      data: { challengeId: challenge.id, userId }
    });
  }
  return c.json({
    message: "Challenge accepted successfully",
    challenge: updated
  });
});
challenges.post("/battle/create", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  const { quizId } = body;
  const prisma = getPrisma(c.env.DB);
  const code = generateInviteCode();
  const battle = await prisma.challenge.create({
    data: {
      creatorId: userId,
      quizId,
      type: "BATTLE",
      inviteCode: code,
      status: "PENDING"
    }
  });
  return c.json({
    message: "Battle room created. Invite opponent with code.",
    code,
    battle
  });
});
challenges.post("/battle/:id/join", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const prisma = getPrisma(c.env.DB);
  const battle = await prisma.challenge.findUnique({ where: { id } });
  if (!battle) return c.json({ error: "Battle not found" }, 404);
  const updated = await prisma.challenge.update({
    where: { id },
    data: {
      opponentId: userId,
      status: "ACTIVE"
    }
  });
  return c.json({
    message: "Joined battle room successfully",
    battle: updated
  });
});
challenges.get("/battle/:id", async (c) => {
  const id = c.req.param("id");
  const prisma = getPrisma(c.env.DB);
  const battle = await prisma.challenge.findUnique({
    where: { id },
    include: {
      participants: {
        include: { user: { select: { username: true, avatarUrl: true } } }
      }
    }
  });
  if (!battle) return c.json({ error: "Battle not found" }, 404);
  return c.json(battle);
});
challenges.post("/battle/:id/answer", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = await c.req.json();
  const { score, completed } = body;
  const prisma = getPrisma(c.env.DB);
  const participant = await prisma.challengeParticipant.findFirst({
    where: { challengeId: id, userId }
  });
  if (!participant) {
    return c.json({ error: "Participant not found in battle" }, 404);
  }
  const updated = await prisma.challengeParticipant.update({
    where: { id: participant.id },
    data: {
      score: score !== void 0 ? score : void 0,
      completed: completed !== void 0 ? completed : void 0
    }
  });
  const allParts = await prisma.challengeParticipant.findMany({
    where: { challengeId: id }
  });
  const allCompleted = allParts.every((p: any) => p.completed);
  if (allCompleted) {
    await prisma.challenge.update({
      where: { id },
      data: { status: "COMPLETED" }
    });
  }
  return c.json(updated);
});
challenges.get("/battle/:id/result", async (c) => {
  const id = c.req.param("id");
  const prisma = getPrisma(c.env.DB);
  const battle = await prisma.challenge.findUnique({
    where: { id },
    include: {
      participants: {
        include: { user: { select: { username: true, avatarUrl: true } } },
        orderBy: { score: "desc" }
      }
    }
  });
  if (!battle) return c.json({ error: "Battle not found" }, 404);
  return c.json({
    battleStatus: battle.status,
    results: battle.participants
  });
});
challenges.post("/async/send", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  const { opponentId, quizId } = body;
  const prisma = getPrisma(c.env.DB);
  const code = generateInviteCode();
  const challenge = await prisma.challenge.create({
    data: {
      creatorId: userId,
      opponentId,
      quizId,
      type: "ASYNC",
      inviteCode: code,
      status: "PENDING"
    }
  });
  await prisma.challengeParticipant.create({ data: { challengeId: challenge.id, userId } });
  await prisma.challengeParticipant.create({ data: { challengeId: challenge.id, userId: opponentId } });
  const fcm = new FCMService(c.env.FIREBASE_CLIENT_EMAIL, c.env.FIREBASE_PRIVATE_KEY);
  const sender = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, username: true } });
  const senderName = sender?.firstName || sender?.username || "Someone";
  await dispatchNotification({
    prisma,
    userId: opponentId,
    title: "New Async Challenge",
    message: `${senderName} challenged you to an async quiz.`,
    type: "CHALLENGE_INVITE",
    pushSettingKey: "pushChallengeUpdates",
    fcm,
    data: { type: "CHALLENGE_INVITE", challengeId: challenge.id }
  });
  return c.json(challenge);
});
challenges.post("/async/:id/respond", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = await c.req.json();
  const { score } = body;
  const prisma = getPrisma(c.env.DB);
  const participant = await prisma.challengeParticipant.findFirst({
    where: { challengeId: id, userId }
  });
  if (!participant) return c.json({ error: "Participant not in challenge" }, 404);
  await prisma.challengeParticipant.update({
    where: { id: participant.id },
    data: {
      score,
      completed: true
    }
  });
  const allParts = await prisma.challengeParticipant.findMany({ where: { challengeId: id } });
  if (allParts.every((p: any) => p.completed)) {
    await prisma.challenge.update({ where: { id }, data: { status: "COMPLETED" } });
  }
  const opponentParticipant = allParts.find((p: any) => p.userId !== userId);
  if (opponentParticipant) {
    const fcm = new FCMService(c.env.FIREBASE_CLIENT_EMAIL, c.env.FIREBASE_PRIVATE_KEY);
    const sender = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, username: true } });
    const senderName = sender?.firstName || sender?.username || "Someone";
    await dispatchNotification({
      prisma,
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
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const list = await prisma.challenge.findMany({
    where: {
      opponentId: userId,
      status: "PENDING",
      type: "ASYNC"
    },
    include: {
      creator: { select: { username: true, avatarUrl: true } }
    }
  });
  return c.json(list);
});
challenges.get("/async/history", async (c) => {
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const list = await prisma.challenge.findMany({
    where: {
      OR: [
        { creatorId: userId },
        { opponentId: userId }
      ],
      status: "COMPLETED"
    },
    include: {
      participants: { include: { user: { select: { username: true } } } }
    }
  });
  return c.json(list);
});
challenges.get("/", async (c) => {
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const list = await prisma.challenge.findMany({
    where: {
      OR: [
        { creatorId: userId },
        { opponentId: userId }
      ]
    },
    include: {
      participants: true
    }
  });
  return c.json(list);
});
challenges.get("/:id", async (c) => {
  const id = c.req.param("id");
  const prisma = getPrisma(c.env.DB);
  const details = await prisma.challenge.findUnique({
    where: { id },
    include: {
      participants: true
    }
  });
  if (!details) return c.json({ error: "Challenge not found" }, 404);
  return c.json(details);
});
challenges.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const prisma = getPrisma(c.env.DB);
  const challenge = await prisma.challenge.findUnique({ where: { id } });
  if (!challenge) return c.json({ error: "Challenge not found" }, 404);
  if (challenge.creatorId !== userId) return c.json({ error: "Forbidden: Only creator can cancel" }, 403);
  await prisma.challenge.delete({ where: { id } });
  return c.json({ message: "Challenge canceled successfully" });
});


export default challenges;
