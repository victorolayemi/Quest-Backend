import { Context } from "hono";
import { PrismaClient } from "@prisma/client/edge";

/**
 * Checks if a user has sufficient coins to perform an action, or if they have unlimited Gold badge,
 * or if they have free limits remaining.
 * Automatically deducts coins if required and logs the transaction.
 */
export async function checkAndDeductCoins(
  c: Context,
  prisma: PrismaClient,
  userId: string,
  action: 'create_journal' | 'create_note' | 'post_video' | 'post_audio' | 'create_community',
  description: string
): Promise<{ success: boolean; message?: string }> {
  
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { success: false, message: "User not found" };

  // Fetch economy settings
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
  const cost = parseInt(getSetting(`cost_${action}`, '0'), 10);

  // 1. Unlimited Gold Badge users bypass all costs
  if (user.verificationBadge === 'GOLD' && isGoldUnlimited) {
    return { success: true };
  }

  // 2. Free Limits Check for Notes and Journals
  if (action === 'create_note' || action === 'create_journal') {
    const limitKey = action === 'create_note' ? 'free_notes_limit' : 'free_journals_limit';
    const limit = parseInt(getSetting(limitKey, '0'), 10);
    const period = getSetting('free_limit_period', 'MONTHLY');
    
    let dateFilter = new Date();
    if (period === 'MONTHLY') {
      dateFilter.setDate(1);
    } else if (period === 'WEEKLY') {
      dateFilter.setDate(dateFilter.getDate() - dateFilter.getDay());
    } else { // DAILY
      dateFilter.setHours(0, 0, 0, 0);
    }

    let currentCount = 0;
    if (action === 'create_note') {
      currentCount = await prisma.personalNote.count({
        where: { userId, createdAt: { gte: dateFilter } }
      });
    } else {
      currentCount = await prisma.journalEntry.count({
        where: { userId, createdAt: { gte: dateFilter } }
      });
    }

    if (currentCount < limit) {
      // Allow free creation
      return { success: true };
    }
  }

  // 3. Coin Deduction
  if (cost > 0) {
    if (user.coinBalance < cost) {
      return { success: false, message: "Insufficient coins" };
    }

    // Deduct coins and log transaction
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { coinBalance: { decrement: cost } }
      }),
      prisma.coinTransaction.create({
        data: {
          userId,
          amount: cost,
          type: 'SPEND',
          description: description
        }
      })
    ]);
  }

  return { success: true };
}

/**
 * Grants coins to a user and logs the transaction.
 */
export async function grantCoins(
  prisma: PrismaClient,
  userId: string,
  amount: number,
  description: string
): Promise<{ success: boolean; newBalance?: number }> {
  if (amount <= 0) return { success: true };

  const [user, _] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { coinBalance: { increment: amount } }
    }),
    prisma.coinTransaction.create({
      data: {
        userId,
        amount,
        type: 'EARN',
        description
      }
    })
  ]);

  return { success: true, newBalance: user.coinBalance };
}
