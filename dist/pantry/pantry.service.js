"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pantryService = exports.PantryService = void 0;
const prisma_service_1 = require("../prisma/prisma.service");
class PantryService {
    async create(chefId, data) {
        const chef = await prisma_service_1.prisma.chef.findUnique({ where: { id: chefId } });
        if (!chef) {
            const error = new Error('Chef profile not found');
            error.status = 404;
            throw error;
        }
        return prisma_service_1.prisma.pantryItem.create({
            data: {
                ...data,
                chef_id: chefId,
            },
        });
    }
    async findAll(query) {
        const { category, chefId } = query;
        return prisma_service_1.prisma.pantryItem.findMany({
            where: {
                chef_id: chefId,
                category: category,
            },
            include: {
                chef: {
                    include: {
                        user: {
                            select: { name: true },
                        },
                    },
                },
            },
        });
    }
    async findOne(id) {
        const item = await prisma_service_1.prisma.pantryItem.findUnique({
            where: { id },
            include: { chef: true },
        });
        if (!item) {
            const error = new Error('Pantry item not found');
            error.status = 404;
            throw error;
        }
        return item;
    }
    async update(id, chefId, data) {
        const item = await this.findOne(id);
        if (!item) {
            const error = new Error('Pantry item not found');
            error.status = 404;
            throw error;
        }
        if (item.chef_id !== chefId) {
            const error = new Error('You can only update your own items');
            error.status = 403;
            throw error;
        }
        return prisma_service_1.prisma.pantryItem.update({
            where: { id },
            data,
        });
    }
    async remove(id, chefId) {
        const item = await this.findOne(id);
        if (!item || item.chef_id !== chefId) {
            const error = new Error('You can only delete your own items');
            error.status = 403;
            throw error;
        }
        await prisma_service_1.prisma.pantryItem.delete({ where: { id } });
    }
}
exports.PantryService = PantryService;
exports.pantryService = new PantryService();
//# sourceMappingURL=pantry.service.js.map