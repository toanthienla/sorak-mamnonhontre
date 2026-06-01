import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { validate } from '../middlewares/validate.js';
import { authMiddleware } from '../middlewares/auth.js';
import {
  loginSchema,
  parentLoginSchema
} from '../validators/auth.schema.js';
import * as ctrl from '../controllers/auth.controller.js';

const router = Router();

router.post('/login', validate(loginSchema), asyncHandler(ctrl.login));
router.post('/parent-login', validate(parentLoginSchema), asyncHandler(ctrl.parentLogin));

export default router;
