import { Router } from 'express';
import { usersService } from './users.service';
import { validationMiddleware } from '../common/middleware/validation.middleware';
import { UpdateUserDto } from './dto/users.dto';
import { jwtAuth, checkRoles } from '../common/middleware/auth.middleware';
import { Role } from '@prisma/client';

const usersRouter = Router();

// GET /api/v1/users/profile
usersRouter.get('/profile', jwtAuth, async (req, res, next) => {
  try {
    const user = await usersService.findOneWithChef({ id: (req.user as any).id });
    res.json(user);
  } catch (error) {
    next(error);
  }
});

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

// GET /api/v1/users (Admin only)
usersRouter.get('/', jwtAuth, checkRoles(Role.ADMIN), (req, res) => {
  res.json({ message: 'Admin: list all users' });
});

export default usersRouter;
