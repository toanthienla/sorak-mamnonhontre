import { randomUUID } from 'node:crypto';
import prisma from '../config/prisma.js';
import { paginate } from '../utils/paginate.js';
import { BadRequest, HttpError, NotFound } from '../utils/http-error.js';

const SELECT = {
  assessment_criterion_id: true,
  criterion_code: true,
  assessment_age_group_id: true,
  development_field_id: true,
  assessment_subject_id: true,
  assessment_theme_id: true,
  assessment_topic_id: true,
  content: true,
  description: true,
  is_active: true,
  created_by: true,
  updated_by: true,
  created_at: true,
  updated_at: true,
  assessment_age_group: {
    select: {
      assessment_age_group_id: true,
      class_group_label: true,
      name_vi: true,
    },
  },
  development_field: {
    select: {
      development_field_id: true,
      name_vi: true,
    },
  },
  assessment_subject: {
    select: {
      assessment_subject_id: true,
      name: true,
      is_active: true,
    },
  },
  assessment_theme: {
    select: {
      assessment_theme_id: true,
      name: true,
      is_active: true,
    },
  },
  assessment_topic: {
    select: {
      assessment_topic_id: true,
      assessment_age_group_id: true,
      assessment_subject_id: true,
      name: true,
      is_active: true,
    },
  },
};

function normalizeText(value) {
  return value?.trim() || null;
}

function normalizeContent(value) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function formatCriterionCode(id) {
  return `TC-${String(id).padStart(6, '0')}`;
}

function pendingCriterionCode() {
  return `TP-${randomUUID().replaceAll('-', '').slice(0, 27)}`;
}

async function assertParentsValid(dto, requireActive = true) {
  const [ageGroup, developmentField, subject, theme, topic] = await Promise.all([
    prisma.assessmentAgeGroup.findFirst({
      where: { assessment_age_group_id: dto.assessment_age_group_id, deleted_at: null },
      select: { assessment_age_group_id: true },
    }),
    prisma.developmentField.findFirst({
      where: { development_field_id: dto.development_field_id, deleted_at: null },
      select: { development_field_id: true },
    }),
    prisma.assessmentSubject.findFirst({
      where: {
        assessment_subject_id: dto.assessment_subject_id,
        deleted_at: null,
        ...(requireActive ? { is_active: true } : {}),
      },
      select: {
        assessment_subject_id: true,
        assessment_age_group_id: true,
        development_field_id: true,
        is_active: true,
      },
    }),
    prisma.assessmentTheme.findFirst({
      where: {
        assessment_theme_id: dto.assessment_theme_id,
        deleted_at: null,
        ...(requireActive ? { is_active: true } : {}),
      },
      select: { assessment_theme_id: true, assessment_subject_id: true, is_active: true },
    }),
    prisma.assessmentTopic.findFirst({
      where: {
        assessment_topic_id: dto.assessment_topic_id,
        deleted_at: null,
        ...(requireActive ? { is_active: true } : {}),
      },
      select: {
        assessment_topic_id: true,
        assessment_theme_id: true,
        assessment_age_group_id: true,
        assessment_subject_id: true,
        is_active: true,
      },
    }),
  ]);

  if (!ageGroup) throw BadRequest('Nhóm tuổi không tồn tại');
  if (!developmentField) throw BadRequest('Lĩnh vực phát triển không tồn tại');
  if (!subject) throw BadRequest('Môn học đang hoạt động không tồn tại');
  if (!theme) throw BadRequest('Chủ đề đang hoạt động không tồn tại');
  if (!topic) throw BadRequest('Đề tài đang hoạt động không tồn tại');
  if (subject.development_field_id !== dto.development_field_id) {
    throw BadRequest('Môn học không thuộc lĩnh vực phát triển đã chọn');
  }
  if (subject.assessment_age_group_id !== dto.assessment_age_group_id) {
    throw BadRequest('Môn học không thuộc nhóm tuổi và lĩnh vực phát triển đã chọn.');
  }
  if (theme.assessment_subject_id !== dto.assessment_subject_id) {
    throw BadRequest('Chủ đề không thuộc môn học đã chọn.');
  }
  if (topic.assessment_theme_id !== dto.assessment_theme_id) {
    throw BadRequest('Đề tài không thuộc chủ đề đã chọn');
  }
  if (topic.assessment_age_group_id !== dto.assessment_age_group_id) {
    throw BadRequest('Đề tài không thuộc độ tuổi đã chọn.');
  }
  if (topic.assessment_subject_id !== dto.assessment_subject_id) {
    throw BadRequest('Đề tài không thuộc môn học đã chọn.');
  }
}

