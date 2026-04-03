import { Request, Response, NextFunction } from 'express';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';

/**
 * Middleware to validate request body against a DTO class.
 * @param dtoClass The class to validate against.
 */
export function validationMiddleware<T>(dtoClass: any) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const input = plainToInstance(dtoClass, req.body);
    const errors: ValidationError[] = await validate(input, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (errors.length > 0) {
      const formattedErrors = errors.map((error: ValidationError) => ({
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
