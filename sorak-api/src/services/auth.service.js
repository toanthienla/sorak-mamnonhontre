import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';
import { env } from '../config/env.js';
import { Unauthorized, BadRequest, NotFound } from '../utils/http-error.js';
import logger from '../utils/logger.js';
import { isEmailConfigured, sendOtpEmail } from './email.service.js';

const BCRYPT_ROUNDS = 12;

function signAccess(payload) {
  return jwt.sign(payload, env.jwt.accessSecret, { expiresIn: env.jwt.accessTtl });
}
function signRefresh(payload) {
  return jwt.sign(payload, env.jwt.refreshSecret, { expiresIn: env.jwt.refreshTtl });
}

export function defaultParentPassword(cardNumber) {
  return `${cardNumber}`;
}

export async function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

// ─── BGH/GV login: query teachers.email → account ───────────────────────────
export async function login(email, password) {
  const teacher = await prisma.teacher.findFirst({
    where: { email, deleted_at: null },
    include: { account: true },
  });
  if (!teacher?.account || !teacher.account.is_active || !teacher.account.password_hash) {
    throw Unauthorized('Email hoặc mật khẩu không đúng');
  }
  const ok = await bcrypt.compare(password, teacher.account.password_hash);
  if (!ok) throw Unauthorized('Email hoặc mật khẩu không đúng');

  const payload = { sub: teacher.account.account_id, role: teacher.account.role };
  return {
    accessToken: signAccess(payload),
    refreshToken: signRefresh(payload),
    user: {
      account_id: teacher.account.account_id,
      teacher_id: teacher.teacher_id,
      email: teacher.email,
      full_name: teacher.full_name,
      phone: teacher.phone,
      role: teacher.account.role,
      gender: teacher.gender ?? null,
    },
  };
}

// ─── PH login: query students.student_id_card_number → account ──────────────
export async function parentLogin(cardNumber, password) {
  const student = await prisma.student.findFirst({
    where: { student_id_card_number: cardNumber, deleted_at: null },
    include: { account: true },
  });
  if (!student?.account || !student.account.is_active || !student.account.password_hash) {
    throw Unauthorized('Mã thẻ hoặc mật khẩu không đúng');
  }
  const ok = await bcrypt.compare(password, student.account.password_hash);
  if (!ok) throw Unauthorized('Mã thẻ hoặc mật khẩu không đúng');

  const payload = { sub: student.account.account_id, role: 'PH' };
  return {
    accessToken: signAccess(payload),
    refreshToken: signRefresh(payload),
    user: {
      account_id: student.account.account_id,
      student_id: student.student_id,
      student_id_card_number: student.student_id_card_number,
      full_name: student.full_name,
      role: 'PH',
    },
  };
}

// ─── Refresh ────────────────────────────────────────────────────────────────
export async function refresh(refreshToken) {
  try {
    const payload = jwt.verify(refreshToken, env.jwt.refreshSecret);
    return { accessToken: signAccess({ sub: payload.sub, role: payload.role }) };
  } catch {
    throw Unauthorized('Refresh token không hợp lệ');
  }
}

// ─── /me ────────────────────────────────────────────────────────────────────
export async function getMe(reqUser) {
  if (reqUser.role === 'PH') {
    const student = await prisma.student.findFirst({
      where: { account_id: reqUser.sub, deleted_at: null },
      include: {
        parents: true,
        student_classes: {
          where: { left_date: null },
          include: { class: { include: { school_year: { select: { name: true } } } } },
          orderBy: { enrolled_date: 'desc' },
          take: 1,
        },
      },
    });
    if (!student) throw Unauthorized();
    return { ...student, role: 'PH' };
  }

  // BGH/GV
  const teacher = await prisma.teacher.findFirst({
    where: { account_id: reqUser.sub, deleted_at: null },
    include: { account: { select: { role: true, is_active: true } } },
  });
  if (!teacher) throw Unauthorized();
  return {
    account_id: reqUser.sub,
    teacher_id: teacher.teacher_id,
    email: teacher.email,
    full_name: teacher.full_name,
    phone: teacher.phone,
    role: teacher.account.role,
    gender: teacher.gender ?? null,
    position: teacher.position,
    work_status: teacher.work_status,
  };
}

// ─── Self change password ───────────────────────────────────────────────────
export async function changePassword(reqUser, oldPw, newPw) {
  const account = await prisma.account.findUnique({ where: { account_id: reqUser.sub } });
  if (!account?.password_hash) throw Unauthorized();
  const ok = await bcrypt.compare(oldPw, account.password_hash);
  if (!ok) throw BadRequest('Mật khẩu cũ không đúng');
  await prisma.account.update({
    where: { account_id: reqUser.sub },
    data: { password_hash: await hashPassword(newPw) },
  });
  return { message: 'Đổi mật khẩu thành công' };
}

// ─── Forgot password (BGH/GV) — email OTP ──────────────────────────────────
export async function forgotPassword(email) {
  const teacher = await prisma.teacher.findFirst({
    where: { email, deleted_at: null },
    include: { account: { select: { account_id: true, is_active: true } } },
  });
  if (teacher?.account?.is_active) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 10 * 60 * 1000);
    await prisma.account.update({
      where: { account_id: teacher.account.account_id },
      data: { otp_code: code, otp_expires_at: expires },
    });
    if (isEmailConfigured()) {
      try { await sendOtpEmail(email, code); }
      catch (e) { logger.error(`SMTP failed: ${e.message}. OTP: ${code}`); }
    } else {
      logger.info(`OTP for ${email}: ${code} (10 min)`);
    }
  }
  return { message: 'Nếu email tồn tại, mã OTP đã được gửi.' };
}

// ─── Reset password with OTP ────────────────────────────────────────────────
export async function resetPasswordWithOtp(email, otp, newPassword) {
  const teacher = await prisma.teacher.findFirst({
    where: { email, deleted_at: null },
    include: { account: true },
  });
  if (!teacher?.account || teacher.account.otp_code !== otp) throw BadRequest('OTP không hợp lệ');
  if (!teacher.account.otp_expires_at || teacher.account.otp_expires_at < new Date()) {
    throw BadRequest('OTP đã hết hạn');
  }
  await prisma.account.update({
    where: { account_id: teacher.account.account_id },
    data: { password_hash: await hashPassword(newPassword), otp_code: null, otp_expires_at: null },
  });
  return { message: 'Đặt lại mật khẩu thành công' };
}

// ─── Reset parent password to default (BGH/GV action) ───────────────────────
export async function resetParentPassword(studentId) {
  const student = await prisma.student.findUnique({
    where: { student_id: studentId },
    select: { student_id: true, student_id_card_number: true, account_id: true, deleted_at: true },
  });
  if (!student || student.deleted_at) throw NotFound('Học sinh không tồn tại');
  if (!student.account_id) throw BadRequest('Học sinh chưa có tài khoản');
  const defaultPw = defaultParentPassword(student.student_id_card_number);
  await prisma.account.update({
    where: { account_id: student.account_id },
    data: { password_hash: await hashPassword(defaultPw) },
  });
  return { default_password: defaultPw, message: 'Đã đặt lại mật khẩu phụ huynh về mặc định' };
}
