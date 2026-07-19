import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { validate } from '../middlewares/validate.js';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRoles } from '../middlewares/roles.js';
import {
  createAssessmentTopicSchema,
  listAssessmentTopicQuery,
  updateAssessmentTopicSchema,
  updateAssessmentTopicStatusSchema,
} from '../validators/assessment-topics.schema.js';
import * as ctrl from '../controllers/assessment-topics.controller.js';

const router = Router();
router.use(authMiddleware);

router.get(
  '/',
  requireRoles('PRINCIPAL', 'TEACHER'),
  validate(listAssessmentTopicQuery, 'query'),
  asyncHandler(ctrl.findAll),
);
router.get('/:id', requireRoles('PRINCIPAL', 'TEACHER'), asyncHandler(ctrl.findOne));
router.post(
  '/',
  requireRoles('PRINCIPAL'),
  validate(createAssessmentTopicSchema),
  asyncHandler(ctrl.create),
);
router.patch(
  '/:id',
  requireRoles('PRINCIPAL'),
  validate(updateAssessmentTopicSchema),
  asyncHandler(ctrl.update),
);
router.patch(
  '/:id/status',
  requireRoles('PRINCIPAL'),
  validate(updateAssessmentTopicStatusSchema),
  asyncHandler(ctrl.setStatus),
);
router.delete('/:id', requireRoles('PRINCIPAL'), asyncHandler(ctrl.remove));

export default router;
