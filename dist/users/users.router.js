"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const users_service_1 = require("./users.service");
const validation_middleware_1 = require("../common/middleware/validation.middleware");
const users_dto_1 = require("./dto/users.dto");
const auth_middleware_1 = require("../common/middleware/auth.middleware");
const client_1 = require("@prisma/client");
const usersRouter = (0, express_1.Router)();
usersRouter.get('/profile', auth_middleware_1.jwtAuth, async (req, res, next) => {
    try {
        const user = await users_service_1.usersService.findOneWithChef({ id: req.user.id });
        res.json(user);
    }
    catch (error) {
        next(error);
    }
});
usersRouter.patch('/profile', auth_middleware_1.jwtAuth, (0, validation_middleware_1.validationMiddleware)(users_dto_1.UpdateUserDto), async (req, res, next) => {
    try {
        const result = await users_service_1.usersService.update({
            where: { id: req.user.id },
            data: req.body,
        });
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
usersRouter.get('/', auth_middleware_1.jwtAuth, (0, auth_middleware_1.checkRoles)(client_1.Role.ADMIN), (req, res) => {
    res.json({ message: 'Admin: list all users' });
});
exports.default = usersRouter;
//# sourceMappingURL=users.router.js.map