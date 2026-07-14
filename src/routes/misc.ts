import { Hono } from 'hono';
import { getPrisma } from '../utils/prisma';
import { authMiddleware } from '../middleware/auth';
import { adminAuthMiddleware } from '../middleware/adminAuth';
import admin from 'firebase-admin';

// src/routes/misc.ts
import { Bindings, Variables } from '../types';
var misc = new Hono<{Bindings: Bindings, Variables: Variables}>();
misc.get("/countries", (c) => {
  return c.json([
    { code: "NG", name: "Nigeria", dialCode: "+234", flag: "\u{1F1F3}\u{1F1EC}" },
    { code: "US", name: "United States", dialCode: "+1", flag: "\u{1F1FA}\u{1F1F8}" },
    { code: "GB", name: "United Kingdom", dialCode: "+44", flag: "\u{1F1EC}\u{1F1E7}" },
    { code: "GH", name: "Ghana", dialCode: "+233", flag: "\u{1F1EC}\u{1F1ED}" },
    { code: "CA", name: "Canada", dialCode: "+1", flag: "\u{1F1E8}\u{1F1E6}" }
  ]);
});
misc.get("/feelings/metadata", (c) => {
  return c.json([
    { id: "sad", feeling: "Sad", emoji: "\u{1F614}" },
    { id: "anxious", feeling: "Anxious", emoji: "\u{1F630}" },
    { id: "hopeful", feeling: "Hopeful", emoji: "\u{1F31F}" },
    { id: "thankful", feeling: "Thankful", emoji: "\u{1F64F}" },
    { id: "peaceful", feeling: "Peaceful", emoji: "\u{1F54A}\uFE0F" },
    { id: "blessed", feeling: "Blessed", emoji: "\u{1F64F}" },
    { id: "joyful", feeling: "Joyful", emoji: "\u{1F60A}" }
  ]);
});
misc.get("/onboarding/options", (c) => {
  return c.json({
    genders: [
      { id: "male", name: "Male" },
      { id: "female", name: "Female" },
      { id: "other", name: "Prefer not to say" }
    ]
  });
});
misc.get("/features", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const features = await prisma.appFeature.findMany();
  const featureMap = features.reduce(
    (acc: any, feature: any) => {
      acc[feature.key] = feature.isEnabled;
      return acc;
    },
    {}
  );
  return c.json(featureMap);
});


export default misc;
