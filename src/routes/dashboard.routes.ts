import { Router } from 'express';
import { authenticate, requirePermissionOrRole, PERMISSIONS } from '../middleware/auth.middleware';
import { getDashboard } from '../services/dashboard.service';

export const dashboardRouter = Router();

// Dashboard Omzet & Laba: Pemilik atau Staf dengan izin VIEW_DASHBOARD
dashboardRouter.get(
  '/',
  authenticate,
  requirePermissionOrRole(PERMISSIONS.VIEW_DASHBOARD, 'PEMILIK'),
  async (_req, res, next) => {
    try {
      res.json(await getDashboard());
    } catch (error) {
      next(error);
    }
  }
);
