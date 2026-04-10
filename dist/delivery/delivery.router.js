"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const delivery_service_1 = require("./delivery.service");
const auth_middleware_1 = require("../common/middleware/auth.middleware");
const client_1 = require("@prisma/client");
const deliveryRouter = (0, express_1.Router)();
deliveryRouter.post('/process-batch', auth_middleware_1.jwtAuth, (0, auth_middleware_1.checkRoles)(client_1.Role.ADMIN), async (req, res, next) => {
    try {
        const result = await delivery_service_1.deliveryService.processBatchedDeliveries();
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
deliveryRouter.get('/active', auth_middleware_1.jwtAuth, async (req, res, next) => {
    try {
        const result = await delivery_service_1.deliveryService.findActiveDeliveries();
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
deliveryRouter.patch('/:id/status', auth_middleware_1.jwtAuth, async (req, res, next) => {
    try {
        const result = await delivery_service_1.deliveryService.updateDeliveryStatus(req.params.id, req.body.status);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
exports.default = deliveryRouter;
//# sourceMappingURL=delivery.router.js.map