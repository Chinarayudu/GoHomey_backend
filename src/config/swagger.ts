import swaggerJSDoc from 'swagger-jsdoc';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'GoHomeyy API',
      version: '1.0.0',
      description: 'API documentation for GoHomeyy backend',
    },
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        BearerAuth: [],
      },
    ],
    servers: [
      {
        url: '/api/v1',
        description: 'API v1 Base URL',
      },
    ],
  },
  // By not explicitly forcing a strict 'servers' array here, Swagger UI 
  // will use the current host (e.g. Localtunnel URL) ensuring cross-origin issues are avoided.
  apis: ['./src/**/*.router.ts', './src/app.ts'],
};

export const swaggerSpec = swaggerJSDoc(options);
