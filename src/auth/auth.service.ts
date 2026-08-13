import jwt from 'jsonwebtoken';
import { usersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { redisClient } from '../common/redis/redis.client';
import { chefsService } from '../chefs/chefs.service';
import { prisma } from '../prisma/prisma.service';
import { JWT_SECRET } from '../config/env';
import { verifyFirebasePhoneToken } from '../common/services/firebase.service';

export class AuthService {
  private readonly jwtSecret = JWT_SECRET;

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

  // TEMPORARY: while waiting on DLT approval, set OTP_BYPASS_ENABLED=true to skip
  // real SMS sending/verification entirely. sendOtp becomes a no-op success and
  // verifyOtp accepts any OTP value. Set back to false (or unset) once DLT is approved
  // — this is a full phone-verification bypass, must not stay on for real users.
  private readonly otpBypassEnabled = process.env.OTP_BYPASS_ENABLED === 'true';

  async sendOtp(phone: string) {
    if (this.otpBypassEnabled) {
      console.warn('[OTP BYPASS] OTP_BYPASS_ENABLED=true — skipping real SMS send for', phone);
      return { message: 'OTP sent successfully' };
    }

    // Reviewer test number: skip the SMS provider entirely (no real SMS, no cost) and
    // store the fixed OTP so the app's normal verify step still works.
    if (this.isReviewPhone(phone) && this.reviewOtp) {
      await redisClient.setex(`OTP:${phone}`, 300, this.reviewOtp);
      console.log('[Review OTP] Fixed code stored for test phone', phone);
      return { message: 'OTP sent successfully' };
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits

    const msg91AuthKey = process.env.MSG91_AUTH_KEY?.trim();
    const msg91TemplateId = process.env.MSG91_TEMPLATE_ID?.trim();

    if (msg91AuthKey && msg91TemplateId) {
      // MSG91 expects digits only, no leading '+' (e.g. 918688261165).
      const mobile = phone.replace(/^\+/, '');

      try {
        const response = await fetch('https://control.msg91.com/api/v5/flow/', {
          method: 'POST',
          headers: {
            authkey: msg91AuthKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            template_id: msg91TemplateId,
            short_url: '0',
            recipients: [
              {
                mobiles: mobile,
                // Variable name must match what's registered in the MSG91/DLT template.
                OTP: otp,
              },
            ],
          }),
        });
        const data = await response.json();

        if (!response.ok || data?.type === 'error') {
          console.error('[MSG91 Error Response]:', data);
          const err: any = new Error(data?.message || 'MSG91 failed to send OTP');
          err.status = 502;
          err.details = data;
          throw err;
        }

        console.log('[MSG91 OTP Sent]:', {
          request_id: data?.request_id,
          to: phone,
        });
      } catch (err) {
        console.error('[MSG91 Error]:', err);
        throw err;
      }
    } else {
      console.log(`[Mock SMS] Sending OTP ${otp} to phone ${phone}`);
    }

    // Store OTP only after MSG91 accepts the SMS request, or immediately in mock mode.
    await redisClient.setex(`OTP:${phone}`, 300, otp);

    return { message: 'OTP sent successfully' };
  }

  async verifyOtp(phone: string, otp: string) {
    if (this.otpBypassEnabled) {
      console.warn('[OTP BYPASS] OTP_BYPASS_ENABLED=true — accepting any OTP for', phone);
      return this.resolveIdentity(phone);
    }

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

  // Client (web/mobile) completes Firebase Phone Auth and sends us the resulting
  // ID token. We verify it server-side and trust the phone number Firebase
  // vouches for — no OTP generation/storage/SMS sending on our side at all.
  async verifyFirebaseToken(idToken: string) {
    const phone = await verifyFirebasePhoneToken(idToken);
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
