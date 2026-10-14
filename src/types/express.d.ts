import type { AuthUserPayload } from '../services/auth.service';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
    }
  }
}
