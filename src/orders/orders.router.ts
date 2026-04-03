import { Router, Request, Response } from 'express';
import { ordersService } from './orders.service';
import { validationMiddleware } from '../common/middleware/validation.middleware';
import { CreateMealOrderDto, CreatePantryOrderDto, UpdateOrderStatusDto } from './dto/orders.dto';
import { jwtAuth, checkRoles } from '../common/middleware/auth.middleware';
import { Role } from '@prisma/client';

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
 *               itemId:
 *                 type: string
 *               quantity:
 *                 type: integer
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
    // In NestJS, they had req.user.chefId || req.user.id.
    // Assuming chefId is attached or we find it.
    const result = await ordersService.findChefOrders((req.user as any).id);
    res.json(result);
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
