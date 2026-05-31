import Joi from 'joi';

const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  CORS_ORIGINS: Joi.string().default('http://localhost:5173'),

  DATABASE_URL: Joi.string().required(),

  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_TTL: Joi.string().default('15m'),
  JWT_REFRESH_TTL: Joi.string().default('7d'),

  SEED_ADMIN_EMAIL: Joi.string().email({ tlds: { allow: false } }).default('admin@sorak.local'),
  SEED_ADMIN_PHONE: Joi.string().default('0900000001'),

  CLOUDINARY_CLOUD_NAME: Joi.string().optional(),
  CLOUDINARY_API_KEY: Joi.string().optional(),
  CLOUDINARY_API_SECRET: Joi.string().optional(),

  // SMTP for forgot-password OTP email (BGH/GV). If unset → OTP logged to console.
  SMTP_HOST: Joi.string().optional(),
  SMTP_PORT: Joi.number().default(587),
  SMTP_USER: Joi.string().optional(),
  SMTP_PASS: Joi.string().optional(),
  SMTP_FROM: Joi.string().default('Sorak <no-reply@sorak.local>'),
}).unknown(true);

const { value, error } = schema.validate(process.env, { abortEarly: false });
if (error) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment:', error.message);
  process.exit(1);
}

export const env = {
  nodeEnv: value.NODE_ENV,
  port: Number(value.PORT),
  isProd: value.NODE_ENV === 'production',
  corsOrigins: value.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),

  databaseUrl: value.DATABASE_URL,

  jwt: {
    accessSecret: value.JWT_ACCESS_SECRET,
    refreshSecret: value.JWT_REFRESH_SECRET,
    accessTtl: value.JWT_ACCESS_TTL,
    refreshTtl: value.JWT_REFRESH_TTL,
  },

  seed: {
    email: value.SEED_ADMIN_EMAIL,
    phone: value.SEED_ADMIN_PHONE,
  },

  cloudinary: {
    cloudName: value.CLOUDINARY_CLOUD_NAME,
    apiKey: value.CLOUDINARY_API_KEY,
    apiSecret: value.CLOUDINARY_API_SECRET,
  },

  smtp: {
    host: value.SMTP_HOST,
    port: Number(value.SMTP_PORT),
    user: value.SMTP_USER,
    pass: value.SMTP_PASS,
    from: value.SMTP_FROM,
  },
};
