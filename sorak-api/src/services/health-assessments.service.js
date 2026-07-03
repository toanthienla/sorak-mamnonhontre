// Health Assessments — UC-62..68
// BR-087..110, BR-127..131, BR-139, BR-140
import ExcelJS from 'exceljs';
import prisma from '../config/prisma.js';
import { paginate } from '../utils/paginate.js';
import { searchIds } from '../utils/search.js';
import { BadRequest, Conflict, Forbidden, NotFound } from '../utils/http-error.js';
import { evaluateGrowth, referenceCurves } from '../utils/who-growth.js';
import logger from '../utils/logger.js';

const TRANSFERRED_OUT = 'Đã chuyển trường';
const GRADE_RANK = { 'Nhà trẻ': 0, Mầm: 1, Chồi: 2, Lá: 3 };
function byGrade(a, b) {
  const ga = GRADE_RANK[a.class?.age_group] ?? 99,
    gb = GRADE_RANK[b.class?.age_group] ?? 99;
  if (ga !== gb) return ga - gb;
  const ca = a.class?.class_name ?? '',
    cb = b.class?.class_name ?? '';
  if (ca !== cb) return ca.localeCompare(cb, 'vi');
  return (a.student?.full_name ?? '').localeCompare(b.student?.full_name ?? '', 'vi');
}

const ASSESSMENT_INCLUDE = {
  student: {
    select: {
      student_id: true,
      full_name: true,
      student_id_card_number: true,
      gender: true,
      date_of_birth: true,
      student_status: true,
    },
  },
  class: { select: { class_id: true, class_name: true, age_group: true } },
  school_year: { select: { school_year_id: true, name: true } },
};

// ─── Permission helpers ──────────────────────────────────────────────────────

async function getTeacherClassIds(accountId) {
  const teacher = await prisma.teacher.findUnique({
    where: { account_id: accountId },
    select: { teacher_classes: { where: { removed_at: null }, select: { class_id: true } } },
  });
  return teacher?.teacher_classes.map((tc) => tc.class_id) ?? [];
}

// BR-088/089: teacher only their assigned classes
async function assertClassAccess(user, classId) {
  if (user.role === 'PRINCIPAL') return;
  const myClassIds = await getTeacherClassIds(user.sub);
  if (!classId || !myClassIds.includes(classId)) {
    throw Forbidden('Chỉ thao tác được với lớp mình phụ trách');
  }
}

// BR-128: year must not have ended
async function assertYearOpen(schoolYearId) {
  const year = await prisma.schoolYear.findUnique({ where: { school_year_id: schoolYearId } });
  if (!year) throw NotFound('Năm học không tồn tại');
  if (new Date() > year.end_date)
    throw Conflict('Năm học đã kết thúc — không thể thay đổi dữ liệu sức khỏe');
  return year;
}

function validateDate(year, date) {
  const d = new Date(date);
  // BR-091: within year; BR-106: not in the future
  if (d < year.start_date || d > year.end_date)
    throw BadRequest('Ngày đánh giá phải nằm trong năm học');
  if (d > new Date()) throw BadRequest('Ngày đánh giá không được sau ngày hiện tại');
  return d;
}

// Resolve student's enrollment (class + year snapshot, BR-105)
async function getEnrollment(studentId, schoolYearId) {
  return prisma.studentEnrollment.findFirst({
    where: { student_id: studentId, school_year_id: schoolYearId, left_date: null },
    orderBy: { enrolled_date: 'desc' },
  });
}

