import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { validate } from '../middlewares/validate.js';
import { authMiddleware } from '../middlewares/auth.js';
import {
  loginSchema,
  parentLoginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validators/auth.schema.js';
import * as ctrl from '../controllers/auth.controller.js';

const router = Router();

router.post('/login', validate(loginSchema), asyncHandler(ctrl.login));
router.post('/parent-login', validate(parentLoginSchema), asyncHandler(ctrl.parentLogin));
router.post('/refresh', asyncHandler(ctrl.refresh));
router.post('/logout', authMiddleware, asyncHandler(ctrl.logout));
router.post('/forgot-password', validate(forgotPasswordSchema), asyncHandler(ctrl.forgotPassword));

export default router;
