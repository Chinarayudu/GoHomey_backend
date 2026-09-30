import { Router, Request, Response } from 'express';
import { FuelFulfillmentStatus, Role } from '@prisma/client';
import { fuelService } from './fuel.service';
import { jwtAuth, checkRoles } from '../common/middleware/auth.middleware';
import { validationMiddleware } from '../common/middleware/validation.middleware';
import {
  CreateFuelPlanDto,
  CreateFuelSlotDto,
  CreateFuelSubscriptionDto,
  PauseFuelSubscriptionDto,
  UpdateFulfillmentStatusDto,
} from './dto/fuel.dto';
import { prisma } from '../prisma/prisma.service';
import {
  batchProofUpload,
  mealImageUpload,
} from '../common/middleware/upload.middleware';
import { cloudinaryService } from '../common/services/cloudinary.service';
import { fuelLiveService } from './fuel-live.service';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env';

const fuelRouter = Router();

async function resolveChefFromUser(userId: string) {
  return prisma.chef.findFirst({
    where: {
      OR: [{ id: userId }, { user_id: userId }],
    },
  });
}

async function resolveChefFromRequest(req: Request) {
  const user = req.user as any;
  return resolveChefFromUser(user.id);
}

async function resolveChefFromStreamToken(req: Request) {
  const authHeader = req.headers.authorization;
  const tokenFromHeader = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : undefined;
  const token = tokenFromHeader || (req.query.token as string | undefined);

  if (!token) {
    const error: any = new Error('Auth token is required');
    error.status = 401;
    throw error;
  }

  const payload = jwt.verify(token, JWT_SECRET) as any;
  if (payload.role !== Role.CHEF && payload.role !== Role.ADMIN) {
    const error: any = new Error('Chef role is required');
    error.status = 403;
    throw error;
  }

  const chef = await resolveChefFromUser(payload.sub);
  if (!chef) {
    const error: any = new Error('Chef profile not found');
    error.status = 403;
    throw error;
  }

  return chef;
}