// ─── Create (UC-62) ──────────────────────────────────────────────────────────
export async function create(dto, user) {
  const student = await prisma.student.findFirst({
    where: { student_id: dto.student_id, deleted_at: null },
  });
  if (!student) throw NotFound('Học sinh không tồn tại');
  // BR-140
  if (student.student_status === TRANSFERRED_OUT) {
    throw Conflict('Học sinh đã chuyển trường — không thể ghi nhận đánh giá mới');
  }

  const year = await assertYearOpen(dto.school_year_id);
  const date = validateDate(year, dto.assessment_date);

  const enrollment = await getEnrollment(dto.student_id, dto.school_year_id);
  if (!enrollment) throw BadRequest('Học sinh không thuộc năm học đã chọn');
  await assertClassAccess(user, enrollment.class_id);

  // BR-090: one record per student per date
  const dupe = await prisma.healthAssessment.findFirst({
    where: { student_id: dto.student_id, assessment_date: date },
  });
  if (dupe) throw Conflict('Học sinh đã có bản ghi đánh giá cho ngày này');

  const growth = evaluateGrowth({
    gender: student.gender,
    dateOfBirth: student.date_of_birth,
    assessmentDate: date,
    heightCm: dto.height_cm,
    weightKg: dto.weight_kg,
  });

  const record = await prisma.healthAssessment.create({
    data: {
      student_id: dto.student_id,
      school_year_id: dto.school_year_id,
      class_id: enrollment.class_id,
      assessment_date: date,
      height_cm: dto.height_cm,
      weight_kg: dto.weight_kg,
      bmi: growth.bmi,
      bmi_z: growth.bmi_z,
      height_z: growth.height_z,
      weight_z: growth.weight_z,
      bmi_status: growth.bmi_status,
      height_status: growth.height_status,
      weight_status: growth.weight_status,
      note: dto.note ?? null,
      created_by: user.sub,
    },
    include: ASSESSMENT_INCLUDE,
  });
  logger.info(`Health assessment #${record.assessment_id} created for student ${dto.student_id}`);
  return record;
}

