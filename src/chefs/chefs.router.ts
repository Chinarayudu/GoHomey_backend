import { Router, Request, Response } from 'express';
import { chefsService } from './chefs.service';
import { jwtAuth, checkRoles } from '../common/middleware/auth.middleware';
import { validationMiddleware } from '../common/middleware/validation.middleware';
import { ChefRegisterStep1Dto, ChefRegisterStep2Dto } from './dto/chef-register.dto';
import { chefDocumentUpload } from '../common/middleware/upload.middleware';
import { Role } from '@prisma/client';

const chefsRouter = Router();

// ─── REGISTRATION STEP 1: Personal Info ───────────────────────────────────────

/**
 * @openapi
 * /chefs/register/step-1:
 *   post:
 *     summary: "Chef Registration Step 1 — Personal Info"
 *     description: "Submit personal info: Full Name, Email, Mobile Number, Primary Cuisine."
 *     tags: [Chef Registration]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - full_name
 *               - email
 *               - mobile_number
 *               - primary_cuisine
 *             properties:
 *               full_name:
 *                 type: string
 *                 example: "Chef Auguste Escoffier"
 *               email:
 *                 type: string
 *                 example: "auguste@cuisine.com"
 *               mobile_number:
 *                 type: string
 *                 example: "+919876543210"
 *               primary_cuisine:
 *                 type: string
 *                 example: "South Indian"
 *     responses:
 *       201:
 *         description: Step 1 completed successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
chefsRouter.post(
  '/register/step-1',
  jwtAuth,
  validationMiddleware(ChefRegisterStep1Dto),
  async (req: Request, res: Response, next) => {
    try {
      const userId = (req.user as any).id;
      const result = await chefsService.registerStep1(userId, req.body);
      res.status(201).json({
        status: 'success',
        message: 'Step 1 completed. Proceed to Step 2.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ─── REGISTRATION STEP 2: Kitchen Space ───────────────────────────────────────

/**
 * @openapi
 * /chefs/register/step-2:
 *   post:
 *     summary: "Chef Registration Step 2 — Kitchen Space"
 *     description: "Submit kitchen details: Kitchen Name, Location, Capacity, Appliances."
 *     tags: [Chef Registration]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - kitchen_name
 *               - kitchen_address
 *               - latitude
 *               - longitude
 *               - max_capacity
 *               - appliances
 *             properties:
 *               kitchen_name:
 *                 type: string
 *                 example: "The Emerald Atelier"
 *               kitchen_address:
 *                 type: string
 *                 example: "122 Artisan Way, Seattle, WA"
 *               latitude:
 *                 type: number
 *                 example: 47.6062
 *               longitude:
 *                 type: number
 *                 example: -122.3321
 *               max_capacity:
 *                 type: integer
 *                 example: 12
 *               appliances:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["Sous-Vide", "Convection"]
 *     responses:
 *       200:
 *         description: Step 2 completed successfully
 *       400:
 *         description: Validation error or Step 1 not completed
 *       401:
 *         description: Unauthorized
 */
