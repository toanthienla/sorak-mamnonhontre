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

  // Promotion is a separate explicit action (POST /:id/promote) — not auto-run on activate
  return updated;
}

const GRADE_PROGRESSION = {
  'Nhà trẻ': 'Mầm',
  Mầm: 'Chồi',
  Chồi: 'Lá',
  Lá: null, // graduate
};

export async function promoteStudents(toYearId) {
  // Find previous year (most recent by start_date, not toYear)
  const toYear = await assertExists(toYearId);
  const prevYear = await prisma.schoolYear.findFirst({
    where: { school_year_id: { not: toYearId }, deleted_at: null },
    orderBy: { start_date: 'desc' },
  });
  if (!prevYear) return { promoted: 0, graduated: 0, skipped: 0 };

  // Only students who completed the program get promoted (not still-learning ones)
  const PROMOTABLE_STATUSES = ['Hoàn thành chương trình'];

  // Collect students from previous year — via enrollments with class set
  const prevEnrollments = await prisma.studentEnrollment.findMany({
    where: { school_year_id: prevYear.school_year_id, class_id: { not: null }, left_date: null },
    include: {
      student: { select: { student_id: true, deleted_at: true, student_status: true } },
      class: { select: { age_group: true } },
    },
  });

  // Only promote students who had a class — students without class excluded
  const studentGrades = new Map();
  for (const e of prevEnrollments) {
    if (!e.student.deleted_at && PROMOTABLE_STATUSES.includes(e.student.student_status)) {
      studentGrades.set(e.student.student_id, e.class.age_group ?? null);
    }
  }

  // Check which students already enrolled in toYear
  const alreadyEnrolled = await prisma.studentEnrollment.findMany({
    where: { school_year_id: toYearId },
    select: { student_id: true },
  });
  const alreadySet = new Set(alreadyEnrolled.map((e) => e.student_id));

  let promoted = 0,
    graduated = 0,
    skipped = 0;

  // All-or-nothing: any failure rolls back EVERY student promoted in this run
  await prisma.$transaction(async (tx) => {
    for (const [studentId, gradeLevel] of studentGrades) {
      if (alreadySet.has(studentId)) {
        skipped++;
        continue;
      }

      const nextGrade = GRADE_PROGRESSION[gradeLevel];

      if (gradeLevel === 'Lá' || nextGrade === undefined) {
        // Graduate: skip — teacher will manually set "Hoàn thành chương trình", account stays active
        graduated++;
      } else {
        await tx.studentEnrollment.updateMany({
          where: {
            student_id: studentId,
            school_year_id: prevYear.school_year_id,
            left_date: null,
          },
          data: { left_date: new Date() },
        });
        await tx.studentEnrollment.create({
          data: {
            student_id: studentId,
            school_year_id: toYearId,
            class_id: null,
            grade_level: nextGrade,
          },
        });
        await tx.student.update({
          where: { student_id: studentId },
          data: { grade_level: nextGrade, student_status: 'Đang học' },
        });
        promoted++;
      }
    }
  });

  // Auto-inactive: students absent from BOTH prevYear and toYear (2 consecutive years missing)
  let inactivated = 0;
  const prevPrevYear = await prisma.schoolYear.findFirst({
    where: { school_year_id: { notIn: [toYearId, prevYear.school_year_id] }, deleted_at: null },
    orderBy: { start_date: 'desc' },
  });

  if (prevPrevYear) {
    // Collect IDs enrolled in prevPrevYear (single table now)
    const ppRows = await prisma.studentEnrollment.findMany({
      where: { school_year_id: prevPrevYear.school_year_id },
      select: { student_id: true },
    });
    const ppIds = new Set(ppRows.map((r) => r.student_id));

    // IDs with class in prevYear
    const prevClassIds = new Set(prevEnrollments.map((e) => e.student.student_id));

    // IDs enrolled in toYear
    const toYearIds = new Set(alreadyEnrolled.map((e) => e.student_id));

    // Absent from prevYear classes AND toYear → 2 years gone
    const toDeactivate = [...ppIds].filter((id) => !prevClassIds.has(id) && !toYearIds.has(id));

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

  logger.info(
    `Promoted ${promoted} students to ${toYear.name}, graduated ${graduated} Lá students, inactivated ${inactivated}`,
  );
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
  if (classCount > 0) throw BadRequest(`Không thể xóa — còn ${classCount} lớp liên kết`);

  return prisma.schoolYear.update({
    where: { school_year_id: id },
    data: { deleted_at: new Date(), status: STATUS.INACTIVE },
  });
}
