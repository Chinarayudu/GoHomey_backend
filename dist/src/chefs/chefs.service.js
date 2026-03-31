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
exports.ChefsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
let ChefsService = class ChefsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(userId, bio) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        const existingChef = await this.prisma.chef.findFirst({
            where: { user_id: userId },
        });
        if (existingChef) {
            throw new common_1.ConflictException('Chef profile already exists for this user');
        }
        await this.prisma.user.update({
            where: { id: userId },
            data: { role: client_1.Role.CHEF },
        });
        return this.prisma.chef.create({
            data: {
                user_id: userId,
                bio,
                is_verified: false,
                trust_tier: 1,
            },
        });
    }
    async findOne(id) {
        return this.prisma.chef.findUnique({
            where: { id },
            include: { user: true },
        });
    }
    async findAll() {
        return this.prisma.chef.findMany({
            include: { user: true },
        });
    }
    async verifyChef(id, isVerified, trustTier) {
        return this.prisma.chef.update({
            where: { id },
            data: {
                is_verified: isVerified,
                trust_tier: trustTier !== undefined ? trustTier : undefined,
            },
        });
    }
    async updateChef(id, data) {
        return this.prisma.chef.update({
            where: { id },
            data,
        });
    }
};
exports.ChefsService = ChefsService;
exports.ChefsService = ChefsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ChefsService);
//# sourceMappingURL=chefs.service.js.map