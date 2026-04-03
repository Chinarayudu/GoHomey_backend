"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_service_1 = require("./auth.service");
const validation_middleware_1 = require("../common/middleware/validation.middleware");
const auth_dto_1 = require("./dto/auth.dto");
const auth_middleware_1 = require("../common/middleware/auth.middleware");
const authRouter = (0, express_1.Router)();
authRouter.post('/register', (0, validation_middleware_1.validationMiddleware)(auth_dto_1.RegisterDto), async (req, res, next) => {
    try {
        const result = await auth_service_1.authService.register(req.body);
        res.status(201).json(result);
    }
    catch (error) {
        next(error);
    }
});
authRouter.post('/login', (0, validation_middleware_1.validationMiddleware)(auth_dto_1.LoginDto), async (req, res, next) => {
    try {
        const user = await auth_service_1.authService.validateUser(req.body.email, req.body.password);
        if (!user) {
            return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
        }
        const result = await auth_service_1.authService.login(user);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
authRouter.get('/profile', auth_middleware_1.jwtAuth, (req, res) => {
    res.json(req.user);
});
authRouter.post('/send-otp', (0, validation_middleware_1.validationMiddleware)(auth_dto_1.SendOtpDto), async (req, res, next) => {
    try {
        const result = await auth_service_1.authService.sendOtp(req.body.phone);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
authRouter.post('/verify-otp', (0, validation_middleware_1.validationMiddleware)(auth_dto_1.VerifyOtpDto), async (req, res, next) => {
    try {
        const result = await auth_service_1.authService.verifyOtp(req.body.phone, req.body.otp);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
exports.default = authRouter;
//# sourceMappingURL=auth.router.js.map