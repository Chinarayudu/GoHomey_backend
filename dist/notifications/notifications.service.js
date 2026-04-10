"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationsService = exports.NotificationsService = void 0;
class NotificationsService {
    async sendPushNotification(userId, title, body, data) {
        console.log(`Sending push notification to user ${userId}: ${title} - ${body}`);
        return { success: true };
    }
    async sendOrderNotificationToChef(chefId, orderId) {
        console.log(`Sending order notification to chef ${chefId} for order ${orderId}`);
        return this.sendPushNotification(chefId, 'New Order Received!', `You have a new order #${orderId.substring(0, 8)}. Check your dashboard.`, { orderId });
    }
    async sendOrderStatusUpdateToUser(userId, orderId, status) {
        console.log(`Sending order status update to user ${userId} for order ${orderId}: ${status}`);
        return this.sendPushNotification(userId, 'Order Status Updated', `Your order #${orderId.substring(0, 8)} is now ${status.toLowerCase().replace('_', ' ')}.`, { orderId, status });
    }
}
exports.NotificationsService = NotificationsService;
exports.notificationsService = new NotificationsService();
//# sourceMappingURL=notifications.service.js.map