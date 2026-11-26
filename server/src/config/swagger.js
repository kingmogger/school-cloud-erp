import path from 'node:path';
import { fileURLToPath } from 'node:url';
import swaggerJsdoc from 'swagger-jsdoc';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const routesGlob = path.resolve(__dirname, '../routes/*.js').replace(/\\/g, '/');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Centralized School ERP API',
      version: '1.0.0',
      description: 'Versioned REST API for Admin, Faculty, Student, Parent portals and Academic Intelligence.',
    },
    servers: [{ url: '/api/v1', description: 'API v1' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: [routesGlob],
};

export const swaggerSpec = swaggerJsdoc(options);
