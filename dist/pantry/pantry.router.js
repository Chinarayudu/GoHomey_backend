"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const pantry_service_1 = require("./pantry.service");
const validation_middleware_1 = require("../common/middleware/validation.middleware");
const pantry_dto_1 = require("./dto/pantry.dto");
const auth_middleware_1 = require("../common/middleware/auth.middleware");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const pantryRouter = (0, express_1.Router)();
pantryRouter.post('/', auth_middleware_1.jwtAuth, (0, auth_middleware_1.checkRoles)(client_1.Role.CHEF), (0, validation_middleware_1.validationMiddleware)(pantry_dto_1.CreatePantryDto), async (req, res, next) => {
    try {
        const userWithChef = await prisma_service_1.prisma.user.findUnique({
            where: { id: req.user.id },
            include: { chef: true },
        });
        if (!userWithChef?.chef) {
            return res.status(403).json({ status: 'error', message: 'User is not a chef' });
        }
        const result = await pantry_service_1.pantryService.create(userWithChef.chef.id, req.body);
        res.status(201).json(result);
    }
    catch (error) {
        next(error);
    }
});
pantryRouter.get('/', async (req, res, next) => {
    try {
        const { category, chefId } = req.query;
        const result = await pantry_service_1.pantryService.findAll({
            category: category,
            chefId: chefId,
        });
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
pantryRouter.get('/:id', async (req, res, next) => {
    try {
        const result = await pantry_service_1.pantryService.findOne(req.params.id);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
pantryRouter.patch('/:id', auth_middleware_1.jwtAuth, (0, auth_middleware_1.checkRoles)(client_1.Role.CHEF), (0, validation_middleware_1.validationMiddleware)(pantry_dto_1.UpdatePantryDto), async (req, res, next) => {
    try {
        const userWithChef = await prisma_service_1.prisma.user.findUnique({
            where: { id: req.user.id },
            include: { chef: true },
        });
        if (!userWithChef?.chef) {
            return res.status(403).json({ status: 'error', message: 'User is not a chef' });
        }
        const result = await pantry_service_1.pantryService.update(req.params.id, userWithChef.chef.id, req.body);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
pantryRouter.delete('/:id', auth_middleware_1.jwtAuth, (0, auth_middleware_1.checkRoles)(client_1.Role.CHEF), async (req, res, next) => {
    try {
        const userWithChef = await prisma_service_1.prisma.user.findUnique({
            where: { id: req.user.id },
            include: { chef: true },
        });
        if (!userWithChef?.chef) {
            return res.status(403).json({ status: 'error', message: 'User is not a chef' });
        }
        await pantry_service_1.pantryService.remove(req.params.id, userWithChef.chef.id);
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
exports.default = pantryRouter;
//# sourceMappingURL=pantry.router.js.map