import { Router } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { validate } from "../middlewares/validate.js";
import { authMiddleware } from "../middlewares/auth.js";
import { requireRoles } from "../middlewares/roles.js";
import {
  createAcademicYearSchema,
  updateAcademicYearSchema,
  listAcademicYearQuery,
} from "../validators/academic-years.schema.js";
import * as ctrl from "../controllers/academic-years.controller.js";

const router = Router();
router.use(authMiddleware);

router.post(
  "/",
  requireRoles("BGH"),
  validate(createAcademicYearSchema),
  asyncHandler(ctrl.create),
);
router.get(
  "/",
  requireRoles("BGH", "GV"),
  validate(listAcademicYearQuery, "query"),
  asyncHandler(ctrl.findAll),
);
router.get(
  "/archived",
  requireRoles("BGH", "GV"),
  asyncHandler(ctrl.findArchived),
);
router.get("/:id", requireRoles("BGH", "GV"), asyncHandler(ctrl.findOne));
router.patch(
  "/:id",
  requireRoles("BGH"),
  validate(updateAcademicYearSchema),
  asyncHandler(ctrl.update),
);
router.delete("/:id", requireRoles("BGH"), asyncHandler(ctrl.softDelete));
router.post("/:id/restore", requireRoles("BGH"), asyncHandler(ctrl.restore));

export default router;
