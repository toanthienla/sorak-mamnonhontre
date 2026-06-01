import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { validate } from '../middlewares/validate.js';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRoles } from '../middlewares/roles.js';
import { uploadXlsx } from '../middlewares/upload.js';
import {
  createClassSchema,
  updateClassSchema,
  queryClassSchema,
} from '../validators/classes.schema.js';
import * as ctrl from '../controllers/classes.controller.js';

const router = Router();
router.use(authMiddleware);

router.post('/', requireRoles('BGH'), validate(createClassSchema), asyncHandler(ctrl.create));
router.get('/', requireRoles('BGH', 'GV'), validate(queryClassSchema, 'query'), asyncHandler(ctrl.findAll));
router.get('/archived', requireRoles('BGH', 'GV'), asyncHandler(ctrl.findArchived));

router.get('/:id', requireRoles('BGH', 'GV'), asyncHandler(ctrl.findOne));
router.patch('/:id', requireRoles('BGH'), validate(updateClassSchema), asyncHandler(ctrl.update));
router.delete('/:id', requireRoles('BGH'), asyncHandler(ctrl.softDelete));
router.patch('/:id/restore', requireRoles('BGH'), asyncHandler(ctrl.restore));

export default router;
