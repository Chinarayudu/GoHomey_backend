"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const chefs_service_1 = require("./chefs.service");
const auth_middleware_1 = require("../common/middleware/auth.middleware");
const client_1 = require("@prisma/client");
const chefsRouter = (0, express_1.Router)();
chefsRouter.post('/apply', auth_middleware_1.jwtAuth, async (req, res, next) => {
    try {
        const { bio } = req.body;
        const result = await chefs_service_1.chefsService.create(req.user.id, bio);
        res.status(201).json(result);
    }
    catch (error) {
        next(error);
    }
});
chefsRouter.get('/', async (req, res, next) => {
    try {
        const result = await chefs_service_1.chefsService.findAll();
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
chefsRouter.get('/:id', async (req, res, next) => {
    try {
        const result = await chefs_service_1.chefsService.findOne(req.params.id);
        if (!result) {
            return res.status(404).json({ status: 'error', message: 'Chef not found' });
        }
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
chefsRouter.patch('/:id/verify', auth_middleware_1.jwtAuth, (0, auth_middleware_1.checkRoles)(client_1.Role.ADMIN), async (req, res, next) => {
    try {
        const { is_verified, trust_tier } = req.body;
        const result = await chefs_service_1.chefsService.verifyChef(req.params.id, is_verified, trust_tier);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
exports.default = chefsRouter;
//# sourceMappingURL=chefs.router.js.map