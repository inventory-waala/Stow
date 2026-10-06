import express, { Application, Request, Response } from 'express';
import morgan from 'morgan';
import helmet from 'helmet';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { routes } from './routes';

export function createApp(): Application {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(morgan('dev'));

  // Health check
  app.get('/health', (_req: Request, res: Response) => res.json({ status: 'ok' }));

  // Attach service routes from configuration
  for (const r of routes) {
    app.use(r.path, createProxyMiddleware(r.options));
  }

  // Fallback 404
  app.use((_req: Request, res: Response) => res.status(404).json({ error: 'not_found' }));

  return app;
}
