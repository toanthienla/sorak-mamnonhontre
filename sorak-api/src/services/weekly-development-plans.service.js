import prisma from '../config/prisma.js';
import { paginate } from '../utils/paginate.js';
import { BadRequest, Conflict, Forbidden, NotFound } from '../utils/http-error.js';
import { generatePlanningWeeks } from './monthly-theme-plans.service.js';

const DAY_ORDER = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
const SESSION_ORDER = ['MORNING', 'AFTERNOON'];

const PLAN_SELECT = {
  weekly_development_plan_id: true,
  school_year_id: true,
  class_id: true,
  age_group_id: true,
  monthly_theme_plan_id: true,
  planning_year: true,
  planning_month: true,
  week_number: true,
  start_date: true,
  end_date: true,
  display_range: true,
  parity: true,
  status: true,
  note: true,
  created_by: true,
  created_at: true,
  updated_by: true,
  updated_at: true,
  ready_by: true,
  ready_at: true,
  school_year: { select: { school_year_id: true, name: true, start_date: true, end_date: true } },
  class: { select: { class_id: true, class_name: true, age_group: true } },
  age_group: {
    select: { assessment_age_group_id: true, name_vi: true, class_group_label: true },
  },
  monthly_theme_plan: {
    select: {
      monthly_theme_plan_id: true,
      name: true,
      status: true,
      planning_year: true,
      planning_month: true,
    },
  },
  activities: {
    orderBy: [{ day_of_week: 'asc' }, { session: 'asc' }, { display_order: 'asc' }],
    select: {
      weekly_development_plan_activity_id: true,
      weekly_development_plan_id: true,
      source_timetable_item_id: true,
      day_of_week: true,
      activity_date: true,
      session: true,
      display_order: true,
      activity_type: true,
      subject_id: true,
      subject_name_snapshot: true,
      development_field_id: true,
      development_field_name_snapshot: true,
      activity_name_snapshot: true,
      note_snapshot: true,
      criteria: {
        select: {
          weekly_development_plan_activity_criterion_id: true,
          monthly_theme_plan_criterion_id: true,
          criterion_id: true,
          topic_id: true,
          subject_id: true,
          development_field_id: true,
          theme_id: true,
          criterion: {
            select: {
              criterion_code: true,
              content: true,
            },
          },
        },
        orderBy: { criterion: { criterion_code: 'asc' } },
      },
    },
  },
};

