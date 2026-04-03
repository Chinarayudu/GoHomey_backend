"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const meals_service_1 = require("./meals.service");
const auth_middleware_1 = require("../common/middleware/auth.middleware");
const client_1 = require("@prisma/client");
const mealsRouter = (0, express_1.Router)();
mealsRouter.post('/', auth_middleware_1.jwtAuth, (0, auth_middleware_1.checkRoles)(client_1.Role.CHEF, client_1.Role.ADMIN), async (req, res, next) => {
    try {
        const userWithChef = await prisma_service_1.prisma.user.findUnique({
            where: { id: req.user.id },
            include: { chef: true }
        });
        if (!userWithChef?.chef) {
            return res.status(403).json({ status: 'error', message: 'User is not a chef' });
        }
        const result = await meals_service_1.mealsService.create(userWithChef.chef.id, req.body);
        res.status(201).json(result);
    }
    catch (error) {
        next(error);
    }
});
mealsRouter.get('/', async (req, res, next) => {
    try {
        const { date, chefId } = req.query;
        const result = await meals_service_1.mealsService.findAll({
            date: date,
            chefId: chefId,
        });
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
mealsRouter.get('/:id', async (req, res, next) => {
    try {
        const result = await meals_service_1.mealsService.findOne(req.params.id);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
mealsRouter.patch('/:id', auth_middleware_1.jwtAuth, (0, auth_middleware_1.checkRoles)(client_1.Role.CHEF, client_1.Role.ADMIN), async (req, res, next) => {
    try {
        const userWithChef = await prisma_service_1.prisma.user.findUnique({
            where: { id: req.user.id },
            include: { chef: true }
        });
        if (!userWithChef?.chef) {
            return res.status(403).json({ status: 'error', message: 'User is not a chef' });
        }
        const result = await meals_service_1.mealsService.update(req.params.id, userWithChef.chef.id, req.body);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
mealsRouter.delete('/:id', auth_middleware_1.jwtAuth, (0, auth_middleware_1.checkRoles)(client_1.Role.CHEF, client_1.Role.ADMIN), async (req, res, next) => {
    try {
        const userWithChef = await prisma_service_1.prisma.user.findUnique({
            where: { id: req.user.id },
            include: { chef: true }
        });
        if (!userWithChef?.chef) {
            return res.status(403).json({ status: 'error', message: 'User is not a chef' });
        }
        await meals_service_1.mealsService.remove(req.params.id, userWithChef.chef.id);
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
exports.default = mealsRouter;
const prisma_service_1 = require("../prisma/prisma.service");
//# sourceMappingURL=meals.router.js.map