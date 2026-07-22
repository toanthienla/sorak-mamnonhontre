import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { validate } from '../middlewares/validate.js';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRoles } from '../middlewares/roles.js';
import {
  completeWeeklyDevelopmentPlanSchema,
  createWeeklyDevelopmentPlanSchema,
  listWeeklyDevelopmentPlanQuery,
  updateWeeklyMappingsSchema,
  weeklyCreateOptionsQuery,
} from '../validators/weekly-development-plans.schema.js';
import * as ctrl from '../controllers/weekly-development-plans.controller.js';

const router = Router();
router.use(authMiddleware);
router.use(requireRoles('TEACHER'));

router.get('/', validate(listWeeklyDevelopmentPlanQuery, 'query'), asyncHandler(ctrl.findAll));
router.get(
  '/create-options',
  validate(weeklyCreateOptionsQuery, 'query'),
  asyncHandler(ctrl.createOptions),
);
router.post('/', validate(createWeeklyDevelopmentPlanSchema), asyncHandler(ctrl.create));
router.get('/:id', asyncHandler(ctrl.findOne));
router.put(
  '/:id/mappings',
  validate(updateWeeklyMappingsSchema),
  asyncHandler(ctrl.updateMappings),
);
router.patch(
  '/:id/complete',
  validate(completeWeeklyDevelopmentPlanSchema),
  asyncHandler(ctrl.complete),
);
router.patch('/:id/revert-draft', asyncHandler(ctrl.revertToDraft));
router.delete('/:id', asyncHandler(ctrl.remove));

export default router;
