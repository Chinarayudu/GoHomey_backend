import { Router, Request, Response } from 'express';
import { mealsService } from './meals.service';
import { jwtAuth, checkRoles } from '../common/middleware/auth.middleware';
import { Role } from '@prisma/client';

const mealsRouter = Router();

/**
 * @openapi
 * /meals:
 *   post:
 *     summary: Create a new meal (Chef only)
 *     tags: [Meals]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               meal_name:
 *                 type: string
 *               type:
 *                 type: string
 *               price:
 *                 type: number
 *               slots_total:
 *                 type: integer
 *               date:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Meal successfully created
 *       403:
 *         description: Forbidden, user is not a chef
 */
// POST /api/v1/meals
mealsRouter.post('/', jwtAuth, checkRoles(Role.CHEF, Role.ADMIN), async (req, res, next) => {

  try {
    // Determine chefId. For now, assume req.user has chef profile info or we find it.
    // Ideally, we'd have a middleware to attach chef info to req.
    const userWithChef: any = await prisma.user.findUnique({
      where: { id: (req.user as any).id },
      include: { chef: true }
    });
    
    if (!userWithChef?.chef) {
      return res.status(403).json({ status: 'error', message: 'User is not a chef' });
    }

    const result = await mealsService.create(userWithChef.chef.id, req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /meals:
 *   get:
 *     summary: Get all meals
 *     tags: [Meals]
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *         description: Filter meals by date
 *       - in: query
 *         name: chefId
 *         schema:
 *           type: string
 *         description: Filter meals by chef ID
 *     responses:
 *       200:
 *         description: Successfully retrieved meals
 */
// GET /api/v1/meals
mealsRouter.get('/', async (req, res, next) => {

  try {
    const { date, chefId } = req.query;
    const result = await mealsService.findAll({
      date: date as string,
      chefId: chefId as string,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /meals/{id}:
 *   get:
 *     summary: Get details of a specific meal
 *     tags: [Meals]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successfully retrieved meal details
 *       404:
 *         description: Meal not found
 */
// GET /api/v1/meals/:id
mealsRouter.get('/:id', async (req, res, next) => {

  try {
    const result = await mealsService.findOne(req.params.id as string);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/meals/:id
mealsRouter.patch('/:id', jwtAuth, checkRoles(Role.CHEF, Role.ADMIN), async (req, res, next) => {
  try {
    const userWithChef: any = await prisma.user.findUnique({
      where: { id: (req.user as any).id },
      include: { chef: true }
    });

    if (!userWithChef?.chef) {
      return res.status(403).json({ status: 'error', message: 'User is not a chef' });
    }

    const result = await mealsService.update(req.params.id as string, userWithChef.chef.id, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/meals/:id
mealsRouter.delete('/:id', jwtAuth, checkRoles(Role.CHEF, Role.ADMIN), async (req, res, next) => {
  try {
    const userWithChef: any = await prisma.user.findUnique({
      where: { id: (req.user as any).id },
      include: { chef: true }
    });

    if (!userWithChef?.chef) {
      return res.status(403).json({ status: 'error', message: 'User is not a chef' });
    }

    await mealsService.remove(req.params.id as string, userWithChef.chef.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default mealsRouter;

import { prisma } from '../prisma/prisma.service'; // Needed for the inline prisma call
