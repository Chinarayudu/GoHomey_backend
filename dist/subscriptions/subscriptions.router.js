"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const subscriptions_service_1 = require("./subscriptions.service");
const validation_middleware_1 = require("../common/middleware/validation.middleware");
const subscriptions_dto_1 = require("./dto/subscriptions.dto");
const auth_middleware_1 = require("../common/middleware/auth.middleware");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const subscriptionsRouter = (0, express_1.Router)();
subscriptionsRouter.post('/plans', auth_middleware_1.jwtAuth, (0, auth_middleware_1.checkRoles)(client_1.Role.ADMIN), (0, validation_middleware_1.validationMiddleware)(subscriptions_dto_1.CreatePlanDto), async (req, res, next) => {
    try {
        const result = await subscriptions_service_1.subscriptionsService.createPlan(req.body);
        res.status(201).json(result);
    }
    catch (error) {
        next(error);
    }
});
subscriptionsRouter.get('/plans', async (req, res, next) => {
    try {
        const result = await subscriptions_service_1.subscriptionsService.findAllPlans();
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
subscriptionsRouter.get('/plans/:id', async (req, res, next) => {
    try {
        const result = await subscriptions_service_1.subscriptionsService.findOnePlan(req.params.id);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
subscriptionsRouter.post('/slots', auth_middleware_1.jwtAuth, (0, auth_middleware_1.checkRoles)(client_1.Role.CHEF), (0, validation_middleware_1.validationMiddleware)(subscriptions_dto_1.CreateSlotDto), async (req, res, next) => {
    try {
        const userWithChef = await prisma_service_1.prisma.user.findUnique({
            where: { id: req.user.id },
            include: { chef: true },
        });
        if (!userWithChef?.chef) {
            return res.status(403).json({ status: 'error', message: 'User is not a chef' });
        }
        const result = await subscriptions_service_1.subscriptionsService.createSlot(userWithChef.chef.id, req.body);
        res.status(201).json(result);
    }
    catch (error) {
        next(error);
    }
});
subscriptionsRouter.get('/slots/chef/:chefId', async (req, res, next) => {
    try {
        const result = await subscriptions_service_1.subscriptionsService.findSlotsByChef(req.params.chefId);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
exports.default = subscriptionsRouter;
//# sourceMappingURL=subscriptions.router.js.map