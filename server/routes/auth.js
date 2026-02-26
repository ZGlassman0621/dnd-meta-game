/**
 * Auth Routes — Registration, login, and current user endpoint.
 */

import express from 'express';
import { register, login, getUserById, verifyToken, changePassword } from '../services/authService.js';
import { handleServerError } from '../utils/errorHandler.js';

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, password, displayName } = req.body;
    const result = await register(username, password, displayName);
    res.status(201).json(result);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    handleServerError(res, error, 'register');
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await login(username, password);
    res.json(result);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    handleServerError(res, error, 'login');
  }
});

// GET /api/auth/me — manually verifies token (mounted before auth middleware)
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const decoded = await verifyToken(authHeader.slice(7));
    const user = await getUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    handleServerError(res, error, 'get current user');
  }
});

// POST /api/auth/change-password (requires valid token)
router.post('/change-password', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const decoded = await verifyToken(authHeader.slice(7));

    const { currentPassword, newPassword } = req.body;
    const result = await changePassword(decoded.userId, currentPassword, newPassword);
    res.json(result);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    handleServerError(res, error, 'change password');
  }
});

export default router;
