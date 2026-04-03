"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mealsService = exports.MealsService = void 0;
const prisma_service_1 = require("../prisma/prisma.service");
class MealsService {
    async create(chefId, data) {
        const chef = await prisma_service_1.prisma.chef.findUnique({ where: { id: chefId } });
        if (!chef) {
            const error = new Error('Chef profile not found');
            error.status = 404;
            throw error;
        }
        return prisma_service_1.prisma.dailyMeal.create({
            data: {
                ...data,
                chef_id: chefId,
                slots_remaining: data.slots_total,
            },
        });
    }
    async findAll(query) {
        const { date, chefId } = query;
        return prisma_service_1.prisma.dailyMeal.findMany({
            where: {
                chef_id: chefId,
                date: date ? new Date(date) : undefined,
            },
            include: {
                chef: {
                    include: {
                        user: {
                            select: { name: true, email: true },
                        },
                    },
                },
            },
        });
    }
    async findOne(id) {
        const meal = await prisma_service_1.prisma.dailyMeal.findUnique({
            where: { id },
            include: { chef: true },
        });
        if (!meal) {
            const error = new Error('Meal not found');
            error.status = 404;
            throw error;
        }
        return meal;
    }
    async update(id, chefId, data) {
        const meal = await this.findOne(id);
        if (!meal) {
            const error = new Error('Meal not found');
            error.status = 404;
            throw error;
        }
        if (meal.chef_id !== chefId) {
            const error = new Error('You can only update your own meals');
            error.status = 403;
            throw error;
        }
        if (data.slots_total && typeof data.slots_total === 'number') {
            const diff = data.slots_total - meal.slots_total;
            data.slots_remaining = meal.slots_remaining + diff;
        }
        return prisma_service_1.prisma.dailyMeal.update({
            where: { id },
            data,
        });
    }
    async remove(id, chefId) {
        const meal = await this.findOne(id);
        if (!meal || meal.chef_id !== chefId) {
            const error = new Error('You can only delete your own meals');
            error.status = 403;
            throw error;
        }
        await prisma_service_1.prisma.dailyMeal.delete({ where: { id } });
    }
}
exports.MealsService = MealsService;
exports.mealsService = new MealsService();
//# sourceMappingURL=meals.service.js.map