function toDateOnly(value) {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function dayOffset(dayOfWeek) {
  return DAY_ORDER.indexOf(dayOfWeek);
}

function getActivityName(activity) {
  return (
    activity.subject_name_snapshot || activity.activity_name_snapshot || 'Chưa đặt tên hoạt động'
  );
}

function groupedActivities(activities = []) {
  const grouped = {};
  for (const day of DAY_ORDER) {
    grouped[day] = {};
    for (const session of SESSION_ORDER) grouped[day][session] = [];
  }
  for (const activity of activities) {
    grouped[activity.day_of_week]?.[activity.session]?.push(activity);
  }
  return grouped;
}

function withComputed(plan) {
  const activityCount = plan.activities?.length ?? 0;
  const mappedActivityCount =
    plan.activities?.filter((activity) => (activity.criteria?.length ?? 0) > 0).length ?? 0;
  const criterionIds = new Set();
  for (const activity of plan.activities ?? []) {
    for (const row of activity.criteria ?? []) criterionIds.add(row.criterion_id);
  }
  return {
    ...plan,
    activityCount,
    mappedActivityCount,
    criterionCount: criterionIds.size,
    groupedActivities: groupedActivities(plan.activities ?? []),
  };
}

function listItem(row) {
  const computed = withComputed(row);
  return {
    weekly_development_plan_id: computed.weekly_development_plan_id,
    planning_year: computed.planning_year,
    planning_month: computed.planning_month,
    week_number: computed.week_number,
    display_range: computed.display_range,
    status: computed.status,
    updated_at: computed.updated_at,
    monthly_theme_plan: computed.monthly_theme_plan,
    activityCount: computed.activityCount,
    mappedActivityCount: computed.mappedActivityCount,
    criterionCount: computed.criterionCount,
  };
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
    throw BadRequest(
      'Bạn chưa được phân công lớp trong năm học này nên không thể lập kế hoạch tuần.',
    );
  }
  if (classes.length > 1) {
    throw Conflict(
      'Giáo viên đang được phân công nhiều hơn một lớp trong cùng năm học. Vui lòng kiểm tra lại phân công lớp.',
    );
  }
  const ageGroup = await prisma.assessmentAgeGroup.findFirst({
    where: { class_group_label: classes[0].age_group, deleted_at: null },
    select: { assessment_age_group_id: true, name_vi: true, class_group_label: true },
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

async function findMonthlyPlansForWeek({
  classId,
  schoolYearId,
  planningYear,
  planningMonth,
  weekNumber,
}) {
  return prisma.monthlyThemePlan.findMany({
    where: {
      class_id: classId,
      school_year_id: schoolYearId,
      planning_year: planningYear,
      planning_month: planningMonth,
      deleted_at: null,
      weeks: { some: { week_number: weekNumber } },
    },
    select: {
      monthly_theme_plan_id: true,
      name: true,
      status: true,
      criteria: { select: { criterion_id: true } },
    },
  });
}

async function findLockedTimetable(schoolYearId, ageGroupId) {
  return prisma.academicYearTimetable.findFirst({
    where: {
      school_year_id: schoolYearId,
      age_group_id: ageGroupId,
      status: 'LOCKED',
      deleted_at: null,
    },
    select: {
      timetable_id: true,
      items: {
        where: { activity_type: { in: ['SUBJECT', 'THEME_ACTIVITY'] } },
        select: {
          timetable_item_id: true,
          week_pattern: true,
          day_of_week: true,
          session: true,
          display_order: true,
          activity_type: true,
          subject_id: true,
          activity_name: true,
          note: true,
          subject: {
            select: {
              assessment_subject_id: true,
              name: true,
              development_field_id: true,
              development_field: { select: { name_vi: true } },
            },
          },
        },
        orderBy: [{ day_of_week: 'asc' }, { session: 'asc' }, { display_order: 'asc' }],
      },
    },
  });
}

async function assertPlanAccess(id, user) {
  const plan = await prisma.weeklyDevelopmentPlan.findFirst({
    where: { weekly_development_plan_id: id, deleted_at: null },
    select: PLAN_SELECT,
  });
  if (!plan) throw NotFound('Không tìm thấy kế hoạch tuần.');
  const { classRow } = await resolveTeacherClass(user, plan.school_year_id);
  if (plan.class_id !== classRow.class_id) {
    throw Forbidden('Bạn không có quyền truy cập kế hoạch của lớp khác.');
  }
  return plan;
}

async function sourceCriteria(monthlyThemePlanId) {
  return prisma.monthlyDevelopmentPlanCriterion.findMany({
    where: { monthly_theme_plan_id: monthlyThemePlanId },
    select: {
      monthly_development_plan_criterion_id: true,
      criterion_id: true,
      criterion: {
        select: {
          assessment_criterion_id: true,
          criterion_code: true,
          content: true,
          development_field_id: true,
          assessment_subject_id: true,
          assessment_theme_id: true,
          assessment_topic_id: true,
          development_field: { select: { name_vi: true, display_order: true } },
          assessment_subject: { select: { name: true } },
          assessment_theme: { select: { name: true } },
          assessment_topic: { select: { name: true, description: true } },
        },
      },
    },
    orderBy: { criterion: { criterion_code: 'asc' } },
  });
}

function buildAvailableCriteria(rows) {
  return rows.map((row) => ({
    monthlyThemePlanCriterionId: row.monthly_development_plan_criterion_id,
    criterionId: row.criterion_id,
    criterionCode: row.criterion.criterion_code,
    criterionDescription: row.criterion.content,
    developmentFieldId: row.criterion.development_field_id,
    developmentFieldName: row.criterion.development_field.name_vi,
    subjectId: row.criterion.assessment_subject_id,
    subjectName: row.criterion.assessment_subject.name,
    themeId: row.criterion.assessment_theme_id,
    themeName: row.criterion.assessment_theme.name,
    topicId: row.criterion.assessment_topic_id,
    topicName: row.criterion.assessment_topic.name,
    topicDescription: row.criterion.assessment_topic.description,
  }));
}

export async function checkWeeklyPlanUsage(planId) {
  const count = await prisma.dailyDevelopmentAssessment.count({
    where: { weekly_development_plan_id: Number(planId), deleted_at: null },
  });
  return count > 0;
}

async function syncMonthlyThemePlanUsageStatus(tx, monthlyThemePlanId, actorId) {
  const activeWeeklyPlan = await tx.weeklyDevelopmentPlan.findFirst({
    where: { monthly_theme_plan_id: monthlyThemePlanId, deleted_at: null },
    select: { weekly_development_plan_id: true },
  });

  await tx.monthlyThemePlan.update({
    where: { monthly_theme_plan_id: monthlyThemePlanId },
    data: {
      status: activeWeeklyPlan ? 'USED' : 'READY',
      updated_by: actorId,
    },
  });
}

export async function findAll(query, user) {
  const { page, pageSize, planningYear, planningMonth, status, keyword } = query;
  const { classRow, ageGroup, academicYearId } = await resolveTeacherClass(
    user,
    query.academicYearId,
  );
  const where = {
    school_year_id: academicYearId,
    class_id: classRow.class_id,
    deleted_at: null,
  };
  if (planningYear) where.planning_year = Number(planningYear);
  if (planningMonth) where.planning_month = Number(planningMonth);
  if (status) where.status = status;
  if (keyword) {
    where.OR = [
      { display_range: { contains: keyword, mode: 'insensitive' } },
      { monthly_theme_plan: { name: { contains: keyword, mode: 'insensitive' } } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.weeklyDevelopmentPlan.findMany({
      where,
      select: PLAN_SELECT,
      orderBy: [{ planning_year: 'desc' }, { planning_month: 'desc' }, { week_number: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.weeklyDevelopmentPlan.count({ where }),
  ]);

  const result = paginate(rows.map(listItem), total, page, pageSize);
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

export async function createOptions(query, user) {
  const planningYear = Number(query.planningYear);
  const planningMonth = Number(query.planningMonth);
  const { classRow, ageGroup, academicYearId } = await resolveTeacherClass(
    user,
    query.academicYearId,
  );
  assertPlanningMonthInSchoolYear(planningYear, planningMonth, classRow.school_year);
  const weeks = generatePlanningWeeks(planningYear, planningMonth);
  const [existingPlans, lockedTimetable] = await Promise.all([
    prisma.weeklyDevelopmentPlan.findMany({
      where: {
        class_id: classRow.class_id,
        school_year_id: academicYearId,
        planning_year: planningYear,
        planning_month: planningMonth,
        deleted_at: null,
      },
      select: { weekly_development_plan_id: true, week_number: true, status: true },
    }),
    findLockedTimetable(academicYearId, ageGroup.assessment_age_group_id),
  ]);
  const existingMap = new Map(existingPlans.map((plan) => [plan.week_number, plan]));

  const cards = [];
  for (const week of weeks) {
    const monthlyPlans = await findMonthlyPlansForWeek({
      classId: classRow.class_id,
      schoolYearId: academicYearId,
      planningYear,
      planningMonth,
      weekNumber: week.weekNumber,
    });
    const existing = existingMap.get(week.weekNumber);
    let canCreate = true;
    let reason = null;
    if (existing) {
      canCreate = false;
      reason = 'Kế hoạch tuần này đã được tạo.';
    } else if (monthlyPlans.length === 0) {
      canCreate = false;
      reason = 'Tuần này chưa có kế hoạch tháng/chủ đề.';
    } else if (monthlyPlans.length > 1) {
      canCreate = false;
      reason =
        'Tuần này đang được nhiều kế hoạch tháng/chủ đề áp dụng. Vui lòng kiểm tra lại kế hoạch tháng.';
    } else if (!['READY', 'USED'].includes(monthlyPlans[0].status)) {
      canCreate = false;
      reason = 'Kế hoạch tháng/chủ đề của tuần này chưa chính thức.';
    } else if (!lockedTimetable) {
      canCreate = false;
      reason =
        'Chưa có thời khóa biểu chính thức cho nhóm tuổi của lớp này. Không thể tạo kế hoạch tuần.';
    }
    cards.push({
      ...week,
      monthlyThemePlanId: monthlyPlans[0]?.monthly_theme_plan_id ?? null,
      monthlyThemePlanName: monthlyPlans[0]?.name ?? null,
      monthlyThemePlanStatus: monthlyPlans[0]?.status ?? null,
      existingWeeklyPlanId: existing?.weekly_development_plan_id ?? null,
      existingWeeklyPlanStatus: existing?.status ?? null,
      canCreate,
      reason,
    });
  }

  return {
    planningYear,
    planningMonth,
    context: { class: classRow, ageGroup, academicYear: classRow.school_year },
    weeks: cards,
  };
}

export async function create(dto, user) {
  const planningYear = Number(dto.planningYear);
  const planningMonth = Number(dto.planningMonth);
  const weekNumber = Number(dto.weekNumber);
  const { classRow, ageGroup, academicYearId } = await resolveTeacherClass(
    user,
    dto.academicYearId,
  );
  assertPlanningMonthInSchoolYear(planningYear, planningMonth, classRow.school_year);
  const week = generatePlanningWeeks(planningYear, planningMonth).find(
    (item) => item.weekNumber === weekNumber,
  );
  if (!week) throw BadRequest('Tuần được chọn không thuộc tháng triển khai.');

  const duplicate = await prisma.weeklyDevelopmentPlan.findFirst({
    where: {
      class_id: classRow.class_id,
      school_year_id: academicYearId,
      planning_year: planningYear,
      planning_month: planningMonth,
      week_number: weekNumber,
      deleted_at: null,
    },
    select: { weekly_development_plan_id: true },
  });
  if (duplicate) throw Conflict('Kế hoạch tuần này đã được tạo.');

  const monthlyPlans = await findMonthlyPlansForWeek({
    classId: classRow.class_id,
    schoolYearId: academicYearId,
    planningYear,
    planningMonth,
    weekNumber,
  });
  if (monthlyPlans.length === 0) throw BadRequest('Tuần này chưa có kế hoạch tháng/chủ đề.');
  if (monthlyPlans.length > 1) {
    throw Conflict(
      'Tuần này đang được nhiều kế hoạch tháng/chủ đề áp dụng. Vui lòng kiểm tra lại kế hoạch tháng.',
    );
  }
  const monthlyPlan = monthlyPlans[0];
  if (!['READY', 'USED'].includes(monthlyPlan.status)) {
    throw BadRequest('Kế hoạch tháng/chủ đề của tuần này chưa chính thức.');
  }

  const timetable = await findLockedTimetable(academicYearId, ageGroup.assessment_age_group_id);
  if (!timetable) {
    throw BadRequest(
      'Chưa có thời khóa biểu chính thức cho nhóm tuổi của lớp này. Không thể tạo kế hoạch tuần.',
    );
  }
  const allowedPatterns = ['ALL', week.parity];
  const snapshotItems = timetable.items.filter((item) =>
    allowedPatterns.includes(item.week_pattern),
  );
  if (snapshotItems.length === 0) {
    throw BadRequest('Thời khóa biểu chính thức chưa có hoạt động phù hợp cho tuần này.');
  }

  const created = await prisma.$transaction(async (tx) => {
    const plan = await tx.weeklyDevelopmentPlan.create({
      data: {
        school_year_id: academicYearId,
        class_id: classRow.class_id,
        age_group_id: ageGroup.assessment_age_group_id,
        monthly_theme_plan_id: monthlyPlan.monthly_theme_plan_id,
        planning_year: planningYear,
        planning_month: planningMonth,
        week_number: week.weekNumber,
        start_date: toDateOnly(week.startDate),
        end_date: toDateOnly(week.endDate),
        display_range: week.displayRange,
        parity: week.parity,
        status: 'DRAFT',
        created_by: user.sub,
        updated_by: user.sub,
      },
      select: { weekly_development_plan_id: true },
    });
    await tx.weeklyDevelopmentPlanActivity.createMany({
      data: snapshotItems.map((item) => ({
        weekly_development_plan_id: plan.weekly_development_plan_id,
        source_timetable_item_id: item.timetable_item_id,
        day_of_week: item.day_of_week,
        activity_date: addDays(toDateOnly(week.startDate), dayOffset(item.day_of_week)),
        session: item.session,
        display_order: item.display_order,
        activity_type: item.activity_type,
        subject_id: item.subject_id,
        subject_name_snapshot: item.subject?.name ?? null,
        development_field_id: item.subject?.development_field_id ?? null,
        development_field_name_snapshot: item.subject?.development_field?.name_vi ?? null,
        activity_name_snapshot: item.activity_name,
        note_snapshot: item.note,
      })),
    });
    await syncMonthlyThemePlanUsageStatus(tx, monthlyPlan.monthly_theme_plan_id, user.sub);
    return tx.weeklyDevelopmentPlan.findFirst({
      where: { weekly_development_plan_id: plan.weekly_development_plan_id },
      select: PLAN_SELECT,
    });
  });

  return withComputed(created);
}

export async function findOne(id, user) {
  const plan = await assertPlanAccess(id, user);
  const criteria = await sourceCriteria(plan.monthly_theme_plan_id);
  return {
    ...withComputed(plan),
    availableCriteria: buildAvailableCriteria(criteria),
  };
}

export async function updateMappings(id, dto, user) {
  const plan = await assertPlanAccess(id, user);
  if (plan.status !== 'DRAFT') {
    throw BadRequest('Chỉ có thể chỉnh sửa kế hoạch tuần ở trạng thái bản nháp.');
  }
  const activityIds = new Set(
    plan.activities.map((activity) => activity.weekly_development_plan_activity_id),
  );
  const sourceRows = await sourceCriteria(plan.monthly_theme_plan_id);
  const sourceByCriterionId = new Map(sourceRows.map((row) => [row.criterion_id, row]));
  const criterionUsage = new Map();

  for (const activity of dto.activities) {
    if (!activityIds.has(activity.weeklyPlanActivityId)) {
      throw BadRequest('Hoạt động không thuộc kế hoạch tuần này.');
    }
    for (const criterionId of activity.selectedCriteriaIds) {
      const usedByActivityId = criterionUsage.get(criterionId);
      if (usedByActivityId && usedByActivityId !== activity.weeklyPlanActivityId) {
        throw BadRequest('Một tiêu chí chỉ được gán cho một hoạt động trong kế hoạch tuần.');
      }
      criterionUsage.set(criterionId, activity.weeklyPlanActivityId);
    }
  }

  const writes = [];
  for (const activity of dto.activities) {
    if (!activityIds.has(activity.weeklyPlanActivityId)) {
      throw BadRequest('Hoạt động không thuộc kế hoạch tuần này.');
    }
    writes.push(
      prisma.weeklyDevelopmentPlanActivityCriterion.deleteMany({
        where: { weekly_development_plan_activity_id: activity.weeklyPlanActivityId },
      }),
    );
    for (const criterionId of activity.selectedCriteriaIds) {
      const source = sourceByCriterionId.get(criterionId);
      if (!source) {
        throw BadRequest('Tiêu chí được chọn không thuộc kế hoạch tháng/chủ đề nguồn.');
      }
      writes.push(
        prisma.weeklyDevelopmentPlanActivityCriterion.create({
          data: {
            weekly_development_plan_activity_id: activity.weeklyPlanActivityId,
            monthly_theme_plan_criterion_id: source.monthly_development_plan_criterion_id,
            criterion_id: source.criterion_id,
            topic_id: source.criterion.assessment_topic_id,
            subject_id: source.criterion.assessment_subject_id,
            development_field_id: source.criterion.development_field_id,
            theme_id: source.criterion.assessment_theme_id,
          },
        }),
      );
    }
  }
  writes.push(
    prisma.weeklyDevelopmentPlan.update({
      where: { weekly_development_plan_id: id },
      data: { updated_by: user.sub },
    }),
  );
  await prisma.$transaction(writes);
  return findOne(id, user);
}

export async function complete(id, dto, user) {
  const plan = await assertPlanAccess(id, user);
  if (plan.status !== 'DRAFT') {
    throw BadRequest('Chỉ có thể hoàn tất kế hoạch tuần ở trạng thái bản nháp.');
  }
  const activityCount = plan.activities.length;
  const mappedActivityCount = plan.activities.filter(
    (activity) => activity.criteria.length > 0,
  ).length;
  const mappedCriterionCount = plan.activities.reduce(
    (sum, activity) => sum + activity.criteria.length,
    0,
  );
  if (mappedCriterionCount === 0) {
    throw BadRequest('Kế hoạch tuần cần có ít nhất một tiêu chí.');
  }
  const unmappedCount = activityCount - mappedActivityCount;
  if (unmappedCount > 0 && !dto?.confirmIncompleteActivities) {
    const details = {
      requiresConfirmation: true,
      warningCode: 'INCOMPLETE_WEEKLY_ACTIVITIES',
      activityCount,
      mappedActivityCount,
      unmappedCount,
      message: `Kế hoạch tuần còn ${unmappedCount}/${activityCount} hoạt động chưa gán tiêu chí. Bạn có muốn hoàn tất không?`,
    };
    throw Conflict(details.message, details);
  }
  const updated = await prisma.weeklyDevelopmentPlan.update({
    where: { weekly_development_plan_id: id },
    data: {
      status: 'READY',
      ready_by: user.sub,
      ready_at: new Date(),
      updated_by: user.sub,
    },
    select: PLAN_SELECT,
  });
  return findOne(updated.weekly_development_plan_id, user);
}

export async function revertToDraft(id, user) {
  const plan = await assertPlanAccess(id, user);
  if (plan.status === 'USED' || (await checkWeeklyPlanUsage(id))) {
    throw BadRequest(
      'Kế hoạch tuần đã được sử dụng để đánh giá hằng ngày nên không thể đưa về bản nháp.',
    );
  }
  if (plan.status !== 'READY') {
    throw BadRequest('Chỉ kế hoạch tuần chính thức mới có thể đưa về bản nháp.');
  }
  await prisma.weeklyDevelopmentPlan.update({
    where: { weekly_development_plan_id: id },
    data: { status: 'DRAFT', ready_by: null, ready_at: null, updated_by: user.sub },
  });
  return findOne(id, user);
}

export async function softDelete(id, user) {
  const plan = await assertPlanAccess(id, user);
  if (plan.status === 'USED' || (await checkWeeklyPlanUsage(id))) {
    throw BadRequest('Kế hoạch tuần đã được sử dụng nên không thể xóa.');
  }
  await prisma.$transaction(async (tx) => {
    await tx.weeklyDevelopmentPlanActivityCriterion.deleteMany({
      where: {
        activity: { weekly_development_plan_id: id },
      },
    });
    await tx.weeklyDevelopmentPlan.update({
      where: { weekly_development_plan_id: id },
      data: { deleted_at: new Date(), updated_by: user.sub },
    });
    await syncMonthlyThemePlanUsageStatus(tx, plan.monthly_theme_plan_id, user.sub);
  });
  return { weekly_development_plan_id: id };
}
