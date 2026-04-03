import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
export declare const jwtAuth: (req: Request, res: Response, next: NextFunction) => void;
export declare const checkRoles: (...roles: Role[]) => (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare const initializePassport: () => import("express").Handler;
