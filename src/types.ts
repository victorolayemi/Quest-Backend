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
  APPLE_SHARED_SECRET?: string;
  GOOGLE_SERVICE_ACCOUNT_JSON?: string;
  ANDROID_PACKAGE_NAME?: string;
};

export type Variables = {
  userId: string;
};
