import Joi from 'joi';
import { paginationSchema } from './common.schema.js';

export const createTeacherSchema = Joi.object({
  full_name: Joi.string().max(150).required(),
  email: Joi.string().email({ tlds: { allow: false } }).max(150).required(),
  position: Joi.string().max(100).required(),
  phone: Joi.string().max(20).allow(null, '').optional(),
  date_of_birth: Joi.string().isoDate().allow(null, '').optional(),
  gender: Joi.string().valid('Nam', 'Nữ', 'Khác').optional(),
  address: Joi.string().max(500).allow(null, '').optional(),
  work_start_date: Joi.string().isoDate().allow(null, '').optional(),
  qualification: Joi.string().max(255).allow(null, '').optional(),
  work_status: Joi.string().max(50).optional(),
});

const WORK_STATUS_VALUES = ['Đang làm việc', 'Chuyển đến', 'Đã chuyển đi', 'Đã điều động', 'Chờ nghỉ hưu', 'Đã nghỉ hưu', 'Đã biệt phái', 'Thôi việc'];

export const updateTeacherSchema = Joi.object({
  full_name: Joi.string().max(150).optional(),
  email: Joi.string().email({ tlds: { allow: false } }).max(150).optional(),
  position: Joi.string().max(100).optional(),
  phone: Joi.string().max(20).allow(null, '').optional(),
  date_of_birth: Joi.string().isoDate().allow(null, '').optional(),
  gender: Joi.string().valid('Nam', 'Nữ', 'Khác').optional(),
  address: Joi.string().max(500).allow(null, '').optional(),
  work_start_date: Joi.string().isoDate().allow(null, '').optional(),
  qualification: Joi.string().max(255).allow(null, '').optional(),
  work_status: Joi.string().valid(...WORK_STATUS_VALUES).optional(),
}).min(1);

export const queryTeacherSchema = paginationSchema.keys({
  is_active: Joi.string().valid('true', 'false').optional(),
  school_year_id: Joi.string().pattern(/^\d+$/).optional(),
  position: Joi.string().max(100).optional(),
  role: Joi.string().valid('BGH', 'GV', 'none').optional(),
  work_status: Joi.string().optional(),
});
