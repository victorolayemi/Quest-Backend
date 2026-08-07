
import { Context } from "hono";
import { eq, inArray, gte, sql, and } from 'drizzle-orm';
import { user, systemSetting, personalNote, journalEntry, coinTransaction } from '../db/schema';

/**
 * Checks if a user has sufficient coins to perform an action, or if they have unlimited Gold badge,
 * or if they have free limits remaining.
 * Automatically deducts coins if required and logs the transaction.
 */
export async function checkAndDeductCoins(
  c: Context,
  db: any,
  userId: string,
  action: 'create_journal' | 'create_note' | 'post_video' | 'post_audio' | 'create_community',
  description: string
): Promise<{ success: boolean; message?: string }> {
  
  const userObj = await db.query.user.findFirst({ where: eq(user.id, userId) });
  if (!userObj) return { success: false, message: "User not found" };

  const settingsKeys = ['gold_badge_is_unlimited', 'free_notes_limit', 'free_journals_limit', 'free_limit_period', `cost_${action}`];
  const settings = await db.query.systemSetting.findMany({
    where: inArray(systemSetting.key, settingsKeys)
  });

  const getSetting = (key: string, defaultValue: string) => {
    return settings.find((s: any) => s.key === key)?.value || defaultValue;
  };

  const isGoldUnlimited = getSetting('gold_badge_is_unlimited', 'true') === 'true';
  const cost = parseInt(getSetting(`cost_${action}`, '0'), 10);

  // 1. Unlimited Gold Badge users bypass all costs
  if (userObj.verificationBadge === 'GOLD' && isGoldUnlimited) {
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
    const isoDateFilter = dateFilter.toISOString();

    let currentCount = 0;
    if (action === 'create_note') {
      const records = await db.query.personalNote.findMany({
        where: and(eq(personalNote.userId, userId), gte(personalNote.createdAt, isoDateFilter)),
        columns: { id: true }
      });
      currentCount = records.length;
    } else {
      const records = await db.query.journalEntry.findMany({
        where: and(eq(journalEntry.userId, userId), gte(journalEntry.createdAt, isoDateFilter)),
        columns: { id: true }
      });
      currentCount = records.length;
    }

    if (currentCount < limit) {
      // Allow free creation
      return { success: true };
    }
  }

  // 3. Coin Deduction
  if (cost > 0) {
    if (userObj.coinBalance < cost) {
      return { success: false, message: "Insufficient coins" };
    }

    await db.update(user).set({ coinBalance: sql`${user.coinBalance} - ${cost}` }).where(eq(user.id, userId));
    await db.insert(coinTransaction).values({
      id: crypto.randomUUID(),
      userId,
      amount: cost,
      type: 'SPEND',
      description
    });
  }

  return { success: true };
}

// Alias for backwards compatibility with routes that import the Drizzle variant by name
export const checkAndDeductCoinsDrizzle = checkAndDeductCoins;

/**
 * Grants coins to a user and logs the transaction.
 */
export async function grantCoins(
  db: any,
  userId: string,
  amount: number,
  description: string
): Promise<{ success: boolean; newBalance?: number }> {
  if (amount <= 0) return { success: true };

  const [updatedUser] = await db.update(user)
    .set({ coinBalance: sql`${user.coinBalance} + ${amount}` })
    .where(eq(user.id, userId))
    .returning();

  await db.insert(coinTransaction).values({
    id: crypto.randomUUID(),
    userId,
    amount,
    type: 'EARN',
    description
  });

  return { success: true, newBalance: updatedUser.coinBalance };
}

// Alias for backwards compatibility with routes that import the Drizzle variant by name
export const grantCoinsDrizzle = grantCoins;
