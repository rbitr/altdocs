import { Router, Request, Response, NextFunction } from 'express';
import { createUser, createSession, getSessionWithUser, updateUser } from './db.js';
import type { SessionWithUser } from './db.js';

const router = Router();

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      user?: SessionWithUser;
    }
  }
}

/** Middleware: extract user from Authorization header if present. Does not reject unauthenticated requests. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const session = getSessionWithUser(token);
    if (session) {
      req.user = session;
    }
  }
  next();
}

// POST /api/auth/session — Create anonymous session (creates user + session)
router.post('/api/auth/session', (_req: Request, res: Response) => {
  const user = createUser();
  const session = createSession(user.id);
  res.status(201).json({
    token: session.token,
    user: {
      id: user.id,
      display_name: user.display_name,
      color: user.color,
    },
  });
});

// GET /api/auth/me — Get current user from session token
router.get('/api/auth/me', (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  res.json({
    id: req.user.user_id,
    display_name: req.user.display_name,
    color: req.user.color,
  });
});

// PUT /api/auth/me — Update display name
router.put('/api/auth/me', (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  const { display_name } = req.body;
  if (!display_name || typeof display_name !== 'string' || display_name.trim().length === 0) {
    res.status(400).json({ error: 'display_name is required and must be a non-empty string' });
    return;
  }
  const trimmed = display_name.trim().slice(0, 50); // Max 50 chars
  const updated = updateUser(req.user.user_id, trimmed);
  if (!updated) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({
    id: updated.id,
    display_name: updated.display_name,
    color: updated.color,
  });
});

export { router as authRouter };
