import { Router } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { validate } from "../middlewares/validate.js";
import { authMiddleware } from "../middlewares/auth.js";
import { requireRoles } from "../middlewares/roles.js";
import { assignRoleSchema } from "../validators/accounts.schema.js";
import * as ctrl from "../controllers/accounts.controller.js";
import {
  setActiveSchema
} from '../validators/accounts.schema.js';

const router = Router();
router.use(authMiddleware, requireRoles("BGH"));

router.post("/:id/assign-role", validate(assignRoleSchema), asyncHandler(ctrl.assignRole));
export default router;
outer.patch("/:id/active", validate(setActiveSchema), asyncHandler(ctrl.setActive));