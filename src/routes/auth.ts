import { sign } from 'hono/jwt';
import { createRemoteJWKSet, jwtVerify } from 'jose';

import { Hono } from 'hono';
import { getDrizzle } from '../utils/drizzle';
import { user as userTable, globalSettings as globalSettingsTable, otpRequest as otpRequestTable, loginHistory as loginHistoryTable } from '../db/schema';
import { eq, or, and, gte, desc } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import { adminAuthMiddleware } from '../middleware/adminAuth';

// src/routes/auth.ts
import { Bindings, Variables } from '../types';
var auth = new Hono<{Bindings: Bindings, Variables: Variables}>();
async function generateToken(userId: string, secret: string) {
  if (!secret) {
    throw new Error("JWT_SECRET is missing from environment variables");
  }
  const payload = {
    sub: userId,
    exp: Math.floor(Date.now() / 1e3) + 60 * 60 * 24 * 30
    // 30 days
  };
  return await sign(payload, secret);
}
async function hashPasswordLegacy(password: string) {
  const encoder2 = new TextEncoder();
  const data = encoder2.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function hashPassword(password: string, existingSalt?: string, iterations: number = 10000) {
  const encoder2 = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    encoder2.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  let salt: Uint8Array;
  if (existingSalt) {
    salt = new Uint8Array(existingSalt.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));
  } else {
    salt = crypto.getRandomValues(new Uint8Array(16));
  }
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: iterations,
      hash: "SHA-256"
    },
    passwordKey,
    256
  );
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b: number) => b.toString(16).padStart(2, "0")).join("");
  const saltHex = Array.from(salt).map((b: number) => b.toString(16).padStart(2, "0")).join("");
  return `${saltHex}:${hashHex}:${iterations}`;
}
async function verifyPassword(password: string, storedHash: string) {
  if (storedHash.includes(":")) {
    const parts = storedHash.split(":");
    const salt = parts[0];
    const iterations = parts.length === 3 ? parseInt(parts[2], 10) : 100000;
    
    // For legacy hashes (length 2), they were stored as `${saltHex}:${hashHex}`
    // Our new hashPassword returns `${saltHex}:${hashHex}:${iterations}`
    const generatedFullHash = await hashPassword(password, salt, iterations);
    
    if (parts.length === 2) {
      // Compare the first two parts to the original format
      const generatedParts = generatedFullHash.split(":");
      return `${generatedParts[0]}:${generatedParts[1]}` === storedHash;
    } else {
      return generatedFullHash === storedHash;
    }
  } else {
    const hash = await hashPasswordLegacy(password);
    return hash === storedHash;
  }
}
auth.post("/guest", async (c) => {
  const db = getDrizzle(c.env.DB);
  const guestUserArr = await db.insert(userTable).values({ id: crypto.randomUUID(), isGuest: true, points: 0, streakCount: 0 }).returning();
  const guestUser = guestUserArr[0];
  const token = await generateToken(guestUser.id, c.env.JWT_SECRET);
  return c.json({
    token,
    user: guestUser
  });
});
auth.get("/guest/status", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const db = getDrizzle(c.env.DB);
  const userRow = await db.query.user.findFirst({ where: (users, { eq }) => eq(users.id, userId) });
  if (!userRow || !userRow.isGuest) {
    return c.json({ error: "Not a guest session" }, 400);
  }
  const level = Math.floor(userRow.points / 100) + 1;
  return c.json({
    isGuest: true,
    points: userRow.points,
    level,
    playsRemaining: 3
  });
});
auth.post("/otp/send", async (c) => {
  const body = await c.req.json();
  const { contact, purpose } = body; // purpose: "signup" | "reset"
  if (!contact) {
    return c.json({ error: "Contact field is required" }, 400);
  }
  const db = getDrizzle(c.env.DB);
  
  // Fetch global settings
  const globalSettings = await db.query.globalSettings.findFirst({ where: (s, { eq }) => eq(s.id, "default") });
  const otpMethod = globalSettings?.otpMethod ?? "twilio";

  // Only skip OTP for signup when admin has disabled it
  if (purpose === "signup" && globalSettings && !globalSettings.registrationOtpEnabled) {
    return c.json({
      message: "OTP sent successfully",
      contact,
      mocked: true
    });
  }

  const randomArray = new Uint32Array(1);
  crypto.getRandomValues(randomArray);
  const code = (1e3 + randomArray[0] % 9e3).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1e3);
  await db.insert(otpRequestTable).values({ id: crypto.randomUUID(), contact, code, expiresAt: expiresAt.toISOString() });

  const isEmail = contact.includes("@");

  if (otpMethod === "smtp" && globalSettings?.smtpHost && globalSettings?.smtpUser && globalSettings?.smtpPass) {
    // Send OTP via SMTP email using Cloudflare Workers-compatible fetch
    const smtpHost = globalSettings.smtpHost;
    const smtpPort = globalSettings.smtpPort ?? 587;
    const smtpUser = globalSettings.smtpUser;
    const smtpPass = globalSettings.smtpPass;
    const smtpFrom = globalSettings.smtpFrom ?? smtpUser;

    if (!isEmail) {
      return c.json({ error: "SMTP OTP delivery requires an email address as contact." }, 400);
    }

    // Use Mailchannels (free for Workers) or a generic SMTP relay via HTTP API
    // For Cloudflare Workers (no raw TCP), we use the MailChannels Workers API
    try {
      const mailResponse = await fetch("https://api.mailchannels.net/tx/v1/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: contact }] }],
          from: { email: smtpFrom },
          subject: "Your Verification Code",
          content: [
            {
              type: "text/plain",
              value: `Your Quest verification code is: ${code}\n\nThis code expires in 10 minutes. Do not share it with anyone.`
            },
            {
              type: "text/html",
              value: `<p>Your <strong>Quest</strong> verification code is:</p><h2 style="letter-spacing:4px">${code}</h2><p>This code expires in 10 minutes. Do not share it with anyone.</p>`
            }
          ]
        })
      });
      if (!mailResponse.ok && mailResponse.status !== 202) {
        const errText = await mailResponse.text();
        console.error("MailChannels Error:", errText);
        return c.json({ error: "Failed to send OTP email. Check your SMTP settings." }, 500);
      }
    } catch (e) {
      console.error("SMTP Fetch Error:", e);
      return c.json({ error: "Failed to send OTP email." }, 500);
    }
  } else if (otpMethod === "twilio" || !globalSettings?.smtpHost) {
    // Send OTP via Twilio SMS
    if (isEmail) {
      return c.json({ error: "Twilio OTP delivery requires a phone number as contact." }, 400);
    }
    if (c.env.TWILIO_ACCOUNT_SID && c.env.TWILIO_AUTH_TOKEN && c.env.TWILIO_PHONE_NUMBER) {
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${c.env.TWILIO_ACCOUNT_SID}/Messages.json`;
      const authString = btoa(`${c.env.TWILIO_ACCOUNT_SID}:${c.env.TWILIO_AUTH_TOKEN}`);
      const formData = new URLSearchParams();
      formData.append("To", contact);
      formData.append("From", c.env.TWILIO_PHONE_NUMBER);
      formData.append("Body", `Your Quest verification code is: ${code}`);
      try {
        const response = await fetch(twilioUrl, {
          method: "POST",
          headers: {
            "Authorization": `Basic ${authString}`,
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: formData.toString()
        });
        if (!response.ok) {
          const errText = await response.text();
          console.error("Twilio Error:", errText);
          return c.json({ error: "Failed to send OTP SMS. Check your Twilio settings." }, 500);
        }
      } catch (e) {
        console.error("Twilio Fetch Error:", e);
        return c.json({ error: "Failed to communicate with Twilio." }, 500);
      }
    } else {
      console.log("OTP sent successfully (Mock/Dev Mode)", code);
    }
  }

  return c.json({
    message: "OTP sent successfully",
    contact
  });
});

auth.post("/register", async (c) => {
  const body = await c.req.json();
  const { contact, code, password, firstName, lastName, username, gender } = body;
  
  const db = getDrizzle(c.env.DB);
  const globalSettings = await db.query.globalSettings.findFirst({ where: (s, { eq }) => eq(s.id, "default") });
  const otpEnabled = globalSettings ? globalSettings.registrationOtpEnabled : true;

  if (!contact || password === undefined || !username) {
    return c.json({ error: "Contact, password, and username are required" }, 400);
  }

  if (otpEnabled && !code) {
    return c.json({ error: "Code is required when OTP is enabled" }, 400);
  }

  if (otpEnabled) {
    const otpRequest = await db.query.otpRequest.findFirst({ where: (o, { eq, and, gte }) => and(eq(o.contact, contact), eq(o.code, code), eq(o.verified, false), gte(o.expiresAt, new Date().toISOString())), orderBy: (o, { desc }) => [desc(o.expiresAt)] });
    if (!otpRequest) {
      return c.json({ error: "Invalid or expired OTP" }, 400);
    }
    await db.update(otpRequestTable).set({ verified: true }).where(eq(otpRequestTable.id, otpRequest.id));
  }

  const existingUsername = await db.query.user.findFirst({ where: (u, { eq }) => eq(u.username, username) });
  if (existingUsername) {
    return c.json({ error: "Username already taken" }, 400);
  }
  const existingUser = await db.query.user.findFirst({ where: (u, { or, eq }) => or(eq(u.email, contact), eq(u.phoneNumber, contact)) });
  if (existingUser && !existingUser.isGuest) {
    return c.json({ error: "User with this contact already exists. Please login." }, 400);
  }
  
  const hashedPassword = await hashPassword(password);
  
  let user;
  if (existingUser && existingUser.isGuest) {
    const userArr = await db.update(userTable).set({ isGuest: false, email: contact.includes("@") ? contact : null, phoneNumber: contact.includes("@") ? null : contact, password: hashedPassword, firstName, lastName, username, gender }).where(eq(userTable.id, existingUser.id)).returning();
    user = userArr[0];
  } else {
    const userArr = await db.insert(userTable).values({ id: crypto.randomUUID(), email: contact.includes("@") ? contact : null, phoneNumber: contact.includes("@") ? null : contact, password: hashedPassword, isGuest: false, firstName, lastName, username, gender }).returning();
    user = userArr[0];
  }
  const token = await generateToken(user.id, c.env.JWT_SECRET);
  return c.json({
    message: "Registration completed",
    token,
    user
  });
});

auth.post("/login", async (c) => {
  const body = await c.req.json();
  const { contact, password } = body;
  if (!contact || !password) {
    return c.json({ error: "Contact and password are required" }, 400);
  }
  const db = getDrizzle(c.env.DB);
  const user = await db.query.user.findFirst({ where: (u, { or, eq }) => or(eq(u.email, contact), eq(u.phoneNumber, contact)) });
  if (!user || user.isGuest || !user.password) {
    return c.json({ error: "Invalid credentials or user does not exist" }, 401);
  }
  const isValidPassword = await verifyPassword(password, user.password);
  if (!isValidPassword) {
    return c.json({ error: "Invalid credentials" }, 401);
  }
  
  // Progressive Hash Upgrade: If the user has an old hash format, upgrade it
  if (user.password.split(":").length === 2) {
    const upgradedHash = await hashPassword(password); // uses default 10,000 iterations
    await db.update(userTable).set({ password: upgradedHash }).where(eq(userTable.id, user.id));
  }
  
  const token = await generateToken(user.id, c.env.JWT_SECRET);
  const userAgent = c.req.header("user-agent") || "";
  let browser = "Unknown";
  if (userAgent.includes("Edge")) browser = "Edge";
  else if (userAgent.includes("Chrome")) browser = "Chrome";
  else if (userAgent.includes("Firefox")) browser = "Firefox";
  else if (userAgent.includes("Safari")) browser = "Safari";
  let os = "Unknown";
  if (userAgent.includes("Windows")) os = "Windows";
  else if (userAgent.includes("Mac OS")) os = "Mac OS";
  else if (userAgent.includes("Linux")) os = "Linux";
  else if (userAgent.includes("Android")) os = "Android";
  else if (userAgent.includes("iPhone") || userAgent.includes("iPad")) os = "iOS";
  const ip = c.req.header("x-forwarded-for") || c.req.header("cf-connecting-ip") || "Unknown";
  await db.insert(loginHistoryTable).values({ id: crypto.randomUUID(), userId: user.id, ip, browser, os });
  return c.json({
    message: "Login successful",
    token,
    user
  });
});
auth.post("/password/reset", async (c) => {
  const body = await c.req.json();
  const { contact, code, newPassword } = body;
  if (!contact || !code || !newPassword) {
    return c.json({ error: "Contact, code, and newPassword are required" }, 400);
  }
  const db = getDrizzle(c.env.DB);
  const otpRequest = await db.query.otpRequest.findFirst({ where: (o, { eq, and, gte }) => and(eq(o.contact, contact), eq(o.code, code), eq(o.verified, false), gte(o.expiresAt, new Date().toISOString())), orderBy: (o, { desc }) => [desc(o.expiresAt)] });
  if (!otpRequest) {
    return c.json({ error: "Invalid or expired OTP" }, 400);
  }
  const user = await db.query.user.findFirst({ where: (u, { or, eq }) => or(eq(u.email, contact), eq(u.phoneNumber, contact)) });
  if (!user) {
    return c.json({ error: "User does not exist" }, 404);
  }
  const hashedPassword = await hashPassword(newPassword);
  await db.update(otpRequestTable).set({ verified: true }).where(eq(otpRequestTable.id, otpRequest.id));
  await db.update(userTable).set({ password: hashedPassword }).where(eq(userTable.id, user.id));
  return c.json({
    message: "Password reset successful"
  });
});
auth.get("/username/suggest", async (c) => {
  const base = c.req.query("base") || "user";
  const db = getDrizzle(c.env.DB);
  const suggestions = [];
  for (let i = 0; i < 6; i++) {
    const letters = Math.random().toString(36).substring(2, 4);
    const numbers = Math.floor(100 + Math.random() * 900);
    suggestions.push(`${base.toLowerCase()}${letters}${numbers}`);
  }
  return c.json({
    suggestions
  });
});
auth.post("/logout", authMiddleware, async (c) => {
  return c.json({ message: "Logged out successfully" });
});
auth.post("/refresh", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const token = await generateToken(userId, c.env.JWT_SECRET);
  return c.json({ token });
});
auth.post("/google", async (c) => {
  const body = await c.req.json();
  const { email, firstName, lastName, idToken } = body;
  if (!email || !idToken) {
    return c.json({ error: "Email and idToken are required" }, 400);
  }
  try {
    const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
    const { payload } = await jwtVerify(idToken, JWKS, {
      issuer: ["https://accounts.google.com", "accounts.google.com"]
    });
    if (payload.email !== email) {
      return c.json({ error: "Token email mismatch" }, 401);
    }
  } catch (err2) {
    return c.json({ error: "Invalid Google idToken" }, 401);
  }
  const db = getDrizzle(c.env.DB);
  let user = await db.query.user.findFirst({ where: (u, { eq }) => eq(u.email, email) });
  let isNewUser = false;
  if (!user) {
    isNewUser = true;
    const userArr = await db.insert(userTable).values({ id: crypto.randomUUID(), email, firstName, lastName, isGuest: false }).returning();
    user = userArr[0];
  }
  const token = await generateToken(user.id, c.env.JWT_SECRET);
  return c.json({ token, user, isNewUser });
});
auth.post("/apple", async (c) => {
  const body = await c.req.json();
  const { identityToken } = body;
  if (!identityToken) {
    return c.json({ error: "identityToken is required" }, 400);
  }
  let verifiedEmail: string;
  try {
    const JWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));
    const { payload } = await jwtVerify(identityToken, JWKS, {
      issuer: "https://appleid.apple.com"
    });
    if (!payload.email) {
      return c.json({ error: "No email found in token" }, 400);
    }
    verifiedEmail = payload.email as string;
  } catch (err2) {
    return c.json({ error: "Invalid Apple identityToken" }, 401);
  }
  const db = getDrizzle(c.env.DB);
  let user = await db.query.user.findFirst({
    where: (u, { eq }) => eq(u.email, verifiedEmail)
  });
  let isNewUser = false;
  if (!user) {
    isNewUser = true;
    const userArr = await db.insert(userTable).values({ id: crypto.randomUUID(), email: verifiedEmail, isGuest: false }).returning();
    user = userArr[0];
  }
  const token = await generateToken(user.id, c.env.JWT_SECRET);
  return c.json({ token, user, isNewUser });
});


export default auth;
