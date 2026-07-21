import prisma from '../config/prisma.js';
import { paginate } from '../utils/paginate.js';
import { BadRequest, Conflict, Forbidden, NotFound } from '../utils/http-error.js';

const PLAN_SELECT = {
  monthly_theme_plan_id: true,
  school_year_id: true,
  class_id: true,
  age_group_id: true,
  name: true,
  planning_year: true,
  planning_month: true,
  expected_start_date: true,
  expected_end_date: true,
  note: true,
  status: true,
  created_by: true,
  created_at: true,
  updated_by: true,
  ready_by: true,
  ready_at: true,
  updated_at: true,
  deleted_at: true,
  school_year: { select: { school_year_id: true, name: true, start_date: true, end_date: true } },
  class: { select: { class_id: true, class_name: true, age_group: true } },
  age_group: {
    select: {
      assessment_age_group_id: true,
      name_vi: true,
      class_group_label: true,
    },
  },
  criteria: {
    select: {
      criterion_id: true,
      criterion: { select: { assessment_topic_id: true } },
    },
  },
  weeks: {
    select: {
      monthly_theme_plan_week_id: true,
      week_number: true,
      start_date: true,
      end_date: true,
      display_range: true,
      parity: true,
    },
    orderBy: { week_number: 'asc' },
  },
};

function normalizeText(value) {
  return value?.trim() || null;
}

