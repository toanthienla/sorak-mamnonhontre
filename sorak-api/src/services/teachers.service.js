// Teachers service — Option A: CRUD on teachers table
import ExcelJS from 'exceljs';
import bcrypt from 'bcrypt';
import prisma from '../config/prisma.js';
import { paginate } from '../utils/paginate.js';
import { BadRequest, Conflict, NotFound } from '../utils/http-error.js';

const TEACHER_SELECT = {
  teacher_id: true,
  account_id: true,
  full_name: true,
  email: true,
  phone: true,
  position: true,
  gender: true,
  date_of_birth: true,
  address: true,
  work_start_date: true,
  qualification: true,
  work_status: true,
  deleted_at: true,
  created_at: true,
  account: { select: { role: true, is_active: true } },
};

async function assertExists(id) {
  const t = await prisma.teacher.findFirst({ where: { teacher_id: id } });
  if (!t) throw NotFound('Cán bộ không tồn tại');
  return t;
}

export async function create(dto) {
  const dup = await prisma.teacher.findFirst({ where: { email: dto.email }, select: { teacher_id: true } });
  if (dup) throw Conflict('Email đã tồn tại');

  return prisma.teacher.create({
    data: {
      full_name: dto.full_name,
      email: dto.email,
      phone: dto.phone || null,
      position: dto.position || null,
      gender: dto.gender || null,
      date_of_birth: dto.date_of_birth ? new Date(dto.date_of_birth) : null,
      address: dto.address || null,
      work_start_date: dto.work_start_date ? new Date(dto.work_start_date) : null,
      qualification: dto.qualification || null,
      work_status: dto.work_status || 'Đang làm việc',
      // No account yet — assigned later via AccountsPage
    },
    select: TEACHER_SELECT,
  });
}

