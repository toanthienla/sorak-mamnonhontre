import Joi from 'joi';
import { paginationSchema } from './common.schema.js';

export const listAssessmentTopicQuery = paginationSchema.keys({
  assessment_theme_id: Joi.number().integer().positive().optional(),
  assessment_age_group_id: Joi.number().integer().positive().optional(),
  assessment_subject_id: Joi.number().integer().positive().optional(),
  is_active: Joi.string().valid('true', 'false').optional(),
});

export const createAssessmentTopicSchema = Joi.object({
  assessment_theme_id: Joi.number().integer().positive().required(),
  assessment_age_group_id: Joi.number().integer().positive().required(),
  assessment_subject_id: Joi.number().integer().positive().required(),
  name: Joi.string().trim().max(150).required(),
  description: Joi.string().trim().max(500).allow('', null).optional(),
});

export const updateAssessmentTopicSchema = Joi.object({
  name: Joi.string().trim().max(150).optional(),
  description: Joi.string().trim().max(500).allow('', null).optional(),
}).min(1);

export const updateAssessmentTopicStatusSchema = Joi.object({
  is_active: Joi.boolean().required(),
});
