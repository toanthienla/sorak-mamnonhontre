import { Router } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { validate } from "../middlewares/validate.js";
import { authMiddleware } from "../middlewares/auth.js";
import { requireRoles } from "../middlewares/roles.js";
import { uploadXlsx, uploadImage } from "../middlewares/upload.js";
import {
  createStudentSchema,
  updateStudentSchema,
  queryStudentSchema,
  parentInputSchema,
} from "../validators/students.schema.js";
import * as ctrl from "../controllers/students.controller.js";

const router = Router();
router.use(authMiddleware);

router.post(
  "/",
  requireRoles("BGH"),
  validate(createStudentSchema),
  asyncHandler(ctrl.create),
);
router.get(
  "/",
  requireRoles("BGH", "GV"),
  validate(queryStudentSchema, "query"),
  asyncHandler(ctrl.findAll),
);
router.get(
  "/archived",
  requireRoles("BGH", "GV"),
  asyncHandler(ctrl.findArchived),
);
router.get("/:id", requireRoles("BGH", "GV"), asyncHandler(ctrl.findOne));

export default router;
