import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { validate } from '../middlewares/validate.js';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRoles } from '../middlewares/roles.js';
import {
  createAssessmentContentRequestSchema,
  listAssessmentContentRequestQuery,
  reviewAssessmentContentRequestSchema,
} from '../validators/assessment-content-requests.schema.js';
import * as ctrl from '../controllers/assessment-content-requests.controller.js';

const router = Router();
router.use(authMiddleware, requireRoles('PRINCIPAL', 'TEACHER'));

router.post(
  '/',
  requireRoles('TEACHER'),
  validate(createAssessmentContentRequestSchema),
  asyncHandler(ctrl.create),
);
router.get('/', validate(listAssessmentContentRequestQuery, 'query'), asyncHandler(ctrl.findAll));
router.get('/:id', asyncHandler(ctrl.findOne));
router.patch(
  '/:id/review',
  requireRoles('PRINCIPAL'),
  validate(reviewAssessmentContentRequestSchema),
  asyncHandler(ctrl.review),
);
router.patch('/:id/cancel', requireRoles('TEACHER'), asyncHandler(ctrl.cancel));

export default router;
