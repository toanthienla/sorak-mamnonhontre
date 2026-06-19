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
  const VALID_ROLES = ['PRINCIPAL', 'TEACHER'];
  if (!VALID_ROLES.includes(roleName)) throw BadRequest('Role không hợp lệ (BGH | GV)');

  const teacher = await prisma.teacher.findUnique({
    where: { teacher_id: teacherId },
    include: { account: true },
  });
  if (!teacher) throw NotFound('Cán bộ không tồn tại');
  if (teacher.account) throw Conflict('Cán bộ đã có tài khoản — dùng đổi vai trò');

  // Create new account (password required by schema) + link to teacher
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

// Shape returned to the accounts UI: account fields + linked teacher profile
const ACCOUNT_SELECT = {
  account_id: true,
  role: true,
  is_active: true,
  deleted_at: true,
  created_at: true,
  teacher: {
    select: {
      teacher_id: true,
      full_name: true,
      email: true,
      phone: true,
      position: true,
      work_status: true,
      gender: true,
    },
  },
};

// Staff list shape: teacher profile + nested account status (account may be null)
const STAFF_TEACHER_SELECT = {
  teacher_id: true,
  full_name: true,
  email: true,
  phone: true,
  position: true,
  work_status: true,
  gender: true,
  deleted_at: true,
  account_id: true,
  account: { select: { account_id: true, role: true, is_active: true } },
};

// Parent list shape: student profile + nested account status (mirror of staff)
const STUDENT_ACC_SELECT = {
  student_id: true,
  student_id_card_number: true,
  full_name: true,
  student_status: true,
  deleted_at: true,
  account_id: true,
  account: { select: { account_id: true, role: true, is_active: true } },
  enrollments: {
    where: { left_date: null },
    select: { class: { select: { class_id: true, class_name: true } } },
    orderBy: { enrolled_date: 'desc' },
    take: 1,
  },
};

const STUDENT_SORT_FIELDS = ['full_name', 'student_id_card_number', 'student_status'];

// ─── List accounts (type=staff → teachers | type=parent → students) ──────────
export async function findAll(query) {
  const { page, pageSize, search, sortBy, sortOrder } = query;
  const type = query.type === 'parent' ? 'parent' : 'staff';

  if (type === 'parent') {
    // parent: list students (account auto-created) so it mirrors staff query
    const sWhere = { deleted_at: null, account_id: { not: null } };
    if (query.student_status) sWhere.student_status = query.student_status;
    if (query.is_active === 'true') sWhere.account = { is_active: true };
    else if (query.is_active === 'false') sWhere.account = { is_active: false };
    if (search) {
      sWhere.OR = [
        { full_name: { contains: search, mode: 'insensitive' } },
        { student_id_card_number: { contains: search, mode: 'insensitive' } },
      ];
    }

    const sOrderBy =
      sortBy && STUDENT_SORT_FIELDS.includes(sortBy)
        ? { [sortBy]: sortOrder }
        : { student_id: 'desc' };

    const [data, total] = await prisma.$transaction([
      prisma.student.findMany({
        where: sWhere,
        select: STUDENT_ACC_SELECT,
        orderBy: sOrderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.student.count({ where: sWhere }),
    ]);
    return paginate(data, total, page, pageSize);
  }

  // staff: list ALL teachers (with OR without account) so unassigned ones show up
  const tWhere = { deleted_at: null };
  if (query.work_status) tWhere.work_status = query.work_status;
  if (query.position) tWhere.position = query.position;

  if (query.is_active === 'true') tWhere.account = { is_active: true };
  else if (query.is_active === 'false') tWhere.account = { is_active: false };

  if (query.role === 'none') {
    tWhere.account_id = null;
  } else if (query.role) {
    tWhere.account = { ...(tWhere.account ?? {}), role: query.role };
  }

  if (search) {
    tWhere.OR = [
      { full_name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  const orderBy = sortBy ? { [sortBy]: sortOrder } : { teacher_id: 'desc' };

  const [data, total] = await prisma.$transaction([
    prisma.teacher.findMany({
      where: tWhere,
      select: STAFF_TEACHER_SELECT,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.teacher.count({ where: tWhere }),
  ]);

  return paginate(data, total, page, pageSize);
}

// ─── Get one account by account_id (with teacher profile) ────────────────────
export async function findOne(accountId) {
  const acc = await prisma.account.findUnique({
    where: { account_id: accountId },
    select: ACCOUNT_SELECT,
  });
  if (!acc) throw NotFound('Account không tồn tại');
  return acc;
}

// ─── Change role of an existing account ─────────────────────────────────────
export async function changeRole(teacherId, roleName) {
  const VALID_ROLES = ['PRINCIPAL', 'TEACHER'];
  if (!VALID_ROLES.includes(roleName)) throw BadRequest('Role không hợp lệ (BGH | GV)');
  const teacher = await prisma.teacher.findUnique({
    where: { teacher_id: teacherId },
    include: { account: true },
  });
  if (!teacher) throw NotFound('Cán bộ không tồn tại');
  if (!teacher.account) throw BadRequest('Cán bộ chưa có tài khoản');
  return prisma.account.update({
    where: { account_id: teacher.account.account_id },
    data: { role: roleName },
  });
}

// ─── Set a new password on an account (by account_id) ───────────────────────
export async function setPassword(accountId, password) {
  const acc = await prisma.account.findUnique({ where: { account_id: accountId } });
  if (!acc) throw NotFound('Account không tồn tại');
  return prisma.account.update({
    where: { account_id: accountId },
    data: { password_hash: await bcrypt.hash(password, 12) },
  });
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
