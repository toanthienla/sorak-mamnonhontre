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
