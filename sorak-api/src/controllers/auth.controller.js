import * as authService from '../services/auth.service.js';
import { env } from '../config/env.js';
import { Unauthorized } from '../utils/http-error.js';

const ACCESS_COOKIE = 'sorak_access';
const REFRESH_COOKIE = 'sorak_refresh';

const cookieBase = (maxAge) => ({
  httpOnly: true,
  secure: false,   // HTTP on VPS — no SSL
  sameSite: 'lax',
  maxAge,
});

function setAuthCookies(res, { accessToken, refreshToken }) {
  res.cookie(ACCESS_COOKIE, accessToken, { ...cookieBase(15 * 60 * 1000), path: '/' });
  res.cookie(REFRESH_COOKIE, refreshToken, { ...cookieBase(7 * 24 * 60 * 60 * 1000), path: '/api/auth' });
}

function clearAuthCookies(res) {
  res.clearCookie(ACCESS_COOKIE, { path: '/' });
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
}

export async function login(req, res) {
  const result = await authService.login(req.body.email, req.body.password);
  setAuthCookies(res, result);
  res.success({ user: result.user });
}

export async function parentLogin(req, res) {
  const result = await authService.parentLogin(
    req.body.student_id_card_number,
    req.body.password,
  );
  setAuthCookies(res, result);
  res.success({ user: result.user });
}

export async function refresh(req, res) {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) throw Unauthorized('Missing refresh token');
  const { accessToken } = await authService.refresh(token);
  res.cookie(ACCESS_COOKIE, accessToken, { ...cookieBase(15 * 60 * 1000), path: '/' });
  res.success({ message: 'Token refreshed' });
}

export async function logout(req, res) {
  clearAuthCookies(res);
  res.success({ message: 'Logged out' });
}

export async function me(req, res) {
  res.success(await authService.getMe(req.user));
}
