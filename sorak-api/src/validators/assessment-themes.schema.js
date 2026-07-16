import Joi from 'joi';
import { paginationSchema } from './common.schema.js';

export const listAssessmentThemeQuery = paginationSchema.keys({
  assessment_age_group_id: Joi.number().integer().positive().optional(),
  development_field_id: Joi.number().integer().positive().optional(),
  assessment_subject_id: Joi.number().integer().positive().required(),
  is_active: Joi.string().valid('true', 'false').optional(),
});

export const createAssessmentThemeSchema = Joi.object({
  assessment_subject_id: Joi.number().integer().positive().required(),
  name: Joi.string().trim().max(150).required(),
  description: Joi.string().trim().max(500).allow('', null).optional(),
});

export const updateAssessmentThemeSchema = Joi.object({
  name: Joi.string().trim().max(150).optional(),
  description: Joi.string().trim().max(500).allow('', null).optional(),
}).min(1);

export const updateAssessmentThemeStatusSchema = Joi.object({
  is_active: Joi.boolean().required(),
});
