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
exports.PantryService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let PantryService = class PantryService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(chefId, data) {
        const chef = await this.prisma.chef.findUnique({ where: { id: chefId } });
        if (!chef) {
            throw new common_1.NotFoundException('Chef profile not found');
        }
        return this.prisma.pantryItem.create({
            data: {
                ...data,
                chef_id: chefId,
            },
        });
    }
    async findAll(query) {
        const { category, chefId } = query;
        return this.prisma.pantryItem.findMany({
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
        const item = await this.prisma.pantryItem.findUnique({
            where: { id },
            include: { chef: true },
        });
        if (!item) {
            throw new common_1.NotFoundException('Pantry item not found');
        }
        return item;
    }
    async update(id, chefId, data) {
        const item = await this.findOne(id);
        if (!item) {
            throw new common_1.NotFoundException('Pantry item not found');
        }
        if (item.chef_id !== chefId) {
            throw new common_1.ForbiddenException('You can only update your own items');
        }
        return this.prisma.pantryItem.update({
            where: { id },
            data,
        });
    }
    async remove(id, chefId) {
        const item = await this.findOne(id);
        if (!item || item.chef_id !== chefId) {
            throw new common_1.ForbiddenException('You can only delete your own items');
        }
        await this.prisma.pantryItem.delete({ where: { id } });
    }
};
exports.PantryService = PantryService;
exports.PantryService = PantryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PantryService);
//# sourceMappingURL=pantry.service.js.map