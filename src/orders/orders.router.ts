import { Router, Request, Response } from 'express';
import { ordersService } from './orders.service';
import { validationMiddleware } from '../common/middleware/validation.middleware';
import { CreateMealOrderDto, CreatePantryOrderDto, CreateSocialOrderDto, UpdateOrderStatusDto } from './dto/orders.dto';
import { jwtAuth, checkRoles } from '../common/middleware/auth.middleware';
import { Role } from '@prisma/client';
import { prisma } from '../prisma/prisma.service';
const ordersRouter = Router();

/**
 * @openapi
 * /orders/meal:
 *   post:
 *     summary: Create a meal order
 *     tags: [Orders]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mealId:
 *                 type: string
 *               quantity:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Meal order created
 */
// POST /api/v1/orders/meal
ordersRouter.post(

  '/meal',
  jwtAuth,
  validationMiddleware(CreateMealOrderDto),
  async (req, res, next) => {
    try {
      const result = await ordersService.createDailyMealOrder(
        (req.user as any).id,
        req.body.mealId,
        req.body.quantity
      );
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /orders/pantry:
 *   post:
 *     summary: Create a pantry order
 *     description: Pantry items must be associated with a delivery window (piggyback logic).
 *     tags: [Orders]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [itemId, quantity, deliveryWindow]
 *             properties:
 *               itemId:
 *                 type: string
 *               quantity:
 *                 type: integer
 *               deliveryWindow:
 *                 type: string
 *                 example: "Tomorrow Lunch Batch"
 *     responses:
 *       201:
 *         description: Pantry order created
 */
// POST /api/v1/orders/pantry
ordersRouter.post(

  '/pantry',
  jwtAuth,
  validationMiddleware(CreatePantryOrderDto),
  async (req, res, next) => {
    try {
      const result = await ordersService.createPantryOrder(
        (req.user as any).id,
        req.body.itemId,
        req.body.quantity,
        req.body.deliveryWindow
      );
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /orders/social:
 *   post:
 *     summary: Book a social event
 *     tags: [Orders]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               eventId:
 *                 type: string
 *               quantity:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Social event booked
 */
// POST /api/v1/orders/social
ordersRouter.post(
  '/social',
  jwtAuth,
  validationMiddleware(CreateSocialOrderDto),
  async (req, res, next) => {
    try {
      const result = await ordersService.createSocialOrder(
        (req.user as any).id,
        req.body.eventId,
        req.body.quantity
      );
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /orders/user:
 *   get:
 *     summary: Get all orders for the current user
 *     tags: [Orders]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Orders retrieved
 */
// GET /api/v1/orders/user
ordersRouter.get('/user', jwtAuth, async (req, res, next) => {

  try {
    const result = await ordersService.findUserOrders((req.user as any).id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /orders/chef:
 *   get:
 *     summary: Get all orders for the current chef
 *     tags: [Orders]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Chef orders retrieved
 */
// GET /api/v1/orders/chef
ordersRouter.get('/chef', jwtAuth, checkRoles(Role.CHEF), async (req, res, next) => {
  try {
    const user = req.user as any;
    const chef = await prisma.chef.findFirst({
      where: {
        OR: [
          { id: user.id },
          { user_id: user.id }
        ]
      }
    });
    if (!chef) {
      return res.status(403).json({ status: 'error', message: 'Chef profile not found' });
    }

    const { statusGroup } = req.query;
    const result = await ordersService.findChefOrders(chef.id, statusGroup as 'active' | 'completed');
    res.json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /orders/{id}/status:
 *   patch:
 *     summary: Update the status of an order
 *     tags: [Orders]
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
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Order status updated
 */
// PATCH /api/v1/orders/:id/status
ordersRouter.patch(

  '/:id/status',
  jwtAuth,
  checkRoles(Role.CHEF, Role.ADMIN),
  validationMiddleware(UpdateOrderStatusDto),
  async (req, res, next) => {
    try {
      const result = await ordersService.updateOrderStatus(req.params.id as string, req.body.status);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

export default ordersRouter;
