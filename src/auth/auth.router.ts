import { Router, Request, Response } from 'express';
import { authService } from './auth.service';
import { validationMiddleware } from '../common/middleware/validation.middleware';
import { RegisterDto, LoginDto, SendOtpDto, VerifyOtpDto } from './dto/auth.dto';
import { jwtAuth } from '../common/middleware/auth.middleware';

const authRouter = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     RegisterDto:
 *       type: object
 *       required: [name, email, phone, password]
 *       properties:
 *         name: { type: string }
 *         email: { type: string, format: email }
 *         phone: { type: string, example: "+919876543210" }
 *         password: { type: string }
 *         gender: { type: string, enum: [MALE, FEMALE, OTHER] }
 *         role: { type: string, enum: [USER, CHEF, ADMIN] }
 */

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterDto'
 *     responses:
 *       201:
 *         description: User successfully registered
 */
// POST /api/v1/auth/register
authRouter.post(

  '/register',
  validationMiddleware(RegisterDto),
  async (req, res, next) => {
    try {
      const result = await authService.register(req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Log in to the application
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successfully logged in, returns access token
 *       401:
 *         description: Invalid credentials
 */
// POST /api/v1/auth/login
authRouter.post(

  '/login',
  validationMiddleware(LoginDto),
  async (req, res, next) => {
    try {
      const user = await authService.validateUser(req.body.email, req.body.password);
      if (!user) {
        return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
      }
      const result = await authService.login(user);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /auth/profile:
 *   get:
 *     summary: Get current logged-in user profile
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved user profile
 *       401:
 *         description: Unauthorized
 */
// GET /api/v1/auth/profile
authRouter.get('/profile', jwtAuth, (req, res) => {

  res.json(req.user);
});

/**
 * @openapi
 * /auth/send-otp:
 *   post:
 *     summary: Send OTP to a phone number
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *             properties:
 *               phone:
 *                 type: string
 *                 example: "+919876543210"
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *       400:
 *         description: Validation error
 */
authRouter.post(
  '/send-otp',
  validationMiddleware(SendOtpDto),
  async (req, res, next) => {
    try {
      const result = await authService.sendOtp(req.body.phone);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /auth/verify-otp:
 *   post:
 *     summary: Verify OTP and format response based on user existence
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - otp
 *             properties:
 *               phone:
 *                 type: string
 *                 example: "+919876543210"
 *               otp:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Responds with JWT (if existing user) or registration prompt (if new user)
 *       400:
 *         description: Invalid or expired OTP
 */
authRouter.post(
  '/verify-otp',
  validationMiddleware(VerifyOtpDto),
  async (req, res, next) => {
    try {
      const result = await authService.verifyOtp(req.body.phone, req.body.otp);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

export default authRouter;
