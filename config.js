/**
 * AI Chat Network - Server Configuration
 * Configuration settings for the server
 */

require('dotenv').config();

module.exports = {
  // Server port
  port: process.env.PORT || 8001,
  
  // JWT secret for authentication
  jwtSecret: process.env.JWT_SECRET || 'jermaneranson2025',
  
  // JWT expiration
  jwtExpiration: process.env.JWT_EXPIRATION || '24h',
  
  // Environment
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database connection (for future implementation)
  dbConnection: process.env.DB_CONNECTION || null,
  
  // CORS settings
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  },
  
  // WebSocket ping interval in milliseconds
  wsPingInterval: parseInt(process.env.WS_PING_INTERVAL) || 30000,
  
  // API Prefix
  apiPrefix: '/api'
};

// #CommentComplete
