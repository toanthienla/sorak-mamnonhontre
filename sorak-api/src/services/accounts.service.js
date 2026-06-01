// Accounts service — Option A
// Staff accounts: managed via teachers (profile) + accounts (auth)
// PH accounts: auto-created with student, managed here
import bcrypt from 'bcrypt';
import prisma from '../config/prisma.js';
import { paginate } from '../utils/paginate.js';
import { BadRequest, Conflict, Forbidden, NotFound } from '../utils/http-error.js';
import logger from '../utils/logger.js';

// ─── Assign role + set password to a teacher (BGH/GV) ───────────────────────
// Creates an Account if teacher doesn't have one yet, or updates existing
export async function assignRole(teacherId, roleName, password) {
  const VALID_ROLES = ['BGH', 'GV'];
  if (!VALID_ROLES.includes(roleName)) throw BadRequest('Role không hợp lệ (BGH | GV)');

  const teacher = await prisma.teacher.findUnique({
    where: { teacher_id: teacherId },
    include: { account: true },
  });
  if (!teacher) throw NotFound('Cán bộ không tồn tại');

  if (teacher.account) {
    // Update existing account
    const data = { role: roleName };
    if (password) {
      data.password_hash = await bcrypt.hash(password, 12);
      data.is_active = true;
    }
    return prisma.account.update({ where: { account_id: teacher.account.account_id }, data });
  } else {
    // Create new account
    if (!password) throw BadRequest('Cần mật khẩu khi cấp tài khoản lần đầu');
    const acc = await prisma.account.create({
      data: {
        role: roleName,
        password_hash: await bcrypt.hash(password, 12),
        is_active: true,
      },
    });
    await prisma.teacher.update({
      where: { teacher_id: teacherId },
      data: { account_id: acc.account_id },
    });
    logger.info(`Account created for teacher ${teacher.full_name} (${roleName})`);
    return acc;
  }
}

// ─── Toggle account active status ───────────────────────────────────────────
export async function setActive(accountId, isActive) {
  const acc = await prisma.account.findUnique({ where: { account_id: accountId } });
  if (!acc) throw NotFound('Account không tồn tại');
  return prisma.account.update({
    where: { account_id: accountId },
    data: { is_active: Boolean(isActive) },
  });
}

// ─── Soft delete account ─────────────────────────────────────────────────────
export async function softDelete(accountId, actorId) {
  if (accountId === actorId) throw Forbidden('Không thể tự xóa tài khoản của mình');
  const acc = await prisma.account.findUnique({ where: { account_id: accountId } });
  if (!acc) throw NotFound('Account không tồn tại');
  if (acc.deleted_at) throw BadRequest('Account đã bị xóa');
  return prisma.account.update({
    where: { account_id: accountId },
    data: { deleted_at: new Date(), is_active: false },
  });
}

export async function restore(accountId) {
  const acc = await prisma.account.findUnique({ where: { account_id: accountId } });
  if (!acc) throw NotFound('Account không tồn tại');
  if (!acc.deleted_at) throw BadRequest('Account chưa bị xóa');
  return prisma.account.update({
    where: { account_id: accountId },
    data: { deleted_at: null, is_active: true },
  });
}
