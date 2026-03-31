"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var NotificationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
let NotificationsService = NotificationsService_1 = class NotificationsService {
    logger = new common_1.Logger(NotificationsService_1.name);
    async sendPushNotification(userId, title, body, data) {
        this.logger.log(`Sending push notification to user ${userId}: ${title} - ${body}`);
        return { success: true };
    }
    async sendOrderNotificationToChef(chefId, orderId) {
        this.logger.log(`Sending order notification to chef ${chefId} for order ${orderId}`);
        return this.sendPushNotification(chefId, 'New Order Received!', `You have a new order #${orderId.substring(0, 8)}. Check your dashboard.`, { orderId });
    }
    async sendOrderStatusUpdateToUser(userId, orderId, status) {
        this.logger.log(`Sending order status update to user ${userId} for order ${orderId}: ${status}`);
        return this.sendPushNotification(userId, 'Order Status Updated', `Your order #${orderId.substring(0, 8)} is now ${status.toLowerCase().replace('_', ' ')}.`, { orderId, status });
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = NotificationsService_1 = __decorate([
    (0, common_1.Injectable)()
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map