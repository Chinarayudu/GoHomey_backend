"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const admin_service_1 = require("./admin.service");
const auth_middleware_1 = require("../common/middleware/auth.middleware");
const client_1 = require("@prisma/client");
const adminRouter = (0, express_1.Router)();
adminRouter.use(auth_middleware_1.jwtAuth, (0, auth_middleware_1.checkRoles)(client_1.Role.ADMIN));
adminRouter.get('/stats', async (req, res, next) => {
    try {
        const result = await admin_service_1.adminService.getPlatformStats();
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
adminRouter.get('/top-chefs', async (req, res, next) => {
    try {
        const result = await admin_service_1.adminService.getTopChefs();
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
adminRouter.get('/revenue/daily', async (req, res, next) => {
    try {
        const result = await admin_service_1.adminService.getDailyRevenue();
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
exports.default = adminRouter;
//# sourceMappingURL=admin.router.js.map