function toDateOnly(value) {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function mondayOf(date) {
  const current = toDateOnly(date);
  const day = current.getUTCDay();
  current.setUTCDate(current.getUTCDate() - (day === 0 ? 6 : day - 1));
  return current;
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function formatDayMonth(date) {
  return `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function planningMonthOfWeek(monday) {
  const counts = new Map();
  for (let offset = 0; offset < 5; offset += 1) {
    const date = addDays(monday, offset);
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

export function generatePlanningWeeks(year, month) {
  const planningMonth = `${year}-${String(month).padStart(2, '0')}`;
  const firstDate = new Date(Date.UTC(year, month - 1, 1));
  const cursor = mondayOf(firstDate);
  const weeks = [];

  while (weeks.length < 6) {
    const weekMonth = planningMonthOfWeek(cursor);
    if (weekMonth === planningMonth) {
      const weekNumber = weeks.length + 1;
      weeks.push({
        weekNumber,
        startDate: toIsoDate(cursor),
        endDate: toIsoDate(addDays(cursor, 6)),
        displayRange: `${formatDayMonth(cursor)} - ${formatDayMonth(addDays(cursor, 6))}`,
        parity: weekNumber % 2 === 0 ? 'EVEN' : 'ODD',
      });
    } else if (weeks.length > 0 && weekMonth !== planningMonth) {
      break;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }

  return weeks;
}

function withCounts(plan) {
  const topicIds = new Set(plan.criteria?.map((item) => item.criterion.assessment_topic_id) ?? []);
  return {
    ...plan,
    selectedTopicCount: topicIds.size,
    selectedCriterionCount: plan.criteria?.length ?? 0,
  };
}

async function getPlanFieldCoverage(planId) {
  const [fields, selectedRows] = await Promise.all([
    prisma.developmentField.findMany({
      where: { deleted_at: null },
      select: { development_field_id: true, name_vi: true, display_order: true },
      orderBy: { display_order: 'asc' },
    }),
    prisma.monthlyDevelopmentPlanCriterion.findMany({
      where: { monthly_theme_plan_id: planId },
      select: {
        criterion: {
          select: {
            development_field_id: true,
          },
        },
      },
    }),
  ]);

  const selectedFieldIds = new Set(
    selectedRows.map((row) => row.criterion.development_field_id).filter(Boolean),
  );
  const missingFields = fields
    .filter((field) => !selectedFieldIds.has(field.development_field_id))
    .map((field) => ({
      id: field.development_field_id,
      name: field.name_vi,
    }));
  const totalFieldCount = fields.length || 5;

  return {
    selectedFieldCount: Math.min(selectedFieldIds.size, totalFieldCount),
    totalFieldCount,
    missingFieldCount: missingFields.length,
    missingFields,
  };
}

function buildIncompleteFieldsWarning(coverage) {
  return {
    requiresConfirmation: true,
    warningCode: 'INCOMPLETE_DEVELOPMENT_FIELDS',
    ...coverage,
    message: `Kế hoạch này vẫn còn thiếu ${coverage.missingFieldCount}/${coverage.totalFieldCount} lĩnh vực phát triển. Bạn có muốn hoàn tất kế hoạch không?`,
  };
}

export async function checkMonthlyThemePlanUsage(planId) {
  const row = await prisma.weeklyDevelopmentPlan.findFirst({
    where: {
      monthly_theme_plan_id: Number(planId),
      deleted_at: null,
    },
    select: { weekly_development_plan_id: true },
  });
  return Boolean(row);
}

async function removeDeletedWeeklyPlanCriteriaMappings(tx, planId) {
  await tx.weeklyDevelopmentPlanActivityCriterion.deleteMany({
    where: {
      monthlyPlanCriterion: {
        monthly_theme_plan_id: Number(planId),
      },
      activity: {
        weekly_plan: {
          deleted_at: { not: null },
        },
      },
    },
  });
}

function assertPlanCanBeEdited(plan) {
  if (plan.status === 'USED') {
    throw BadRequest('Kế hoạch đã được sử dụng nên không thể chỉnh sửa.');
  }
  if (plan.status !== 'DRAFT') {
    throw BadRequest('Vui lòng đưa kế hoạch về bản nháp trước khi chỉnh sửa.');
  }
}

async function getActiveAcademicYearId(academicYearId) {
  if (academicYearId) return Number(academicYearId);
  const active = await prisma.schoolYear.findFirst({
    where: { status: 'active', deleted_at: null },
    select: { school_year_id: true },
    orderBy: { start_date: 'desc' },
  });
  if (!active) throw BadRequest('Không có năm học đang hoạt động.');
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
  if (classes.length === 0) {
    throw BadRequest('Bạn chưa được phân công lớp trong năm học này nên không thể lập kế hoạch.');
  }
  if (classes.length > 1) {
    throw Conflict(
      'Giáo viên đang được phân công nhiều hơn một lớp trong cùng năm học. Vui lòng kiểm tra lại phân công lớp.',
    );
  }
  const ageGroup = await prisma.assessmentAgeGroup.findFirst({
    where: { class_group_label: classes[0].age_group, deleted_at: null },
    select: {
      assessment_age_group_id: true,
      name_vi: true,
      class_group_label: true,
    },
  });
  if (!ageGroup) throw BadRequest('Không tìm thấy nhóm tuổi của lớp được phân công.');
  return { classRow: classes[0], ageGroup, academicYearId: yearId };
}

function assertPlanningMonthInSchoolYear(year, month, schoolYear) {
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0));
  if (
    monthEnd < toDateOnly(schoolYear.start_date) ||
    monthStart > toDateOnly(schoolYear.end_date)
  ) {
    throw BadRequest('Tháng triển khai phải nằm trong năm học đang chọn.');
  }
}

function resolveSelectedPlanningWeeks(year, month, selectedWeeks) {
  const weekNumbers = [...new Set((selectedWeeks ?? []).map(Number))].sort((a, b) => a - b);
  if (weekNumbers.length === 0) throw BadRequest('Vui lòng chọn ít nhất một tuần áp dụng.');

  for (let index = 1; index < weekNumbers.length; index += 1) {
    if (weekNumbers[index] !== weekNumbers[index - 1] + 1) {
      throw BadRequest('Các tuần áp dụng của một kế hoạch cần liên tiếp nhau.');
    }
  }

  const generatedWeeks = generatePlanningWeeks(year, month);
  const selected = weekNumbers.map((weekNumber) => {
    const week = generatedWeeks.find((item) => item.weekNumber === weekNumber);
    if (!week) throw BadRequest('Tuần áp dụng không thuộc tháng triển khai đã chọn.');
    return week;
  });

  return {
    generatedWeeks,
    selectedWeeks: selected,
    start: toDateOnly(selected[0].startDate),
    end: toDateOnly(selected[selected.length - 1].endDate),
  };
}

async function validateNoWeekOverlap({
  classId,
  schoolYearId,
  planningYear,
  planningMonth,
  selectedWeeks,
  exceptId,
}) {
  const overlap = await prisma.monthlyThemePlanWeek.findFirst({
    where: {
      week_number: { in: selectedWeeks.map((week) => week.weekNumber) },
      plan: {
        class_id: classId,
        school_year_id: schoolYearId,
        planning_year: planningYear,
        planning_month: planningMonth,
        deleted_at: null,
        ...(exceptId ? { monthly_theme_plan_id: { not: exceptId } } : {}),
      },
    },
    select: {
      week_number: true,
      display_range: true,
      plan: { select: { name: true } },
    },
  });
  if (overlap) {
    throw Conflict(
      `Tuần ${overlap.week_number} · ${overlap.display_range} đang thuộc kế hoạch "${overlap.plan.name}".`,
    );
  }
}

function buildWeekWrites(planId, weeks) {
  return weeks.map((week) => ({
    monthly_theme_plan_id: planId,
    week_number: week.weekNumber,
    start_date: toDateOnly(week.startDate),
    end_date: toDateOnly(week.endDate),
    display_range: week.displayRange,
    parity: week.parity,
  }));
}

async function assertPlanAccess(id, user) {
  const plan = await prisma.monthlyThemePlan.findFirst({
    where: { monthly_theme_plan_id: id, deleted_at: null },
    select: PLAN_SELECT,
  });
  if (!plan) throw NotFound('Không tìm thấy kế hoạch tháng/chủ đề.');
  const { classRow } = await resolveTeacherClass(user, plan.school_year_id);
  if (plan.class_id !== classRow.class_id) {
    throw Forbidden('Bạn không có quyền truy cập kế hoạch của lớp khác.');
  }
  return plan;
}

export async function findAll(query, user) {
  const { page, pageSize, keyword, status, fromDate, toDate } = query;
  const { classRow, ageGroup, academicYearId } = await resolveTeacherClass(
    user,
    query.academicYearId,
  );
  const where = {
    school_year_id: academicYearId,
    class_id: classRow.class_id,
    deleted_at: null,
  };
  if (status) where.status = status;
  const search = keyword || query.search;
  if (search) where.name = { contains: search, mode: 'insensitive' };
  if (fromDate) where.expected_end_date = { gte: toDateOnly(fromDate) };
  if (toDate) where.expected_start_date = { lte: toDateOnly(toDate) };

  const [rows, total] = await Promise.all([
    prisma.monthlyThemePlan.findMany({
      where,
      select: PLAN_SELECT,
      orderBy: [{ expected_start_date: 'desc' }, { monthly_theme_plan_id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.monthlyThemePlan.count({ where }),
  ]);

  const result = paginate(rows.map(withCounts), total, page, pageSize);
  return {
    ...result,
    meta: {
      ...result.meta,
      context: {
        class: classRow,
        ageGroup,
        academicYear: classRow.school_year,
      },
    },
  };
}

export async function planningWeeks(query, user) {
  const year = Number(query.year);
  const month = Number(query.month);
  const exceptId = query.exceptId ? Number(query.exceptId) : undefined;
  const { classRow, academicYearId } = await resolveTeacherClass(user, query.academicYearId);
  assertPlanningMonthInSchoolYear(year, month, classRow.school_year);

  const [weeks, occupied] = await Promise.all([
    Promise.resolve(generatePlanningWeeks(year, month)),
    prisma.monthlyThemePlanWeek.findMany({
      where: {
        plan: {
          class_id: classRow.class_id,
          school_year_id: academicYearId,
          planning_year: year,
          planning_month: month,
          deleted_at: null,
          ...(exceptId ? { monthly_theme_plan_id: { not: exceptId } } : {}),
        },
      },
      select: {
        week_number: true,
        plan: {
          select: {
            monthly_theme_plan_id: true,
            name: true,
          },
        },
      },
    }),
  ]);
  const occupiedMap = new Map(occupied.map((item) => [item.week_number, item.plan]));

  return {
    planningYear: year,
    planningMonth: month,
    weeks: weeks.map((week) => {
      const plan = occupiedMap.get(week.weekNumber);
      return {
        ...week,
        occupiedByPlanId: plan?.monthly_theme_plan_id ?? null,
        occupiedByPlanName: plan?.name ?? null,
      };
    }),
  };
}

export async function create(dto, user) {
  const { classRow, ageGroup, academicYearId } = await resolveTeacherClass(
    user,
    dto.academicYearId,
  );
  assertPlanningMonthInSchoolYear(dto.planningYear, dto.planningMonth, classRow.school_year);
  const { selectedWeeks, start, end } = resolveSelectedPlanningWeeks(
    dto.planningYear,
    dto.planningMonth,
    dto.selectedWeeks,
  );
  await validateNoWeekOverlap({
    classId: classRow.class_id,
    schoolYearId: academicYearId,
    planningYear: dto.planningYear,
    planningMonth: dto.planningMonth,
    selectedWeeks,
  });

  const plan = await prisma.$transaction(async (tx) => {
    const created = await tx.monthlyThemePlan.create({
      data: {
        school_year_id: academicYearId,
        class_id: classRow.class_id,
        age_group_id: ageGroup.assessment_age_group_id,
        name: dto.name,
        planning_year: dto.planningYear,
        planning_month: dto.planningMonth,
        expected_start_date: start,
        expected_end_date: end,
        note: normalizeText(dto.note),
        status: 'DRAFT',
        created_by: user.sub,
        updated_by: user.sub,
      },
      select: { monthly_theme_plan_id: true },
    });
    await tx.monthlyThemePlanWeek.createMany({
      data: buildWeekWrites(created.monthly_theme_plan_id, selectedWeeks),
    });
    return tx.monthlyThemePlan.findFirst({
      where: { monthly_theme_plan_id: created.monthly_theme_plan_id },
      select: PLAN_SELECT,
    });
  });
  return withCounts(plan);
}

export async function findOne(id, user) {
  const plan = await assertPlanAccess(id, user);
  return withCounts(plan);
}

export async function update(id, dto, user) {
  const current = await assertPlanAccess(id, user);
  if (await checkMonthlyThemePlanUsage(id)) {
    throw BadRequest('Không thể chỉnh sửa vì kế hoạch đã được sử dụng.');
  }
  assertPlanCanBeEdited(current);
  const planningYear = dto.planningYear ?? current.planning_year;
  const planningMonth = dto.planningMonth ?? current.planning_month;
  const selectedWeekNumbers = dto.selectedWeeks ?? current.weeks.map((week) => week.week_number);
  assertPlanningMonthInSchoolYear(planningYear, planningMonth, current.school_year);
  const { selectedWeeks, start, end } = resolveSelectedPlanningWeeks(
    planningYear,
    planningMonth,
    selectedWeekNumbers,
  );
  await validateNoWeekOverlap({
    classId: current.class_id,
    schoolYearId: current.school_year_id,
    planningYear,
    planningMonth,
    selectedWeeks,
    exceptId: id,
  });

  const updated = await prisma.$transaction(async (tx) => {
    await tx.monthlyThemePlanWeek.deleteMany({ where: { monthly_theme_plan_id: id } });
    await tx.monthlyThemePlanWeek.createMany({
      data: buildWeekWrites(id, selectedWeeks),
    });
    return tx.monthlyThemePlan.update({
      where: { monthly_theme_plan_id: id },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        planning_year: planningYear,
        planning_month: planningMonth,
        expected_start_date: start,
        expected_end_date: end,
        ...(Object.hasOwn(dto, 'note') ? { note: normalizeText(dto.note) } : {}),
        updated_by: user.sub,
      },
      select: PLAN_SELECT,
    });
  });
  return withCounts(updated);
}

export async function softDelete(id, user) {
  const current = await assertPlanAccess(id, user);
  if (current.status === 'USED') {
    throw BadRequest('Kế hoạch này đã được sử dụng cho kế hoạch tuần nên không thể xóa.');
  }
  if (await checkMonthlyThemePlanUsage(id)) {
    throw BadRequest('Kế hoạch này đã được sử dụng cho kế hoạch tuần nên không thể xóa.');
  }
  const plan = await prisma.$transaction(async (tx) => {
    await removeDeletedWeeklyPlanCriteriaMappings(tx, id);
    await tx.monthlyThemePlanWeek.deleteMany({
      where: { monthly_theme_plan_id: id },
    });
    await tx.monthlyDevelopmentPlanCriterion.deleteMany({
      where: { monthly_theme_plan_id: id },
    });
    await tx.monthlyDevelopmentPlanTopic.deleteMany({
      where: { monthly_theme_plan_id: id },
    });
    await tx.monthlyDevelopmentPlanTheme.deleteMany({
      where: { monthly_theme_plan_id: id },
    });
    return tx.monthlyThemePlan.update({
      where: { monthly_theme_plan_id: id },
      data: { deleted_at: new Date(), updated_by: user.sub },
      select: PLAN_SELECT,
    });
  });
  return withCounts(plan);
}

function createNode(map, id, factory) {
  if (!map.has(id)) map.set(id, factory());
  return map.get(id);
}

function criterionMatchesClassification(row, ageGroupId) {
  return (
    row.assessment_age_group_id === ageGroupId &&
    row.assessment_subject.development_field_id === row.development_field_id &&
    row.assessment_topic.assessment_age_group_id === row.assessment_age_group_id &&
    row.assessment_topic.assessment_subject_id === row.assessment_subject_id &&
    row.assessment_topic.assessment_theme_id === row.assessment_theme_id
  );
}

function buildCriteriaTree(criteria, selectedIds) {
  const fieldMap = new Map();
  for (const row of criteria) {
    const field = createNode(fieldMap, row.development_field_id, () => ({
      developmentFieldId: row.development_field_id,
      developmentFieldName: row.development_field.name_vi,
      selectedCount: 0,
      totalCount: 0,
      subjects: [],
      subjectMap: new Map(),
    }));
    const subject = createNode(field.subjectMap, row.assessment_subject_id, () => {
      const item = {
        subjectId: row.assessment_subject_id,
        subjectName: row.assessment_subject.name,
        selectedCount: 0,
        totalCount: 0,
        themes: [],
        themeMap: new Map(),
      };
      field.subjects.push(item);
      return item;
    });
    const theme = createNode(subject.themeMap, row.assessment_theme_id, () => {
      const item = {
        themeId: row.assessment_theme_id,
        themeName: row.assessment_theme.name,
        selectedCount: 0,
        totalCount: 0,
        topics: [],
        topicMap: new Map(),
      };
      subject.themes.push(item);
      return item;
    });
    const topic = createNode(theme.topicMap, row.assessment_topic_id, () => {
      const item = {
        topicId: row.assessment_topic_id,
        topicName: row.assessment_topic.name,
        selectedCount: 0,
        totalCount: 0,
        criteria: [],
      };
      theme.topics.push(item);
      return item;
    });
    const selected = selectedIds.has(row.assessment_criterion_id);
    const criterion = {
      criterionId: row.assessment_criterion_id,
      criterionCode: row.criterion_code,
      criterionDescription: row.content,
      selected,
    };
    topic.criteria.push(criterion);
    for (const node of [field, subject, theme, topic]) {
      node.totalCount += 1;
      if (selected) node.selectedCount += 1;
    }
  }

  return [...fieldMap.values()].map((field) => ({
    ...field,
    subjectMap: undefined,
    subjects: field.subjects.map((subject) => ({
      ...subject,
      themeMap: undefined,
      themes: subject.themes.map((theme) => ({
        ...theme,
        topicMap: undefined,
      })),
    })),
  }));
}

export async function criteriaBank(id, query, user) {
  const plan = await assertPlanAccess(id, user);
  const selectedIds = new Set(plan.criteria.map((item) => item.criterion_id));
  const where = {
    assessment_age_group_id: plan.age_group_id,
    is_active: true,
    deleted_at: null,
    development_field: { deleted_at: null },
    assessment_subject: { is_active: true, deleted_at: null },
    assessment_theme: { is_active: true, deleted_at: null },
    assessment_topic: { is_active: true, deleted_at: null },
  };
  if (query.developmentFieldId) where.development_field_id = Number(query.developmentFieldId);
  if (query.subjectId) where.assessment_subject_id = Number(query.subjectId);
  if (query.themeId) where.assessment_theme_id = Number(query.themeId);
  if (query.keyword) {
    where.OR = [
      { criterion_code: { contains: query.keyword, mode: 'insensitive' } },
      { content: { contains: query.keyword, mode: 'insensitive' } },
      { assessment_topic: { name: { contains: query.keyword, mode: 'insensitive' } } },
      { assessment_theme: { name: { contains: query.keyword, mode: 'insensitive' } } },
      { assessment_subject: { name: { contains: query.keyword, mode: 'insensitive' } } },
    ];
  }

  let criteria = await prisma.assessmentCriterion.findMany({
    where,
    select: {
      assessment_criterion_id: true,
      criterion_code: true,
      content: true,
      assessment_age_group_id: true,
      development_field_id: true,
      assessment_subject_id: true,
      assessment_theme_id: true,
      assessment_topic_id: true,
      development_field: { select: { name_vi: true, display_order: true } },
      assessment_subject: {
        select: { name: true, development_field_id: true },
      },
      assessment_theme: { select: { name: true } },
      assessment_topic: {
        select: {
          name: true,
          assessment_age_group_id: true,
          assessment_subject_id: true,
          assessment_theme_id: true,
        },
      },
    },
    orderBy: [
      { development_field: { display_order: 'asc' } },
      { assessment_subject: { name: 'asc' } },
      { assessment_theme: { name: 'asc' } },
      { assessment_topic: { name: 'asc' } },
      { criterion_code: 'asc' },
    ],
  });

  criteria = criteria.filter((row) => criterionMatchesClassification(row, plan.age_group_id));
  if (query.selectedOnly === 'true') {
    criteria = criteria.filter((row) => selectedIds.has(row.assessment_criterion_id));
  }

  return {
    plan: withCounts(plan),
    fieldCoverage: await getPlanFieldCoverage(id),
    tree: buildCriteriaTree(criteria, selectedIds),
  };
}

export async function updateSelectedCriteria(id, dto, user) {
  const plan = await assertPlanAccess(id, user);
  if (await checkMonthlyThemePlanUsage(id)) {
    throw BadRequest('Không thể chỉnh sửa tiêu chí vì kế hoạch đã được sử dụng.');
  }
  assertPlanCanBeEdited(plan);
  const ids = dto.criterionIds ?? [];
  const rows = await prisma.assessmentCriterion.findMany({
    where: {
      assessment_criterion_id: { in: ids },
      assessment_age_group_id: plan.age_group_id,
      is_active: true,
      deleted_at: null,
      development_field: { deleted_at: null },
      assessment_subject: { is_active: true, deleted_at: null },
      assessment_theme: { is_active: true, deleted_at: null },
      assessment_topic: { is_active: true, deleted_at: null },
    },
    select: {
      assessment_criterion_id: true,
      assessment_age_group_id: true,
      development_field_id: true,
      assessment_subject_id: true,
      assessment_theme_id: true,
      assessment_topic_id: true,
      assessment_subject: { select: { development_field_id: true } },
      assessment_topic: {
        select: {
          assessment_age_group_id: true,
          assessment_subject_id: true,
          assessment_theme_id: true,
        },
      },
    },
  });
  const validIds = rows
    .filter((row) => criterionMatchesClassification(row, plan.age_group_id))
    .map((row) => row.assessment_criterion_id);
  if (validIds.length !== ids.length) {
    throw BadRequest('Tiêu chí được chọn không hợp lệ hoặc không thuộc nhóm tuổi của lớp.');
  }
  const validRows = rows.filter((row) => validIds.includes(row.assessment_criterion_id));
  const themeIds = [...new Set(validRows.map((row) => row.assessment_theme_id))];
  const topicIds = [...new Set(validRows.map((row) => row.assessment_topic_id))];

  await prisma.$transaction(async (tx) => {
    await removeDeletedWeeklyPlanCriteriaMappings(tx, id);
    await tx.monthlyDevelopmentPlanTopic.deleteMany({
      where: { monthly_theme_plan_id: id },
    });
    await tx.monthlyDevelopmentPlanTheme.deleteMany({
      where: { monthly_theme_plan_id: id },
    });
    await tx.monthlyDevelopmentPlanCriterion.deleteMany({
      where: { monthly_theme_plan_id: id },
    });
    if (validIds.length > 0) {
      await tx.monthlyDevelopmentPlanTheme.createMany({
        data: themeIds.map((themeId) => ({
          monthly_theme_plan_id: id,
          theme_id: themeId,
        })),
        skipDuplicates: true,
      });
      await tx.monthlyDevelopmentPlanTopic.createMany({
        data: topicIds.map((topicId) => ({
          monthly_theme_plan_id: id,
          topic_id: topicId,
        })),
        skipDuplicates: true,
      });
      await tx.monthlyDevelopmentPlanCriterion.createMany({
        data: validIds.map((criterionId) => ({
          monthly_theme_plan_id: id,
          criterion_id: criterionId,
        })),
        skipDuplicates: true,
      });
    }
    await tx.monthlyThemePlan.update({
      where: { monthly_theme_plan_id: id },
      data: { updated_by: user.sub },
    });
  });

  return findOne(id, user);
}

export async function complete(id, dto, user) {
  const plan = await assertPlanAccess(id, user);
  if (plan.status !== 'DRAFT') {
    throw BadRequest('Chỉ có thể hoàn tất kế hoạch ở trạng thái bản nháp.');
  }
  if (!plan.name || !plan.expected_start_date || !plan.expected_end_date) {
    throw BadRequest('Kế hoạch cần có đầy đủ tên và thời gian trước khi hoàn tất.');
  }
  if ((plan.criteria?.length ?? 0) === 0) {
    throw BadRequest('Kế hoạch cần có ít nhất một tiêu chí trước khi hoàn tất.');
  }
  const coverage = await getPlanFieldCoverage(id);
  if (coverage.selectedFieldCount < coverage.totalFieldCount && !dto?.confirmIncompleteFields) {
    const warning = buildIncompleteFieldsWarning(coverage);
    throw Conflict(warning.message, warning);
  }

  const updated = await prisma.monthlyThemePlan.update({
    where: { monthly_theme_plan_id: id },
    data: {
      status: 'READY',
      ready_by: user.sub,
      ready_at: new Date(),
      updated_by: user.sub,
    },
    select: PLAN_SELECT,
  });
  return withCounts(updated);
}

export async function revertToDraft(id, user) {
  const plan = await assertPlanAccess(id, user);
  if (plan.status === 'USED' || (await checkMonthlyThemePlanUsage(id))) {
    throw BadRequest('Kế hoạch đã được sử dụng cho kế hoạch tuần nên không thể đưa về bản nháp.');
  }
  if (plan.status !== 'READY') {
    throw BadRequest('Chỉ kế hoạch chính thức mới có thể đưa về bản nháp.');
  }

  const updated = await prisma.monthlyThemePlan.update({
    where: { monthly_theme_plan_id: id },
    data: {
      status: 'DRAFT',
      ready_by: null,
      ready_at: null,
      updated_by: user.sub,
    },
    select: PLAN_SELECT,
  });
  return withCounts(updated);
}