chefsRouter.post(
  '/register/step-2',
  jwtAuth,
  validationMiddleware(ChefRegisterStep2Dto),
  async (req: Request, res: Response, next) => {
    try {
      const user = req.user as any;
      const result = await chefsService.registerStep2(user.id, req.body, user.phone);
      res.status(200).json({
        status: 'success',
        message: 'Step 2 completed. Proceed to Step 3.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ─── REGISTRATION STEP 3: Security & Verification (File Uploads) ──────────────

/**
 * @openapi
 * /chefs/register/step-3:
 *   post:
 *     summary: "Chef Registration Step 3 — Security & Verification"
 *     description: "Upload verification documents: Government ID, Food Safety Certificate, Kitchen Photo."
 *     tags: [Chef Registration]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - government_id
 *               - food_safety_cert
 *               - kitchen_photo
 *             properties:
 *               government_id:
 *                 type: string
 *                 format: binary
 *                 description: "Passport, License, or National ID (JPEG/PNG/PDF)"
 *               food_safety_cert:
 *                 type: string
 *                 format: binary
 *                 description: "FSSAI or local food safety certificate (JPEG/PNG/PDF)"
 *               kitchen_photo:
 *                 type: string
 *                 format: binary
 *                 description: "Wide shot of primary workspace (JPEG/PNG/WebP)"
 *     responses:
 *       200:
 *         description: Step 3 completed, application submitted for review
 *       400:
 *         description: Missing required files or previous steps not completed
 *       401:
 *         description: Unauthorized
 */
chefsRouter.post(
  '/register/step-3',
  jwtAuth,
  chefDocumentUpload.fields([
    { name: 'government_id', maxCount: 1 },
    { name: 'food_safety_cert', maxCount: 1 },
    { name: 'kitchen_photo', maxCount: 1 },
  ]),
  async (req: Request, res: Response, next) => {
    try {
      const user = req.user as any;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      if (!files?.government_id?.[0] || !files?.food_safety_cert?.[0] || !files?.kitchen_photo?.[0]) {
        return res.status(400).json({
          status: 'error',
          message: 'All three documents are required: government_id, food_safety_cert, kitchen_photo',
        });
      }

      const fileUrls = {
        government_id_url: `/uploads/chef-documents/${files.government_id[0].filename}`,
        food_safety_cert_url: `/uploads/chef-documents/${files.food_safety_cert[0].filename}`,
        kitchen_photo_url: `/uploads/chef-documents/${files.kitchen_photo[0].filename}`,
      };

      const result = await chefsService.registerStep3(user.id, fileUrls, user.phone);
      res.status(200).json({
        status: 'success',
        message: 'Application submitted! Our concierge team will review your documents within 24 hours.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ─── REGISTRATION STATUS ──────────────────────────────────────────────────────

/**
 * @openapi
 * /chefs/register/status:
 *   get:
 *     summary: Get current chef registration status and progress
 *     tags: [Chef Registration]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Registration status retrieved
 *       401:
 *         description: Unauthorized
 */
chefsRouter.get(
  '/register/status',
  jwtAuth,
  async (req: Request, res: Response, next) => {
    try {
      const user = req.user as any;
      const result = await chefsService.getRegistrationStatus(user.id, user.phone);
      res.json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ─── EXISTING CHEF ENDPOINTS ──────────────────────────────────────────────────

/**
 * @openapi
 * /chefs:
 *   get:
 *     summary: Get all chefs
 *     tags: [Chefs]
 *     responses:
 *       200:
 *         description: Successfully retrieved all chefs
 */
chefsRouter.get('/', async (req, res, next) => {
  try {
    const result = await chefsService.findAll();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /chefs/{id}:
 *   get:
 *     summary: Get a specific chef by ID
 *     tags: [Chefs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chef found
 *       404:
 *         description: Chef not found
 */
chefsRouter.get('/:id', async (req, res, next) => {
  try {
    const result = await chefsService.findOne(req.params.id as string);
    if (!result) {
      return res.status(404).json({ status: 'error', message: 'Chef not found' });
    }
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /chefs/{id}/verify:
 *   patch:
 *     summary: Verify a chef (Admin only)
 *     tags: [Chefs]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               is_verified:
 *                 type: boolean
 *               trust_tier:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Chef verification updated
 */
chefsRouter.patch(
  '/:id/verify',
  jwtAuth,
  checkRoles(Role.ADMIN),
  async (req, res, next) => {
    try {
      const { is_verified, trust_tier } = req.body;
      const result = await chefsService.verifyChef(
        req.params.id as string,
        is_verified,
        trust_tier
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /chefs/{id}/application-status:
 *   patch:
 *     summary: Update chef application status (Admin only)
 *     tags: [Chefs]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [DRAFT, PENDING_REVIEW, PHONE_VETTING, KITCHEN_AUDIT, APPROVED, REJECTED]
 *     responses:
 *       200:
 *         description: Application status updated
 */
chefsRouter.patch(
  '/:id/application-status',
  jwtAuth,
  checkRoles(Role.ADMIN),
  async (req, res, next) => {
    try {
      const result = await chefsService.updateApplicationStatus(
        req.params.id as string,
        req.body.status
      );
      res.json({
        status: 'success',
        message: `Application status updated to ${req.body.status}`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default chefsRouter;
