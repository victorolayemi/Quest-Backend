import { FCMService } from "./fcm";
import { notification as notificationTable, user as userTable } from "../db/schema";
import { eq } from "drizzle-orm";

export async function dispatchNotification({
  prisma,
  db,
  userId,
  title,
  message: message2,
  type,
  pushSettingKey,
  fcm,
  data,
  logInDb = true
}: {
  prisma?: any;
  db?: any;
  userId: string;
  title: string;
  message: string;
  type: string;
  pushSettingKey?: string;
  fcm: FCMService;
  data?: any;
  logInDb?: boolean;
}) {
  try {
    let user: any;
    if (db) {
      const userArr = await db.select({
        fcmToken: userTable.fcmToken,
        allNotifications: userTable.allNotifications,
        inAppNotifications: userTable.inAppNotifications,
        pushDirectMessages: userTable.pushDirectMessages,
        pushCommunityPosts: userTable.pushCommunityPosts,
        pushCommunityForum: userTable.pushCommunityForum,
        pushConnectionRequests: userTable.pushConnectionRequests,
        pushConnectionAccepted: userTable.pushConnectionAccepted,
         
      }).from(userTable).where(eq(userTable.id, userId));
      user = userArr[0];
    } else {
      user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          fcmToken: true,
          allNotifications: true,
          inAppNotifications: true,
          pushDirectMessages: true,
          pushCommunityPosts: true,
          pushCommunityForum: true,
          pushConnectionRequests: true,
          pushConnectionAccepted: true,
           
        }
      });
    }

    if (!user || !user.allNotifications) return;

    if (user.inAppNotifications && logInDb) {
      if (db) {
        await db.insert(notificationTable).values({
          id: crypto.randomUUID(),
          userId,
          title,
          message: message2,
          type
        });
      } else {
        await prisma.notification.create({
          data: {
            userId,
            title,
            message: message2,
            type
          }
        });
      }
    }

    let shouldPush = false;
    if (pushSettingKey) {
      shouldPush = user[pushSettingKey] === true;
    } else {
      shouldPush = true;
    }

    if (shouldPush && user.fcmToken) {
      await fcm.sendNotification({
        token: user.fcmToken,
        notification: {
          title,
          body: message2
        },
        data
      });
    }
  } catch (error) {
    console.error(`Failed to dispatch notification [${type}] to user ${userId}:`, error);
  }
}
