"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const payments_service_1 = require("./payments.service");
const auth_middleware_1 = require("../common/middleware/auth.middleware");
const paymentsRouter = (0, express_1.Router)();
paymentsRouter.post('/create', auth_middleware_1.jwtAuth, async (req, res, next) => {
    try {
        const { orderId } = req.body;
        const result = await payments_service_1.paymentsService.createPayment(orderId);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
paymentsRouter.post('/verify', async (req, res, next) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        const result = await payments_service_1.paymentsService.verifyPayment(razorpay_order_id, razorpay_payment_id, razorpay_signature);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
exports.default = paymentsRouter;
//# sourceMappingURL=payments.router.js.map