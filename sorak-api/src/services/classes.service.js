import ExcelJS from 'exceljs';
import prisma from '../config/prisma.js';
import { paginate } from '../utils/paginate.js';
import { BadRequest, Conflict, NotFound } from '../utils/http-error.js';
import { searchIds } from '../utils/search.js';

async function assertExists(id) {
  const cls = await prisma.class.findFirst({ where: { class_id: id, deleted_at: null } });
  if (!cls) throw NotFound('Class not found');
  return cls;
}

async function assertYearOpen(yearId) {
  const year = await prisma.schoolYear.findFirst({
    where: { school_year_id: yearId, deleted_at: null },
  });
  if (!year) throw BadRequest('Năm học không tồn tại');
  if (year.status === 'closed') throw BadRequest('Năm học đã đóng — không thể tạo lớp');
}

async function getTeacherIdByAccountId(accountId) {
  const t = await prisma.teacher.findFirst({
    where: { account_id: Number(accountId) },
    select: { teacher_id: true },
  });
  if (!t) throw BadRequest('GV chủ nhiệm không tồn tại');
  return t.teacher_id;
}

export async function create(dto) {
  await assertYearOpen(dto.school_year_id);
  const dup = await prisma.class.findFirst({
    where: { class_name: dto.class_name, school_year_id: dto.school_year_id, deleted_at: null },
    select: { class_id: true },
  });
  if (dup) throw Conflict(`Lớp "${dto.class_name}" đã tồn tại trong năm học này`);
  return prisma.class.create({
    data: {
      class_name: dto.class_name,
      school_year_id: dto.school_year_id,
      age_group: dto.age_group,
      room: dto.room,
    },
  });
}

