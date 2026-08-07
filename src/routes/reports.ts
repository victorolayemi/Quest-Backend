import { Hono } from 'hono';
import { getDrizzle } from '../utils/drizzle';
import { report } from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { Bindings, Variables } from '../types';

const reports = new Hono<{Bindings: Bindings, Variables: Variables}>();

reports.use('*', authMiddleware);

reports.post('/', async (c) => {
  const db = getDrizzle(c.env.DB);
  const userId = c.get('userId') as string;
  
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await c.req.json() as any;
    const { itemType, itemId, reportedUserId, reason, details, attachedMessages } = body;

    if (!itemType || !itemId || !reason) {
      return c.json({ error: 'itemType, itemId, and reason are required' }, 400);
    }

    const [newReport] = await db.insert(report).values({
      id: crypto.randomUUID(),
      userId,
      itemType,
      itemId,
      reportedUserId,
      reason,
      details,
      attachedMessages: attachedMessages ? JSON.stringify(attachedMessages) : null,
    }).returning();

    return c.json({ success: true, report: newReport });
  } catch (error) {
    console.error('Error creating report:', error);
    return c.json({ error: 'Failed to create report' }, 500);
  }
});

export default reports;
