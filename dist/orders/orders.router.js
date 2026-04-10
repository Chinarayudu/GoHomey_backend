"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const orders_service_1 = require("./orders.service");
const validation_middleware_1 = require("../common/middleware/validation.middleware");
const orders_dto_1 = require("./dto/orders.dto");
const auth_middleware_1 = require("../common/middleware/auth.middleware");
const client_1 = require("@prisma/client");
const ordersRouter = (0, express_1.Router)();
ordersRouter.post('/meal', auth_middleware_1.jwtAuth, (0, validation_middleware_1.validationMiddleware)(orders_dto_1.CreateMealOrderDto), async (req, res, next) => {
    try {
        const result = await orders_service_1.ordersService.createDailyMealOrder(req.user.id, req.body.mealId, req.body.quantity);
        res.status(201).json(result);
    }
    catch (error) {
        next(error);
    }
});
ordersRouter.post('/pantry', auth_middleware_1.jwtAuth, (0, validation_middleware_1.validationMiddleware)(orders_dto_1.CreatePantryOrderDto), async (req, res, next) => {
    try {
        const result = await orders_service_1.ordersService.createPantryOrder(req.user.id, req.body.itemId, req.body.quantity);
        res.status(201).json(result);
    }
    catch (error) {
        next(error);
    }
});
ordersRouter.get('/user', auth_middleware_1.jwtAuth, async (req, res, next) => {
    try {
        const result = await orders_service_1.ordersService.findUserOrders(req.user.id);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
ordersRouter.get('/chef', auth_middleware_1.jwtAuth, (0, auth_middleware_1.checkRoles)(client_1.Role.CHEF), async (req, res, next) => {
    try {
        const result = await orders_service_1.ordersService.findChefOrders(req.user.id);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
ordersRouter.patch('/:id/status', auth_middleware_1.jwtAuth, (0, auth_middleware_1.checkRoles)(client_1.Role.CHEF, client_1.Role.ADMIN), (0, validation_middleware_1.validationMiddleware)(orders_dto_1.UpdateOrderStatusDto), async (req, res, next) => {
    try {
        const result = await orders_service_1.ordersService.updateOrderStatus(req.params.id, req.body.status);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
exports.default = ordersRouter;
//# sourceMappingURL=orders.router.js.map