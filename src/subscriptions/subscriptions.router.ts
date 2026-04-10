import { Router, Request, Response } from 'express';
import { subscriptionsService } from './subscriptions.service';
import { validationMiddleware } from '../common/middleware/validation.middleware';
import { CreatePlanDto, CreateSlotDto } from './dto/subscriptions.dto';
import { jwtAuth, checkRoles } from '../common/middleware/auth.middleware';
import { Role } from '@prisma/client';
import { prisma } from '../prisma/prisma.service';

const subscriptionsRouter = Router();

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
 *     responses:
 *       200:
 *         description: Plans retrieved
 */
// GET /api/v1/subscriptions/plans
subscriptionsRouter.get('/plans', async (req, res, next) => {

  try {
    const result = await subscriptionsService.findAllPlans();
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
      // Find the chef profile for the user
      const userWithChef = await prisma.user.findUnique({
        where: { id: (req.user as any).id },
        include: { chef: true },
      });

      if (!userWithChef?.chef) {
        return res.status(403).json({ status: 'error', message: 'User is not a chef' });
      }

      const result = await subscriptionsService.createSlot(userWithChef.chef.id, req.body);
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
