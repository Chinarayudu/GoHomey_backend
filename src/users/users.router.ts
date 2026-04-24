import { Router } from 'express';
import { usersService } from './users.service';
import { validationMiddleware } from '../common/middleware/validation.middleware';
import { UpdateUserDto } from './dto/users.dto';
import { CreateAddressDto, UpdateAddressDto as UpdateAddressDtoClass } from './dto/address.dto';
import { jwtAuth, checkRoles } from '../common/middleware/auth.middleware';
import { Role } from '@prisma/client';

const usersRouter = Router();

/**
 * @openapi
 * /users/profile:
 *   get:
 *     summary: Get current logged-in user profile
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved user profile
 *       401:
 *         description: Unauthorized
 */
// GET /api/v1/users/profile
usersRouter.get('/profile', jwtAuth, async (req, res, next) => {
  try {
    const user = await usersService.findOneWithChef({ id: (req.user as any).id });
    res.json(user);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /users/profile:
 *   patch:
 *     summary: Update current logged-in user profile
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               email: { type: string }
 *               gender: { type: string, enum: [MALE, FEMALE, OTHER] }
 *     responses:
 *       200:
 *         description: Profile successfully updated
 *       401:
 *         description: Unauthorized
 */
// PATCH /api/v1/users/profile
usersRouter.patch(
  '/profile',
  jwtAuth,
  validationMiddleware(UpdateUserDto),
  async (req, res, next) => {
    try {
      const result = await usersService.update({
        where: { id: (req.user as any).id },
        data: req.body,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /users:
 *   get:
 *     summary: List all users (Admin only)
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved list of users
 *       403:
 *         description: Forbidden - Admin role required
 */
// GET /api/v1/users (Admin only)
usersRouter.get('/', jwtAuth, checkRoles(Role.ADMIN), (req, res) => {
  res.json({ message: 'Admin: list all users' });
});

// --- Address Management ---

/**
 * @openapi
 * /users/addresses:
 *   get:
 *     summary: Get user's addresses
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 */
usersRouter.get('/addresses', jwtAuth, async (req, res, next) => {
  try {
    const result = await usersService.findAddresses((req.user as any).id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /users/addresses:
 *   post:
 *     summary: Add a new address
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 */
usersRouter.post(
  '/addresses',
  jwtAuth,
  validationMiddleware(CreateAddressDto),
  async (req, res, next) => {
    try {
      const result = await usersService.addAddress((req.user as any).id, req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /users/addresses/{id}:
 *   patch:
 *     summary: Update an address
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 */
usersRouter.patch(
  '/addresses/:id',
  jwtAuth,
  validationMiddleware(UpdateAddressDtoClass),
  async (req, res, next) => {
    try {
      const result = await usersService.updateAddress(req.params.id as string, (req.user as any).id, req.body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /users/addresses/{id}:
 *   delete:
 *     summary: Delete an address
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 */
usersRouter.delete('/addresses/:id', jwtAuth, async (req, res, next) => {
  try {
    await usersService.removeAddress(req.params.id as string, (req.user as any).id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default usersRouter;
