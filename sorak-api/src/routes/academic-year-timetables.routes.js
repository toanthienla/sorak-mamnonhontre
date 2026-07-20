import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { validate } from '../middlewares/validate.js';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRoles } from '../middlewares/roles.js';
import {
  assignedDailyActivitiesQuery,
  assignedWeeklyTimetableQuery,
  createAcademicYearTimetableSchema,
  listAcademicYearTimetableQuery,
  unlockAcademicYearTimetableSchema,
  updateAcademicYearTimetableSchema,
} from '../validators/academic-year-timetables.schema.js';
import * as ctrl from '../controllers/academic-year-timetables.controller.js';

const router = Router();
router.use(authMiddleware);

router.get(
  '/assigned/weekly',
  requireRoles('TEACHER'),
  validate(assignedWeeklyTimetableQuery, 'query'),
  asyncHandler(ctrl.assignedWeekly),
);
router.get(
  '/assigned/daily-activities',
  requireRoles('TEACHER'),
  validate(assignedDailyActivitiesQuery, 'query'),
  asyncHandler(ctrl.assignedDailyActivities),
);

router.get(
  '/',
  requireRoles('PRINCIPAL'),
  validate(listAcademicYearTimetableQuery, 'query'),
  asyncHandler(ctrl.findAll),
);
router.get('/:id', requireRoles('PRINCIPAL'), asyncHandler(ctrl.findOne));
router.post(
  '/',
  requireRoles('PRINCIPAL'),
  validate(createAcademicYearTimetableSchema),
  asyncHandler(ctrl.create),
);
router.put(
  '/:id',
  requireRoles('PRINCIPAL'),
  validate(updateAcademicYearTimetableSchema),
  asyncHandler(ctrl.update),
);
router.patch('/:id/lock', requireRoles('PRINCIPAL'), asyncHandler(ctrl.lock));
router.patch(
  '/:id/unlock',
  requireRoles('PRINCIPAL'),
  validate(unlockAcademicYearTimetableSchema),
  asyncHandler(ctrl.unlock),
);

export default router;
