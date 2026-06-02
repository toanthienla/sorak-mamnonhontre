import Joi from "joi";
import { paginationSchema } from "./common.schema.js";

export const parentInputSchema = Joi.object({
  full_name: Joi.string().max(150).required(),
  relationship: Joi.string().max(50).optional(),
  birth_year: Joi.number().integer().optional(),
  job: Joi.string().max(150).optional(),
  phone: Joi.string().max(20).optional(),
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .optional(),
  id_number: Joi.string().max(20).optional(),
  address: Joi.string().max(500).optional(),
});

export const STUDENT_STATUS_VALUES = [
  "Đang học",
  "Hoàn thành chương trình",
  "Chuyển đến kỳ 1",
  "Nghỉ học xin học lại kỳ 1",
  "Chuyển đi kỳ 1",
  "Thôi học kỳ 1",
  "Chuyển đến kỳ 2",
  "Nghỉ học xin học lại kỳ 2",
  "Chuyển đi kỳ 2",
  "Thôi học kỳ 2",
  "Chuyển đến trong hè",
  "Chuyển đi trong hè",
  "Thôi học trong hè",
];

export const createStudentSchema = Joi.object({
  // student_id_card_number is auto-generated — not accepted from client
  full_name: Joi.string().max(150).required(),
  date_of_birth: Joi.string().isoDate().required(),
  gender: Joi.string().valid("Nam", "Nữ").required(),
  grade_level: Joi.string().max(30).allow(null, "").optional(),
  enrollment_date: Joi.string().isoDate().allow(null, "").optional(),
  ethnicity: Joi.string().max(50).allow(null, "").optional(),
  nationality: Joi.string().max(50).allow(null, "").optional(),
  religion: Joi.string().max(50).allow(null, "").optional(),
  blood_type: Joi.string().max(5).allow(null, "").optional(),
  birth_place: Joi.string().max(255).allow(null, "").optional(),
  contact_phone: Joi.string().max(20).allow(null, "").optional(),
  permanent_province: Joi.string().max(100).allow(null, "").optional(),
  permanent_ward: Joi.string().max(100).allow(null, "").optional(),
  permanent_address_detail: Joi.string().max(500).allow(null, "").optional(),
  current_address: Joi.string().max(500).allow(null, "").optional(),
  hometown_province: Joi.string().max(100).allow(null, "").optional(),
  hometown_ward: Joi.string().max(100).allow(null, "").optional(),
  photo_url: Joi.string().max(500).allow(null, "").optional(),
  class_id: Joi.number().integer().positive().optional(),
  parents: Joi.array().items(parentInputSchema).max(5).optional(),
});

export const updateStudentSchema = Joi.object({
  full_name: Joi.string().max(150).optional(),
  student_status: Joi.string()
    .valid(...STUDENT_STATUS_VALUES)
    .optional(),
  date_of_birth: Joi.string().isoDate().optional(),
  gender: Joi.string().valid("Nam", "Nữ").optional(),
  grade_level: Joi.string().max(30).allow(null, "").optional(),
  enrollment_date: Joi.string().isoDate().allow(null, "").optional(),
  ethnicity: Joi.string().max(50).allow(null, "").optional(),
  nationality: Joi.string().max(50).allow(null, "").optional(),
  religion: Joi.string().max(50).allow(null, "").optional(),
  area_type: Joi.string().max(20).allow(null, "").optional(),
  blood_type: Joi.string().max(5).allow(null, "").optional(),
  contact_phone: Joi.string().max(20).allow(null, "").optional(),
  birth_place: Joi.string().max(255).allow(null, "").optional(),
  permanent_province: Joi.string().max(100).allow(null, "").optional(),
  permanent_ward: Joi.string().max(100).allow(null, "").optional(),
  permanent_address_detail: Joi.string().max(500).allow(null, "").optional(),
  current_address: Joi.string().max(500).allow(null, "").optional(),
  hometown_province: Joi.string().max(100).allow(null, "").optional(),
  hometown_ward: Joi.string().max(100).allow(null, "").optional(),
  photo_url: Joi.string().max(500).allow(null, "").optional(),
}).min(1);

export const queryStudentSchema = paginationSchema.keys({
  school_year_id: Joi.number().integer().optional(),
  class_id: Joi.number().integer().optional(),
  grade_level: Joi.string().optional(),
  is_active: Joi.string().valid("true", "false").optional(),
  student_status: Joi.string().optional(),
});
