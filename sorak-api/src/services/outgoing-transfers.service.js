// Chuyển trường đis — UC-50..55
// BR-073..078, BR-085, BR-086
import ExcelJS from 'exceljs';
import prisma from '../config/prisma.js';
import { paginate } from '../utils/paginate.js';
import { searchIds } from '../utils/search.js';
import { BadRequest, Conflict, NotFound } from '../utils/http-error.js';
import logger from '../utils/logger.js';

const TRANSFERRED_OUT = 'Đã chuyển trường';
const ACTIVE_STATUS = 'Đang học';

const TRANSFER_INCLUDE = {
  student: {
    select: {
      student_id: true,
      full_name: true,
      student_id_card_number: true,
      student_status: true,
      account: { select: { account_id: true, is_active: true } },
    },
  },
  class: { select: { class_id: true, class_name: true, age_group: true } },
  school_year: { select: { school_year_id: true, name: true } },
};

async function validateDateInYear(schoolYearId, date) {
  const year = await prisma.schoolYear.findUnique({ where: { school_year_id: schoolYearId } });
  if (!year) throw NotFound('Năm học không tồn tại');
  const d = new Date(date);
  // BR-075: transfer date must belong to the selected academic year
  if (d < year.start_date || d > year.end_date) {
    throw BadRequest('Ngày chuyển trường phải nằm trong năm học đã chọn');
  }
  return year;
}

// ─── Record (UC-50) ──────────────────────────────────────────────────────────
export async function create(dto, user) {
  const student = await prisma.student.findFirst({
    where: { student_id: dto.student_id, deleted_at: null },
    include: { account: true },
  });
  if (!student) throw NotFound('Học sinh không tồn tại');

  // EF-50-03: already transferred out
  if (student.student_status === TRANSFERRED_OUT) {
    throw Conflict('Học sinh đã được ghi nhận chuyển trường');
  }
  const dupe = await prisma.outgoingTransfer.findFirst({
    where: { student_id: dto.student_id, status: 'Recorded', deleted_at: null },
  });
  if (dupe) throw Conflict('Học sinh đã có hồ sơ chuyển đi đang hiệu lực');

  // Resolve current enrollment → class + year (year from dto or student's active enrollment)
  const enrollment = await prisma.studentEnrollment.findFirst({
    where: {
      student_id: dto.student_id,
      left_date: null,
      ...(dto.school_year_id ? { school_year_id: dto.school_year_id } : {}),
    },
    orderBy: { enrolled_date: 'desc' },
  });
  if (!enrollment) throw BadRequest('Học sinh chưa thuộc năm học nào');

  await validateDateInYear(enrollment.school_year_id, dto.transfer_date);

  const result = await prisma.$transaction(async (tx) => {
    const record = await tx.outgoingTransfer.create({
      data: {
        student_id: dto.student_id,
        school_year_id: enrollment.school_year_id,
        class_id: enrollment.class_id,
        destination_school: dto.destination_school,
        transfer_date: new Date(dto.transfer_date),
        reason: dto.reason ?? null,
        note: dto.note ?? null,
        status: 'Recorded',
        created_by: user.sub,
      },
      include: TRANSFER_INCLUDE,
    });

    // BR-076: learning status → Transferred Out (profile + current enrollment, kept in records BR-077)
    await tx.student.update({
      where: { student_id: dto.student_id },
      data: { student_status: TRANSFERRED_OUT },
    });
    await tx.studentEnrollment.updateMany({
      where: { student_id: dto.student_id, left_date: null },
      data: { student_status: TRANSFERRED_OUT },
    });

    // BR-078: deactivate the student account
    if (student.account_id) {
      await tx.account.update({
        where: { account_id: student.account_id },
        data: { is_active: false },
      });
    }
    return record;
  });

  logger.info(`Outgoing transfer #${result.transfer_id} recorded for student ${dto.student_id}`);
  return result;
}

