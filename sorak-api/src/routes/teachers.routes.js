import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { validate } from '../middlewares/validate.js';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRoles } from '../middlewares/roles.js';
import { uploadXlsx } from '../middlewares/upload.js';
import {
  createTeacherSchema,
  updateTeacherSchema,
  queryTeacherSchema,
} from '../validators/teachers.schema.js';
import * as ctrl from '../controllers/teachers.controller.js';

const router = Router();
router.use(authMiddleware);

router.post('/', requireRoles('BGH'), validate(createTeacherSchema), asyncHandler(ctrl.create));
router.get('/', requireRoles('BGH', 'GV'), validate(queryTeacherSchema, 'query'), asyncHandler(ctrl.findAll));
router.get('/archived', requireRoles('BGH', 'GV'), asyncHandler(ctrl.findArchived));
router.get('/:id', requireRoles('BGH', 'GV'), asyncHandler(ctrl.findOne));

export default router;
