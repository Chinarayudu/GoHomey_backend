import { Router, Request, Response } from 'express';
import { socialService } from './social.service';
import { validationMiddleware } from '../common/middleware/validation.middleware';
import { CreateSocialEventDto, UpdateSocialEventDto } from './dto/social.dto';
import { jwtAuth, checkRoles, optionalJwtAuth } from '../common/middleware/auth.middleware';
import { Role } from '@prisma/client';
import { prisma } from '../prisma/prisma.service';

const socialRouter = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     CreateSocialEventDto:
 *       type: object
 *       required: [title, description, date, end_date, location, price, slots_total]
 *       properties:
 *         title: { type: string }
 *         description: { type: string }
 *         date: { type: string, format: date-time }
 *         end_date: { type: string, format: date-time }
 *         location: { type: string }
 *         price: { type: number }
 *         slots_total: { type: integer }
 *         social_balance: { type: boolean }
 *         image_url: { type: string }
 *     UpdateSocialEventDto:
 *       type: object
 *       properties:
 *         title: { type: string }
 *         description: { type: string }
 *         date: { type: string, format: date-time }
 *         end_date: { type: string, format: date-time }
 *         location: { type: string }
 *         price: { type: number }
 *         slots_total: { type: integer }
 *         social_balance: { type: boolean }
 *         image_url: { type: string }
 */

/**
 * @openapi
 * /social:
 *   post:
 *     summary: Create a new social event (Chef only)
 *     tags: [Social]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateSocialEventDto'
 *     responses:
 *       201:
 *         description: Social event created
 */
socialRouter.post(
  '/',
  jwtAuth,
  checkRoles(Role.CHEF),
  validationMiddleware(CreateSocialEventDto),
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

      const result = await socialService.create(chef.id, req.body);
      res.status(201).json({ status: 'success', data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /social/dashboard:
 *   get:
 *     summary: Get social dashboard statistics (Chef only)
 *     tags: [Social]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics
 */
socialRouter.get(
  '/dashboard',
  jwtAuth,
  checkRoles(Role.CHEF),
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

      const result = await socialService.getDashboardStats(chef.id);
      res.json({ status: 'success', data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /social:
 *   get:
 *     summary: List all social events
 *     tags: [Social]
 *     parameters:
 *       - in: query
 *         name: chefId
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of social events
 */
socialRouter.get('/', optionalJwtAuth, async (req, res, next) => {
  try {
    const { chefId } = req.query as any;

    const result = await socialService.findAll({
      chefId: chefId as string,
    });
    res.json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /social/{id}:
 *   get:
 *     summary: Get social event detail
 *     tags: [Social]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Social event details
 */
socialRouter.get('/:id', async (req, res, next) => {
  try {
    const result = await socialService.findOne(req.params.id as string);
    res.json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /social/{id}:
 *   patch:
 *     summary: Update social event (Chef only)
 *     tags: [Social]
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
 *             $ref: '#/components/schemas/UpdateSocialEventDto'
 *     responses:
 *       200:
 *         description: Social event updated
 */
socialRouter.patch(
  '/:id',
  jwtAuth,
  checkRoles(Role.CHEF),
  validationMiddleware(UpdateSocialEventDto),
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

      const result = await socialService.update(req.params.id as string, chef.id, req.body);
      res.json({ status: 'success', data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /social/{id}:
 *   delete:
 *     summary: Delete social event (Chef only)
 *     tags: [Social]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Social event deleted
 */
socialRouter.delete('/:id', jwtAuth, checkRoles(Role.CHEF), async (req, res, next) => {
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

    await socialService.remove(req.params.id as string, chef.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default socialRouter;
