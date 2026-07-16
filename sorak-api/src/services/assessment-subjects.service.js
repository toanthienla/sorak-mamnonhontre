import prisma from '../config/prisma.js';
import { paginate } from '../utils/paginate.js';
import { BadRequest, Conflict, NotFound } from '../utils/http-error.js';
import { countReferences } from './assessment-delete-usage.service.js';

const SELECT = {
  assessment_theme_id: true,
  assessment_subject_id: true,
  name: true,
  description: true,
  is_active: true,
  created_at: true,
  updated_at: true,
  assessment_subject: {
    select: {
      assessment_subject_id: true,
      development_field_id: true,
      name: true,
      is_active: true,
    },
  },
};

function normalizeText(value) {
  return value?.trim() || null;
}

function hasScopedCountQuery(query) {
  return Boolean(
    query.assessment_age_group_id && query.development_field_id && query.assessment_subject_id,
  );
}

function emptyCounts() {
  return {
    activeTopicCount: 0,
    totalTopicCount: 0,
    activeCriterionCount: 0,
    totalCriterionCount: 0,
  };
}

function applyGroupedCount(target, rows, field) {
  for (const row of rows) {
    const current = target.get(row.assessment_theme_id) ?? emptyCounts();
    target.set(row.assessment_theme_id, { ...current, [field]: row._count._all });
  }
}

async function getScopedCounts(query) {
  if (!hasScopedCountQuery(query)) return new Map();

  const assessmentAgeGroupId = Number(query.assessment_age_group_id);
  const developmentFieldId = Number(query.development_field_id);
  const assessmentSubjectId = Number(query.assessment_subject_id);

  const topicWhere = {
    deleted_at: null,
    assessment_age_group_id: assessmentAgeGroupId,
    assessment_subject_id: assessmentSubjectId,
  };
  const criterionWhere = {
    deleted_at: null,
    assessment_age_group_id: assessmentAgeGroupId,
    development_field_id: developmentFieldId,
    assessment_subject_id: assessmentSubjectId,
    assessment_topic: {
      deleted_at: null,
      assessment_age_group_id: assessmentAgeGroupId,
      assessment_subject_id: assessmentSubjectId,
    },
  };

  const [totalTopics, activeTopics, totalCriteria, activeCriteria] = await Promise.all([
    prisma.assessmentTopic.groupBy({
      by: ['assessment_theme_id'],
      where: topicWhere,
      _count: { _all: true },
    }),
    prisma.assessmentTopic.groupBy({
      by: ['assessment_theme_id'],
      where: { ...topicWhere, is_active: true },
      _count: { _all: true },
    }),
    prisma.assessmentCriterion.groupBy({
      by: ['assessment_theme_id'],
      where: criterionWhere,
      _count: { _all: true },
    }),
    prisma.assessmentCriterion.groupBy({
      by: ['assessment_theme_id'],
      where: { ...criterionWhere, is_active: true },
      _count: { _all: true },
    }),
  ]);

  const counts = new Map();
  applyGroupedCount(counts, totalTopics, 'totalTopicCount');
  applyGroupedCount(counts, activeTopics, 'activeTopicCount');
  applyGroupedCount(counts, totalCriteria, 'totalCriterionCount');
  applyGroupedCount(counts, activeCriteria, 'activeCriterionCount');
  return counts;
}

export async function assertExists(id) {
  const row = await prisma.assessmentTheme.findFirst({
    where: { assessment_theme_id: id, deleted_at: null },
    select: SELECT,
  });
  if (!row) throw NotFound('Không tìm thấy chủ đề');
  return row;
}

async function assertSubjectExists(subjectId) {
  const row = await prisma.assessmentSubject.findFirst({
    where: { assessment_subject_id: Number(subjectId), deleted_at: null },
    select: { assessment_subject_id: true },
  });
  if (!row) throw BadRequest('Môn học không tồn tại');
  return row;
}

async function assertNoDuplicate(subjectId, name, exceptId) {
  const row = await prisma.assessmentTheme.findFirst({
    where: {
      assessment_subject_id: Number(subjectId),
      name,
      deleted_at: null,
      ...(exceptId ? { assessment_theme_id: { not: exceptId } } : {}),
    },
    select: { assessment_theme_id: true },
  });
  if (row) throw Conflict('Chủ đề đang hoạt động đã tồn tại');
}

