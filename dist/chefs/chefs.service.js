"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chefsService = exports.ChefsService = void 0;
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
class ChefsService {
    async create(userId, bio) {
        const user = await prisma_service_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            const error = new Error('User not found');
            error.status = 404;
            throw error;
        }
        const existingChef = await prisma_service_1.prisma.chef.findFirst({
            where: { user_id: userId },
        });
        if (existingChef) {
            const error = new Error('Chef profile already exists for this user');
            error.status = 409;
            throw error;
        }
        await prisma_service_1.prisma.user.update({
            where: { id: userId },
            data: { role: client_1.Role.CHEF },
        });
        return prisma_service_1.prisma.chef.create({
            data: {
                user_id: userId,
                bio,
                is_verified: false,
                trust_tier: 1,
            },
        });
    }
    async findOne(id) {
        return prisma_service_1.prisma.chef.findUnique({
            where: { id },
            include: { user: true },
        });
    }
    async findAll() {
        return prisma_service_1.prisma.chef.findMany({
            include: { user: true },
        });
    }
    async verifyChef(id, isVerified, trustTier) {
        return prisma_service_1.prisma.chef.update({
            where: { id },
            data: {
                is_verified: isVerified,
                trust_tier: trustTier !== undefined ? trustTier : undefined,
            },
        });
    }
    async updateChef(id, data) {
        return prisma_service_1.prisma.chef.update({
            where: { id },
            data,
        });
    }
}
exports.ChefsService = ChefsService;
exports.chefsService = new ChefsService();
//# sourceMappingURL=chefs.service.js.map