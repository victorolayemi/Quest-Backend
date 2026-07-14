import { Context, Next } from 'hono';
import { verify } from 'hono/jwt';
import { getPrisma } from '../utils/prisma';
import { Bindings, Variables } from '../types';

export async function adminAuthMiddleware(c: Context<{Bindings: Bindings, Variables: Variables}>, next: Next) {
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
    const userId = payload.sub as string;
    const prisma = getPrisma(c.env.DB);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true }
    });
    if (!user || !user.isAdmin) {
      return c.json({ error: "Forbidden: Admin access required" }, 403);
    }
    c.set("userId", userId);
    await next();
  } catch (err2) {
    return c.json({ error: "Unauthorized: Invalid token" }, 401);
  }
}
