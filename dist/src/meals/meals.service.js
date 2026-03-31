"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MealsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let MealsService = class MealsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(chefId, data) {
        const chef = await this.prisma.chef.findUnique({ where: { id: chefId } });
        if (!chef) {
            throw new common_1.NotFoundException('Chef profile not found');
        }
        return this.prisma.dailyMeal.create({
            data: {
                ...data,
                chef_id: chefId,
                slots_remaining: data.slots_total,
            },
        });
    }
    async findAll(query) {
        const { date, chefId } = query;
        return this.prisma.dailyMeal.findMany({
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
        const meal = await this.prisma.dailyMeal.findUnique({
            where: { id },
            include: { chef: true },
        });
        if (!meal) {
            throw new common_1.NotFoundException('Meal not found');
        }
        return meal;
    }
    async update(id, chefId, data) {
        const meal = await this.findOne(id);
        if (!meal) {
            throw new common_1.NotFoundException('Meal not found');
        }
        if (meal.chef_id !== chefId) {
            throw new common_1.ForbiddenException('You can only update your own meals');
        }
        if (data.slots_total && typeof data.slots_total === 'number') {
            const diff = data.slots_total - meal.slots_total;
            data.slots_remaining = meal.slots_remaining + diff;
        }
        return this.prisma.dailyMeal.update({
            where: { id },
            data,
        });
    }
    async remove(id, chefId) {
        const meal = await this.findOne(id);
        if (!meal || meal.chef_id !== chefId) {
            throw new common_1.ForbiddenException('You can only delete your own meals');
        }
        await this.prisma.dailyMeal.delete({ where: { id } });
    }
};
exports.MealsService = MealsService;
exports.MealsService = MealsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], MealsService);
//# sourceMappingURL=meals.service.js.map