export async function assertExists(id) {
  const row = await prisma.assessmentCriterion.findFirst({
    where: { assessment_criterion_id: id, deleted_at: null },
    select: SELECT,
  });
  if (!row) throw NotFound('Không tìm thấy tiêu chí');
  const [enriched] = await attachRequestSources([row]);
  return enriched;
}

async function attachRequestSources(rows) {
  const ids = rows.map((row) => row.assessment_criterion_id);
  if (ids.length === 0) return rows;

  const records = await prisma.assessmentContentRequestCreatedRecord.findMany({
    where: {
      record_type: 'CRITERION',
      record_id: { in: ids },
    },
    select: {
      record_id: true,
      request: {
        select: {
          request_id: true,
          request_code: true,
          created_at: true,
          requester_teacher: {
            select: {
              teacher_id: true,
              full_name: true,
              email: true,
            },
          },
        },
      },
    },
    orderBy: { created_at: 'asc' },
  });

  const sourceByCriterionId = new Map();
  for (const record of records) {
    if (!sourceByCriterionId.has(record.record_id)) {
      sourceByCriterionId.set(record.record_id, record.request);
    }
  }

  return rows.map((row) => ({
    ...row,
    source_request: sourceByCriterionId.get(row.assessment_criterion_id) ?? null,
  }));
}

async function assertNoDuplicate(dto, exceptId) {
  const rows = await prisma.assessmentCriterion.findMany({
    where: {
      assessment_age_group_id: dto.assessment_age_group_id,
      development_field_id: dto.development_field_id,
      assessment_subject_id: dto.assessment_subject_id,
      assessment_theme_id: dto.assessment_theme_id,
      assessment_topic_id: dto.assessment_topic_id,
      deleted_at: null,
      ...(exceptId ? { assessment_criterion_id: { not: exceptId } } : {}),
    },
    select: { content: true },
  });

  const nextContent = normalizeContent(dto.content);
  if (rows.some((row) => normalizeContent(row.content) === nextContent)) {
    throw Conflict('Tiêu chí đang hoạt động đã tồn tại trong cùng phân loại');
  }
}

function buildClassification(current, dto) {
  return {
    assessment_age_group_id: current.assessment_age_group_id,
    development_field_id: current.development_field_id,
    assessment_subject_id: current.assessment_subject_id,
    assessment_theme_id: current.assessment_theme_id,
    assessment_topic_id: current.assessment_topic_id,
    content: dto.content ?? current.content,
  };
}

function buildUpdateData(dto, actorId) {
  const data = { updated_by: actorId };
  if (Object.prototype.hasOwnProperty.call(dto, 'content')) data.content = dto.content;
  if (Object.prototype.hasOwnProperty.call(dto, 'description')) {
    data.description = normalizeText(dto.description);
  }
  return data;
}

