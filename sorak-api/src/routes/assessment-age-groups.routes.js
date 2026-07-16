import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { validate } from '../middlewares/validate.js';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRoles } from '../middlewares/roles.js';
import { listAssessmentAgeGroupQuery } from '../validators/assessment-age-groups.schema.js';
import * as ctrl from '../controllers/assessment-age-groups.controller.js';

const router = Router();
router.use(authMiddleware);

router.get(
  '/',
  requireRoles('PRINCIPAL', 'TEACHER'),
  validate(listAssessmentAgeGroupQuery, 'query'),
  asyncHandler(ctrl.findAll),
);

export default router;
