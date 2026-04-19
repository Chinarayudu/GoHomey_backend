import express, { Express, Request, Response, NextFunction, Router } from 'express';
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

const app: Express = express();

// Security
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin: '*', // Allow all origins for development
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  credentials: true,
}));

// Monitoring and Parsing
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(initializePassport());

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
