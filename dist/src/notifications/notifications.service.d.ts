export declare class NotificationsService {
    private readonly logger;
    sendPushNotification(userId: string, title: string, body: string, data?: any): Promise<{
        success: boolean;
    }>;
    sendOrderNotificationToChef(chefId: string, orderId: string): Promise<{
        success: boolean;
    }>;
    sendOrderStatusUpdateToUser(userId: string, orderId: string, status: string): Promise<{
        success: boolean;
    }>;
}
