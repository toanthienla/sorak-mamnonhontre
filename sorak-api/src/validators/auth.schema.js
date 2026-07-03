import Joi from 'joi';

export const loginSchema = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .required(),
  password: Joi.string().min(6).required(),
});

export const parentLoginSchema = Joi.object({
  student_id_card_number: Joi.string().trim().min(1).max(20).required(),
  password: Joi.string().min(6).required(),
});

export const changePasswordSchema = Joi.object({
  old_password: Joi.string().min(1).required(),
  new_password: Joi.string().min(6).max(72).required(),
});

export const forgotPasswordSchema = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .required(),
});

export const resetPasswordSchema = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .required(),
  otp: Joi.string().trim().length(6).pattern(/^\d+$/).required(),
  new_password: Joi.string().min(6).max(72).required(),
});
