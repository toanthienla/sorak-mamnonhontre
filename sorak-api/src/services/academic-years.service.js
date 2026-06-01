import prisma from '../config/prisma.js';
import { BadRequest, Conflict, NotFound } from '../utils/http-error.js';
import logger from '../utils/logger.js';

const STATUS = { ACTIVE: 'active', INACTIVE: 'inactive' };

async function assertExists(id) {
  const year = await prisma.schoolYear.findFirst({
    where: { school_year_id: id, deleted_at: null },
  });
  if (!year) throw NotFound('Academic year not found');
  return year;
}

export async function create(dto) {
  const start = new Date(dto.start_date);
  const end = new Date(dto.end_date);
  if (end <= start) throw BadRequest('end_date phải sau start_date');

  const dup = await prisma.schoolYear.findFirst({
    where: { name: dto.name, deleted_at: null },
    select: { school_year_id: true },
  });
  if (dup) throw Conflict(`Năm học ${dto.name} đã tồn tại`);

  return prisma.schoolYear.create({
    data: { name: dto.name, start_date: start, end_date: end, status: STATUS.INACTIVE },
  });
}

export function findAll() {
  return prisma.schoolYear.findMany({
    where: { deleted_at: null },
    orderBy: { start_date: 'desc' },
  });
}

export function findArchived() {
  return prisma.schoolYear.findMany({
    where: { deleted_at: { not: null } },
    orderBy: { deleted_at: 'desc' },
  });
}

export async function findOne(id) {
  const year = await prisma.schoolYear.findFirst({
    where: { school_year_id: id, deleted_at: null },
    include: {
      semesters: { orderBy: { semester_number: 'asc' } },
      _count: { select: { classes: true } },
    },
  });
  if (!year) throw NotFound('Academic year not found');
  return year;
}

export async function update(id, dto) {
  const year = await assertExists(id);

  // Only trigger setActive flow when transitioning TO active (not already active)
  if (dto.status === STATUS.ACTIVE && year.status !== STATUS.ACTIVE) return setActive(id);

  if (dto.name && dto.name !== year.name) {
    const dup = await prisma.schoolYear.findFirst({
      where: { name: dto.name, NOT: { school_year_id: id } },
      select: { school_year_id: true },
    });
    if (dup) throw Conflict('Tên năm học đã tồn tại');
  }

  const start = dto.start_date ? new Date(dto.start_date) : year.start_date;
  const end = dto.end_date ? new Date(dto.end_date) : year.end_date;
  if (end <= start) throw BadRequest('end_date phải sau start_date');

  return prisma.schoolYear.update({
    where: { school_year_id: id },
    data: {
      name: dto.name ?? undefined,
      start_date: start,
      end_date: end,
      status: dto.status ?? undefined,
    },
  });
}

export async function setActive(id) {
  const year = await assertExists(id);
  if (year.status === STATUS.ACTIVE) return year;

  const [, , updated] = await prisma.$transaction([
    prisma.schoolYear.updateMany({
      where: { status: STATUS.ACTIVE, NOT: { school_year_id: id } },
      data: { status: STATUS.INACTIVE },
    }),
    prisma.semester.createMany({
      data: [
        {
          school_year_id: id,
          semester_number: 1,
          start_date: year.start_date,
          end_date: new Date(year.start_date.getTime() + 120 * 86400000),
        },
        {
          school_year_id: id,
          semester_number: 2,
          start_date: new Date(year.start_date.getTime() + 121 * 86400000),
          end_date: year.end_date,
        },
      ],
      skipDuplicates: true,
    }),
    prisma.schoolYear.update({
      where: { school_year_id: id },
      data: { status: STATUS.ACTIVE },
    }),
  ]);

  logger.info(`Academic year ${updated.name} → ACTIVE`);

  // Auto-promote students from previous year when activating
  const promotion = await promoteStudents(id);
  logger.info(`Promoted ${promotion.promoted}, graduated ${promotion.graduated}`);

  return { ...updated, promotion };
}

const GRADE_PROGRESSION = {
  'Nhà trẻ': 'Mầm',
  'Mầm': 'Chồi',
  'Chồi': 'Lá',
  'Lá': null, // graduate
};

