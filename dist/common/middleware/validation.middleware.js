"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validationMiddleware = validationMiddleware;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
function validationMiddleware(dtoClass) {
    return async (req, res, next) => {
        const input = (0, class_transformer_1.plainToInstance)(dtoClass, req.body);
        const errors = await (0, class_validator_1.validate)(input, {
            whitelist: true,
            forbidNonWhitelisted: true,
        });
        if (errors.length > 0) {
            const formattedErrors = errors.map((error) => ({
                property: error.property,
                constraints: error.constraints,
            }));
            res.status(400).json({
                status: 'error',
                message: 'Validation failed',
                errors: formattedErrors,
            });
            return;
        }
        req.body = input;
        next();
    };
}
//# sourceMappingURL=validation.middleware.js.map