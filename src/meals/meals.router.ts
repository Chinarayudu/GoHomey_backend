import { Router, Request, Response } from 'express';
import { mealsService } from './meals.service';
import { jwtAuth, checkRoles } from '../common/middleware/auth.middleware';
import { Role } from '@prisma/client';
import { mealImageUpload, batchProofUpload } from '../common/middleware/upload.middleware';
import { prisma } from '../prisma/prisma.service';

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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [meal_name, type, price, slots_total, date]
 *             properties:
 *               meal_name: { type: string }
 *               type: { type: string, enum: [VEG, NON_VEG] }
 *               service_window: { type: string, enum: [LUNCH, DINNER] }
 *               price: { type: number }
 *               slots_total: { type: integer }
 *               date: { type: string, format: date-time }
 *               meal_image: { type: string, format: binary }
 *     responses:
 *       201:
 *         description: Meal successfully created
 */
mealsRouter.post(
  '/',
  jwtAuth,
  checkRoles(Role.CHEF, Role.ADMIN),
  mealImageUpload.single('meal_image'),
  async (req: Request, res: Response, next) => {
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
        return res.status(403).json({ status: 'error', message: 'User is not a chef' });
      }

      const mealData = {
        ...req.body,
        price: parseFloat(req.body.price),
        slots_total: parseInt(req.body.slots_total),
        image_url: req.file ? `/uploads/meals/${req.file.filename}` : undefined,
      };

      const result = await mealsService.create(chef.id, mealData);
      res.status(201).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /meals/{id}/proof:
 *   post:
 *     summary: Upload batch photo proof (Chef only)
 *     tags: [Meals]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [batch_proof]
 *             properties:
 *               batch_proof: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Proof uploaded successfully
 */
mealsRouter.post(
  '/:id/proof',
  jwtAuth,
  checkRoles(Role.CHEF),
  batchProofUpload.single('batch_proof'),
  async (req: Request, res: Response, next) => {
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
        return res.status(403).json({ status: 'error', message: 'User is not its chef' });
      }

      if (!req.file) {
        return res.status(400).json({ status: 'error', message: 'Batch proof photo is required' });
      }

      const proofUrl = `/uploads/proofs/${req.file.filename}`;
      const result = await mealsService.update(req.params.id as string, chef.id, {
        batch_photo_url: proofUrl,
      });

      res.json({
        status: 'success',
        message: 'Batch proof uploaded successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

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
mealsRouter.get('/:id', async (req, res, next) => {
  try {
    const result = await mealsService.findOne(req.params.id as string);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

mealsRouter.patch('/:id', jwtAuth, checkRoles(Role.CHEF, Role.ADMIN), async (req, res, next) => {
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
      return res.status(403).json({ status: 'error', message: 'User is not a chef' });
    }

    const result = await mealsService.update(req.params.id as string, chef.id, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

mealsRouter.delete('/:id', jwtAuth, checkRoles(Role.CHEF, Role.ADMIN), async (req, res, next) => {
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
      return res.status(403).json({ status: 'error', message: 'User is not a chef' });
    }

    await mealsService.remove(req.params.id as string, chef.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default mealsRouter;
