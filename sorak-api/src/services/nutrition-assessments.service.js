// Đánh giá nuôi dưỡng — standalone, theo giai đoạn (UC-74..79 adapted)
// Per class + period grid; no FK link to health assessment (BMI shown as reference on the UI)
import ExcelJS from 'exceljs';
import prisma from '../config/prisma.js';
import { BadRequest, Conflict, Forbidden, NotFound } from '../utils/http-error.js';
import logger from '../utils/logger.js';

const TRANSFERRED_OUT = 'Đã chuyển trường';

export const PERIODS = [
  { code: 'dau_nam', label: 'Học kỳ 1 (đầu năm)' },
  { code: 'giua_ky_1', label: 'Học kỳ 1 (giữa kỳ)' },
  { code: 'cuoi_ky_1', label: 'Học kỳ 1 (cuối kỳ)' },
  { code: 'dau_ky_2', label: 'Học kỳ 2 (đầu kỳ)' },
  { code: 'giua_ky_2', label: 'Học kỳ 2 (giữa kỳ)' },
  { code: 'cuoi_nam', label: 'Học kỳ 2 (cuối năm)' },
];
const PERIOD_CODES = PERIODS.map((p) => p.code);
const PERIOD_LABEL = Object.fromEntries(PERIODS.map((p) => [p.code, p.label]));

export const WEIGHT_CHANNELS = ['Suy dinh dưỡng thể nhẹ cân', 'Cân nặng cao hơn tuổi'];

async function getTeacherClassIds(accountId) {
  const teacher = await prisma.teacher.findUnique({
    where: { account_id: accountId },
    select: { teacher_classes: { where: { removed_at: null }, select: { class_id: true } } },
  });
  return teacher?.teacher_classes.map((tc) => tc.class_id) ?? [];
}

async function assertClassAccess(user, classId) {
  if (user.role === 'PRINCIPAL') return;
  const myClassIds = await getTeacherClassIds(user.sub);
  if (!classId || !myClassIds.includes(classId)) {
    throw Forbidden('Chỉ thao tác được với lớp mình phụ trách');
  }
}

async function assertYearOpen(schoolYearId) {
  const year = await prisma.schoolYear.findUnique({ where: { school_year_id: schoolYearId } });
  if (!year) throw NotFound('Năm học không tồn tại');
  if (new Date() > year.end_date)
    throw Conflict('Năm học đã kết thúc — không thể thay đổi dữ liệu nuôi dưỡng');
  return year;
}

// ─── Grid: roster of a class for one period + their nutrition row + latest BMI ──
export async function grid(query, user) {
  const classId = Number(query.class_id);
  const schoolYearId = Number(query.school_year_id);
  const period = query.period;
  if (!PERIOD_CODES.includes(period)) throw BadRequest('Giai đoạn không hợp lệ');
  await assertClassAccess(user, classId);

  // Students currently in the class
  const enrollments = await prisma.studentEnrollment.findMany({
    where: { class_id: classId, left_date: null },
    include: {
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
    },
    orderBy: { student: { full_name: 'asc' } },
  });
  const studentIds = enrollments.map((e) => e.student_id);

  // Existing nutrition rows for this period
  const records = await prisma.nutritionAssessment.findMany({
    where: { student_id: { in: studentIds }, school_year_id: schoolYearId, period },
  });
  const recByStudent = new Map(records.map((r) => [r.student_id, r]));

  // Latest BMI per student (reference for the teacher)
  const health = await prisma.healthAssessment.findMany({
    where: { student_id: { in: studentIds }, school_year_id: schoolYearId, bmi: { not: null } },
    orderBy: [{ student_id: 'asc' }, { assessment_date: 'desc' }],
    select: { student_id: true, bmi: true, bmi_status: true, assessment_date: true },
  });
  const bmiByStudent = new Map();
  for (const h of health) if (!bmiByStudent.has(h.student_id)) bmiByStudent.set(h.student_id, h);

  return enrollments.map((e) => {
    const s = e.student;
    const rec = recByStudent.get(s.student_id) ?? null;
    const bmi = bmiByStudent.get(s.student_id) ?? null;
    return {
      student_id: s.student_id,
      full_name: s.full_name,
      student_id_card_number: s.student_id_card_number,
      gender: s.gender,
      date_of_birth: s.date_of_birth,
      transferred_out: s.student_status === TRANSFERRED_OUT,
      nutrition_id: rec?.nutrition_id ?? null,
      weight_channel: rec?.weight_channel ?? null,
      is_stunting: rec?.is_stunting ?? false,
      is_severe_stunting: rec?.is_severe_stunting ?? false,
      is_obese: rec?.is_obese ?? false,
      note: rec?.note ?? null,
      latest_bmi: bmi?.bmi ?? null,
      latest_bmi_status: bmi?.bmi_status ?? null,
      latest_bmi_date: bmi?.assessment_date ?? null,
    };
  });
}

