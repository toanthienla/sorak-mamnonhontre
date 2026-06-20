// Đánh giá sức khỏes — UC-62..68
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

  const where = { student_id: studentId };
  if (query.school_year_id) where.school_year_id = Number(query.school_year_id);

  const records = await prisma.healthAssessment.findMany({
    where,
    include: ASSESSMENT_INCLUDE,
    orderBy: { assessment_date: 'asc' },
  });

  if (user.role === 'TEACHER') {
    const myClassIds = await getTeacherClassIds(user.sub);
    const allowed = records.some((r) => r.class_id && myClassIds.includes(r.class_id));
    // Allow if any record is in teacher's class OR student currently enrolled in one
    if (!allowed) {
      const enrolled = await prisma.studentEnrollment.findFirst({
        where: { student_id: studentId, left_date: null, class_id: { in: myClassIds } },
      });
      if (!enrolled) throw Forbidden('Không có quyền xem học sinh này');
    }
  }
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
