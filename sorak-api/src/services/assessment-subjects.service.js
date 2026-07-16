import prisma from '../config/prisma.js';
import { paginate } from '../utils/paginate.js';
import { BadRequest, Conflict, NotFound } from '../utils/http-error.js';
import { initializeBaseThemes } from '../utils/subject-base-themes.js';

const SELECT = {
  assessment_subject_id: true,
  assessment_age_group_id: true,
  development_field_id: true,
  name: true,
  description: true,
  is_active: true,
  created_at: true,
  updated_at: true,
  development_field: {
    select: {
      development_field_id: true,
      name_vi: true,
      display_order: true,
    },
  },
  assessment_age_group: { select: { assessment_age_group_id: true, name_vi: true } },
};

function normalizeText(value) {
  return value?.trim() || null;
}

async function assertDevelopmentFieldExists(developmentFieldId) {
  const row = await prisma.developmentField.findFirst({
    where: { development_field_id: developmentFieldId, deleted_at: null },
    select: { development_field_id: true },
  });
  if (!row) throw BadRequest('Lĩnh vực phát triển không tồn tại');
  return row;
}

async function assertAgeGroupExists(ageGroupId) {
  const row = await prisma.assessmentAgeGroup.findFirst({
    where: { assessment_age_group_id: Number(ageGroupId), deleted_at: null },
    select: { assessment_age_group_id: true },
  });
  if (!row) throw BadRequest('Nhóm tuổi không tồn tại');
  return row;
}

export async function assertExists(id) {
  const row = await prisma.assessmentSubject.findFirst({
    where: { assessment_subject_id: id, deleted_at: null },
    select: SELECT,
  });
  if (!row) throw NotFound('Không tìm thấy môn học');
  return row;
}

async function assertNoDuplicate(ageGroupId, developmentFieldId, name, exceptId) {
  const row = await prisma.assessmentSubject.findFirst({
    where: {
      assessment_age_group_id: Number(ageGroupId),
      development_field_id: developmentFieldId,
      name,
      deleted_at: null,
      ...(exceptId ? { assessment_subject_id: { not: exceptId } } : {}),
    },
    select: { assessment_subject_id: true },
  });
  if (row) throw Conflict('Môn học đang hoạt động đã tồn tại trong lĩnh vực này');
}

function buildData(dto, actorId) {
  const data = { ...dto, ...(actorId ? { updated_by: actorId } : {}) };
  if (Object.prototype.hasOwnProperty.call(dto, 'description')) {
    data.description = normalizeText(dto.description);
  }
  return data;
}

export async function findAll(query) {
  const { page, pageSize, search, assessment_age_group_id, development_field_id, is_active } =
    query;
  const where = { deleted_at: null };

  if (assessment_age_group_id) where.assessment_age_group_id = Number(assessment_age_group_id);
  if (development_field_id) where.development_field_id = Number(development_field_id);
  if (is_active === 'true') where.is_active = true;
  if (is_active === 'false') where.is_active = false;
  if (search) where.name = { contains: search, mode: 'insensitive' };

  const [rows, total] = await Promise.all([
    prisma.assessmentSubject.findMany({
      where,
      select: SELECT,
      orderBy: [{ development_field: { display_order: 'asc' } }, { name: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.assessmentSubject.count({ where }),
  ]);

  return paginate(rows, total, page, pageSize);
}

export function findOne(id) {
  return assertExists(id);
}

export async function create(dto, actorId) {
  await assertAgeGroupExists(dto.assessment_age_group_id);
  await assertDevelopmentFieldExists(dto.development_field_id);
  await assertNoDuplicate(dto.assessment_age_group_id, dto.development_field_id, dto.name);

  return prisma.$transaction(async (tx) => {
    const subject = await tx.assessmentSubject.create({
      data: {
        assessment_age_group_id: dto.assessment_age_group_id,
        development_field_id: dto.development_field_id,
        name: dto.name,
        description: normalizeText(dto.description),
        created_by: actorId,
        updated_by: actorId,
      },
      select: SELECT,
    });
    await initializeBaseThemes(tx, subject.assessment_subject_id);
    return subject;
  });
}

export async function update(id, dto, actorId) {
  const current = await assertExists(id);
  const nextName = dto.name ?? current.name;
  if (current.is_active) {
    await assertNoDuplicate(
      current.assessment_age_group_id,
      current.development_field_id,
      nextName,
      id,
    );
  }

  return prisma.assessmentSubject.update({
    where: { assessment_subject_id: id },
    data: buildData(dto, actorId),
    select: SELECT,
  });
}

export async function setStatus(id, isActive, actorId) {
  const current = await assertExists(id);
  if (isActive) {
    await assertDevelopmentFieldExists(current.development_field_id);
    await assertNoDuplicate(
      current.assessment_age_group_id,
      current.development_field_id,
      current.name,
      id,
    );
  }

  return prisma.assessmentSubject.update({
    where: { assessment_subject_id: id },
    data: { is_active: Boolean(isActive), updated_by: actorId },
    select: SELECT,
  });
}
