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
