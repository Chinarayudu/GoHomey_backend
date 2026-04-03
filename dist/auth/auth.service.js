"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = exports.AuthService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const users_service_1 = require("../users/users.service");
const bcrypt = __importStar(require("bcrypt"));
const client_1 = require("@prisma/client");
const redis_client_1 = require("../common/redis/redis.client");
class AuthService {
    jwtSecret = process.env.JWT_SECRET || 'super-secret-key';
    async validateUser(email, pass) {
        const user = await users_service_1.usersService.findOne({ email });
        if (user && (await bcrypt.compare(pass, user.password))) {
            const { password, ...result } = user;
            return result;
        }
        return null;
    }
    async login(user) {
        const payload = {
            sub: user.id,
            email: user.email,
            role: user.role,
        };
        return {
            access_token: jsonwebtoken_1.default.sign(payload, this.jwtSecret, { expiresIn: '1d' }),
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        };
    }
    async register(registrationData) {
        const { name, email, phone, password, role } = registrationData;
        try {
            const user = await users_service_1.usersService.create({
                name,
                email,
                phone,
                password,
                role: role || client_1.Role.USER,
            });
            const { password: _, ...result } = user;
            return result;
        }
        catch (error) {
            if (error.status === 409) {
                const err = new Error(error.message);
                err.status = 409;
                throw err;
            }
            throw error;
        }
    }
    async sendOtp(phone) {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        await redis_client_1.redisClient.setex(`OTP:${phone}`, 300, otp);
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const fromPhone = process.env.TWILIO_PHONE_NUMBER;
        if (accountSid && authToken && fromPhone) {
            const message = `Your GoHomeyy verification code is ${otp}. Valid for 5 min.`;
            const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
            const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Basic ${basicAuth}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: new URLSearchParams({
                        To: phone,
                        From: fromPhone,
                        Body: message
                    })
                });
                const data = await response.json();
                console.log('[Twilio Response]:', data);
            }
            catch (err) {
                console.error('[Twilio Error]:', err);
            }
        }
        else {
            console.log(`[Mock SMS] Sending OTP ${otp} to phone ${phone}`);
        }
        return { message: 'OTP sent successfully' };
    }
    async verifyOtp(phone, otp) {
        const storedOtp = await redis_client_1.redisClient.get(`OTP:${phone}`);
        if (!storedOtp || storedOtp !== otp) {
            const err = new Error('Invalid or expired OTP');
            err.status = 400;
            throw err;
        }
        await redis_client_1.redisClient.del(`OTP:${phone}`);
        const user = await users_service_1.usersService.findOne({ phone });
        if (!user) {
            return {
                isNewUser: true,
                phone,
                message: 'Proceed to registration'
            };
        }
        const result = await this.login(user);
        return {
            isNewUser: false,
            ...result
        };
    }
}
exports.AuthService = AuthService;
exports.authService = new AuthService();
//# sourceMappingURL=auth.service.js.map