export async function assertActiveThemeExists(id, subjectId) {
  const row = await prisma.assessmentTheme.findFirst({
    where: {
      assessment_theme_id: id,
      is_active: true,
      deleted_at: null,
      ...(subjectId ? { assessment_subject_id: Number(subjectId) } : {}),
    },
    select: { assessment_theme_id: true, assessment_subject_id: true },
  });
  if (!row) {
    if (subjectId) throw BadRequest('Chủ đề không thuộc môn học đã chọn.');
    throw NotFound('Chủ đề đang hoạt động không tồn tại');
  }
  return row;
}

export async function findAll(query) {
  const { page, pageSize, search, is_active } = query;
  await assertSubjectExists(query.assessment_subject_id);
  const where = {
    deleted_at: null,
    assessment_subject_id: Number(query.assessment_subject_id),
  };

  if (is_active === 'true') where.is_active = true;
  if (is_active === 'false') where.is_active = false;
  if (search) where.name = { contains: search, mode: 'insensitive' };

  const [rows, total, scopedCounts] = await Promise.all([
    prisma.assessmentTheme.findMany({
      where,
      select: SELECT,
      orderBy: { name: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.assessmentTheme.count({ where }),
    getScopedCounts(query),
  ]);

  return paginate(
    rows.map((row) => ({
      ...row,
      ...emptyCounts(),
      ...(scopedCounts.get(row.assessment_theme_id) ?? {}),
    })),
    total,
    page,
    pageSize,
  );
}

export function findOne(id) {
  return assertExists(id);
}

export async function create(dto, actorId) {
  await assertSubjectExists(dto.assessment_subject_id);
  await assertNoDuplicate(dto.assessment_subject_id, dto.name);

  return prisma.assessmentTheme.create({
    data: {
      assessment_subject_id: Number(dto.assessment_subject_id),
      name: dto.name,
      description: normalizeText(dto.description),
      created_by: actorId,
      updated_by: actorId,
    },
    select: SELECT,
  });
}

export async function update(id, dto, actorId) {
  const current = await assertExists(id);
  const nextName = dto.name ?? current.name;

  if (current.is_active) await assertNoDuplicate(current.assessment_subject_id, nextName, id);

  const data = { ...dto, updated_by: actorId };
  if (Object.prototype.hasOwnProperty.call(dto, 'description')) {
    data.description = normalizeText(dto.description);
  }

  return prisma.assessmentTheme.update({
    where: { assessment_theme_id: id },
    data,
    select: SELECT,
  });
}

export async function setStatus(id, isActive, actorId) {
  const current = await assertExists(id);
  if (isActive) await assertNoDuplicate(current.assessment_subject_id, current.name, id);

  return prisma.assessmentTheme.update({
    where: { assessment_theme_id: id },
    data: { is_active: Boolean(isActive), updated_by: actorId },
    select: SELECT,
  });
}

export async function hardDelete(id) {
  const current = await prisma.assessmentTheme.findFirst({
    where: { assessment_theme_id: id, deleted_at: null },
    select: SELECT,
  });
  if (!current) throw NotFound('Không tìm thấy dữ liệu cần xóa.');
  if (current.is_active) {
    throw BadRequest('Không thể xóa dữ liệu đang hoạt động. Vui lòng ngừng kích hoạt trước.');
  }

  const blockers = await countReferences(
    [
      {
        table: 'assessment_topics',
        column: 'assessment_theme_id',
        reason: 'Đề tài con',
        type: 'child',
      },
      {
        table: 'assessment_criteria',
        column: 'assessment_theme_id',
        reason: 'Tiêu chí liên quan',
        type: 'child',
      },
      {
        table: 'monthly_development_plan_themes',
        column: 'theme_id',
        reason: 'Kế hoạch tháng',
        type: 'usage',
      },
      {
        table: 'assessment_content_addition_requests',
        column: 'theme_id',
        reason: 'Yêu cầu bổ sung nội dung',
        type: 'usage',
      },
    ],
    id,
  );

  if (blockers.length > 0) {
    const hasChild = blockers.some((item) => item.type === 'child');
    throw Conflict(
      hasChild
        ? 'Không thể xóa vì dữ liệu này vẫn còn dữ liệu con.'
        : 'Không thể xóa vì dữ liệu này đã được sử dụng trong kế hoạch hoặc đánh giá.',
      blockers,
    );
  }

  return prisma.assessmentTheme.delete({
    where: { assessment_theme_id: id },
    select: SELECT,
  });
}
