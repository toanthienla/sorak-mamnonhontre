import Joi from 'joi';
import { paginationSchema } from './common.schema.js';

export const createAccountSchema = Joi.object({
  password: Joi.string().min(6).max(72).required(),
  full_name: Joi.string().max(150).required(),
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .max(150)
    .required(),
  phone: Joi.string().max(20).optional(),
  gender: Joi.string().valid('Nam', 'Nữ', 'Khác').optional(),
  date_of_birth: Joi.string().isoDate().optional(),
  address: Joi.string().max(500).allow(null, '').optional(),
  work_start_date: Joi.string().isoDate().optional(),
  qualification: Joi.string().max(255).allow(null, '').optional(),
  role: Joi.string().valid('PRINCIPAL', 'TEACHER').default('TEACHER'),
  is_active: Joi.boolean().default(true),
});

export const updateAccountSchema = Joi.object({
  full_name: Joi.string().max(150).optional(),
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .max(150)
    .optional(),
  phone: Joi.string().max(20).allow(null, '').optional(),
  gender: Joi.string().valid('Nam', 'Nữ', 'Khác').optional(),
  date_of_birth: Joi.string().isoDate().allow(null, '').optional(),
  address: Joi.string().max(500).allow(null, '').optional(),
  work_start_date: Joi.string().isoDate().allow(null, '').optional(),
  qualification: Joi.string().max(255).allow(null, '').optional(),
  is_active: Joi.boolean().optional(),
}).min(1);

export const changeRoleSchema = Joi.object({
  role: Joi.string().valid('PRINCIPAL', 'TEACHER').required(),
});

export const assignRoleSchema = Joi.object({
  role: Joi.string().valid('PRINCIPAL', 'TEACHER').required(),
  password: Joi.string().min(6).max(72).required(),
});

export const setActiveSchema = Joi.object({
  is_active: Joi.boolean().required(),
});

export const setPasswordSchema = Joi.object({
  password: Joi.string().min(6).max(72).required(),
});

export const queryAccountSchema = paginationSchema.keys({
  role: Joi.string().valid('PRINCIPAL', 'TEACHER').optional(),
  has_role: Joi.string().valid('true', 'false').optional(),
  is_active: Joi.string().valid('true', 'false').optional(),
  include_deleted: Joi.string().valid('true', 'false').optional(),
  work_status: Joi.string().optional(),
  position: Joi.string().optional(),
  type: Joi.string().valid('staff', 'parent').optional(),
  student_status: Joi.string().optional(),
});
