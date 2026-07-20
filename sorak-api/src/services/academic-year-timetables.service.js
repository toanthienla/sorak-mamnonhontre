import prisma from '../config/prisma.js';
import { paginate } from '../utils/paginate.js';
import { BadRequest, Conflict, Forbidden, NotFound } from '../utils/http-error.js';

const SELECT = {
  timetable_id: true,
  school_year_id: true,
  age_group_id: true,
  name: true,
  description: true,
  status: true,
  created_by: true,
  created_at: true,
  last_updated_by: true,
  last_updated_at: true,
  change_reason: true,
  locked_by: true,
  locked_at: true,
  unlocked_by: true,
  unlocked_at: true,
  unlock_reason: true,
  school_year: {
    select: { school_year_id: true, name: true, start_date: true, end_date: true, status: true },
  },
  age_group: {
    select: {
      assessment_age_group_id: true,
      name_vi: true,
      class_group_label: true,
    },
  },
  creator: { select: { teacher: { select: { full_name: true } } } },
  last_updater: { select: { teacher: { select: { full_name: true } } } },
  locker: { select: { teacher: { select: { full_name: true } } } },
  unlocker: { select: { teacher: { select: { full_name: true } } } },
  items: {
    orderBy: [
      { week_pattern: 'asc' },
      { day_of_week: 'asc' },
      { session: 'asc' },
      { display_order: 'asc' },
    ],
    select: {
      timetable_item_id: true,
      timetable_id: true,
      week_pattern: true,
      day_of_week: true,
      session: true,
      display_order: true,
      activity_type: true,
      subject_id: true,
      activity_name: true,
      is_theme_based: true,
      is_assessable: true,
      requires_weekly_mapping: true,
      note: true,
      subject: {
        select: {
          assessment_subject_id: true,
          name: true,
          development_field: { select: { name_vi: true } },
        },
      },
    },
  },
};

const DAY_ORDER = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
const SESSION_ORDER = ['MORNING', 'AFTERNOON'];
const WEEK_PATTERNS = ['ALL', 'ODD', 'EVEN'];

function normalizeText(value) {
  return value?.trim() || null;
}

function toItemData(item) {
  const type = item.activityType;
  const defaults = { isThemeBased: true, isAssessable: true, requiresWeeklyMapping: true };

  return {
    week_pattern: item.weekPattern,
    day_of_week: item.dayOfWeek,
    session: item.session,
    display_order: item.displayOrder,
    activity_type: type,
    subject_id: item.subjectId ?? null,
    activity_name: normalizeText(item.activityName),
    is_theme_based: item.isThemeBased ?? defaults.isThemeBased,
    is_assessable: item.isAssessable ?? defaults.isAssessable,
    requires_weekly_mapping: item.requiresWeeklyMapping ?? defaults.requiresWeeklyMapping,
    note: normalizeText(item.note),
  };
}

function getItemName(item) {
  return item.subject?.name ?? item.activity_name;
}

function groupItems(items) {
  const grouped = {};
  for (const pattern of WEEK_PATTERNS) {
    grouped[pattern] = {};
    for (const day of DAY_ORDER) {
      grouped[pattern][day] = {};
      for (const session of SESSION_ORDER) grouped[pattern][day][session] = [];
    }
  }
  for (const item of items ?? []) {
    grouped[item.week_pattern]?.[item.day_of_week]?.[item.session]?.push(item);
  }
  return grouped;
}

function withComputed(row) {
  const itemCount = row.items?.length ?? 0;
  return {
    ...row,
    itemCount,
    assessableItemCount: row.items?.filter((item) => item.is_assessable).length ?? 0,
    themeBasedItemCount: row.items?.filter((item) => item.is_theme_based).length ?? 0,
    groupedItems: groupItems(row.items ?? []),
  };
}

async function assertSchoolYear(id) {
  const row = await prisma.schoolYear.findFirst({
    where: { school_year_id: id, deleted_at: null },
    select: { school_year_id: true, name: true },
  });
  if (!row) throw BadRequest('Năm học không tồn tại');
  return row;
}