// ─── Grid across ALL classes of the year (one period) ───────────────────────
export async function gridAll(query, user) {
  const schoolYearId = Number(query.school_year_id);
  const period = query.period;
  if (!PERIOD_CODES.includes(period)) throw BadRequest('Giai đoạn không hợp lệ');

  // Active-year enrollments with a class; teacher restricted to own classes
  const where = { school_year_id: schoolYearId, left_date: null, class_id: { not: null } };
  if (user.role === 'TEACHER') {
    const myClassIds = await getTeacherClassIds(user.sub);
    where.class_id = { in: myClassIds };
  }
  const enrollments = await prisma.studentEnrollment.findMany({
    where,
    include: {
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
    },
  });
  // Order by grade (Nhà trẻ → Mầm → Chồi → Lá) → class name → student name
  const GRADE_RANK = { 'Nhà trẻ': 0, Mầm: 1, Chồi: 2, Lá: 3 };
  enrollments.sort((a, b) => {
    const ga = GRADE_RANK[a.class?.age_group] ?? 99,
      gb = GRADE_RANK[b.class?.age_group] ?? 99;
    if (ga !== gb) return ga - gb;
    const ca = a.class?.class_name ?? '',
      cb = b.class?.class_name ?? '';
    if (ca !== cb) return ca.localeCompare(cb, 'vi');
    return (a.student.full_name ?? '').localeCompare(b.student.full_name ?? '', 'vi');
  });
  const studentIds = enrollments.map((e) => e.student_id);

  const records = await prisma.nutritionAssessment.findMany({
    where: { student_id: { in: studentIds }, school_year_id: schoolYearId, period },
  });
  const recByStudent = new Map(records.map((r) => [r.student_id, r]));

  const health = await prisma.healthAssessment.findMany({
    where: { student_id: { in: studentIds }, school_year_id: schoolYearId, bmi: { not: null } },
    orderBy: [{ student_id: 'asc' }, { assessment_date: 'desc' }],
    select: { student_id: true, bmi: true, bmi_status: true },
  });
  const bmiByStudent = new Map();
  for (const h of health) if (!bmiByStudent.has(h.student_id)) bmiByStudent.set(h.student_id, h);

  return enrollments.map((e) => {
    const s = e.student;
    const rec = recByStudent.get(s.student_id) ?? null;
    const bmi = bmiByStudent.get(s.student_id) ?? null;
    return {
      student_id: s.student_id,
      class_id: e.class_id,
      class_name: e.class?.class_name ?? null,
      full_name: s.full_name,
      student_id_card_number: s.student_id_card_number,
      gender: s.gender,
      date_of_birth: s.date_of_birth,
      transferred_out: s.student_status === TRANSFERRED_OUT,
      weight_channel: rec?.weight_channel ?? null,
      is_stunting: rec?.is_stunting ?? false,
      is_severe_stunting: rec?.is_severe_stunting ?? false,
      is_obese: rec?.is_obese ?? false,
      latest_bmi: bmi?.bmi ?? null,
      latest_bmi_status: bmi?.bmi_status ?? null,
    };
  });
}

// ─── Bulk upsert one period for a class ──────────────────────────────────────
