import Joi from 'joi';
import { paginationSchema } from './common.schema.js';

export const listWeeklyDevelopmentPlanQuery = paginationSchema.keys({
  academicYearId: Joi.number().integer().positive().optional(),
  planningYear: Joi.number().integer().min(2000).max(2100).optional(),
  planningMonth: Joi.number().integer().min(1).max(12).optional(),
  status: Joi.string().valid('DRAFT', 'READY', 'USED').optional(),
  keyword: Joi.string().trim().allow('').optional(),
});

export const weeklyCreateOptionsQuery = Joi.object({
  academicYearId: Joi.number().integer().positive().optional(),
  planningYear: Joi.number().integer().min(2000).max(2100).required(),
  planningMonth: Joi.number().integer().min(1).max(12).required(),
});

export const createWeeklyDevelopmentPlanSchema = Joi.object({
  academicYearId: Joi.number().integer().positive().optional(),
  planningYear: Joi.number().integer().min(2000).max(2100).required(),
  planningMonth: Joi.number().integer().min(1).max(12).required(),
  weekNumber: Joi.number().integer().min(1).max(6).required(),
});

export const updateWeeklyMappingsSchema = Joi.object({
  activities: Joi.array()
    .items(
      Joi.object({
        weeklyPlanActivityId: Joi.number().integer().positive().required(),
        selectedCriteriaIds: Joi.array()
          .items(Joi.number().integer().positive())
          .unique()
          .required(),
      }),
    )
    .required(),
});

export const completeWeeklyDevelopmentPlanSchema = Joi.object({
  confirmIncompleteActivities: Joi.boolean().optional(),
});
