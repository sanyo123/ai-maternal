import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { authService } from './services/auth.service.js';

// Import routes
import authRoutes from './routes/auth.routes.js';
import patientsRoutes from './routes/patients.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import digitalTwinsRoutes from './routes/digitalTwins.routes.js';
import policyRoutes from './routes/policy.routes.js';
import resourcesRoutes from './routes/resources.routes.js';

const app = express();

// Middleware
app.use(cors({
  origin: env.CORS_ORIGIN,
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/digital-twins', digitalTwinsRoutes);
app.use('/api/policy', policyRoutes);
app.use('/api/resources', resourcesRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: env.NODE_ENV === 'development' ? err.message : 'Internal server error',
  });
});

// Start server
const PORT = parseInt(env.PORT);

app.listen(PORT, async () => {
  console.log('='.repeat(60));
  console.log('🏥 Maternal & Child Health Tracker API');
  console.log('='.repeat(60));
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${env.NODE_ENV}`);
  console.log(`🔗 API URL: http://localhost:${PORT}`);
  console.log(`🔐 CORS Origin: ${env.CORS_ORIGIN}`);
  console.log('='.repeat(60));

  // Create default user
  try {
    await authService.createDefaultUser();
  } catch (error) {
    console.error('Error creating default user:', error);
  }

  console.log('');
  console.log('📚 Available Endpoints:');
  console.log('  POST /api/auth/register        - Register new user');
  console.log('  POST /api/auth/login           - Login user');
  console.log('  GET  /api/auth/verify          - Verify token');
  console.log('');
  console.log('  GET  /api/patients/maternal    - Get all maternal patients');
  console.log('  GET  /api/patients/pediatric   - Get all pediatric patients');
  console.log('  POST /api/patients/maternal/upload - Upload maternal CSV');
  console.log('  POST /api/patients/pediatric/upload - Upload pediatric CSV');
  console.log('');
  console.log('  GET  /api/analytics/dashboard  - Get dashboard stats');
  console.log('  GET  /api/analytics/trends     - Get risk trends');
  console.log('  GET  /api/analytics/insights   - Get AI insights');
  console.log('  POST /api/analytics/predict-risk - Predict patient risk');
  console.log('');
  console.log('  GET  /api/digital-twins/deviations - Get twin deviations');
  console.log('  GET  /api/digital-twins/vital-signs/:id - Get vital signs');
  console.log('  POST /api/digital-twins/vital-signs - Record vital signs');
  console.log('');
  console.log('  GET  /api/policy/scenarios     - Get policy scenarios');
  console.log('  POST /api/policy/scenarios     - Create policy scenario');
  console.log('  POST /api/policy/simulate      - Simulate policy impact');
  console.log('');
  console.log('  GET  /api/resources            - Get resource allocations');
  console.log('  POST /api/resources            - Create/update resources');
  console.log('  GET  /api/resources/forecast/:type - Get resource forecast');
  console.log('');
  console.log('='.repeat(60));
  console.log('🤖 Hugging Face AI: ENABLED');
  console.log('✅ Server ready to accept requests');
  console.log('='.repeat(60));
});

export default app;