async function assertAgeGroup(id) {
  const row = await prisma.assessmentAgeGroup.findFirst({
    where: { assessment_age_group_id: id, deleted_at: null },
    select: { assessment_age_group_id: true },
  });
  if (!row) throw BadRequest('Nhóm tuổi không tồn tại');
  return row;
}

export async function checkTimetableUsage() {
  // TODO: When Weekly Development Plan and Daily Assessment modules are implemented,
  // this must check dependent usage and block destructive timetable changes.
  return false;
}

async function getDefaultAcademicYearId(academicYearId) {
  if (academicYearId) return Number(academicYearId);

  const active = await prisma.schoolYear.findFirst({
    where: { status: 'active', deleted_at: null },
    select: { school_year_id: true },
    orderBy: { start_date: 'desc' },
  });
  if (!active) throw BadRequest('Chưa có năm học để thiết lập thời khóa biểu.');
  return active.school_year_id;
}

export async function ensureTimetablesForAcademicYear(academicYearId, actorId) {
  const schoolYear = await assertSchoolYear(Number(academicYearId));
  const ageGroups = await prisma.assessmentAgeGroup.findMany({
    where: { deleted_at: null },
    select: { assessment_age_group_id: true, name_vi: true, class_group_label: true },
    orderBy: [{ display_order: 'asc' }, { assessment_age_group_id: 'asc' }],
  });

  const existing = await prisma.academicYearTimetable.findMany({
    where: { school_year_id: schoolYear.school_year_id, deleted_at: null },
    select: { age_group_id: true },
  });
  const existingAgeGroupIds = new Set(existing.map((row) => row.age_group_id));
  const missing = ageGroups.filter(
    (ageGroup) => !existingAgeGroupIds.has(ageGroup.assessment_age_group_id),
  );

  if (missing.length > 0) {
    await prisma.academicYearTimetable.createMany({
      data: missing.map((ageGroup) => ({
        school_year_id: schoolYear.school_year_id,
        age_group_id: ageGroup.assessment_age_group_id,
        name: `Thời khóa biểu ${ageGroup.name_vi} - ${schoolYear.name}`,
        status: 'DRAFT',
        created_by: actorId,
      })),
      skipDuplicates: true,
    });
  }
}

async function validateNoDuplicateTimetable(academicYearId, ageGroupId, exceptId) {
  const row = await prisma.academicYearTimetable.findFirst({
    where: {
      school_year_id: academicYearId,
      age_group_id: ageGroupId,
      deleted_at: null,
      ...(exceptId ? { timetable_id: { not: exceptId } } : {}),
    },
    select: { timetable_id: true },
  });
  if (row) throw Conflict('Đã tồn tại thời khóa biểu cho năm học và nhóm tuổi này.');
}

async function validateItems(items, ageGroupId) {
  const seen = new Set();
  const subjectIds = new Set();

  for (const raw of items ?? []) {
    const item = toItemData(raw);
    const effectivePatterns = item.week_pattern === 'ALL' ? ['ODD', 'EVEN'] : [item.week_pattern];
    for (const pattern of effectivePatterns) {
      const key = `${pattern}|${item.day_of_week}|${item.session}|${item.display_order}`;
      if (seen.has(key)) {
        throw BadRequest(
          'Trong cùng một tuần, một buổi học không được có hai hoạt động cùng thứ tự hiển thị.',
        );
      }
      seen.add(key);
    }

    if (item.activity_type === 'ROUTINE') {
      throw BadRequest('Hoạt động sinh hoạt không thuộc phạm vi thời khóa biểu đánh giá.');
    }

    if (item.activity_type === 'SUBJECT' && !item.subject_id) {
      throw BadRequest('Vui lòng chọn môn học cho hoạt động môn học.');
    }
    if (item.activity_type === 'THEME_ACTIVITY' && !item.activity_name) {
      throw BadRequest('Vui lòng nhập tên hoạt động.');
    }
    if (!item.subject_id && !item.activity_name) {
      throw BadRequest('Vui lòng chọn môn học hoặc nhập tên hoạt động.');
    }
    if (item.subject_id) subjectIds.add(item.subject_id);
  }

  if (subjectIds.size > 0) {
    const subjects = await prisma.assessmentSubject.findMany({
      where: {
        assessment_subject_id: { in: [...subjectIds] },
        assessment_age_group_id: Number(ageGroupId),
        is_active: true,
        deleted_at: null,
      },
      select: { assessment_subject_id: true },
    });
    if (subjects.length !== subjectIds.size) {
      throw BadRequest('Môn học không tồn tại hoặc đã ngừng kích hoạt.');
    }
  }
}

