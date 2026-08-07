export type Bindings = {
  DB: D1Database;
  MEDIA_BUCKET: R2Bucket;
  ASSETS: any;
  JWT_SECRET: string;
  FIREBASE_CLIENT_EMAIL: string;
  FIREBASE_PRIVATE_KEY: string;
  VITE_API_URL: string;
  TWILIO_ACCOUNT_SID: string;
  TWILIO_AUTH_TOKEN: string;
  TWILIO_PHONE_NUMBER: string;
  NOTIFICATION_QUEUE: Queue;
};

export type Variables = {
  userId: string;
};