export async function findAll(query) {
  const {
    page,
    pageSize,
    search,
    assessment_age_group_id,
    development_field_id,
    assessment_subject_id,
    assessment_theme_id,
    assessment_topic_id,
    is_active,
  } = query;
  const where = { deleted_at: null };

  if (assessment_age_group_id) where.assessment_age_group_id = Number(assessment_age_group_id);
  if (development_field_id) where.development_field_id = Number(development_field_id);
  if (assessment_subject_id) where.assessment_subject_id = Number(assessment_subject_id);
  if (assessment_theme_id) where.assessment_theme_id = Number(assessment_theme_id);
  if (assessment_topic_id) where.assessment_topic_id = Number(assessment_topic_id);
  if (is_active === 'true') where.is_active = true;
  if (is_active === 'false') where.is_active = false;
  if (search) {
    where.OR = [
      { criterion_code: { contains: search, mode: 'insensitive' } },
      { content: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.assessmentCriterion.findMany({
      where,
      select: SELECT,
      orderBy: [{ is_active: 'desc' }, { criterion_code: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.assessmentCriterion.count({ where }),
  ]);

  return paginate(await attachRequestSources(rows), total, page, pageSize);
}

export function findOne(id) {
  return assertExists(id);
}

export async function create(dto, actorId) {
  await assertParentsValid(dto);
  await assertNoDuplicate(dto);

  return prisma.$transaction(async (tx) => {
    const created = await tx.assessmentCriterion.create({
      data: {
        ...dto,
        criterion_code: pendingCriterionCode(),
        description: normalizeText(dto.description),
        created_by: actorId,
        updated_by: actorId,
      },
      select: { assessment_criterion_id: true },
    });

    return tx.assessmentCriterion.update({
      where: { assessment_criterion_id: created.assessment_criterion_id },
      data: { criterion_code: formatCriterionCode(created.assessment_criterion_id) },
      select: SELECT,
    });
  });
}

export async function update(id, dto, actorId) {
  const current = await assertExists(id);
  const next = buildClassification(current, dto);

  await assertParentsValid(next);
  if (current.is_active) await assertNoDuplicate(next, id);

  return prisma.assessmentCriterion.update({
    where: { assessment_criterion_id: id },
    data: buildUpdateData(dto, actorId),
    select: SELECT,
  });
}

export async function setStatus(id, isActive, actorId) {
  const current = await assertExists(id);
  const classification = buildClassification(current, {});

  if (isActive) {
    await assertParentsValid(classification);
    await assertNoDuplicate(classification, id);
  }

  return prisma.assessmentCriterion.update({
    where: { assessment_criterion_id: id },
    data: { is_active: Boolean(isActive), updated_by: actorId },
    select: SELECT,
  });
}

function accountTeacherName(account) {
  return account?.teacher?.full_name ?? null;
}

function formatPlanningMonth(year, month) {
  return `${String(month).padStart(2, '0')}/${year}`;
}

function snapshotContainsCriterion(snapshot, criterionId) {
  return Array.isArray(snapshot?.criterionSummaries)
    ? snapshot.criterionSummaries.some((item) => Number(item?.criterionId) === Number(criterionId))
    : false;
}

async function collectUsages(criterionId) {
  const [monthlyRows, weeklyRows, dailyRows, monthlyReports, academicYearReports, contentRequests] =
    await Promise.all([
      prisma.monthlyDevelopmentPlanCriterion.findMany({
        where: { criterion_id: criterionId, plan: { deleted_at: null } },
        select: {
          plan: {
            select: {
              monthly_theme_plan_id: true,
              name: true,
              planning_year: true,
              planning_month: true,
              status: true,
              creator: { select: { teacher: { select: { full_name: true } } } },
              class: { select: { class_name: true } },
              weeks: { select: { week_number: true } },
            },
          },
        },
      }),
      prisma.weeklyDevelopmentPlanActivityCriterion.findMany({
        where: { criterion_id: criterionId, activity: { weekly_plan: { deleted_at: null } } },
        select: {
          activity: {
            select: {
              weekly_development_plan_activity_id: true,
              subject_name_snapshot: true,
              activity_name_snapshot: true,
              weekly_plan: {
                select: {
                  weekly_development_plan_id: true,
                  week_number: true,
                  display_range: true,
                  status: true,
                  creator: { select: { teacher: { select: { full_name: true } } } },
                  class: { select: { class_name: true } },
                  monthly_theme_plan: { select: { name: true } },
                },
              },
            },
          },
        },
      }),
      prisma.dailyDevelopmentAssessment.findMany({
        where: { criterion_id: criterionId, deleted_at: null },
        select: {
          weekly_development_plan_activity_id: true,
          activity_date: true,
          student_id: true,
          activity: {
            select: { subject_name_snapshot: true, activity_name_snapshot: true },
          },
          assessor: { select: { teacher: { select: { full_name: true } } } },
          class: { select: { class_name: true } },
        },
      }),
      prisma.monthlyDevelopmentReport.findMany({
        where: {
          deleted_at: null,
          status: { in: ['READY', 'USED'] },
          summary_snapshot: { not: null },
        },
        select: {
          planning_year: true,
          planning_month: true,
          status: true,
          summary_snapshot: true,
          class: { select: { class_name: true } },
        },
      }),
      prisma.academicYearDevelopmentReport.findMany({
        where: { deleted_at: null, status: 'READY', summary_snapshot: { not: null } },
        select: {
          status: true,
          summary_snapshot: true,
          school_year: { select: { name: true } },
          class: { select: { class_name: true } },
        },
      }),
      prisma.assessmentContentAdditionRequest.findMany({
        where: { criterion_id: criterionId },
        select: { request_id: true, request_code: true, status: true, created_at: true },
      }),
    ]);

  const monthlyPlans = monthlyRows.map(({ plan }) => {
    const weekNumbers = plan.weeks.map((week) => week.week_number).sort((a, b) => a - b);
    const weekRange = weekNumbers.length
      ? `Tuần ${weekNumbers.length === 1 ? weekNumbers[0] : `${weekNumbers[0]}-${weekNumbers.at(-1)}`}`
      : 'Chưa chọn tuần áp dụng';
    return {
      id: plan.monthly_theme_plan_id,
      planName: plan.name,
      teacherName: accountTeacherName(plan.creator),
      className: plan.class.class_name,
      planningMonth: formatPlanningMonth(plan.planning_year, plan.planning_month),
      weekRange,
      status: plan.status,
    };
  });

  const weeklyPlans = weeklyRows.map(({ activity }) => {
    const plan = activity.weekly_plan;
    return {
      id: activity.weekly_development_plan_activity_id,
      weeklyPlanId: plan.weekly_development_plan_id,
      weekNumber: plan.week_number,
      displayRange: plan.display_range,
      sourcePlanName: plan.monthly_theme_plan.name,
      teacherName: accountTeacherName(plan.creator),
      className: plan.class.class_name,
      activityName:
        activity.subject_name_snapshot ??
        activity.activity_name_snapshot ??
        'Chưa đặt tên hoạt động',
      status: plan.status,
    };
  });

  const dailyUsageMap = new Map();
  for (const row of dailyRows) {
    const key = [
      row.weekly_development_plan_activity_id,
      row.activity_date.toISOString().slice(0, 10),
      row.class.class_name,
      accountTeacherName(row.assessor) ?? '',
    ].join(':');
    if (!dailyUsageMap.has(key)) {
      dailyUsageMap.set(key, {
        activityDate: row.activity_date,
        activityName:
          row.activity.subject_name_snapshot ??
          row.activity.activity_name_snapshot ??
          'Chưa đặt tên hoạt động',
        teacherName: accountTeacherName(row.assessor),
        className: row.class.class_name,
        studentIds: new Set(),
      });
    }
    dailyUsageMap.get(key).studentIds.add(row.student_id);
  }
  const dailyAssessments = [...dailyUsageMap.values()].map(({ studentIds, ...usage }) => ({
    ...usage,
    assessedStudentCount: studentIds.size,
  }));

  const reports = [];
  const monthlyReportGroups = new Map();
  for (const report of monthlyReports) {
    if (!snapshotContainsCriterion(report.summary_snapshot, criterionId)) continue;
    const key = `${report.planning_year}-${report.planning_month}-${report.class.class_name}-${report.status}`;
    if (!monthlyReportGroups.has(key)) {
      monthlyReportGroups.set(key, {
        type: 'MONTHLY',
        period: formatPlanningMonth(report.planning_year, report.planning_month),
        className: report.class.class_name,
        status: report.status,
        reportCount: 0,
      });
    }
    monthlyReportGroups.get(key).reportCount += 1;
  }
  reports.push(...monthlyReportGroups.values());
  for (const report of academicYearReports) {
    if (!snapshotContainsCriterion(report.summary_snapshot, criterionId)) continue;
    reports.push({
      type: 'ACADEMIC_YEAR',
      period: report.school_year.name,
      className: report.class.class_name,
      status: report.status,
      reportCount: 1,
    });
  }

  const historicalRequests = contentRequests.map((request) => ({
    id: request.request_id,
    requestCode: request.request_code,
    status: request.status,
    createdAt: request.created_at,
  }));
  const totalUsages =
    monthlyPlans.length +
    weeklyPlans.length +
    dailyAssessments.length +
    reports.length +
    historicalRequests.length;

  return {
    canDelete: totalUsages === 0,
    summary: {
      totalUsages,
      monthlyPlanCount: monthlyPlans.length,
      weeklyPlanCount: weeklyPlans.length,
      dailyAssessmentGroupCount: dailyAssessments.length,
      reportCount: reports.length,
      historicalReferenceCount: historicalRequests.length,
    },
    groups: { monthlyPlans, weeklyPlans, dailyAssessments, reports, historicalRequests },
  };
}

export async function findUsages(id) {
  const criterion = await prisma.assessmentCriterion.findFirst({
    where: { assessment_criterion_id: id, deleted_at: null },
    select: {
      assessment_criterion_id: true,
      criterion_code: true,
      content: true,
      is_active: true,
    },
  });
  if (!criterion) throw NotFound('Không tìm thấy tiêu chí.');

  return { criterion, ...(await collectUsages(id)) };
}

export async function hardDelete(id) {
  const current = await prisma.assessmentCriterion.findFirst({
    where: { assessment_criterion_id: id, deleted_at: null },
    select: SELECT,
  });
  if (!current) throw NotFound('Không tìm thấy dữ liệu cần xóa.');
  if (current.is_active) {
    throw BadRequest('Không thể xóa dữ liệu đang hoạt động. Vui lòng ngừng kích hoạt trước.');
  }

  const usage = await collectUsages(id);
  if (!usage.canDelete) {
    throw new HttpError(409, 'CRITERION_IN_USE', 'Tiêu chí đang được sử dụng nên không thể xóa.', {
      usageSummary: usage.summary,
    });
  }

  return prisma.assessmentCriterion.delete({
    where: { assessment_criterion_id: id },
    select: SELECT,
  });
}
