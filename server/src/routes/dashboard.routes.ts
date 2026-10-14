import { Router } from 'express';
import { getDashboard } from '../services/dashboard.service';

export const dashboardRouter = Router();

dashboardRouter.get('/', async (_req, res) => {
  res.json(await getDashboard());
});
