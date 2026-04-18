import jwt from 'jsonwebtoken';
import { usersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { redisClient } from '../common/redis/redis.client';
import { chefsService } from '../chefs/chefs.service';

export class AuthService {
  private readonly jwtSecret = process.env.JWT_SECRET || 'super-secret-key';

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await usersService.findOne({ email });
    if (user && (await bcrypt.compare(pass, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = {
      sub: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
    };
    return {
      token: jwt.sign(payload, this.jwtSecret, { expiresIn: '1d' }),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  async register(registrationData: any) {
    const { name, email, phone, password, role, gender } = registrationData;

    try {
      const user = await usersService.create({
        name,
        email,
        phone,
        password,
        role: role || Role.USER,
        gender: gender || 'OTHER',
      });

      const { password: _, ...result } = user;
      return result;
    } catch (error: any) {
      if (error.status === 409) {
        const err: any = new Error(error.message);
        err.status = 409;
        throw err;
      }
      throw error;
    }
  }

  async sendOtp(phone: string) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
    // Store in Redis with TTL 5 minutes (300 seconds)
    await redisClient.setex(`OTP:${phone}`, 300, otp);

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
            To: phone,      // Twilio requires country code (e.g., +918688261165)
            From: fromPhone,
            Body: message
          })
        });
        const data = await response.json();
        console.log('[Twilio Response]:', data);
      } catch (err) {
        console.error('[Twilio Error]:', err);
      }
    } else {
      console.log(`[Mock SMS] Sending OTP ${otp} to phone ${phone}`);
    }

    return { message: 'OTP sent successfully' };
  }

  async verifyOtp(phone: string, otp: string) {
    const storedOtp = await redisClient.get(`OTP:${phone}`);

    if (!storedOtp || storedOtp !== otp) {
      const err: any = new Error('Invalid or expired OTP');
      err.status = 400;
      throw err;
    }

    // Clear OTP after successful validation
    await redisClient.del(`OTP:${phone}`);

    // Check User table first
    let person = await usersService.findOne({ phone });
    let isChef = false;

    if (!person) {
      // Check Chef table
      person = await chefsService.findByPhone(phone);
      if (person) isChef = true;
    }

    if (!person) {
      // New user (neither standard user nor chef yet)
      const tempToken = jwt.sign(
        { phone: phone, role: Role.USER, isRegistrationPending: true },
        this.jwtSecret,
        { expiresIn: '1h' }
      );

      return {
        isNewUser: true,
        phone: phone,
        token: tempToken,
        message: 'OTP verified successfully. Please complete your registration.'
      };
    }

    const result = await this.login(person);
    const chefStatus = isChef ? (person as any).application_status : null;

    return {
      isNewUser: false,
      isChef,
      registrationStep: isChef ? (person as any).registration_step : null,
      applicationStatus: chefStatus,
      redirectToStatus: isChef && chefStatus !== 'DRAFT',
      ...result,
      phone: person.phone
    };
  }
}

export const authService = new AuthService();
