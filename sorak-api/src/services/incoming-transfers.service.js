// Chuyển trường đếns — UC-56..61
// BR-079..084
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
  // BR-082: transfer date must belong to the selected academic year
  if (d < year.start_date || d > year.end_date) {
    throw BadRequest('Ngày chuyển trường phải nằm trong năm học đã chọn');
  }
  return year;
}

// ─── Record (UC-56) ──────────────────────────────────────────────────────────
export async function create(dto, user) {
  // BR-079/080: student profile must already exist
  const student = await prisma.student.findFirst({
    where: { student_id: dto.student_id, deleted_at: null },
    include: { account: true },
  });
  if (!student) throw NotFound('Học sinh không tồn tại — tạo hồ sơ học sinh trước');

  // EF-56-02: must be assigned to a class
  const enrollment = await prisma.studentEnrollment.findFirst({
    where: {
      student_id: dto.student_id,
      left_date: null,
      ...(dto.school_year_id ? { school_year_id: dto.school_year_id } : {}),
    },
    orderBy: { enrolled_date: 'desc' },
  });
  if (!enrollment?.class_id) throw BadRequest('Học sinh chưa được xếp lớp');

  await validateDateInYear(enrollment.school_year_id, dto.transfer_date);

  const dupe = await prisma.incomingTransfer.findFirst({
    where: { student_id: dto.student_id, status: 'Recorded', deleted_at: null },
  });
  if (dupe) throw Conflict('Học sinh đã có hồ sơ chuyển đến đang hiệu lực');

  const result = await prisma.$transaction(async (tx) => {
    const record = await tx.incomingTransfer.create({
      data: {
        student_id: dto.student_id,
        school_year_id: enrollment.school_year_id,
        class_id: enrollment.class_id,
        previous_school: dto.previous_school,
        transfer_date: new Date(dto.transfer_date),
        reason: dto.reason ?? null,
        note: dto.note ?? null,
        status: 'Recorded',
        created_by: user.sub,
      },
      include: TRANSFER_INCLUDE,
    });

    // BR-084: re-enrolling student who previously transferred out → restore + reactivate
    if (student.student_status === TRANSFERRED_OUT) {
      await tx.student.update({
        where: { student_id: dto.student_id },
        data: { student_status: ACTIVE_STATUS },
      });
      await tx.studentEnrollment.updateMany({
        where: { student_id: dto.student_id, left_date: null },
        data: { student_status: ACTIVE_STATUS },
      });
      if (student.account_id) {
        await tx.account.update({
          where: { account_id: student.account_id },
          data: { is_active: true },
        });
      }
    }
    return record;
  });

  logger.info(`Incoming transfer #${result.transfer_id} recorded for student ${dto.student_id}`);
  return result;
}

// ─── List (UC-57) ────────────────────────────────────────────────────────────
export async function findAll(query, user) {
  const { page, pageSize, search } = query;
  const where = { deleted_at: null };

  if (query.status) where.status = query.status;
  if (query.school_year_id) where.school_year_id = Number(query.school_year_id);
  if (query.class_id) where.class_id = Number(query.class_id);
  if (query.student_id) where.student_id = Number(query.student_id);
  // Teachers only see records they created
  if (user?.role === 'TEACHER') where.created_by = user.sub;
  if (query.previous_school) {
    where.previous_school = { contains: query.previous_school, mode: 'insensitive' };
  }
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
    prisma.incomingTransfer.findMany({
      where,
      include: TRANSFER_INCLUDE,
      orderBy: { transfer_id: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.incomingTransfer.count({ where }),
  ]);
  return paginate(data, total, page, pageSize);
}

// ─── Details (UC-58) ─────────────────────────────────────────────────────────
export async function findOne(id) {
  const record = await prisma.incomingTransfer.findFirst({
    where: { transfer_id: id, deleted_at: null },
    include: TRANSFER_INCLUDE,
  });
  if (!record) throw NotFound('Hồ sơ chuyển đến không tồn tại');
  return record;
}

// ─── Update info (UC-59) — Recorded records only ─────────────────────────────
export async function update(id, dto, user) {
  const record = await prisma.incomingTransfer.findFirst({
    where: { transfer_id: id, deleted_at: null },
  });
  if (!record) throw NotFound('Hồ sơ chuyển đến không tồn tại');
  // EF-59-04: cancelled records cannot be edited
  if (record.status !== 'Recorded') throw Conflict('Chỉ sửa được hồ sơ ở trạng thái Recorded');

  if (dto.transfer_date) {
    await validateDateInYear(record.school_year_id, dto.transfer_date);
  }

  return prisma.incomingTransfer.update({
    where: { transfer_id: id },
    data: {
      ...(dto.previous_school !== undefined ? { previous_school: dto.previous_school } : {}),
      ...(dto.transfer_date !== undefined ? { transfer_date: new Date(dto.transfer_date) } : {}),
      ...(dto.reason !== undefined ? { reason: dto.reason } : {}),
      ...(dto.note !== undefined ? { note: dto.note } : {}),
      updated_by: user.sub,
    },
    include: TRANSFER_INCLUDE,
  });
}

// ─── Cancel status (UC-60) — record kept for audit, no student side effects ──
export async function cancel(id, dto, user) {
  const record = await prisma.incomingTransfer.findFirst({
    where: { transfer_id: id, deleted_at: null },
  });
  if (!record) throw NotFound('Hồ sơ chuyển đến không tồn tại');
  if (record.status === 'Cancelled') throw Conflict('Hồ sơ đã được hủy trước đó');

  const updated = await prisma.incomingTransfer.update({
    where: { transfer_id: id },
    data: {
      status: 'Cancelled',
      cancel_reason: dto.cancel_reason ?? null,
      updated_by: user.sub,
    },
    include: TRANSFER_INCLUDE,
  });
  logger.info(`Incoming transfer #${id} cancelled`);
  return updated;
}

// ─── Soft delete ──────────────────────────────────────────────────────────────
export async function softDelete(id, user) {
  const record = await prisma.incomingTransfer.findFirst({
    where: { transfer_id: id, deleted_at: null },
  });
  if (!record) throw NotFound('Hồ sơ chuyển đến không tồn tại');
  return prisma.incomingTransfer.update({
    where: { transfer_id: id },
    data: { deleted_at: new Date(), updated_by: user.sub },
  });
}

// ─── Export Excel (UC-61) — Cancelled excluded from official reports ─────────
