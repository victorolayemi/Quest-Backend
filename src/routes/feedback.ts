import { Hono } from "hono";
import { getDrizzle } from "../utils/drizzle";
import { feedback } from "../db/schema";
import { Bindings, Variables } from "../types";
import { authMiddleware } from "../middleware/auth";
import crypto from "crypto";

const router = new Hono<{ Bindings: Bindings; Variables: Variables }>();

router.use("*", authMiddleware);

router.post("/", async (c) => {
  const db = getDrizzle(c.env);
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json();
    const { type, content } = body;

    if (!type || !content) {
      return c.json({ error: "Type and content are required" }, 400);
    }

    const newFeedback = {
      id: crypto.randomUUID(),
      userId: userId,
      type,
      content,
    };

    await db.insert(feedback).values(newFeedback);

    return c.json({ message: "Feedback submitted successfully", feedback: newFeedback }, 201);
  } catch (error: any) {
    console.error("Error submitting feedback:", error);
    return c.json({ error: "Failed to submit feedback" }, 500);
  }
});

export default router;