export async function findArchived(query = {}) {
  const page = Number(query.page ?? 1);
  const pageSize = Number(query.pageSize ?? 100);
  const where = { deleted_at: { not: null } };
  if (query.search) {
    where.OR = [
      { full_name: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  const [data, total] = await prisma.$transaction([
    prisma.teacher.findMany({ where, select: TEACHER_SELECT, orderBy: { deleted_at: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.teacher.count({ where }),
  ]);
  return paginate(data, total, page, pageSize);
}

export async function findAll(query) {
  const { page, pageSize, search, sortBy, sortOrder } = query;
  const schoolYearId = query.school_year_id ? Number(query.school_year_id) : undefined;

  const where = { deleted_at: null };
  if (query.position) where.position = query.position;
  if (query.work_status) where.work_status = query.work_status;

  // is_active filter (via account relation)
  if (query.is_active === 'true') where.account = { is_active: true };
  else if (query.is_active === 'false') where.account = { is_active: false };

  // role filter
  if (query.role === 'none') {
    where.account_id = null;
  } else if (query.role) {
    where.account = { ...(where.account ?? {}), role: query.role };
  }


  if (search) {
    where.OR = [
      { full_name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
    ];
  }

  const orderBy = sortBy ? { [sortBy]: sortOrder } : { teacher_id: 'desc' };

  const [data, total] = await prisma.$transaction([
    prisma.teacher.findMany({
      where,
      select: {
        ...TEACHER_SELECT,
        teacher_classes: {
          where: {
            removed_at: null,
            ...(schoolYearId ? { class: { school_year_id: schoolYearId } } : {}),
          },
          select: {
            class: {
              select: {
                class_id: true,
                class_name: true,
                school_year: { select: { school_year_id: true, name: true, status: true } },
              },
            },
          },
        },
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.teacher.count({ where }),
  ]);

  return paginate(data, total, page, pageSize);
}

export async function findOne(id) {
  const t = await prisma.teacher.findUnique({
    where: { teacher_id: id },
    select: {
      ...TEACHER_SELECT,
      teacher_classes: {
        where: { removed_at: null },
        include: {
          class: { include: { school_year: { select: { school_year_id: true, name: true } } } },
        },
        orderBy: { assigned_at: 'desc' },
      },
    },
  });
  if (!t) throw NotFound('Cán bộ không tồn tại');
  return t;
}

export async function update(id, dto) {
  await assertExists(id);
  if (dto.email) {
    const dup = await prisma.teacher.findFirst({
      where: { email: dto.email, NOT: { teacher_id: id } },
      select: { teacher_id: true },
    });
    if (dup) throw Conflict('Email đã tồn tại');
  }
  return prisma.teacher.update({
    where: { teacher_id: id },
    data: {
      full_name: dto.full_name ?? undefined,
      email: dto.email ?? undefined,
      phone: dto.phone === undefined ? undefined : (dto.phone || null),
      position: dto.position ?? undefined,
      gender: dto.gender ?? undefined,
      date_of_birth: dto.date_of_birth ? new Date(dto.date_of_birth) : undefined,
      address: dto.address === undefined ? undefined : (dto.address || null),
      work_start_date: dto.work_start_date ? new Date(dto.work_start_date) : undefined,
      qualification: dto.qualification === undefined ? undefined : (dto.qualification || null),
      work_status: dto.work_status ?? undefined,
    },
    select: TEACHER_SELECT,
  });
}

export async function softDelete(id) {
  const t = await assertExists(id);
  if (t.deleted_at) throw BadRequest('Cán bộ đã bị xóa');
  return prisma.$transaction(async (tx) => {
    await tx.teacherClass.updateMany({
      where: { teacher_id: id, removed_at: null },
      data: { removed_at: new Date() },
    });
    if (t.account_id) {
      await tx.account.update({
        where: { account_id: t.account_id },
        data: { deleted_at: new Date(), is_active: false },
      });
    }
    await tx.teacher.update({
      where: { teacher_id: id },
      data: { deleted_at: new Date() },
    });
    return { teacher_id: id, deleted: true };
  });
}

export async function restore(id) {
  const t = await prisma.teacher.findUnique({ where: { teacher_id: id } });
  if (!t) throw NotFound('Cán bộ không tồn tại');
  if (!t.deleted_at) throw BadRequest('Cán bộ chưa bị xóa');
  await prisma.$transaction(async (tx) => {
    await tx.teacher.update({ where: { teacher_id: id }, data: { deleted_at: null } });
    if (t.account_id) {
      await tx.account.update({ where: { account_id: t.account_id }, data: { deleted_at: null } });
    }
  });
  return { teacher_id: id, restored: true };
}

export async function importExcel(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheet = wb.worksheets[0];
  if (!sheet) throw BadRequest('File Excel không có sheet');

  const errors = [];
  const created = [];

  for (let i = 2; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    const full_name = String(row.getCell(1).value ?? '').trim();
    const email = String(row.getCell(2).value ?? '').trim();
    const position = String(row.getCell(3).value ?? '').trim() || undefined;
    const phone = String(row.getCell(4).value ?? '').trim() || undefined;
    const dobRaw = row.getCell(5).value;
    const gender = String(row.getCell(6).value ?? '').trim() || undefined;
    const qualification = String(row.getCell(7).value ?? '').trim() || undefined;

    if (!full_name && !email) continue;
    if (!full_name || !email) { errors.push({ row: i, message: 'Thiếu full_name/email' }); continue; }

    try {
      const dob = dobRaw instanceof Date ? dobRaw.toISOString().slice(0, 10) : undefined;
      const result = await create({ full_name, email, position, phone, date_of_birth: dob, gender, qualification });
      created.push({ row: i, teacher_id: result.teacher_id, email });
    } catch (e) {
      errors.push({ row: i, message: e.message });
    }
  }

  return { success_count: created.length, error_count: errors.length, created, errors };
}

export async function exportExcel() {
  const teachers = await prisma.teacher.findMany({
    where: { deleted_at: null },
    include: {
      account: { select: { role: true, is_active: true } },
      teacher_classes: {
        where: { removed_at: null },
        include: { class: { include: { school_year: { select: { name: true } } } } },
      },
    },
    orderBy: { full_name: 'asc' },
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Cán bộ');
  ws.columns = [
    { header: 'Họ tên', key: 'name', width: 25 },
    { header: 'Email', key: 'email', width: 25 },
    { header: 'Chức vụ', key: 'position', width: 15 },
    { header: 'SĐT', key: 'phone', width: 15 },
    { header: 'Ngày sinh', key: 'dob', width: 12 },
    { header: 'Giới tính', key: 'gender', width: 10 },
    { header: 'Trình độ', key: 'qualification', width: 25 },
    { header: 'Lớp đang dạy', key: 'classes', width: 30 },
    { header: 'Vai trò', key: 'role', width: 10 },
    { header: 'Trạng thái TK', key: 'status', width: 12 },
  ];
  ws.getRow(1).font = { bold: true };

  for (const t of teachers) {
    const classes = t.teacher_classes
      .map((tc) => `${tc.class.class_name} - ${tc.class.school_year.name}`)
      .join('; ');
    ws.addRow({
      name: t.full_name, email: t.email, position: t.position ?? '',
      phone: t.phone ?? '', dob: t.date_of_birth ? t.date_of_birth.toISOString().slice(0, 10) : '',
      gender: t.gender ?? '', qualification: t.qualification ?? '', classes,
      role: t.account?.role ?? 'Chưa cấp',
      status: t.account?.is_active ? 'Active' : 'Inactive',
    });
  }

  const arr = await wb.xlsx.writeBuffer();
  return Buffer.from(arr);
}
