import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { authGuard, AuthenticatedRequest } from './middleware/authGuard.js';
import apiRouter from './routes/apiRouter.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// 1. GLOBAL MIDDLEWARES
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log basic requests for debugging
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[HTTP] ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// 2. HEALTH & UNPROTECTED ENDPOINTS
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'UP',
      timestamp: new Date().toISOString()
    }
  });
});

// 3. SECURED ENDPOINTS (Protected by local JWT authGuard)
app.get('/api/health', authGuard, (req: AuthenticatedRequest, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'AUTHENTICATED_UP',
      user: req.user,
      timestamp: new Date().toISOString()
    }
  });
});

// Mount database and AI processing routing
app.use('/api', authGuard, apiRouter);

// 4. CENTRAL ERROR HANDLER MIDDLEWARE
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  const statusCode = err.status || 500;
  const errorCode = err.code || 'INTERNAL_SERVER_ERROR';

  console.error(`[Error Handler] ${errorCode}: ${err.message}`, err);

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: err.message || 'An unexpected error occurred.',
      details: process.env.NODE_ENV === 'development' ? err.details || null : undefined
    }
  });
});

// 5. SERVER RUNTIME BOOTSTRAP
app.listen(PORT, () => {
  console.log(`[Server] AiTaskManager Backend running on http://localhost:${PORT}`);
});

export default app;
