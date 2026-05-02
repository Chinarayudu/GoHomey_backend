import { Router, Request, Response } from 'express';
import { pantryService } from './pantry.service';
import { validationMiddleware } from '../common/middleware/validation.middleware';
import { CreatePantryDto, UpdatePantryDto } from './dto/pantry.dto';
import { jwtAuth, checkRoles, optionalJwtAuth } from '../common/middleware/auth.middleware';
import { Role } from '@prisma/client';
import { prisma } from '../prisma/prisma.service';

const pantryRouter = Router();

/**
 * @openapi
 * /pantry:
 *   post:
 *     summary: Create a new pantry item (Chef only)
 *     tags: [Pantry]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, category, price, inventory]
 *             properties:
 *               name: { type: string }
 *               category: { type: string }
 *               price: { type: number }
 *               inventory: { type: integer }
 *               image_url: { type: string }
 *     responses:
 *       201:
 *         description: Pantry item created
 */
// POST /api/v1/pantry
pantryRouter.post(
  '/',
  jwtAuth,
  checkRoles(Role.CHEF),
  validationMiddleware(CreatePantryDto),
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

      const result = await pantryService.create(chef.id, req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /pantry:
 *   get:
 *     summary: List pantry items
 *     tags: [Pantry]
 *     parameters:
 *       - in: query
 *         name: chefId
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of pantry items retrieved
 */
// GET /api/v1/pantry
pantryRouter.get('/', optionalJwtAuth, async (req, res, next) => {
  try {
    const { chefId } = req.query as any;

    const result = await pantryService.findAll({
      chefId: chefId as string,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /pantry/{id}:
 *   get:
 *     summary: Get pantry item details
 *     tags: [Pantry]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Pantry item details retrieved
 *       404:
 *         description: Pantry item not found
 */
// GET /api/v1/pantry/:id
pantryRouter.get('/:id', async (req, res, next) => {
  try {
    const result = await pantryService.findOne(req.params.id as string);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /pantry/{id}:
 *   patch:
 *     summary: Update pantry item (Chef only)
 *     tags: [Pantry]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               category: { type: string }
 *               price: { type: number }
 *               inventory: { type: integer }
 *               image_url: { type: string }
 *     responses:
 *       200:
 *         description: Pantry item updated
 */
// PATCH /api/v1/pantry/:id
pantryRouter.patch(
  '/:id',
  jwtAuth,
  checkRoles(Role.CHEF),
  validationMiddleware(UpdatePantryDto),
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

      const result = await pantryService.update(req.params.id as string, chef.id, req.body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /pantry/{id}:
 *   delete:
 *     summary: Delete pantry item (Chef only)
 *     tags: [Pantry]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Pantry item deleted
 */
// DELETE /api/v1/pantry/:id
pantryRouter.delete('/:id', jwtAuth, checkRoles(Role.CHEF), async (req, res, next) => {
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

    await pantryService.remove(req.params.id as string, chef.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default pantryRouter;
