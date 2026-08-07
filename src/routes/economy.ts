import { Hono } from 'hono';
import { getDrizzle } from '../utils/drizzle';
import { authMiddleware } from '../middleware/auth';
import { Bindings, Variables } from '../types';
import { eq, desc, inArray, and, gte, sql } from 'drizzle-orm';
import { user, coinTransaction, systemSetting, personalNote, journalEntry, coinPackage } from '../db/schema';

const economy = new Hono<{Bindings: Bindings, Variables: Variables}>();
economy.use("*", authMiddleware);

economy.get("/balance", async (c) => {
  const userId = c.get("userId");
  const db = getDrizzle(c.env.DB);
  
  const u = await db.query.user.findFirst({
    where: (users, { eq }) => eq(users.id, userId),
    columns: { coinBalance: true, verificationBadge: true }
  });
  
  if (!u) return c.json({ error: "User not found" }, 404);
  return c.json(u);
});

economy.get("/transactions", async (c) => {
  const userId = c.get("userId");
  const db = getDrizzle(c.env.DB);
  const page = parseInt(c.req.query("page") || "1", 10);
  const limit = parseInt(c.req.query("limit") || "20", 10);
  
  const list = await db.query.coinTransaction.findMany({
    where: (txs, { eq }) => eq(txs.userId, userId),
    orderBy: (txs, { desc }) => [desc(txs.createdAt)],
    offset: (page - 1) * limit,
    limit: limit
  });
  
  return c.json(list);
});

economy.get("/config", async (c) => {
  const db = getDrizzle(c.env.DB);
  const settings = await db.query.systemSetting.findMany({
    where: (s, { inArray }) => inArray(s.key, [
      'cost_create_journal', 
      'cost_create_note', 
      'cost_post_video', 
      'cost_post_audio', 
      'cost_create_community',
      'gold_badge_is_unlimited'
    ])
  });

  const config = settings.reduce((acc, curr) => {
    acc[curr.key] = curr.value || '';
    return acc;
  }, {} as Record<string, string>);

  return c.json(config);
});

economy.post("/check-cost", async (c) => {
  const userId = c.get("userId");
  const db = getDrizzle(c.env.DB);
  const body = await c.req.json();
  const action = body.action; // 'create_journal', 'create_note', 'post_video', 'post_audio', 'create_community'
  
  if (!action) return c.json({ error: "Action is required" }, 400);

  const u = await db.query.user.findFirst({ where: (users, { eq }) => eq(users.id, userId) });
  if (!u) return c.json({ error: "User not found" }, 404);

  const settings = await db.query.systemSetting.findMany({
    where: (s, { inArray }) => inArray(s.key, [
      'gold_badge_is_unlimited', 
      'free_notes_limit', 
      'free_journals_limit', 
      'free_limit_period', 
      `cost_${action}`
    ])
  });

  const getSetting = (key: string, defaultValue: string) => {
    return settings.find(s => s.key === key)?.value || defaultValue;
  };

  const isGoldUnlimited = getSetting('gold_badge_is_unlimited', 'true') === 'true';
  const baseCost = parseInt(getSetting(`cost_${action}`, '0'), 10);

  if (u.verificationBadge === 'GOLD' && isGoldUnlimited) {
    return c.json({ cost: 0, isFree: true, reason: 'Gold badge is unlimited' });
  }

  // Check free limits
  if (action === 'create_note' || action === 'create_journal') {
    const limitKey = action === 'create_note' ? 'free_notes_limit' : 'free_journals_limit';
    const limit = parseInt(getSetting(limitKey, '0'), 10);
    const period = getSetting('free_limit_period', 'MONTHLY');
    
    let dateFilter = new Date();
    if (period === 'MONTHLY') {
      dateFilter.setDate(1);
    } else if (period === 'WEEKLY') {
      const day = dateFilter.getDay(), diff = dateFilter.getDate() - day + (day == 0 ? -6:1);
      dateFilter = new Date(dateFilter.setDate(diff));
    }
    dateFilter.setHours(0,0,0,0);
    
    // SQLite stores dates as strings/unix, drizzle orm uses string/Date mapped correctly if set
    // Let's use string format for safety if mapped as text, or Date if mapped as integer/text custom
    // Assuming drizzle mapped it as text:
    const dateString = dateFilter.toISOString();

    let countResult;
    if (action === 'create_note') {
      countResult = await db.select({ count: sql<number>`count(*)` })
        .from(personalNote)
        .where(and(eq(personalNote.userId, userId), gte(personalNote.createdAt, dateString)));
    } else {
      countResult = await db.select({ count: sql<number>`count(*)` })
        .from(journalEntry)
        .where(and(eq(journalEntry.userId, userId), gte(journalEntry.createdAt, dateString)));
    }
    
    const count = countResult[0].count;

    if (count < limit) {
      return c.json({ cost: 0, isFree: true, reason: 'Within free limits' });
    }
  }

  return c.json({ cost: baseCost, isFree: baseCost === 0, reason: 'Standard cost applied' });
});

// For local testing of purchasing a coin package
economy.post("/purchase/:packageId", async (c) => {
  const userId = c.get("userId");
  const packageId = c.req.param("packageId");
  const db = getDrizzle(c.env.DB);
  
  const pkg = await db.query.coinPackage.findFirst({ where: (pkgs, { eq }) => eq(pkgs.id, packageId) });
  if (!pkg) return c.json({ error: "Package not found" }, 404);
  
  // D1 batches work seamlessly with drizzle transactions if using the d1 dialect
  await db.transaction(async (tx) => {
    await tx.update(user)
      .set({ coinBalance: sql`${user.coinBalance} + ${pkg.amount}` })
      .where(eq(user.id, userId));
      
    await tx.insert(coinTransaction).values({
      id: crypto.randomUUID(), // Provide ID manually for SQLite
      userId,
      amount: pkg.amount,
      type: 'EARN',
      description: `Purchased package`
    });
  });

  return c.json({ message: "Purchase successful", coinsAdded: pkg.amount });
});

export default economy;
