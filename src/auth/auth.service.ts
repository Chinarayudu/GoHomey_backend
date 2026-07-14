import jwt from 'jsonwebtoken';
import { usersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { redisClient } from '../common/redis/redis.client';
import { chefsService } from '../chefs/chefs.service';
import { prisma } from '../prisma/prisma.service';

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
      latitude: user.latitude,
      longitude: user.longitude,
    };
    return {
      token: jwt.sign(payload, this.jwtSecret),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        latitude: user.latitude,
        longitude: user.longitude,
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

  // Fixed credentials for Google Play / App Store reviewers, who cannot receive
  // a real-time SMS OTP. Enabled only when both env vars are set. Does not affect
  // real users — a normal phone never matches REVIEW_TEST_PHONE.
  private readonly reviewPhone = process.env.REVIEW_TEST_PHONE?.trim();
  private readonly reviewOtp = process.env.REVIEW_TEST_OTP?.trim();

  private isReviewPhone(phone: string): boolean {
    return !!this.reviewPhone && phone.trim() === this.reviewPhone;
  }

  async sendOtp(phone: string) {
    // Reviewer test number: skip Twilio entirely (no real SMS, no cost) and
    // store the fixed OTP so the app's normal verify step still works.
    if (this.isReviewPhone(phone) && this.reviewOtp) {
      await redisClient.setex(`OTP:${phone}`, 300, this.reviewOtp);
      console.log('[Review OTP] Fixed code stored for test phone', phone);
      return { message: 'OTP sent successfully' };
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits

    const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
    const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
    const fromPhone = process.env.TWILIO_PHONE_NUMBER?.trim();

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

        if (!response.ok) {
          console.error('[Twilio Error Response]:', data);
          const err: any = new Error(
            data?.message === 'Authenticate'
              ? 'Twilio authentication failed. Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.'
              : data?.message || 'Twilio failed to send OTP',
          );
          err.status = 502;
          err.details = data;
          throw err;
        }

        console.log('[Twilio OTP Sent]:', {
          sid: data?.sid,
          status: data?.status,
          to: phone,
        });
      } catch (err) {
        console.error('[Twilio Error]:', err);
        throw err;
      }
    } else {
      console.log(`[Mock SMS] Sending OTP ${otp} to phone ${phone}`);
    }

    // Store OTP only after Twilio accepts the SMS request, or immediately in mock mode.
    await redisClient.setex(`OTP:${phone}`, 300, otp);

    return { message: 'OTP sent successfully' };
  }

  async verifyOtp(phone: string, otp: string) {
    // Reviewer test number: accept the fixed OTP directly, independent of Redis.
    if (this.isReviewPhone(phone) && this.reviewOtp && otp.trim() === this.reviewOtp) {
      await redisClient.del(`OTP:${phone}`).catch(() => {});
      return this.resolveIdentity(phone);
    }

    const storedOtp = await redisClient.get(`OTP:${phone}`);

    if (!storedOtp || storedOtp !== otp) {
      const err: any = new Error('Invalid or expired OTP');
      err.status = 400;
      throw err;
    }

    // Clear OTP after successful validation
    await redisClient.del(`OTP:${phone}`);

    return this.resolveIdentity(phone);
  }

  private async resolveIdentity(phone: string) {
    // 1. Check User table with linked Chef profile
    let person: any = await prisma.user.findUnique({
      where: { phone },
      include: { chef: true },
    });

    let isChef = false;
    let chefProfile: any = null;

    if (person) {
      if (person.chef) {
        isChef = true;
        chefProfile = person.chef;
      } else {
        // Fallback: Check if a Chef record exists by phone but isn't linked
        chefProfile = await chefsService.findByPhone(phone);
        if (chefProfile) {
          isChef = true;
          // Link them now
          await prisma.chef.update({
            where: { id: chefProfile.id },
            data: { user_id: person.id },
          });
          // Upgrade user role to CHEF if necessary
          if (person.role !== Role.CHEF) {
            person = await prisma.user.update({
              where: { id: person.id },
              data: { role: Role.CHEF },
            });
          }
          person.chef = chefProfile;
        }
      }
    } else {
      // 2. Check standalone Chef table (for cases where user_id is not yet linked)
      chefProfile = await chefsService.findByPhone(phone);
      if (chefProfile) {
        isChef = true;
        const existingUser = await prisma.user.findFirst({
          where: {
            OR: [{ phone: chefProfile.phone }, { email: chefProfile.email }],
          },
        });

        if (existingUser) {
          person = existingUser;
          await prisma.chef.update({
            where: { id: chefProfile.id },
            data: { user_id: existingUser.id },
          });
          if (existingUser.role !== Role.CHEF) {
            person = await prisma.user.update({
              where: { id: existingUser.id },
              data: { role: Role.CHEF },
            });
          }
        } else {
          person = await prisma.user.create({
            data: {
              name: chefProfile.name,
              phone: chefProfile.phone,
              email: chefProfile.email,
              password: chefProfile.password,
              role: Role.CHEF,
              gender: 'OTHER',
              latitude: chefProfile.latitude,
              longitude: chefProfile.longitude,
            },
          });

          await prisma.chef.update({
            where: { id: chefProfile.id },
            data: { user_id: person.id },
          });
        }
      }
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
        message: 'OTP verified successfully. Please complete your registration.',
      };
    }

    // Log in the person (User or Chef record)
    const result = await this.login(person);

    return {
      isNewUser: false,
      isChef,
      registrationStep: isChef ? chefProfile?.registration_step : null,
      applicationStatus: isChef ? chefProfile?.application_status : null,
      redirectToStatus: isChef && chefProfile?.application_status !== 'DRAFT',
      ...result,
      phone: person.phone,
    };
  }
}

export const authService = new AuthService();
