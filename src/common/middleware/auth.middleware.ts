import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { Role } from '@prisma/client';

// Configure Passport with JWT Strategy for Express
const options = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET || 'super-secret-key',
};

passport.use(
  new JwtStrategy(options, async (payload, done) => {
    try {
      if (payload) {
        return done(null, { 
          id: payload.sub, 
          email: payload.email, 
          phone: payload.phone,
          role: payload.role,
          isRegistrationPending: payload.isRegistrationPending
        });
      }
      return done(null, false);
    } catch (error) {
      return done(error, false);
    }
  })
);

export const jwtAuth = (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('jwt', { session: false }, (err: any, user: any, info: any) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }
    req.user = user;
    next();
  })(req, res, next);
};

export const checkRoles = (...roles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }
    const userRole = (req.user as any).role;
    if (roles.length && !roles.includes(userRole)) {
      return res.status(403).json({ status: 'error', message: 'Forbidden: Insufficient permissions' });
    }
    next();
  };
};

export const initializePassport = () => passport.initialize();
