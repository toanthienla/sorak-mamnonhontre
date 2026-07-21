import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { validate } from '../middlewares/validate.js';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRoles } from '../middlewares/roles.js';
import {
  completeMonthlyThemePlanSchema,
  createMonthlyThemePlanSchema,
  criteriaBankQuery,
  listMonthlyThemePlanQuery,
  planningWeeksQuery,
  updateMonthlyThemePlanSchema,
  updateSelectedCriteriaSchema,
} from '../validators/monthly-theme-plans.schema.js';
import * as ctrl from '../controllers/monthly-theme-plans.controller.js';

const router = Router();
router.use(authMiddleware);
router.use(requireRoles('TEACHER'));

router.get('/', validate(listMonthlyThemePlanQuery, 'query'), asyncHandler(ctrl.findAll));
router.post('/', validate(createMonthlyThemePlanSchema), asyncHandler(ctrl.create));
router.get(
  '/planning-weeks',
  validate(planningWeeksQuery, 'query'),
  asyncHandler(ctrl.planningWeeks),
);
router.get('/:id', asyncHandler(ctrl.findOne));
router.put('/:id', validate(updateMonthlyThemePlanSchema), asyncHandler(ctrl.update));
router.patch(
  '/:id/complete',
  validate(completeMonthlyThemePlanSchema),
  asyncHandler(ctrl.complete),
);
router.patch('/:id/revert-draft', asyncHandler(ctrl.revertToDraft));
router.delete('/:id', asyncHandler(ctrl.remove));
router.get(
  '/:id/criteria-bank',
  validate(criteriaBankQuery, 'query'),
  asyncHandler(ctrl.criteriaBank),
);
router.put(
  '/:id/selected-criteria',
  validate(updateSelectedCriteriaSchema),
  asyncHandler(ctrl.updateSelectedCriteria),
);

export default router;
