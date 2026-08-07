import { Context, Next } from 'hono';
import { verify } from 'hono/jwt';
import { getDrizzle } from '../utils/drizzle';
import { Bindings, Variables } from '../types';

export async function authMiddleware(c: Context<{Bindings: Bindings, Variables: Variables}>, next: Next) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized: Missing or invalid token" }, 401);
  }
  const token = authHeader.split(" ")[1];
  try {
    const secret = c.env.JWT_SECRET;
    if (!secret) {
      return c.json({ error: "Internal Server Error: JWT_SECRET not configured" }, 500);
    }
    const payload = await verify(token, secret, "HS256");
    c.set("userId", payload.sub as string);
    await next();
  } catch (err2) {
    return c.json({ error: "Unauthorized: Invalid token" }, 401);
  }
}

export async function checkCommunityRestriction(c: Context<{Bindings: Bindings, Variables: Variables}>, next: Next) {
  const userId = c.get("userId");
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  
  const db = getDrizzle(c.env.DB);
  const user = await db.query.user.findFirst({
    where: (users, { eq }) => eq(users.id, userId),
    columns: { isCommunityRestricted: true }
  });
  
  if (user?.isCommunityRestricted) {
    return c.json({ error: "Your account has been restricted from community features due to a violation." }, 403);
  }
  
  await next();
}

export async function checkMediaRestriction(c: Context<{Bindings: Bindings, Variables: Variables}>, next: Next) {
  const userId = c.get("userId");
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  
  const db = getDrizzle(c.env.DB);
  const user = await db.query.user.findFirst({
    where: (users, { eq }) => eq(users.id, userId),
    columns: { mediaRestrictionExpiry: true }
  });
  
  if (user?.mediaRestrictionExpiry && new Date(user.mediaRestrictionExpiry) > new Date()) {
    return c.json({ error: "Your account has been restricted from posting media due to a violation." }, 403);
  }
  
  await next();
}
