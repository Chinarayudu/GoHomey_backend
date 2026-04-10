"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializePassport = exports.checkRoles = exports.jwtAuth = void 0;
const passport_1 = __importDefault(require("passport"));
const passport_jwt_1 = require("passport-jwt");
const options = {
    jwtFromRequest: passport_jwt_1.ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET || 'super-secret-key',
};
passport_1.default.use(new passport_jwt_1.Strategy(options, async (payload, done) => {
    try {
        if (payload) {
            return done(null, { id: payload.sub, email: payload.email, role: payload.role });
        }
        return done(null, false);
    }
    catch (error) {
        return done(error, false);
    }
}));
const jwtAuth = (req, res, next) => {
    passport_1.default.authenticate('jwt', { session: false }, (err, user, info) => {
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
exports.jwtAuth = jwtAuth;
const checkRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }
        const userRole = req.user.role;
        if (roles.length && !roles.includes(userRole)) {
            return res.status(403).json({ status: 'error', message: 'Forbidden: Insufficient permissions' });
        }
        next();
    };
};
exports.checkRoles = checkRoles;
const initializePassport = () => passport_1.default.initialize();
exports.initializePassport = initializePassport;
//# sourceMappingURL=auth.middleware.js.map