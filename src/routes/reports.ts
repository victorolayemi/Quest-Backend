import { Hono } from 'hono';
import { getPrisma } from '../utils/prisma';
import { authMiddleware } from '../middleware/auth';
import { Bindings, Variables } from '../types';

const reports = new Hono<{Bindings: Bindings, Variables: Variables}>();

reports.use('*', authMiddleware);

reports.post('/', async (c) => {
  const prisma = getPrisma(c.env.DB);
  const userId = c.get('userId');
  
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await c.req.json();
    const { itemType, itemId, reportedUserId, reason, details, attachedMessages } = body;

    if (!itemType || !itemId || !reason) {
      return c.json({ error: 'itemType, itemId, and reason are required' }, 400);
    }

    const report = await prisma.report.create({
      data: {
        userId,
        itemType,
        itemId,
        reportedUserId,
        reason,
        details,
        attachedMessages: attachedMessages ? JSON.stringify(attachedMessages) : null,
      },
    });

    return c.json({ success: true, report });
  } catch (error) {
    console.error('Error creating report:', error);
    return c.json({ error: 'Failed to create report' }, 500);
  }
});

export default reports;