// ─── List (UC-63) — latest per student by default (BR-127) ───────────────────
export async function findAll(query, user) {
  const { page, pageSize, search } = query;
  const where = {};

  if (query.school_year_id) where.school_year_id = Number(query.school_year_id);
  if (query.class_id) where.class_id = Number(query.class_id);
  if (query.student_id) where.student_id = Number(query.student_id);
  if (query.bmi_status) where.bmi_status = query.bmi_status;
  if (query.date_from || query.date_to) {
    where.assessment_date = {
      ...(query.date_from ? { gte: new Date(query.date_from) } : {}),
      ...(query.date_to ? { lte: new Date(query.date_to) } : {}),
    };
  }

  // Teacher: restrict to assigned classes
  if (user.role === 'TEACHER') {
    const myClassIds = await getTeacherClassIds(user.sub);
    where.class_id =
      query.class_id && myClassIds.includes(Number(query.class_id))
        ? Number(query.class_id)
        : { in: myClassIds };
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

  // BR-127: latest record per student (default mode)
  if (query.latest !== 'false') {
    const all = await prisma.healthAssessment.findMany({
      where,
      include: ASSESSMENT_INCLUDE,
      orderBy: [{ student_id: 'asc' }, { assessment_date: 'desc' }],
    });
    const latest = [];
    const seen = new Set();
    for (const r of all) {
      if (!seen.has(r.student_id)) {
        seen.add(r.student_id);
        latest.push(r);
      }
    }
    latest.sort(byGrade); // grade order Nhà trẻ→Mầm→Chồi→Lá
    const total = latest.length;
    const start = (page - 1) * pageSize;
    return paginate(latest.slice(start, start + pageSize), total, page, pageSize);
  }

  const [data, total] = await prisma.$transaction([
    prisma.healthAssessment.findMany({
      where,
      include: ASSESSMENT_INCLUDE,
      orderBy: { assessment_date: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.healthAssessment.count({ where }),
  ]);
  return paginate(data, total, page, pageSize);
}

// ─── Details (UC-64) ─────────────────────────────────────────────────────────
export async function findOne(id, user) {
  const record = await prisma.healthAssessment.findUnique({
    where: { assessment_id: id },
    include: ASSESSMENT_INCLUDE,
  });
  if (!record) throw NotFound('Bản ghi đánh giá không tồn tại');
  if (user.role === 'TEACHER') {
    const myClassIds = await getTeacherClassIds(user.sub);
    if (!record.class_id || !myClassIds.includes(record.class_id)) {
      throw Forbidden('Không có quyền xem bản ghi này');
    }
  }
  return record;
}

// ─── Student history within a year (UC-69/70/71/72) ─────────────────────────
export async function history(query, user) {
  const studentId = Number(query.student_id);
  const student = await prisma.student.findFirst({
    where: { student_id: studentId, deleted_at: null },
    select: {
      student_id: true,
      full_name: true,
      gender: true,
      date_of_birth: true,
      student_status: true,
    },
  });
  if (!student) throw NotFound('Học sinh không tồn tại');

  // Teachers may only view a student currently enrolled in one of their classes
  if (user.role === 'TEACHER') {
    const enrolled = await prisma.studentEnrollment.findFirst({
      where: {
        student_id: studentId,
        left_date: null,
        class: {
          teacher_classes: { some: { teacher: { account_id: user.sub }, removed_at: null } },
        },
      },
    });
    if (!enrolled) throw Forbidden('Không có quyền xem học sinh này');
  }

  const where = { student_id: studentId };
  if (query.school_year_id) where.school_year_id = Number(query.school_year_id);

  const records = await prisma.healthAssessment.findMany({
    where,
    include: ASSESSMENT_INCLUDE,
    orderBy: { assessment_date: 'asc' },
  });

  return { student, records };
}

// WHO reference curves for charts
export function curves(query) {
  const indicator = query.indicator; // height | weight | bmi
  const gender = query.gender; // Nam | Nữ
  if (!['height', 'weight', 'bmi'].includes(indicator)) throw BadRequest('indicator không hợp lệ');
  if (!['Nam', 'Nữ'].includes(gender)) throw BadRequest('gender không hợp lệ');
  return referenceCurves(indicator, gender);
}

// ─── Update (UC-65) ──────────────────────────────────────────────────────────
export async function update(id, dto, user) {
  const record = await prisma.healthAssessment.findUnique({
    where: { assessment_id: id },
    include: { student: true },
  });
  if (!record) throw NotFound('Bản ghi đánh giá không tồn tại');
  await assertClassAccess(user, record.class_id);

  // BR-140
  if (record.student.student_status === TRANSFERRED_OUT) {
    throw Conflict('Học sinh đã chuyển trường — không thể cập nhật');
  }
  const year = await assertYearOpen(record.school_year_id);

  let date = record.assessment_date;
  if (dto.assessment_date) {
    date = validateDate(year, dto.assessment_date);
    // EF-65-05: duplicate date with another record
    const dupe = await prisma.healthAssessment.findFirst({
      where: { student_id: record.student_id, assessment_date: date, assessment_id: { not: id } },
    });
    if (dupe) throw Conflict('Học sinh đã có bản ghi đánh giá cho ngày này');
  }

  const heightCm = dto.height_cm !== undefined ? dto.height_cm : record.height_cm;
  const weightKg = dto.weight_kg !== undefined ? dto.weight_kg : record.weight_kg;

  // BR-097/107: recalculate on any change
  const growth = evaluateGrowth({
    gender: record.student.gender,
    dateOfBirth: record.student.date_of_birth,
    assessmentDate: date,
    heightCm,
    weightKg,
  });

  const updated = await prisma.healthAssessment.update({
    where: { assessment_id: id },
    data: {
      assessment_date: date,
      height_cm: heightCm,
      weight_kg: weightKg,
      bmi: growth.bmi,
      bmi_z: growth.bmi_z,
      height_z: growth.height_z,
      weight_z: growth.weight_z,
      bmi_status: growth.bmi_status,
      height_status: growth.height_status,
      weight_status: growth.weight_status,
      ...(dto.note !== undefined ? { note: dto.note } : {}),
      updated_by: user.sub, // BR-100
    },
    include: ASSESSMENT_INCLUDE,
  });
  return updated;
}

// ─── Delete (UC-66) — hard delete ─────────────────────────────────────────────
export async function remove(id, user) {
  const record = await prisma.healthAssessment.findUnique({
    where: { assessment_id: id },
  });
  if (!record) throw NotFound('Bản ghi đánh giá không tồn tại');
  await assertClassAccess(user, record.class_id);
  await assertYearOpen(record.school_year_id);
  // (đánh giá nuôi dưỡng nay độc lập — không còn ràng buộc xóa)
  await prisma.healthAssessment.delete({ where: { assessment_id: id } });
  logger.info(`Health assessment #${id} hard-deleted by account ${user.sub}`);
  return { deleted: true };
}

// ─── Bulk entry by class — grid input, one date, many students ───────────────
// Upserts per student+date (same semantics as Excel import, BR-102)
export async function bulkUpsert(dto, user) {
  const { school_year_id, class_id, assessment_date, rows } = dto;
  await assertClassAccess(user, class_id);
  const year = await assertYearOpen(school_year_id);
  const date = validateDate(year, assessment_date);

  // Students currently in the class
  const enrollments = await prisma.studentEnrollment.findMany({
    where: { class_id, left_date: null },
    include: { student: true },
  });
  const byId = new Map(enrollments.map((e) => [e.student.student_id, e.student]));

  let created = 0,
    updated = 0,
    skipped = 0;
  const errors = [];

  for (const row of rows) {
    const student = byId.get(row.student_id);
    if (!student) {
      errors.push({ student_id: row.student_id, error: 'Không thuộc lớp' });
      continue;
    }
    if (student.student_status === TRANSFERRED_OUT) {
      errors.push({ student_id: row.student_id, error: 'Đã chuyển trường' });
      continue;
    }
    // Empty row = not measured this round — skip silently
    if (!row.height_cm && !row.weight_kg) {
      skipped++;
      continue;
    }
    if (!(row.height_cm > 0) || !(row.weight_kg > 0)) {
      errors.push({ student_id: row.student_id, error: 'Chiều cao/cân nặng không hợp lệ' });
      continue;
    }

    const growth = evaluateGrowth({
      gender: student.gender,
      dateOfBirth: student.date_of_birth,
      assessmentDate: date,
      heightCm: row.height_cm,
      weightKg: row.weight_kg,
    });
    const data = {
      height_cm: row.height_cm,
      weight_kg: row.weight_kg,
      bmi: growth.bmi,
      bmi_z: growth.bmi_z,
      height_z: growth.height_z,
      weight_z: growth.weight_z,
      bmi_status: growth.bmi_status,
      height_status: growth.height_status,
      weight_status: growth.weight_status,
      ...(row.note !== undefined ? { note: row.note || null } : {}),
      updated_by: user.sub,
    };

    const existing = await prisma.healthAssessment.findFirst({
      where: { student_id: row.student_id, assessment_date: date },
    });
    if (existing) {
      await prisma.healthAssessment.update({
        where: { assessment_id: existing.assessment_id },
        data,
      });
      updated++;
    } else {
      await prisma.healthAssessment.create({
        data: {
          student_id: row.student_id,
          school_year_id,
          class_id,
          assessment_date: date,
          created_by: user.sub,
          ...data,
        },
      });
      created++;
    }
  }
  logger.info(
    `Bulk health entry class ${class_id} ${assessment_date}: +${created} ~${updated} skip ${skipped}`,
  );
  return { created, updated, skipped, errors };
}

// Existing records of a class for one date — prefill for the bulk grid
export async function byClassDate(query, user) {
  const classId = Number(query.class_id);
  await assertClassAccess(user, classId);
  const date = new Date(query.assessment_date);
  const records = await prisma.healthAssessment.findMany({
    where: { class_id: classId, assessment_date: date },
    select: {
      assessment_id: true,
      student_id: true,
      height_cm: true,
      weight_kg: true,
      bmi: true,
      bmi_status: true,
      note: true,
    },
  });
  return records;
}

// ─── Import (UC-67) ───────────────────────────────────────────────────────────

async function parseImportRows(buffer, classId, schoolYearId) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) throw BadRequest('File không có sheet dữ liệu');

  const year = await prisma.schoolYear.findUnique({ where: { school_year_id: schoolYearId } });
  if (!year) throw NotFound('Năm học không tồn tại');

  // Students of the selected class
  const enrollments = await prisma.studentEnrollment.findMany({
    where: { class_id: classId, left_date: null },
    include: { student: true },
  });
  const byCard = new Map(enrollments.map((e) => [e.student.student_id_card_number, e.student]));

  const rows = [];
  ws.eachRow((row, n) => {
    if (n === 1) return; // header
    const card = String(row.getCell(1).text ?? '').trim();
    if (!card) return;
    const rawDate = row.getCell(3).value;
    const height = Number(row.getCell(4).value);
    const weight = Number(row.getCell(5).value);
    const note = String(row.getCell(6).text ?? '').trim() || null;

    const r = {
      row: n,
      card,
      name: String(row.getCell(2).text ?? '').trim(),
      date: null,
      height_cm: height,
      weight_kg: weight,
      note,
      errors: [],
    };

    const student = byCard.get(card);
    if (!student) r.errors.push('Học sinh không thuộc lớp đã chọn');
    else {
      r.student_id = student.student_id;
      r.name = student.full_name;
      if (student.student_status === TRANSFERRED_OUT) r.errors.push('Học sinh đã chuyển trường');
    }

    const d = rawDate instanceof Date ? rawDate : new Date(String(rawDate ?? ''));
    if (Number.isNaN(d.getTime())) r.errors.push('Ngày đánh giá không hợp lệ');
    else if (d < year.start_date || d > year.end_date) r.errors.push('Ngày ngoài năm học');
    else if (d > new Date()) r.errors.push('Ngày sau hiện tại');
    else r.date = d;

    if (!Number.isFinite(height) || height <= 0 || height > 200)
      r.errors.push('Chiều cao không hợp lệ');
    if (!Number.isFinite(weight) || weight <= 0 || weight > 100)
      r.errors.push('Cân nặng không hợp lệ');

    rows.push(r);
  });
  return { rows, students: byCard };
}

export async function previewImport(buffer, classId, schoolYearId, user) {
  await assertClassAccess(user, classId);
  await assertYearOpen(schoolYearId);
  const { rows } = await parseImportRows(buffer, classId, schoolYearId);
  return {
    rows: rows.map((r) => ({
      row: r.row,
      card: r.card,
      name: r.name,
      date: r.date ? r.date.toISOString().slice(0, 10) : '',
      height_cm: r.height_cm,
      weight_kg: r.weight_kg,
      note: r.note ?? '',
      valid: r.errors.length === 0,
      errors: r.errors,
    })),
    valid_count: rows.filter((r) => r.errors.length === 0).length,
    error_count: rows.filter((r) => r.errors.length > 0).length,
  };
}

export async function importExcel(buffer, classId, schoolYearId, user) {
  await assertClassAccess(user, classId);
  await assertYearOpen(schoolYearId);
  const { rows, students } = await parseImportRows(buffer, classId, schoolYearId);

  let created = 0,
    updated = 0;
  for (const r of rows) {
    if (r.errors.length > 0) continue;
    const student = students.get(r.card);
    const growth = evaluateGrowth({
      gender: student.gender,
      dateOfBirth: student.date_of_birth,
      assessmentDate: r.date,
      heightCm: r.height_cm,
      weightKg: r.weight_kg,
    });
    const data = {
      height_cm: r.height_cm,
      weight_kg: r.weight_kg,
      bmi: growth.bmi,
      bmi_z: growth.bmi_z,
      height_z: growth.height_z,
      weight_z: growth.weight_z,
      bmi_status: growth.bmi_status,
      height_status: growth.height_status,
      weight_status: growth.weight_status,
      note: r.note,
      updated_by: user.sub,
    };
    // BR-102: same student + date → update
    const existing = await prisma.healthAssessment.findFirst({
      where: { student_id: r.student_id, assessment_date: r.date },
    });
    if (existing) {
      await prisma.healthAssessment.update({
        where: { assessment_id: existing.assessment_id },
        data,
      });
      updated++;
    } else {
      await prisma.healthAssessment.create({
        data: {
          student_id: r.student_id,
          school_year_id: schoolYearId,
          class_id: classId,
          assessment_date: r.date,
          created_by: user.sub,
          ...data,
        },
      });
      created++;
    }
  }
  return { created, updated, error_count: rows.filter((r) => r.errors.length > 0).length };
}

export async function importTemplate() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Mẫu nhập sức khỏe');
  ws.columns = [
    { header: 'Mã thẻ HS (*)', key: 'card', width: 16 },
    { header: 'Họ tên (tham khảo)', key: 'name', width: 25 },
    { header: 'Ngày đánh giá (*) (YYYY-MM-DD)', key: 'date', width: 26 },
    { header: 'Chiều cao cm (*)', key: 'height', width: 16 },
    { header: 'Cân nặng kg (*)', key: 'weight', width: 16 },
    { header: 'Ghi chú', key: 'note', width: 30 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.addRow({
    card: 'HS250001',
    name: 'Nguyễn Văn A',
    date: '2026-09-15',
    height: 100.5,
    weight: 16.2,
    note: '',
  });
  return wb.xlsx.writeBuffer();
}

// ─── Export (UC-68) ──────────────────────────────────────────────────────────
export async function exportExcel(query, user) {
  const where = {};
  if (query.school_year_id) where.school_year_id = Number(query.school_year_id);
  if (query.class_id) where.class_id = Number(query.class_id);
  if (query.student_id) where.student_id = Number(query.student_id);
  if (query.bmi_status) where.bmi_status = query.bmi_status;

  if (user.role === 'TEACHER') {
    const myClassIds = await getTeacherClassIds(user.sub);
    where.class_id =
      query.class_id && myClassIds.includes(Number(query.class_id))
        ? Number(query.class_id)
        : { in: myClassIds };
  }

  const records = await prisma.healthAssessment.findMany({
    where,
    include: ASSESSMENT_INCLUDE,
    orderBy: [{ student_id: 'asc' }, { assessment_date: 'desc' }],
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Đánh giá sức khỏe');
  ws.columns = [
    { header: 'Mã thẻ HS', key: 'card', width: 14 },
    { header: 'Họ tên', key: 'name', width: 25 },
    { header: 'Lớp', key: 'class', width: 12 },
    { header: 'Năm học', key: 'year', width: 12 },
    { header: 'Ngày đánh giá', key: 'date', width: 14 },
    { header: 'Cao (cm)', key: 'height', width: 10 },
    { header: 'Nặng (kg)', key: 'weight', width: 10 },
    { header: 'BMI', key: 'bmi', width: 8 },
    { header: 'BMI/tuổi', key: 'bmi_status', width: 16 },
    { header: 'Cao/tuổi', key: 'height_status', width: 16 },
    { header: 'Nặng/tuổi', key: 'weight_status', width: 20 },
    { header: 'Ghi chú', key: 'note', width: 30 },
  ];
  ws.getRow(1).font = { bold: true };
  for (const r of records) {
    ws.addRow({
      card: r.student.student_id_card_number,
      name: r.student.full_name,
      class: r.class?.class_name ?? '',
      year: r.school_year.name,
      date: r.assessment_date.toISOString().slice(0, 10),
      height: r.height_cm ?? '',
      weight: r.weight_kg ?? '',
      bmi: r.bmi ?? '',
      bmi_status: r.bmi_status ?? '',
      height_status: r.height_status ?? '',
      weight_status: r.weight_status ?? '',
      note: r.note ?? '',
    });
  }
  return wb.xlsx.writeBuffer();
}