// POST /api/v1/fuel/plans (Admin)
fuelRouter.post(
  '/plans',
  jwtAuth,
  checkRoles(Role.ADMIN),
  validationMiddleware(CreateFuelPlanDto),
  async (req, res, next) => {
    try {
      const result = await fuelService.createPlan(req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/v1/fuel/plans
fuelRouter.get('/plans', async (_req, res, next) => {
  try {
    const result = await fuelService.listPlans();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/fuel/plans/:id
fuelRouter.get('/plans/:id', async (req, res, next) => {
  try {
    const result = await fuelService.getPlan(req.params.id as string);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

function parseMealTarget(body: any) {
  const day = Number(body.day);
  const period = String(body.period || '').trim();
  if (!Number.isInteger(day) || day < 1 || !period) {
    const error: any = new Error(
      'day (positive integer) and period (e.g. breakfast, lunch, dinner) are required',
    );
    error.status = 400;
    throw error;
  }
  return { day, period };
}

// POST /api/v1/fuel/plans/:id/meal-images (Admin)
// multipart/form-data: day, period, images[] (up to 10)
fuelRouter.post(
  '/plans/:id/meal-images',
  jwtAuth,
  checkRoles(Role.ADMIN),
  mealImageUpload.array('images', 10),
  async (req: Request, res: Response, next) => {
    try {
      const { day, period } = parseMealTarget(req.body);
      const files = (req.files as Express.Multer.File[]) || [];
      if (!files.length) {
        return res
          .status(400)
          .json({ status: 'error', message: 'At least one image is required' });
      }
      if (files.some((file) => !file.mimetype.startsWith('image/'))) {
        return res
          .status(400)
          .json({ status: 'error', message: 'Only image files are allowed' });
      }

      const uploaded = await Promise.all(
        files.map((file) =>
          cloudinaryService.uploadFile(file, 'homey/fuel/meals'),
        ),
      );
      const result = await fuelService.addMealImages(
        req.params.id as string,
        day,
        period,
        uploaded.map((upload) => upload.secure_url),
      );
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },
);

// DELETE /api/v1/fuel/plans/:id/meal-images (Admin)
// body: { day, period, image_url }
fuelRouter.delete(
  '/plans/:id/meal-images',
  jwtAuth,
  checkRoles(Role.ADMIN),
  async (req, res, next) => {
    try {
      const { day, period } = parseMealTarget(req.body);
      const imageUrl = String(req.body.image_url || '').trim();
      if (!imageUrl) {
        return res
          .status(400)
          .json({ status: 'error', message: 'image_url is required' });
      }

      const result = await fuelService.removeMealImage(
        req.params.id as string,
        day,
        period,
        imageUrl,
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/v1/fuel/plans/:id/chefs?delivery_time_slot=13:00
fuelRouter.get('/plans/:id/chefs', async (req, res, next) => {
  try {
    const result = await fuelService.listChefsForPlan(
      req.params.id as string,
      req.query.delivery_time_slot as string | undefined,
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/fuel/chef/plans
fuelRouter.get(
  '/chef/plans',
  jwtAuth,
  checkRoles(Role.CHEF),
  async (req, res, next) => {
    try {
      const chef = await resolveChefFromRequest(req);
      if (!chef) {
        return res
          .status(403)
          .json({ status: 'error', message: 'Chef profile not found' });
      }

      const result = await fuelService.listChefPlanCatalog(chef.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/v1/fuel/chef/slots
fuelRouter.get(
  '/chef/slots',
  jwtAuth,
  checkRoles(Role.CHEF),
  async (req, res, next) => {
    try {
      const chef = await resolveChefFromRequest(req);
      if (!chef) {
        return res
          .status(403)
          .json({ status: 'error', message: 'Chef profile not found' });
      }

      const result = await fuelService.listChefSlots(chef.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/v1/fuel/chef/slots
fuelRouter.post(
  '/chef/slots',
  jwtAuth,
  checkRoles(Role.CHEF),
  validationMiddleware(CreateFuelSlotDto),
  async (req, res, next) => {
    try {
      const chef = await resolveChefFromRequest(req);
      if (!chef) {
        return res
          .status(403)
          .json({ status: 'error', message: 'Chef profile not found' });
      }

      const result = await fuelService.enableChefPlan(chef.id, req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/v1/fuel/subscriptions
fuelRouter.post(
  '/subscriptions',
  jwtAuth,
  validationMiddleware(CreateFuelSubscriptionDto),
  async (req, res, next) => {
    try {
      const result = await fuelService.createSubscription(
        (req.user as any).id,
        req.body,
      );
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/v1/fuel/subscriptions/me
fuelRouter.get('/subscriptions/me', jwtAuth, async (req, res, next) => {
  try {
    const result = await fuelService.listMySubscriptions((req.user as any).id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/fuel/deliveries/me?date=YYYY-MM-DD
fuelRouter.get('/deliveries/me', jwtAuth, async (req, res, next) => {
  try {
    const result = await fuelService.listMyFulfillments(
      (req.user as any).id,
      req.query.date as string | undefined,
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/fuel/subscriptions/:id/pause
fuelRouter.post(
  '/subscriptions/:id/pause',
  jwtAuth,
  validationMiddleware(PauseFuelSubscriptionDto),
  async (req, res, next) => {
    try {
      const result = await fuelService.pauseSubscription(
        (req.user as any).id,
        req.params.id as string,
        req.body,
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/v1/fuel/chef/subscriptions
fuelRouter.get(
  '/chef/subscriptions',
  jwtAuth,
  checkRoles(Role.CHEF),
  async (req, res, next) => {
    try {
      const chef = await resolveChefFromUser((req.user as any).id);
      if (!chef) {
        return res
          .status(403)
          .json({ status: 'error', message: 'Chef profile not found' });
      }
      const result = await fuelService.listChefSubscriptions(chef.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/v1/fuel/chef/fulfillments?date=YYYY-MM-DD
fuelRouter.get(
  '/chef/fulfillments',
  jwtAuth,
  checkRoles(Role.CHEF),
  async (req, res, next) => {
    try {
      const chef = await resolveChefFromRequest(req);
      if (!chef) {
        return res
          .status(403)
          .json({ status: 'error', message: 'Chef profile not found' });
      }
      const result = await fuelService.listChefFulfillments(
        chef.id,
        req.query.date as string | undefined,
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/v1/fuel/now/chef-stream?token=<chef_jwt>
fuelRouter.get('/now/chef-stream', async (req, res, next) => {
  try {
    const chef = await resolveChefFromStreamToken(req);
    fuelLiveService.connectChef(chef.id, res);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/fuel/now/dispatch
fuelRouter.post('/now/dispatch', jwtAuth, async (req, res, next) => {
  try {
    const latitude = Number(req.body.latitude);
    const longitude = Number(req.body.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({
        status: 'error',
        message: 'latitude and longitude are required',
      });
    }

    const result = await fuelLiveService.startDispatch({
      user_id: (req.user as any).id,
      latitude,
      longitude,
      plan_id: req.body.plan_id,
      item_name: req.body.item_name,
      time_slot: req.body.time_slot,
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/fuel/now/dispatch/:id
fuelRouter.get('/now/dispatch/:id', jwtAuth, async (req, res, next) => {
  try {
    const session = fuelLiveService.getSession(req.params.id as string);
    if (!session) {
      return res.status(404).json({
        status: 'error',
        message: 'Fuel NOW dispatch session not found',
      });
    }
    res.json(session);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/fuel/now/dispatch/:id/respond
fuelRouter.post(
  '/now/dispatch/:id/respond',
  jwtAuth,
  checkRoles(Role.CHEF),
  async (req, res, next) => {
    try {
      const chef = await resolveChefFromRequest(req);
      if (!chef) {
        return res
          .status(403)
          .json({ status: 'error', message: 'Chef profile not found' });
      }
      const result = fuelLiveService.respond(
        req.params.id as string,
        chef.id,
        Boolean(req.body.accepted),
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

// PATCH /api/v1/fuel/fulfillments/:id/status
fuelRouter.patch(
  '/fulfillments/:id/status',
  jwtAuth,
  checkRoles(Role.CHEF, Role.ADMIN),
  validationMiddleware(UpdateFulfillmentStatusDto),
  async (req, res, next) => {
    try {
      const result = await fuelService.updateFulfillmentStatus(
        req.params.id as string,
        req.body.status as FuelFulfillmentStatus,
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/v1/fuel/fulfillments/:id/weigh-in
fuelRouter.post(
  '/fulfillments/:id/weigh-in',
  jwtAuth,
  checkRoles(Role.CHEF),
  batchProofUpload.single('batch_proof'),
  async (req: Request, res: Response, next) => {
    try {
      const chef = await resolveChefFromUser((req.user as any).id);
      if (!chef) {
        return res
          .status(403)
          .json({ status: 'error', message: 'Chef profile not found' });
      }
      if (!req.file) {
        return res
          .status(400)
          .json({ status: 'error', message: 'batch_proof photo is required' });
      }

      const grams = Number(req.body.weight_verification_grams);
      const uploadedProof = await cloudinaryService.uploadFile(
        req.file,
        'homey/fuel/weigh-ins',
      );
      const result = await fuelService.submitWeighIn(
        req.params.id as string,
        chef.id,
        uploadedProof.secure_url,
        grams,
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/v1/fuel/fulfillments/generate (Admin)
fuelRouter.post(
  '/fulfillments/generate',
  jwtAuth,
  checkRoles(Role.ADMIN),
  async (req, res, next) => {
    try {
      const daysAhead = req.body?.daysAhead
        ? Number(req.body.daysAhead)
        : undefined;
      const result = await fuelService.generateFulfillments(daysAhead);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/v1/fuel/reminders/prep/run (Admin)
fuelRouter.post(
  '/reminders/prep/run',
  jwtAuth,
  checkRoles(Role.ADMIN),
  async (req, res, next) => {
    try {
      const hoursBefore = req.body?.hoursBefore
        ? Number(req.body.hoursBefore)
        : 3;
      const result = await fuelService.sendPrepReminders(hoursBefore);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/v1/fuel/now/chefs?latitude=...&longitude=...
fuelRouter.get('/now/chefs', jwtAuth, async (req, res, next) => {
  try {
    const latitude = Number(req.query.latitude);
    const longitude = Number(req.query.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({
        status: 'error',
        message: 'latitude and longitude are required',
      });
    }

    const result = await fuelService.findFuelNowChefs(
      latitude,
      longitude,
      req.query.time_slot as string | undefined,
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default fuelRouter;
