// Load .env before anything else reads process.env
import { CORS_ORIGIN, DEFAULT_OLLAMA_MODEL, NODE_ENV, OLLAMA_BASE_URL, PORT, envFileLoaded } from './config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import customerRoutes from './routes/customers';
import transactionRoutes from './routes/transactions';
import dashboardRoutes from './routes/dashboard';
import importRoutes from './routes/import';
import reminderRoutes from './routes/reminders';
import reportRoutes from './routes/reports';
import settingsRoutes from './routes/settings';

const app = express();

// Security middleware
app.use(helmet({ contentSecurityPolicy: false })); // CSP off for dev
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // generous for local dev
  message: { success: false, error: 'Too many requests' },
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API Routes
app.use('/api/customers', customerRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/import', importRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);

// Root and API index info
const apiIndexHandler = (_req: express.Request, res: express.Response) => {
  res.json({
    success: true,
    message: '🏪 UdhaarOS API is running',
    version: '1.0.0',
    documentation: 'See README.md for endpoint details',
    endpoints: {
      health: '/api/health',
      dashboard: '/api/dashboard',
      customers: '/api/customers',
      transactions: '/api/transactions',
      import: '/api/import',
      reminders: '/api/reminders',
      reports: '/api/reports',
      settings: '/api/settings',
    },
    frontendApp: CORS_ORIGIN,
  });
};

app.get('/', apiIndexHandler);
app.get('/api', apiIndexHandler);

// Health check at root
app.get('/api/health', async (_req, res) => {
  res.json({ success: true, data: { status: 'healthy', timestamp: new Date().toISOString() } });
});

// Error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', NODE_ENV === 'development' ? err : err.message);
  
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: 'Invalid JSON in request body' });
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, error: 'File too large' });
  }

  res.status(500).json({
    success: false,
    error: NODE_ENV === 'development' ? err.message : 'Internal server error',
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

app.listen(PORT, () => {
  console.log(`🏪 UdhaarOS API running on http://localhost:${PORT}`);
  console.log(`   Environment: ${NODE_ENV}`);
  console.log(`   CORS Origin: ${CORS_ORIGIN}`);
  console.log(`   Env file: ${envFileLoaded || '(none found — using defaults)'}`);
  console.log(`   Ollama URL: ${OLLAMA_BASE_URL}`);
  console.log(`   Default AI Model: ${DEFAULT_OLLAMA_MODEL} (change at runtime in Store Settings → AI Model Setup)`);
});

export default app;
