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
