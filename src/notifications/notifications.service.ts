import { prisma } from '../prisma/prisma.service';

export class NotificationsService {
  async registerDeviceToken(userId: string, token: string, platform?: string) {
    if (!token?.trim()) {
      const error: any = new Error('Push token is required');
      error.status = 400;
      throw error;
    }

    return prisma.devicePushToken.upsert({
      where: { token: token.trim() },
      update: {
        user_id: userId,
        platform,
        is_active: true,
      },
      create: {
        user_id: userId,
        token: token.trim(),
        platform,
      },
    });
  }

  private async sendExpoPush(token: string, title: string, body: string, data?: any) {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: token,
        title,
        body,
        data,
        sound: 'default',
      }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('[Expo Push Error]:', result);
      return { success: false, result };
    }

    return { success: true, result };
  }

  async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    data?: any,
  ) {
    const tokens = await prisma.devicePushToken.findMany({
      where: {
        user_id: userId,
        is_active: true,
      },
    });

    if (tokens.length === 0) {
      console.log(
        `[Mock Push] User ${userId}: ${title} - ${body}`,
      );
      return { success: true, delivered: 0, mocked: true };
    }

    const results: any[] = [];
    for (const token of tokens) {
      if (token.token.startsWith('ExponentPushToken')) {
        results.push(await this.sendExpoPush(token.token, title, body, data));
      } else {
        console.log(`[Unsupported Push Token] ${token.platform || 'unknown'} token stored for user ${userId}`);
        results.push({ success: false, reason: 'Unsupported push token type' });
      }
    }

    return {
      success: results.some((result) => result.success),
      delivered: results.filter((result) => result.success).length,
      results,
    };
  }

  async sendOrderNotificationToChef(chefId: string, orderId: string) {
    console.log(
      `Sending order notification to chef ${chefId} for order ${orderId}`,
    );
    return this.sendPushNotification(
      chefId,
      'New Order Received!',
      `You have a new order #${orderId.substring(0, 8)}. Check your dashboard.`,
      { orderId },
    );
  }

  async sendOrderStatusUpdateToUser(
    userId: string,
    orderId: string,
    status: string,
  ) {
    console.log(
      `Sending order status update to user ${userId} for order ${orderId}: ${status}`,
    );
    return this.sendPushNotification(
      userId,
      'Order Status Updated',
      `Your order #${orderId.substring(0, 8)} is now ${status.toLowerCase().replace('_', ' ')}.`,
      { orderId, status },
    );
  }
}

export const notificationsService = new NotificationsService();