export async function findArchived(query = {}) {
  const page = Number(query.page ?? 1);
  const pageSize = Number(query.pageSize ?? 100);
  const where = { deleted_at: { not: null } };
  if (query.search) {
    const ids = await searchIds('classes', 'class_id', ['class_name'], query.search);
    where.class_id = { in: ids ?? [] };
  }
  const [data, total] = await prisma.$transaction([
    prisma.class.findMany({
      where,
      include: {
        school_year: { select: { school_year_id: true, name: true } },
        teacher_classes: {
          where: { removed_at: null },
          include: { teacher: { select: { teacher_id: true, full_name: true } } },
        },
      },
      orderBy: { deleted_at: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.class.count({ where }),
  ]);
  return paginate(data, total, page, pageSize);
}

const CLASS_GRADE_RANK = { 'Nhà trẻ': 0, Mầm: 1, Chồi: 2, Lá: 3 };

export async function findAll(query, user) {
  const { page, pageSize, search, sortBy, sortOrder, school_year_id, age_group } = query;
  const where = { deleted_at: null };
  if (school_year_id) where.school_year_id = school_year_id;
  if (age_group) where.age_group = age_group;
  if (search) {
    const ids = await searchIds('classes', 'class_id', ['class_name'], search);
    where.class_id = { in: ids ?? [] };
  }

  // Teachers: only their assigned classes
  if (user?.role === 'TEACHER') {
    where.teacher_classes = { some: { removed_at: null, teacher: { account_id: user.sub } } };
  }

  const orderBy = sortBy ? { [sortBy]: sortOrder } : { created_at: 'desc' };

  const include = {
    school_year: { select: { school_year_id: true, name: true } },
    teacher_classes: {
      where: { removed_at: null },
      include: {
        teacher: {
          select: { teacher_id: true, account_id: true, full_name: true, position: true },
        },
      },
    },
    _count: { select: { enrollments: { where: { left_date: null } } } },
  };

  const total = await prisma.class.count({ where });

  // Default (no explicit sort): grade order Nhà trẻ→Mầm→Chồi→Lá, fetch all + slice
  if (!sortBy) {
    const all = await prisma.class.findMany({ where, include });
    all.sort((a, b) => {
      const ga = CLASS_GRADE_RANK[a.age_group] ?? 99,
        gb = CLASS_GRADE_RANK[b.age_group] ?? 99;
      if (ga !== gb) return ga - gb;
      return (a.class_name ?? '').localeCompare(b.class_name ?? '', 'vi');
    });
    const start = (page - 1) * pageSize;
    return paginate(all.slice(start, start + pageSize), all.length, page, pageSize);
  }

  const data = await prisma.class.findMany({
    where,
    include,
    orderBy,
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  return paginate(data, total, page, pageSize);
}

export async function findOne(id) {
  const cls = await prisma.class.findFirst({
    where: { class_id: id, deleted_at: null },
    include: {
      school_year: true,
      teacher_classes: {
        where: { removed_at: null },
        include: {
          teacher: {
            select: {
              teacher_id: true,
              account_id: true,
              full_name: true,
              email: true,
              phone: true,
              position: true,
            },
          },
        },
      },
      enrollments: {
        where: { left_date: null },
        include: {
          student: {
            select: {
              student_id: true,
              full_name: true,
              date_of_birth: true,
              gender: true,
              photo_url: true,
            },
          },
        },
      },
    },
  });
  if (!cls) throw NotFound('Class not found');
  return cls;
}

export async function update(id, dto) {
  const cls = await assertExists(id);
  if (dto.class_name && dto.class_name !== cls.class_name) {
    const dup = await prisma.class.findFirst({
      where: {
        class_name: dto.class_name,
        school_year_id: cls.school_year_id,
        deleted_at: null,
        NOT: { class_id: id },
      },
      select: { class_id: true },
    });
    if (dup) throw Conflict(`Lớp "${dto.class_name}" đã tồn tại trong năm học này`);
  }
  return prisma.class.update({
    where: { class_id: id },
    data: {
      class_name: dto.class_name ?? undefined,
      age_group: dto.age_group ?? undefined,
      room: dto.room ?? undefined,
    },
  });
}

export async function addTeacher(classId, accountId) {
  await assertExists(classId);
  const teacher = await prisma.teacher.findFirst({
    where: { account_id: Number(accountId), deleted_at: null },
    select: { teacher_id: true },
  });
  if (!teacher) throw BadRequest('Giáo viên không tồn tại');
  await prisma.teacherClass.upsert({
    where: { teacher_id_class_id: { teacher_id: teacher.teacher_id, class_id: classId } },
    create: { teacher_id: teacher.teacher_id, class_id: classId },
    update: { removed_at: null },
  });
  return { teacher_id: teacher.teacher_id, class_id: classId };
}

export async function removeTeacher(classId, teacherId) {
  await assertExists(classId);
  await prisma.teacherClass.updateMany({
    where: { class_id: classId, teacher_id: Number(teacherId), removed_at: null },
    data: { removed_at: new Date() },
  });
}

export async function softDelete(id) {
  await assertExists(id);
  const studentCount = await prisma.studentEnrollment.count({
    where: { class_id: id, left_date: null },
  });
  if (studentCount > 0) throw BadRequest(`Không thể xóa — còn ${studentCount} học sinh trong lớp`);

  return prisma.$transaction(async (tx) => {
    await tx.teacherClass.updateMany({
      where: { class_id: id, removed_at: null },
      data: { removed_at: new Date() },
    });
    return tx.class.update({
      where: { class_id: id },
      data: { deleted_at: new Date() },
    });
  });
}

export async function restore(id) {
  const cls = await prisma.class.findFirst({ where: { class_id: id } });
  if (!cls) throw NotFound('Lớp không tồn tại');
  if (!cls.deleted_at) throw BadRequest('Lớp chưa bị xóa');
  return prisma.class.update({
    where: { class_id: id },
    data: { deleted_at: null },
  });
}

export async function importTemplate() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Lớp');
  ws.columns = [
    { header: 'Tên lớp *', key: 'class_name', width: 18 },
    { header: 'Năm học * (VD: 2025-2026)', key: 'year', width: 22 },
    { header: 'Khối (Nhà trẻ/Mầm/Chồi/Lá)', key: 'age_group', width: 22 },
    { header: 'Phòng', key: 'room', width: 12 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.addRow({ class_name: 'Mầm 1', year: '2025-2026', age_group: 'Mầm', room: 'A101' });
  const arr = await wb.xlsx.writeBuffer();
  return Buffer.from(arr);
}

export async function previewImport(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheet = wb.worksheets[0];
  if (!sheet) throw BadRequest('File Excel không có sheet');

  const seen = new Set();
  const rows = [];
  for (let i = 2; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    const class_name = String(row.getCell(1).value ?? '').trim();
    const year_name = String(row.getCell(2).value ?? '').trim();
    const age_group = String(row.getCell(3).value ?? '').trim();
    const room = String(row.getCell(4).value ?? '').trim();

    if (!class_name && !year_name) continue;

    const errors = [];
    if (!class_name) errors.push('Thiếu tên lớp');
    if (!year_name) errors.push('Thiếu năm học');
    else {
      const year = await prisma.schoolYear.findFirst({
        where: { name: year_name, deleted_at: null },
        select: { school_year_id: true },
      });
      if (!year) errors.push(`Năm học "${year_name}" không tồn tại`);
      else if (class_name) {
        const key = `${class_name}|${year.school_year_id}`;
        if (seen.has(key)) errors.push('Lớp trùng trong file');
        seen.add(key);
        const dup = await prisma.class.findFirst({
          where: { class_name, school_year_id: year.school_year_id, deleted_at: null },
          select: { class_id: true },
        });
        if (dup) errors.push('Lớp đã tồn tại trong năm học này');
      }
    }
    if (age_group && !['Nhà trẻ', 'Mầm', 'Chồi', 'Lá'].includes(age_group))
      errors.push('Khối không hợp lệ');

    rows.push({
      row: i,
      class_name,
      year_name,
      age_group,
      room,
      valid: errors.length === 0,
      errors,
    });
  }
  return {
    rows,
    valid_count: rows.filter((r) => r.valid).length,
    error_count: rows.filter((r) => !r.valid).length,
  };
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
    const class_name = String(row.getCell(1).value ?? '').trim();
    const year_name = String(row.getCell(2).value ?? '').trim();
    const age_group = String(row.getCell(3).value ?? '').trim() || undefined;
    const room = String(row.getCell(4).value ?? '').trim() || undefined;

    if (!class_name || !year_name) {
      if (class_name || year_name)
        errors.push({ row: i, message: 'Thiếu class_name hoặc school_year' });
      continue;
    }

    try {
      const year = await prisma.schoolYear.findFirst({
        where: { name: year_name, deleted_at: null },
      });
      if (!year) throw new Error(`Năm học "${year_name}" không tồn tại`);

      const result = await create({
        class_name,
        school_year_id: year.school_year_id,
        age_group,
        room,
      });
      created.push({ row: i, class_id: result.class_id, class_name: result.class_name });
    } catch (e) {
      errors.push({ row: i, message: e.message });
    }
  }

  return { success_count: created.length, error_count: errors.length, created, errors };
}

export async function exportExcel(school_year_id) {
  const where = { deleted_at: null };
  if (school_year_id) where.school_year_id = school_year_id;

  const classes = await prisma.class.findMany({
    where,
    include: {
      school_year: { select: { name: true } },
      teacher_classes: {
        where: { removed_at: null },
        include: { teacher: { select: { full_name: true } } },
      },
      _count: { select: { enrollments: { where: { left_date: null } } } },
    },
    orderBy: [{ school_year_id: 'desc' }, { class_name: 'asc' }],
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Classes');
  ws.columns = [
    { header: 'Tên lớp', key: 'class_name', width: 20 },
    { header: 'Năm học', key: 'school_year', width: 12 },
    { header: 'Khối', key: 'age_group', width: 10 },
    { header: 'Phòng', key: 'room', width: 10 },
    { header: 'Sĩ số', key: 'enrolled', width: 8 },
    { header: 'Giáo viên', key: 'teachers', width: 40 },
  ];
  ws.getRow(1).font = { bold: true };

  for (const c of classes) {
    ws.addRow({
      class_name: c.class_name,
      school_year: c.school_year.name,
      age_group: c.age_group ?? '',
      room: c.room ?? '',
      enrolled: c._count.enrollments,
      teachers: c.teacher_classes.map((tc) => tc.teacher.full_name).join(', ') || '',
    });
  }

  const arr = await wb.xlsx.writeBuffer();
  return Buffer.from(arr);
}
