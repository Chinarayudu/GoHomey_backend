import { Request, Response, NextFunction } from 'express';
export declare function validationMiddleware<T>(dtoClass: any): (req: Request, res: Response, next: NextFunction) => Promise<void>;
