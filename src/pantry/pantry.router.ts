import { Router, Request, Response } from 'express';
import { pantryService } from './pantry.service';
import { validationMiddleware } from '../common/middleware/validation.middleware';
import { CreatePantryDto, UpdatePantryDto } from './dto/pantry.dto';
import { jwtAuth, checkRoles } from '../common/middleware/auth.middleware';
import { Role } from '@prisma/client';
import { prisma } from '../prisma/prisma.service';

const pantryRouter = Router();

// POST /api/v1/pantry
pantryRouter.post(
  '/',
  jwtAuth,
  checkRoles(Role.CHEF),
  validationMiddleware(CreatePantryDto),
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

      const result = await pantryService.create(userWithChef.chef.id, req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/v1/pantry
pantryRouter.get('/', async (req, res, next) => {
  try {
    const { category, chefId } = req.query;
    const result = await pantryService.findAll({
      category: category as string,
      chefId: chefId as string,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/pantry/:id
pantryRouter.get('/:id', async (req, res, next) => {
  try {
    const result = await pantryService.findOne(req.params.id as string);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/pantry/:id
pantryRouter.patch(
  '/:id',
  jwtAuth,
  checkRoles(Role.CHEF),
  validationMiddleware(UpdatePantryDto),
  async (req, res, next) => {
    try {
      const userWithChef = await prisma.user.findUnique({
        where: { id: (req.user as any).id },
        include: { chef: true },
      });

      if (!userWithChef?.chef) {
        return res.status(403).json({ status: 'error', message: 'User is not a chef' });
      }

      const result = await pantryService.update(req.params.id as string, userWithChef.chef.id, req.body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/v1/pantry/:id
pantryRouter.delete('/:id', jwtAuth, checkRoles(Role.CHEF), async (req, res, next) => {
  try {
    const userWithChef = await prisma.user.findUnique({
      where: { id: (req.user as any).id },
      include: { chef: true },
    });

    if (!userWithChef?.chef) {
      return res.status(403).json({ status: 'error', message: 'User is not a chef' });
    }

    await pantryService.remove(req.params.id as string, userWithChef.chef.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default pantryRouter;
