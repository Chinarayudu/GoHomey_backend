import express, { Express, Request, Response, NextFunction, Router } from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import 'reflect-metadata';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import { initializePassport } from './common/middleware/auth.middleware';

// We will import routers here as they are created
import authRouter from './auth/auth.router';
import usersRouter from './users/users.router';
import chefsRouter from './chefs/chefs.router';
import mealsRouter from './meals/meals.router';
import ordersRouter from './orders/orders.router';
import pantryRouter from './pantry/pantry.router';
import paymentsRouter from './payments/payments.router';
import subscriptionsRouter from './subscriptions/subscriptions.router';
import deliveryRouter from './delivery/delivery.router';
import adminRouter from './admin/admin.router';
import socialRouter from './social/social.router';
import webhooksRouter from './delivery/webhooks.router';
import followsRouter from './follows/follows.router';
import feedRouter from './feed/feed.router';
import fuelRouter from './fuel/fuel.router';
import notificationsRouter from './notifications/notifications.router';

const app: Express = express();
app.set('trust proxy', 1);

function makePublicUploadUrls(data: any, baseUrl: string): any {
  if (typeof data === 'string') {
    return data.startsWith('/uploads/') ? `${baseUrl}${data}` : data;
  }

  if (data instanceof Date) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => makePublicUploadUrls(item, baseUrl));
  }

  if (data && typeof data === 'object') {
    return Object.fromEntries(
      Object.entries(data).map(([key, value]) => [
        key,
        makePublicUploadUrls(value, baseUrl),
      ]),
    );
  }

  return data;
}

// Security
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
// Auth is Bearer-token based (no cookies), so credentials/origin-echo is not needed.
// Set CORS_ORIGIN to a comma-separated allowlist (e.g. "https://app.example.com,https://admin.example.com")
// to restrict origins in production; defaults to allowing all origins.
const corsOrigins = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors({
  origin: corsOrigins && corsOrigins.length > 0 ? corsOrigins : '*',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
}));

// Monitoring and Parsing
app.use(morgan('dev'));
app.use(express.json({
  verify: (req: any, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));
app.use(initializePassport());
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body?: any) => {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return originalJson(makePublicUploadUrls(body, baseUrl));
  };
  next();
});

// API v1 prefix
// Root route
app.get('/', (req, res) => {
  res.send('Hello World!');
});

const apiV1Router = Router();
app.use('/api/v1', apiV1Router);

// Health check
/**
 * @openapi
 * /health:
 *   get:
 *     summary: Returns API health status
 *     responses:
 *       200:
 *         description: API is up and running
 */
apiV1Router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Actual module routing
apiV1Router.use('/auth', authRouter);
apiV1Router.use('/users', usersRouter);
apiV1Router.use('/chefs', chefsRouter);
apiV1Router.use('/meals', mealsRouter);
apiV1Router.use('/orders', ordersRouter);
apiV1Router.use('/pantry', pantryRouter);
apiV1Router.use('/payments', paymentsRouter);
apiV1Router.use('/subscriptions', subscriptionsRouter);
apiV1Router.use('/delivery', deliveryRouter);
apiV1Router.use('/admin', adminRouter);
apiV1Router.use('/social', socialRouter);
apiV1Router.use('/webhooks', webhooksRouter);
apiV1Router.use('/follows', followsRouter);
apiV1Router.use('/feed', feedRouter);
apiV1Router.use('/fuel', fuelRouter);
apiV1Router.use('/notifications', notificationsRouter);

// Swagger setup
apiV1Router.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  const status = err.status || 500;
  res.status(status).json({
    status: 'error',
    message: err.message || 'Internal Server Error',
    errors: err.errors || undefined,
  });
});

export default app;
