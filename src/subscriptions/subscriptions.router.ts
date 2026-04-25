import { Router, Request, Response } from 'express';
import { subscriptionsService } from './subscriptions.service';
import { validationMiddleware } from '../common/middleware/validation.middleware';
import { CreatePlanDto, CreateSlotDto } from './dto/subscriptions.dto';
import { jwtAuth, checkRoles, optionalJwtAuth } from '../common/middleware/auth.middleware';
import { Role } from '@prisma/client';
import { prisma } from '../prisma/prisma.service';
import { chefDocumentUpload } from '../common/middleware/upload.middleware';

const subscriptionsRouter = Router();

/**
 * @openapi
 * /subscriptions/custom/upload:
 *   post:
 *     summary: Upload a custom diet plan PDF
 *     tags: [Subscriptions]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               diet_plan:
 *                 type: string
 *                 format: binary
 */
subscriptionsRouter.post(
  '/custom/upload',
  jwtAuth,
  chefDocumentUpload.single('diet_plan'),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    res.json({
      status: 'success',
      message: 'Custom plan uploaded successfully',
      file_url: `/uploads/chef-documents/${req.file.filename}`,
    });
  }
);

/**
 * @openapi
 * /subscriptions/plans:
 *   post:
 *     summary: Create a subscription plan (Admin only)
 *     tags: [Subscriptions]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               price:
 *                 type: number
 *               deliveriesPerWeek:
 *                 type: integer
 *               calories: { type: integer }
 *               protein: { type: integer }
 *               carbs: { type: integer }
 *               fat: { type: integer }
 *     responses:
 *       201:
 *         description: Plan created
 */
// POST /api/v1/subscriptions/plans (Admin only)
subscriptionsRouter.post(

  '/plans',
  jwtAuth,
  checkRoles(Role.ADMIN),
  validationMiddleware(CreatePlanDto),
  async (req, res, next) => {
    try {
      const result = await subscriptionsService.createPlan(req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /subscriptions/plans:
 *   get:
 *     summary: Get all subscription plans
 *     tags: [Subscriptions]
 *     parameters:
 *       - in: query
 *         name: latitude
 *         schema:
 *           type: number
 *         description: User latitude for 3km radius filtering
 *       - in: query
 *         name: longitude
 *         schema:
 *           type: number
 *         description: User longitude for 3km radius filtering
 *     responses:
 *       200:
 *         description: Plans retrieved
 */
// GET /api/v1/subscriptions/plans
subscriptionsRouter.get('/plans', optionalJwtAuth, async (req, res, next) => {
  try {
    const { latitude, longitude } = req.query as any;
    const user = req.user as any;
    const resLat = latitude ? parseFloat(latitude as string) : user?.latitude;
    const resLon = longitude ? parseFloat(longitude as string) : user?.longitude;

    const result = await subscriptionsService.findAllPlans(resLat, resLon);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /subscriptions/plans/{id}:
 *   get:
 *     summary: Get a specific subscription plan
 *     tags: [Subscriptions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Plan details retrieved
 */
// GET /api/v1/subscriptions/plans/:id
subscriptionsRouter.get('/plans/:id', async (req, res, next) => {

  try {
    const result = await subscriptionsService.findOnePlan(req.params.id as string);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /subscriptions/slots:
 *   post:
 *     summary: Create a subscription slot (Chef only)
 *     tags: [Subscriptions]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               planId:
 *                 type: string
 *               maxSubscribers:
 *                 type: integer
 *               deliveryDays:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Slot created
 */
// POST /api/v1/subscriptions/slots (Chef only)
subscriptionsRouter.post(

  '/slots',
  jwtAuth,
  checkRoles(Role.CHEF),
  validationMiddleware(CreateSlotDto),
  async (req, res, next) => {
    try {
      const chef = await prisma.chef.findFirst({
        where: {
          OR: [
            { id: (req.user as any).id },
            { user_id: (req.user as any).id }
          ]
        }
      });

      if (!chef) {
        return res.status(403).json({ status: 'error', message: 'User is not a chef' });
      }

      const result = await subscriptionsService.createSlot(chef.id, req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /subscriptions/slots/chef/{chefId}:
 *   get:
 *     summary: Get slots by chef ID
 *     tags: [Subscriptions]
 *     parameters:
 *       - in: path
 *         name: chefId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Slots retrieved
 */
// GET /api/v1/subscriptions/slots/chef/:chefId
subscriptionsRouter.get('/slots/chef/:chefId', async (req, res, next) => {

  try {
    const result = await subscriptionsService.findSlotsByChef(req.params.chefId as string);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default subscriptionsRouter;