// ─── List (UC-51) ────────────────────────────────────────────────────────────
export async function findAll(query, user) {
  const { page, pageSize, search } = query;
  const where = { deleted_at: null };

  if (query.status) where.status = query.status;
  if (query.school_year_id) where.school_year_id = Number(query.school_year_id);
  if (query.class_id) where.class_id = Number(query.class_id);
  if (query.student_id) where.student_id = Number(query.student_id);
  // Teachers only see records they created
  if (user?.role === 'TEACHER') where.created_by = user.sub;
  if (search) {
    const ids = await searchIds(
      'students',
      'student_id',
      ['full_name', 'student_id_card_number'],
      search,
    );
    if (ids) where.student_id = { in: ids };
  }

  const [data, total] = await prisma.$transaction([
    prisma.outgoingTransfer.findMany({
      where,
      include: TRANSFER_INCLUDE,
      orderBy: { transfer_id: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.outgoingTransfer.count({ where }),
  ]);
  return paginate(data, total, page, pageSize);
}

// ─── Details (UC-52) ─────────────────────────────────────────────────────────
export async function findOne(id) {
  const record = await prisma.outgoingTransfer.findFirst({
    where: { transfer_id: id, deleted_at: null },
    include: TRANSFER_INCLUDE,
  });
  if (!record) throw NotFound('Hồ sơ chuyển đi không tồn tại');
  return record;
}

// ─── Update info (UC-53) — correction only, Recorded records only ────────────
export async function update(id, dto, user) {
  const record = await prisma.outgoingTransfer.findFirst({
    where: { transfer_id: id, deleted_at: null },
  });
  if (!record) throw NotFound('Hồ sơ chuyển đi không tồn tại');
  if (record.status !== 'Recorded') throw Conflict('Chỉ sửa được hồ sơ ở trạng thái Recorded');

  if (dto.transfer_date) {
    await validateDateInYear(record.school_year_id, dto.transfer_date);
  }

  return prisma.outgoingTransfer.update({
    where: { transfer_id: id },
    data: {
      ...(dto.destination_school !== undefined
        ? { destination_school: dto.destination_school }
        : {}),
      ...(dto.transfer_date !== undefined ? { transfer_date: new Date(dto.transfer_date) } : {}),
      ...(dto.reason !== undefined ? { reason: dto.reason } : {}),
      ...(dto.note !== undefined ? { note: dto.note } : {}),
      updated_by: user.sub,
    },
    include: TRANSFER_INCLUDE,
  });
}

// ─── Cancel status (UC-54) — restores student + account (BR-085) ────────────
export async function cancel(id, dto, user) {
  const record = await prisma.outgoingTransfer.findFirst({
    where: { transfer_id: id, deleted_at: null },
    include: { student: { select: { account_id: true } } },
  });
  if (!record) throw NotFound('Hồ sơ chuyển đi không tồn tại');
  if (record.status === 'Cancelled') throw Conflict('Hồ sơ đã được hủy trước đó');

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.outgoingTransfer.update({
      where: { transfer_id: id },
      data: {
        status: 'Cancelled',
        cancel_reason: dto.cancel_reason ?? null,
        updated_by: user.sub,
      },
      include: TRANSFER_INCLUDE,
    });

    // BR-085: restore learning status + reactivate account
    await tx.student.update({
      where: { student_id: record.student_id },
      data: { student_status: ACTIVE_STATUS },
    });
    await tx.studentEnrollment.updateMany({
      where: { student_id: record.student_id, left_date: null },
      data: { student_status: ACTIVE_STATUS },
    });
    if (record.student.account_id) {
      await tx.account.update({
        where: { account_id: record.student.account_id },
        data: { is_active: true },
      });
    }
    return updated;
  });

  logger.info(`Outgoing transfer #${id} cancelled — student ${record.student_id} restored`);
  return result;
}

// ─── Soft delete — wrong entry; also restores student if still Recorded ─────
export async function softDelete(id, user) {
  const record = await prisma.outgoingTransfer.findFirst({
    where: { transfer_id: id, deleted_at: null },
    include: { student: { select: { account_id: true } } },
  });
  if (!record) throw NotFound('Hồ sơ chuyển đi không tồn tại');

  return prisma.$transaction(async (tx) => {
    // Deleting an active Recorded entry = the transfer never happened → restore student
    if (record.status === 'Recorded') {
      await tx.student.update({
        where: { student_id: record.student_id },
        data: { student_status: ACTIVE_STATUS },
      });
      await tx.studentEnrollment.updateMany({
        where: { student_id: record.student_id, left_date: null },
        data: { student_status: ACTIVE_STATUS },
      });
      if (record.student.account_id) {
        await tx.account.update({
          where: { account_id: record.student.account_id },
          data: { is_active: true },
        });
      }
    }
    return tx.outgoingTransfer.update({
      where: { transfer_id: id },
      data: { deleted_at: new Date(), updated_by: user.sub },
    });
  });
}

// ─── Export Excel (UC-55) — Cancelled excluded (BR-086) ─────────────────────
export async function exportExcel(filter) {
  const where = { deleted_at: null, status: 'Recorded' };
  if (filter.school_year_id) where.school_year_id = Number(filter.school_year_id);
  if (filter.class_id) where.class_id = Number(filter.class_id);
  if (filter.student_id) where.student_id = Number(filter.student_id);

  const records = await prisma.outgoingTransfer.findMany({
    where,
    include: TRANSFER_INCLUDE,
    orderBy: { transfer_date: 'desc' },
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Chuyển đi');
  ws.columns = [
    { header: 'Mã thẻ HS', key: 'card', width: 14 },
    { header: 'Họ tên', key: 'name', width: 25 },
    { header: 'Lớp', key: 'class', width: 12 },
    { header: 'Năm học', key: 'year', width: 12 },
    { header: 'Trường chuyển đến', key: 'dest', width: 30 },
    { header: 'Ngày chuyển', key: 'date', width: 13 },
    { header: 'Lý do', key: 'reason', width: 30 },
    { header: 'Ghi chú', key: 'note', width: 30 },
  ];
  ws.getRow(1).font = { bold: true };

  for (const r of records) {
    ws.addRow({
      card: r.student.student_id_card_number,
      name: r.student.full_name,
      class: r.class?.class_name ?? '',
      year: r.school_year.name,
      dest: r.destination_school,
      date: r.transfer_date.toISOString().slice(0, 10),
      reason: r.reason ?? '',
      note: r.note ?? '',
    });
  }
  return wb.xlsx.writeBuffer();
}
