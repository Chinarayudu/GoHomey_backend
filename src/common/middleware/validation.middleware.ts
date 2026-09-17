import { Request, Response, NextFunction } from 'express';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';

/**
 * Middleware to validate request body against a DTO class.
 * @param dtoClass The class to validate against.
 * @param options.forbidNonWhitelisted When true (default), an unknown field in
 *   the body fails validation with 400. When false, unknown fields are silently
 *   stripped and the request proceeds with only the DTO-declared fields.
 */
export function validationMiddleware<T>(
  dtoClass: any,
  options: { forbidNonWhitelisted?: boolean } = {},
) {
  const { forbidNonWhitelisted = true } = options;
  return async (req: Request, res: Response, next: NextFunction) => {
    const input = plainToInstance(dtoClass, req.body);
    const errors: ValidationError[] = await validate(input, {
      whitelist: true,
      forbidNonWhitelisted,
    });

    if (errors.length > 0) {
      const formattedErrors = errors.map((error: ValidationError) => {
        const constraints = error.constraints || {};
        const message = Object.values(constraints)[0] ?? `${error.property} is invalid`;
        return { property: error.property, message, constraints };
      });
      res.status(400).json({
        status: 'error',
        // Surface the first field's own message (e.g. "bank_account_number must
        // be 9 to 18 digits") instead of a generic "Validation failed" — clients
        // that only read `message` still get something accurate to show.
        message: formattedErrors[0].message,
        errors: formattedErrors,
      });
      return;
    }

    req.body = input;
    next();
  };
}
