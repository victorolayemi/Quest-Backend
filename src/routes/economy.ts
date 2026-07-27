import { Hono } from 'hono';
import { getPrisma } from '../utils/prisma';
import { authMiddleware } from '../middleware/auth';
import { Bindings, Variables } from '../types';

const economy = new Hono<{Bindings: Bindings, Variables: Variables}>();
economy.use("*", authMiddleware);

economy.get("/balance", async (c) => {
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { coinBalance: true, verificationBadge: true }
  });
  
  if (!user) return c.json({ error: "User not found" }, 404);
  return c.json(user);
});

economy.get("/transactions", async (c) => {
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const page = parseInt(c.req.query("page") || "1", 10);
  const limit = parseInt(c.req.query("limit") || "20", 10);
  
  const list = await prisma.coinTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * limit,
    take: limit
  });
  
  return c.json(list);
});

economy.get("/config", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const settings = await prisma.systemSetting.findMany({
    where: {
      key: {
        in: [
          'cost_create_journal', 
          'cost_create_note', 
          'cost_post_video', 
          'cost_post_audio', 
          'cost_create_community',
          'gold_badge_is_unlimited'
        ]
      }
    }
  });

  const config = settings.reduce((acc, curr) => {
    acc[curr.key] = curr.value;
    return acc;
  }, {} as Record<string, string>);

  return c.json(config);
});

economy.post("/check-cost", async (c) => {
  const userId = c.get("userId");
  const prisma = getPrisma(c.env.DB);
  const body = await c.req.json();
  const action = body.action; // 'create_journal', 'create_note', 'post_video', 'post_audio', 'create_community'
  
  if (!action) return c.json({ error: "Action is required" }, 400);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return c.json({ error: "User not found" }, 404);

  const settings = await prisma.systemSetting.findMany({
    where: {
      key: {
        in: ['gold_badge_is_unlimited', 'free_notes_limit', 'free_journals_limit', 'free_limit_period', `cost_${action}`]
      }
    }
  });

  const getSetting = (key: string, defaultValue: string) => {
    return settings.find(s => s.key === key)?.value || defaultValue;
  };

  const isGoldUnlimited = getSetting('gold_badge_is_unlimited', 'true') === 'true';
  const baseCost = parseInt(getSetting(`cost_${action}`, '0'), 10);

  if (user.verificationBadge === 'GOLD' && isGoldUnlimited) {
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

    const count = action === 'create_note' 
      ? await prisma.personalNote.count({ where: { userId, createdAt: { gte: dateFilter } } })
      : await prisma.journalEntry.count({ where: { userId, createdAt: { gte: dateFilter } } });

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
  const prisma = getPrisma(c.env.DB);
  
  const pkg = await prisma.coinPackage.findUnique({ where: { id: packageId } });
  if (!pkg) return c.json({ error: "Package not found" }, 404);

  // In production, this would be a webhook from RevenueCat/Stripe validating a receipt.
  // For now, we simulate a successful purchase.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { coinBalance: { increment: pkg.coins } }
    }),
    prisma.coinTransaction.create({
      data: {
        userId,
        amount: pkg.coins,
        type: 'EARN',
        description: `Purchased ${pkg.name}`
      }
    })
  ]);

  return c.json({ message: "Purchase successful", coinsAdded: pkg.coins });
});

export default economy;