export async function promoteStudents(toYearId) {
  // Find previous year (most recent by start_date, not toYear)
  const toYear = await assertExists(toYearId);
  const prevYear = await prisma.schoolYear.findFirst({
    where: { school_year_id: { not: toYearId }, deleted_at: null },
    orderBy: { start_date: 'desc' },
  });
  if (!prevYear) return { promoted: 0, graduated: 0, skipped: 0 };

  const PROMOTABLE_STATUSES = ['Đang học', 'Hoàn thành chương trình'];

  // Collect students from previous year via StudentClass
  const prevClasses = await prisma.studentClass.findMany({
    where: { class: { school_year_id: prevYear.school_year_id }, left_date: null },
    include: {
      student: { select: { student_id: true, deleted_at: true, student_status: true } },
      class: { select: { age_group: true } },
    },
  });

  // Also from StudentYearEnrollment (students with no class in prev year)
  const prevEnrollments = await prisma.studentYearEnrollment.findMany({
    where: { school_year_id: prevYear.school_year_id },
    include: { student: { select: { student_id: true, deleted_at: true, student_status: true } } },
  });

  // Build map: student_id → grade_level (prefer StudentClass)
  // Only include students with promotable status (skip Thôi học, Chuyển đi, etc.)
  const studentGrades = new Map();
  for (const sc of prevClasses) {
    if (!sc.student.deleted_at && PROMOTABLE_STATUSES.includes(sc.student.student_status)) {
      studentGrades.set(sc.student.student_id, sc.class.age_group ?? null);
    }
  }
  for (const se of prevEnrollments) {
    if (!se.student.deleted_at && !studentGrades.has(se.student_id) && PROMOTABLE_STATUSES.includes(se.student.student_status)) {
      studentGrades.set(se.student_id, se.grade_level ?? null);
    }
  }

  // Check which students already enrolled in toYear
  const alreadyEnrolled = await prisma.studentYearEnrollment.findMany({
    where: { school_year_id: toYearId },
    select: { student_id: true },
  });
  const alreadySet = new Set(alreadyEnrolled.map((e) => e.student_id));

  let promoted = 0, graduated = 0, skipped = 0;

  for (const [studentId, gradeLevel] of studentGrades) {
    if (alreadySet.has(studentId)) { skipped++; continue; }

    const nextGrade = GRADE_PROGRESSION[gradeLevel];

    if (gradeLevel === 'Lá' || nextGrade === undefined) {
      // Graduate: skip — teacher will manually set "Hoàn thành chương trình", account stays active
      graduated++;
    } else {
      // Close old class record
      await prisma.studentClass.updateMany({
        where: { student_id: studentId, class: { school_year_id: prevYear.school_year_id }, left_date: null },
        data: { left_date: new Date() },
      });
      // Promote to next grade, reset status to Đang học
      await prisma.studentYearEnrollment.create({
        data: { student_id: studentId, school_year_id: toYearId, grade_level: nextGrade },
      });
      await prisma.student.update({
        where: { student_id: studentId },
        data: { grade_level: nextGrade, student_status: 'Đang học' },
      });
      promoted++;
    }
  }

  // Auto-inactive: students absent from BOTH prevYear and toYear (2 consecutive years missing)
  let inactivated = 0;
  const prevPrevYear = await prisma.schoolYear.findFirst({
    where: { school_year_id: { notIn: [toYearId, prevYear.school_year_id] }, deleted_at: null },
    orderBy: { start_date: 'desc' },
  });

  if (prevPrevYear) {
    // Collect IDs enrolled in prevPrevYear (via StudentClass OR StudentYearEnrollment)
    const ppClasses = await prisma.studentClass.findMany({
      where: { class: { school_year_id: prevPrevYear.school_year_id } },
      select: { student_id: true },
    });
    const ppEnrollments = await prisma.studentYearEnrollment.findMany({
      where: { school_year_id: prevPrevYear.school_year_id },
      select: { student_id: true },
    });
    const ppIds = new Set([...ppClasses, ...ppEnrollments].map((r) => r.student_id));

    // IDs enrolled in prevYear
    const prevClassIds = new Set(prevClasses.map((sc) => sc.student.student_id));
    const prevEnrollIds = new Set(prevEnrollments.map((e) => e.student_id));

    // IDs enrolled in toYear
    const toYearIds = new Set(alreadyEnrolled.map((e) => e.student_id));

    // Absent from prevYear AND toYear → 2 years gone
    const toDeactivate = [...ppIds].filter(
      (id) => !prevClassIds.has(id) && !prevEnrollIds.has(id) && !toYearIds.has(id),
    );

    if (toDeactivate.length > 0) {
      const result = await prisma.account.updateMany({
        where: {
          student: { student_id: { in: toDeactivate }, deleted_at: null },
          is_active: true,
          deleted_at: null,
        },
        data: { is_active: false },
      });
      inactivated = result.count;
    }
  }

  logger.info(`Promoted ${promoted} students to ${toYear.name}, graduated ${graduated} Lá students, inactivated ${inactivated}`);
  return { promoted, graduated, skipped, inactivated };
}

export async function restore(id) {
  const year = await prisma.schoolYear.findFirst({ where: { school_year_id: id } });
  if (!year) throw NotFound('Academic year not found');
  if (!year.deleted_at) throw BadRequest('Năm học chưa bị lưu trữ');

  return prisma.schoolYear.update({
    where: { school_year_id: id },
    data: { deleted_at: null, status: STATUS.INACTIVE },
  });
}

export async function softDelete(id) {
  const year = await assertExists(id);
  if (year.status === STATUS.ACTIVE)
    throw BadRequest('Không thể xóa năm đang active — chuyển active trước');

  const classCount = await prisma.class.count({
    where: { school_year_id: id, deleted_at: null },
  });
  if (classCount > 0)
    throw BadRequest(`Không thể xóa — còn ${classCount} lớp liên kết`);

  return prisma.schoolYear.update({
    where: { school_year_id: id },
    data: { deleted_at: new Date(), status: STATUS.INACTIVE },
  });
}
