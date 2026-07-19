import prisma from '../config/prisma.js';
import { paginate } from '../utils/paginate.js';
import { BadRequest, Conflict, NotFound } from '../utils/http-error.js';
import { countReferences } from './assessment-delete-usage.service.js';
import { assertActiveThemeExists } from './assessment-themes.service.js';

const SELECT = {
  assessment_topic_id: true,
  assessment_theme_id: true,
  assessment_age_group_id: true,
  assessment_subject_id: true,
  name: true,
  description: true,
  is_active: true,
  created_at: true,
  updated_at: true,
  assessment_theme: {
    select: {
      assessment_theme_id: true,
      name: true,
      is_active: true,
    },
  },
  assessment_age_group: {
    select: {
      assessment_age_group_id: true,
      class_group_label: true,
      name_vi: true,
    },
  },
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

export async function assertExists(id) {
  const row = await prisma.assessmentTopic.findFirst({
    where: { assessment_topic_id: id, deleted_at: null },
    select: SELECT,
  });
  if (!row) throw NotFound('Không tìm thấy đề tài');
  return row;
}

async function assertAgeGroupExists(ageGroupId) {
  const row = await prisma.assessmentAgeGroup.findFirst({
    where: { assessment_age_group_id: ageGroupId, deleted_at: null },
    select: { assessment_age_group_id: true },
  });
  if (!row) throw BadRequest('Nhóm tuổi không tồn tại');
  return row;
}

async function assertActiveSubjectExists(subjectId) {
  const row = await prisma.assessmentSubject.findFirst({
    where: { assessment_subject_id: subjectId, is_active: true, deleted_at: null },
    select: { assessment_subject_id: true, assessment_age_group_id: true },
  });
  if (!row) throw BadRequest('Môn học đang hoạt động không tồn tại');
  return row;
}

async function assertTopicScopeValid(dto) {
  const [, , subject] = await Promise.all([
    assertActiveThemeExists(dto.assessment_theme_id, dto.assessment_subject_id),
    assertAgeGroupExists(dto.assessment_age_group_id),
    assertActiveSubjectExists(dto.assessment_subject_id),
  ]);
  if (subject.assessment_age_group_id !== dto.assessment_age_group_id) {
    throw BadRequest('Môn học không thuộc nhóm tuổi và lĩnh vực phát triển đã chọn.');
  }
}

async function assertNoDuplicate(themeId, ageGroupId, subjectId, name, exceptId) {
  const row = await prisma.assessmentTopic.findFirst({
    where: {
      assessment_theme_id: themeId,
      assessment_age_group_id: ageGroupId,
      assessment_subject_id: subjectId,
      name,
      deleted_at: null,
      ...(exceptId ? { assessment_topic_id: { not: exceptId } } : {}),
    },
    select: { assessment_topic_id: true },
  });
  if (row)
    throw Conflict('Đề tài đang hoạt động đã tồn tại trong cùng nhóm tuổi, chủ đề và môn học');
}

async function getUsageBlockers(id) {
  return countReferences(
    [
      {
        table: 'assessment_criteria',
        column: 'assessment_topic_id',
        reason: 'Tiêu chí con',
        type: 'child',
      },
      {
        table: 'monthly_development_plan_topics',
        column: 'topic_id',
        reason: 'Kế hoạch tháng',
        type: 'usage',
      },
      {
        table: 'weekly_activity_topics',
        column: 'topic_id',
        reason: 'Kế hoạch tuần',
        type: 'usage',
      },
      {
        table: 'assessment_content_addition_requests',
        column: 'topic_id',
        reason: 'Yêu cầu bổ sung nội dung',
        type: 'usage',
      },
    ],
    id,
  );
}

export async function findAll(query) {
  const {
    page,
    pageSize,
    search,
    assessment_theme_id,
    assessment_age_group_id,
    assessment_subject_id,
    is_active,
  } = query;
  const where = { deleted_at: null };

  if (assessment_theme_id) where.assessment_theme_id = Number(assessment_theme_id);
  if (assessment_age_group_id) where.assessment_age_group_id = Number(assessment_age_group_id);
  if (assessment_subject_id) where.assessment_subject_id = Number(assessment_subject_id);
  if (is_active === 'true') where.is_active = true;
  if (is_active === 'false') where.is_active = false;
  if (search) where.name = { contains: search, mode: 'insensitive' };

  const [rows, total] = await Promise.all([
    prisma.assessmentTopic.findMany({
      where,
      select: SELECT,
      orderBy: [
        { assessment_age_group: { display_order: 'asc' } },
        { assessment_subject: { name: 'asc' } },
        { assessment_theme: { name: 'asc' } },
        { name: 'asc' },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.assessmentTopic.count({ where }),
  ]);

  return paginate(rows, total, page, pageSize);
}

export function findOne(id) {
  return assertExists(id);
}

export async function create(dto, actorId) {
  await assertTopicScopeValid(dto);
  await assertNoDuplicate(
    dto.assessment_theme_id,
    dto.assessment_age_group_id,
    dto.assessment_subject_id,
    dto.name,
  );

  return prisma.assessmentTopic.create({
    data: {
      assessment_theme_id: dto.assessment_theme_id,
      assessment_age_group_id: dto.assessment_age_group_id,
      assessment_subject_id: dto.assessment_subject_id,
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

  await assertTopicScopeValid({
    assessment_theme_id: current.assessment_theme_id,
    assessment_age_group_id: current.assessment_age_group_id,
    assessment_subject_id: current.assessment_subject_id,
  });
  if (current.is_active) {
    await assertNoDuplicate(
      current.assessment_theme_id,
      current.assessment_age_group_id,
      current.assessment_subject_id,
      nextName,
      id,
    );
  }

  const data = { updated_by: actorId };
  if (Object.prototype.hasOwnProperty.call(dto, 'name')) data.name = dto.name;
  if (Object.prototype.hasOwnProperty.call(dto, 'description')) {
    data.description = normalizeText(dto.description);
  }

  return prisma.assessmentTopic.update({
    where: { assessment_topic_id: id },
    data,
    select: SELECT,
  });
}

export async function setStatus(id, isActive, actorId) {
  const current = await assertExists(id);
  if (isActive) {
    await assertTopicScopeValid(current);
    await assertNoDuplicate(
      current.assessment_theme_id,
      current.assessment_age_group_id,
      current.assessment_subject_id,
      current.name,
      id,
    );
  }

  return prisma.assessmentTopic.update({
    where: { assessment_topic_id: id },
    data: { is_active: Boolean(isActive), updated_by: actorId },
    select: SELECT,
  });
}

export async function hardDelete(id) {
  const current = await prisma.assessmentTopic.findFirst({
    where: { assessment_topic_id: id, deleted_at: null },
    select: SELECT,
  });
  if (!current) throw NotFound('Không tìm thấy dữ liệu cần xóa.');
  if (current.is_active) {
    throw BadRequest('Không thể xóa dữ liệu đang hoạt động. Vui lòng ngừng kích hoạt trước.');
  }

  const blockers = await getUsageBlockers(id);

  if (blockers.length > 0) {
    const hasChild = blockers.some((item) => item.type === 'child');
    throw Conflict(
      hasChild
        ? 'Không thể xóa vì dữ liệu này vẫn còn dữ liệu con.'
        : 'Không thể xóa vì dữ liệu này đã được sử dụng trong kế hoạch hoặc đánh giá.',
      blockers,
    );
  }

  return prisma.assessmentTopic.delete({
    where: { assessment_topic_id: id },
    select: SELECT,
  });
}
