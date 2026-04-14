"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const chefs_service_1 = require("./chefs.service");
const auth_middleware_1 = require("../common/middleware/auth.middleware");
const validation_middleware_1 = require("../common/middleware/validation.middleware");
const chef_register_dto_1 = require("./dto/chef-register.dto");
const upload_middleware_1 = require("../common/middleware/upload.middleware");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const chefsRouter = (0, express_1.Router)();
chefsRouter.post('/register/step-1', auth_middleware_1.jwtAuth, (0, validation_middleware_1.validationMiddleware)(chef_register_dto_1.ChefRegisterStep1Dto), async (req, res, next) => {
    try {
        const userId = req.user.id;
        const result = await chefs_service_1.chefsService.registerStep1(userId, req.body);
        res.status(201).json({
            status: 'success',
            message: 'Step 1 completed. Proceed to Step 2.',
            data: result,
        });
    }
    catch (error) {
        next(error);
    }
});
chefsRouter.post('/register/step-2', auth_middleware_1.jwtAuth, (0, validation_middleware_1.validationMiddleware)(chef_register_dto_1.ChefRegisterStep2Dto), async (req, res, next) => {
    try {
        const user = req.user;
        const result = await chefs_service_1.chefsService.registerStep2(user.id, req.body, user.phone);
        res.status(200).json({
            status: 'success',
            message: 'Step 2 completed. Proceed to Step 3.',
            data: result,
        });
    }
    catch (error) {
        next(error);
    }
});
chefsRouter.post('/register/step-3', auth_middleware_1.jwtAuth, upload_middleware_1.chefDocumentUpload.fields([
    { name: 'government_id', maxCount: 1 },
    { name: 'food_safety_cert', maxCount: 1 },
    { name: 'kitchen_photo', maxCount: 1 },
]), async (req, res, next) => {
    try {
        const user = req.user;
        const files = req.files;
        if (!files?.government_id?.[0] || !files?.food_safety_cert?.[0] || !files?.kitchen_photo?.[0]) {
            return res.status(400).json({
                status: 'error',
                message: 'All three documents are required: government_id, food_safety_cert, kitchen_photo',
            });
        }
        const fileUrls = {
            government_id_url: `/uploads/chef-documents/${files.government_id[0].filename}`,
            food_safety_cert_url: `/uploads/chef-documents/${files.food_safety_cert[0].filename}`,
            kitchen_photo_url: `/uploads/chef-documents/${files.kitchen_photo[0].filename}`,
        };
        const result = await chefs_service_1.chefsService.registerStep3(user.id, fileUrls, user.phone);
        res.status(200).json({
            status: 'success',
            message: 'Application submitted! Our concierge team will review your documents within 24 hours.',
            data: result,
        });
    }
    catch (error) {
        next(error);
    }
});
chefsRouter.get('/register/status', auth_middleware_1.jwtAuth, async (req, res, next) => {
    try {
        const user = req.user;
        const result = await chefs_service_1.chefsService.getRegistrationStatus(user.id, user.phone);
        res.json({
            status: 'success',
            data: result,
        });
    }
    catch (error) {
        next(error);
    }
});
chefsRouter.get('/dashboard', auth_middleware_1.jwtAuth, (0, auth_middleware_1.checkRoles)(client_1.Role.CHEF), async (req, res, next) => {
    try {
        const user = req.user;
        const chef = await prisma_service_1.prisma.chef.findFirst({
            where: {
                OR: [
                    { id: user.id },
                    { user_id: user.id }
                ]
            }
        });
        if (!chef) {
            return res.status(403).json({ status: 'error', message: 'Chef profile not found' });
        }
        const dashboardData = await chefs_service_1.chefsService.getDashboardData(chef.id);
        res.json({
            status: 'success',
            data: dashboardData,
        });
    }
    catch (error) {
        next(error);
    }
});
chefsRouter.get('/profile', auth_middleware_1.jwtAuth, (0, auth_middleware_1.checkRoles)(client_1.Role.CHEF), async (req, res, next) => {
    try {
        const user = req.user;
        const chef = await prisma_service_1.prisma.chef.findFirst({
            where: {
                OR: [
                    { id: user.id },
                    { user_id: user.id }
                ]
            }
        });
        if (!chef) {
            return res.status(403).json({ status: 'error', message: 'Chef profile not found' });
        }
        const profile = await chefs_service_1.chefsService.getProfile(chef.id);
        res.json({
            status: 'success',
            data: profile,
        });
    }
    catch (error) {
        next(error);
    }
});
chefsRouter.patch('/profile', auth_middleware_1.jwtAuth, (0, auth_middleware_1.checkRoles)(client_1.Role.CHEF), async (req, res, next) => {
    try {
        const user = req.user;
        const chef = await prisma_service_1.prisma.chef.findFirst({
            where: {
                OR: [
                    { id: user.id },
                    { user_id: user.id }
                ]
            }
        });
        if (!chef) {
            return res.status(403).json({ status: 'error', message: 'Chef profile not found' });
        }
        const result = await chefs_service_1.chefsService.updateProfile(chef.id, req.body);
        res.json({
            status: 'success',
            message: 'Profile updated successfully',
            data: result,
        });
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
chefsRouter.patch('/:id/application-status', auth_middleware_1.jwtAuth, (0, auth_middleware_1.checkRoles)(client_1.Role.ADMIN), async (req, res, next) => {
    try {
        const result = await chefs_service_1.chefsService.updateApplicationStatus(req.params.id, req.body.status);
        res.json({
            status: 'success',
            message: `Application status updated to ${req.body.status}`,
            data: result,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = chefsRouter;
//# sourceMappingURL=chefs.router.js.map