async function assertExists(id) {
  const row = await prisma.academicYearTimetable.findFirst({
    where: { timetable_id: id, deleted_at: null },
    select: SELECT,
  });
  if (!row) throw NotFound('Không tìm thấy thời khóa biểu năm học.');
  return row;
}

export async function findAll(query, actorId) {
  const { page, pageSize, academicYearId, ageGroupId, status, keyword } = query;
  const yearId = await getDefaultAcademicYearId(academicYearId);
  await ensureTimetablesForAcademicYear(yearId, actorId);

  const where = { deleted_at: null, school_year_id: yearId };
  if (ageGroupId) where.age_group_id = Number(ageGroupId);
  if (status) where.status = status;
  if (keyword) {
    where.OR = [
      { name: { contains: keyword, mode: 'insensitive' } },
      { description: { contains: keyword, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.academicYearTimetable.findMany({
      where,
      select: SELECT,
      orderBy: [{ school_year_id: 'desc' }, { age_group: { display_order: 'asc' } }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.academicYearTimetable.count({ where }),
  ]);

  return paginate(rows.map(withComputed), total, page, pageSize);
}

export async function findOne(id) {
  return withComputed(await assertExists(id));
}

export async function create(dto, actorId) {
  await assertSchoolYear(dto.academicYearId);
  await assertAgeGroup(dto.ageGroupId);
  await validateNoDuplicateTimetable(dto.academicYearId, dto.ageGroupId);
  await validateItems(dto.items, dto.ageGroupId);

  return prisma.$transaction(async (tx) => {
    const row = await tx.academicYearTimetable.create({
      data: {
        school_year_id: dto.academicYearId,
        age_group_id: dto.ageGroupId,
        name: dto.name,
        description: normalizeText(dto.description),
        status: 'DRAFT',
        created_by: actorId,
        items: { create: dto.items.map(toItemData) },
      },
      select: SELECT,
    });
    return withComputed(row);
  });
}

export async function update(id, dto, actorId) {
  const current = await assertExists(id);
  if (current.status === 'LOCKED') throw BadRequest('Không thể cập nhật thời khóa biểu đã khóa.');
  if (await checkTimetableUsage(id)) {
    throw BadRequest('Không thể cập nhật vì thời khóa biểu đã được sử dụng.');
  }

  const academicYearId = dto.academicYearId ?? current.school_year_id;
  const ageGroupId = dto.ageGroupId ?? current.age_group_id;
  await assertSchoolYear(academicYearId);
  await assertAgeGroup(ageGroupId);
  await validateNoDuplicateTimetable(academicYearId, ageGroupId, id);
  await validateItems(dto.items, ageGroupId);

  return prisma.$transaction(async (tx) => {
    await tx.academicYearTimetableItem.deleteMany({ where: { timetable_id: id } });
    const row = await tx.academicYearTimetable.update({
      where: { timetable_id: id },
      data: {
        school_year_id: academicYearId,
        age_group_id: ageGroupId,
        name: dto.name ?? current.name,
        description: normalizeText(dto.description),
        last_updated_by: actorId,
        last_updated_at: new Date(),
        change_reason: dto.changeReason,
        items: { create: dto.items.map(toItemData) },
      },
      select: SELECT,
    });
    return withComputed(row);
  });
}

export async function lock(id, actorId) {
  const current = await assertExists(id);
  if (current.status !== 'DRAFT') throw BadRequest('Thời khóa biểu không ở trạng thái bản nháp.');
  if ((current.items?.length ?? 0) === 0) {
    throw BadRequest('Thời khóa biểu phải có ít nhất một hoạt động trước khi khóa.');
  }
  await validateItems(
    current.items.map((item) => ({
      weekPattern: item.week_pattern,
      dayOfWeek: item.day_of_week,
      session: item.session,
      displayOrder: item.display_order,
      activityType: item.activity_type,
      subjectId: item.subject_id,
      activityName: item.activity_name,
      isThemeBased: item.is_theme_based,
      isAssessable: item.is_assessable,
      requiresWeeklyMapping: item.requires_weekly_mapping,
      note: item.note,
    })),
    current.age_group_id,
  );

  const row = await prisma.academicYearTimetable.update({
    where: { timetable_id: id },
    data: { status: 'LOCKED', locked_by: actorId, locked_at: new Date() },
    select: SELECT,
  });
  return withComputed(row);
}

export async function unlock(id, dto, actorId) {
  const current = await assertExists(id);
  if (current.status !== 'LOCKED') throw BadRequest('Thời khóa biểu chưa được khóa.');

  const row = await prisma.academicYearTimetable.update({
    where: { timetable_id: id },
    data: {
      status: 'DRAFT',
      unlocked_by: actorId,
      unlocked_at: new Date(),
      unlock_reason: dto.unlockReason,
    },
    select: SELECT,
  });
  return withComputed(row);
}

async function getActiveAcademicYearId(academicYearId) {
  if (academicYearId) return Number(academicYearId);
  const active = await prisma.schoolYear.findFirst({
    where: { status: 'active', deleted_at: null },
    select: { school_year_id: true },
  });
  if (!active) throw BadRequest('Không có năm học đang hoạt động');
  return active.school_year_id;
}

async function resolveTeacherClass(user, academicYearId) {
  if (user.role !== 'TEACHER') throw Forbidden('Bạn không có quyền thực hiện thao tác này.');
  const yearId = await getActiveAcademicYearId(academicYearId);
  const teacher = await prisma.teacher.findUnique({
    where: { account_id: user.sub },
    select: {
      teacher_classes: {
        where: {
          removed_at: null,
          class: { school_year_id: yearId, deleted_at: null },
        },
        select: {
          class: {
            select: {
              class_id: true,
              class_name: true,
              age_group: true,
              school_year_id: true,
              school_year: {
                select: { school_year_id: true, name: true, start_date: true, end_date: true },
              },
            },
          },
        },
      },
    },
  });
  const classes = teacher?.teacher_classes.map((item) => item.class).filter(Boolean) ?? [];
  if (classes.length === 0)
    throw BadRequest(
      'Bạn chưa được phân công lớp trong năm học này nên không thể xem thời khóa biểu.',
    );
  if (classes.length > 1) {
    throw Conflict(
      'Giáo viên đang được phân công nhiều hơn một lớp trong cùng năm học. Vui lòng kiểm tra lại phân công lớp.',
    );
  }
  return { classRow: classes[0], academicYearId: yearId };
}

async function findAgeGroupByClassLabel(label) {
  const ageGroup = await prisma.assessmentAgeGroup.findFirst({
    where: { class_group_label: label, deleted_at: null },
    select: { assessment_age_group_id: true, name_vi: true, class_group_label: true },
  });
  if (!ageGroup) throw BadRequest('Không tìm thấy nhóm tuổi của lớp được phân công.');
  return ageGroup;
}

async function findLockedForAgeGroup(academicYearId, ageGroupId) {
  const row = await prisma.academicYearTimetable.findFirst({
    where: {
      school_year_id: academicYearId,
      age_group_id: ageGroupId,
      status: 'LOCKED',
      deleted_at: null,
    },
    select: SELECT,
  });
  if (!row) throw NotFound('Chưa có thời khóa biểu chính thức cho nhóm tuổi này.');
  return withComputed(row);
}

export async function assignedWeekly(query, user) {
  const { classRow, academicYearId } = await resolveTeacherClass(user, query.academicYearId);
  const ageGroup = await findAgeGroupByClassLabel(classRow.age_group);
  const [timetable, weeklyPlans] = await Promise.all([
    findLockedForAgeGroup(academicYearId, ageGroup.assessment_age_group_id),
    prisma.weeklyDevelopmentPlan.findMany({
      where: {
        school_year_id: academicYearId,
        class_id: classRow.class_id,
        deleted_at: null,
      },
      select: {
        weekly_development_plan_id: true,
        monthly_theme_plan_id: true,
        planning_year: true,
        planning_month: true,
        week_number: true,
        display_range: true,
        status: true,
        monthly_theme_plan: {
          select: {
            monthly_theme_plan_id: true,
            name: true,
          },
        },
        activities: {
          select: {
            weekly_development_plan_activity_id: true,
            source_timetable_item_id: true,
            day_of_week: true,
            session: true,
            display_order: true,
            criteria: {
              select: {
                criterion_id: true,
                criterion: {
                  select: {
                    criterion_code: true,
                    content: true,
                    assessment_topic: {
                      select: {
                        assessment_topic_id: true,
                        name: true,
                        description: true,
                        assessment_theme: {
                          select: {
                            assessment_theme_id: true,
                            name: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
              orderBy: { criterion: { criterion_code: 'asc' } },
            },
          },
        },
      },
      orderBy: [{ planning_year: 'desc' }, { planning_month: 'desc' }, { week_number: 'desc' }],
    }),
  ]);
  return { class: classRow, ageGroup, timetable, weeklyPlans };
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function mondayOf(date) {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = next.getUTCDay() || 7;
  next.setUTCDate(next.getUTCDate() - day + 1);
  return next;
}

function dayOfWeekFromDate(date) {
  const day = date.getUTCDay();
  if (day < 1 || day > 5) throw BadRequest('Ngày được chọn không thuộc thứ Hai đến thứ Sáu.');
  return DAY_ORDER[day - 1];
}

function planningMonthOfWeek(monday) {
  const counts = new Map();
  for (let offset = 0; offset < 5; offset += 1) {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + offset);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function computePlanningInfo(input) {
  const date = new Date(input);
  const dayOfWeek = dayOfWeekFromDate(date);
  const monday = mondayOf(date);
  const planningMonth = planningMonthOfWeek(monday);
  const [year, month] = planningMonth.split('-').map(Number);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const cursor = mondayOf(first);
  let weekNumber = 0;
  while (cursor <= monday) {
    if (planningMonthOfWeek(cursor) === planningMonth) weekNumber += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  const weekParity = weekNumber % 2 === 0 ? 'EVEN' : 'ODD';
  return {
    date: toIsoDate(date),
    dayOfWeek,
    planningMonth,
    weekNumber,
    weekParity,
  };
}

export async function assignedDailyActivities(query, user) {
  const weekly = await assignedWeekly(query, user);
  const info = query.date
    ? computePlanningInfo(query.date)
    : {
        date: null,
        dayOfWeek: query.dayOfWeek,
        planningMonth: null,
        weekNumber: query.weekNumber ?? null,
        weekParity:
          query.weekPattern ??
          (query.weekNumber ? (query.weekNumber % 2 === 0 ? 'EVEN' : 'ODD') : null),
      };
  const allowedPatterns = info.weekParity
    ? ['ALL', info.weekParity]
    : ['ALL', query.weekPattern].filter(Boolean);
  const activities = weekly.timetable.items
    .filter(
      (item) => item.day_of_week === info.dayOfWeek && allowedPatterns.includes(item.week_pattern),
    )
    .sort((a, b) => a.session.localeCompare(b.session) || a.display_order - b.display_order);
  return {
    ...info,
    class: weekly.class,
    ageGroup: weekly.ageGroup,
    activities,
    groupedActivities: {
      MORNING: activities.filter((item) => item.session === 'MORNING'),
      AFTERNOON: activities.filter((item) => item.session === 'AFTERNOON'),
    },
  };
}
