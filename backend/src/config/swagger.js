const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Chat API',
      version: '1.0.0',
      description: 'Authentication (JWT), messaging, groups, uploads',
    },
    servers: [{ url: 'http://localhost:3000' }],
  },
  apis: [
    path.join(__dirname, '../routes/authRoutes.js'),
    path.join(__dirname, '../routes/chatRoutes.js'),
  ],
};

module.exports = swaggerJsdoc(options);
