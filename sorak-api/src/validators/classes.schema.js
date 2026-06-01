import Joi from 'joi';
import { paginationSchema } from './common.schema.js';

export const createClassSchema = Joi.object({
  class_name: Joi.string().max(100).required(),
  school_year_id: Joi.number().integer().min(1).required(),
  age_group: Joi.string().max(30).optional(),
  room: Joi.string().max(50).optional(),
});

export const updateClassSchema = Joi.object({
  class_name: Joi.string().max(100).optional(),
  age_group: Joi.string().max(30).optional(),
  room: Joi.string().max(50).optional(),
}).min(1);

export const queryClassSchema = paginationSchema.keys({
  school_year_id: Joi.number().integer().optional(),
  age_group: Joi.string().optional(),
});
