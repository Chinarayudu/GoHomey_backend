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
exports.UpdateOrderStatusDto = exports.CreatePantryOrderDto = exports.CreateMealOrderDto = void 0;
const openapi = require("@nestjs/swagger");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class CreateMealOrderDto {
    mealId;
    quantity;
    static _OPENAPI_METADATA_FACTORY() {
        return { mealId: { required: true, type: () => String }, quantity: { required: true, type: () => Number } };
    }
}
exports.CreateMealOrderDto = CreateMealOrderDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateMealOrderDto.prototype, "mealId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", Number)
], CreateMealOrderDto.prototype, "quantity", void 0);
class CreatePantryOrderDto {
    itemId;
    quantity;
    static _OPENAPI_METADATA_FACTORY() {
        return { itemId: { required: true, type: () => String }, quantity: { required: true, type: () => Number } };
    }
}
exports.CreatePantryOrderDto = CreatePantryOrderDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreatePantryOrderDto.prototype, "itemId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", Number)
], CreatePantryOrderDto.prototype, "quantity", void 0);
class UpdateOrderStatusDto {
    status;
    static _OPENAPI_METADATA_FACTORY() {
        return { status: { required: true, type: () => Object, enum: [
                    'PENDING',
                    'CONFIRMED',
                    'PREPARING',
                    'OUT_FOR_DELIVERY',
                    'DELIVERED',
                    'CANCELLED',
                    'REFUNDED',
                ] } };
    }
}
exports.UpdateOrderStatusDto = UpdateOrderStatusDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: [
            'PENDING',
            'CONFIRMED',
            'PREPARING',
            'OUT_FOR_DELIVERY',
            'DELIVERED',
            'CANCELLED',
            'REFUNDED',
        ],
    }),
    (0, class_validator_1.IsIn)([
        'PENDING',
        'CONFIRMED',
        'PREPARING',
        'OUT_FOR_DELIVERY',
        'DELIVERED',
        'CANCELLED',
        'REFUNDED',
    ]),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UpdateOrderStatusDto.prototype, "status", void 0);
//# sourceMappingURL=orders.dto.js.map