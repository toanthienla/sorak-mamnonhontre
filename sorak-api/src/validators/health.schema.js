import Joi from 'joi';
import { paginationSchema } from './common.schema.js';

// BR-096: positive numbers, sane kindergarten ranges
const height = Joi.number().positive().max(200);
const weight = Joi.number().positive().max(100);

export const createHealthSchema = Joi.object({
  student_id: Joi.number().integer().positive().required(),
  school_year_id: Joi.number().integer().positive().required(),
  assessment_date: Joi.string().isoDate().required(),
  height_cm: height.required(),
  weight_kg: weight.required(),
  note: Joi.string().trim().max(500).allow(null, '').optional(),
});

export const bulkHealthSchema = Joi.object({
  school_year_id: Joi.number().integer().positive().required(),
  class_id: Joi.number().integer().positive().required(),
  assessment_date: Joi.string().isoDate().required(),
  rows: Joi.array()
    .items(
      Joi.object({
        student_id: Joi.number().integer().positive().required(),
        height_cm: height.allow(null).optional(),
        weight_kg: weight.allow(null).optional(),
        note: Joi.string().trim().max(500).allow(null, '').optional(),
      }),
    )
    .min(1)
    .max(100)
    .required(),
});

export const byClassDateSchema = Joi.object({
  class_id: Joi.number().integer().positive().required(),
  assessment_date: Joi.string().isoDate().required(),
});

export const updateHealthSchema = Joi.object({
  assessment_date: Joi.string().isoDate().optional(),
  height_cm: height.optional(),
  weight_kg: weight.optional(),
  note: Joi.string().trim().max(500).allow(null, '').optional(),
}).min(1);

export const queryHealthSchema = paginationSchema.keys({
  school_year_id: Joi.number().integer().positive().optional(),
  class_id: Joi.number().integer().positive().optional(),
  student_id: Joi.number().integer().positive().optional(),
  bmi_status: Joi.string().optional(),
  date_from: Joi.string().isoDate().optional(),
  date_to: Joi.string().isoDate().optional(),
  latest: Joi.string().valid('true', 'false').optional(),
});

export const historyQuerySchema = Joi.object({
  student_id: Joi.number().integer().positive().required(),
  school_year_id: Joi.number().integer().positive().optional(),
});

export const curvesQuerySchema = Joi.object({
  indicator: Joi.string().valid('height', 'weight', 'bmi').required(),
  gender: Joi.string().valid('Nam', 'Nữ').required(),
});

// ─── Nutrition (đánh giá nuôi dưỡng — grid theo giai đoạn) ───────────────────

const PERIOD = Joi.string().valid(
  'dau_nam',
  'giua_ky_1',
  'cuoi_ky_1',
  'dau_ky_2',
  'giua_ky_2',
  'cuoi_nam',
);
const CHANNEL = Joi.string()
  .valid('Suy dinh dưỡng thể nhẹ cân', 'Cân nặng cao hơn tuổi')
  .allow(null, '');

export const nutritionGridQuerySchema = Joi.object({
  class_id: Joi.number().integer().positive().required(),
  school_year_id: Joi.number().integer().positive().required(),
  period: PERIOD.required(),
});

export const nutritionGridAllQuerySchema = Joi.object({
  school_year_id: Joi.number().integer().positive().required(),
  period: PERIOD.required(),
});

export const nutritionBulkSchema = Joi.object({
  class_id: Joi.number().integer().positive().required(),
  school_year_id: Joi.number().integer().positive().required(),
  period: PERIOD.required(),
  rows: Joi.array()
    .items(
      Joi.object({
        student_id: Joi.number().integer().positive().required(),
        weight_channel: CHANNEL.optional(),
        is_stunting: Joi.boolean().optional(),
        is_severe_stunting: Joi.boolean().optional(),
        is_obese: Joi.boolean().optional(),
        note: Joi.string().trim().max(500).allow(null, '').optional(),
      }),
    )
    .min(1)
    .max(100)
    .required(),
});
