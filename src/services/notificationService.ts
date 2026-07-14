import { FCMService } from "./fcm";

export async function dispatchNotification({
  prisma,
  userId,
  title,
  message: message2,
  type,
  pushSettingKey,
  fcm,
  data
}: {
  prisma: any;
  userId: string;
  title: string;
  message: string;
  type: string;
  pushSettingKey?: string;
  fcm: FCMService;
  data?: any;
}) {
  try {
    const user: any = await prisma.user.findUnique({
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
        pushChallengeUpdates: true
      }
    });
    if (!user || !user.allNotifications) return;
    if (user.inAppNotifications) {
      await prisma.notification.create({
        data: {
          userId,
          title,
          message: message2,
          type
        }
      });
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
