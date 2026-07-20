import { randomUUID } from 'node:crypto';
import prisma from '../config/prisma.js';
import { paginate } from '../utils/paginate.js';
import { BadRequest, Conflict, Forbidden, NotFound } from '../utils/http-error.js';
import { initializeBaseThemes } from '../utils/subject-base-themes.js';

const REQUEST_SELECT = {
  request_id: true,
  request_code: true,
  request_type: true,
  status: true,
  proposed_name: true,
  proposed_description: true,
  proposed_reason: true,
  proposed_criteria: true,
  age_group_id: true,
  development_field_id: true,
  subject_id: true,
  theme_id: true,
  topic_id: true,
  criterion_id: true,
  requester_id: true,
  requester_teacher_id: true,
  requester_class_id: true,
  reviewed_by: true,
  reviewed_at: true,
  review_note: true,
  cancelled_at: true,
  cancelled_by: true,
  created_at: true,
  updated_at: true,
  age_group: { select: { assessment_age_group_id: true, name_vi: true, class_group_label: true } },
  development_field: { select: { development_field_id: true, name_vi: true } },
  subject: {
    select: {
      assessment_subject_id: true,
      name: true,
      development_field_id: true,
      is_active: true,
    },
  },
  theme: { select: { assessment_theme_id: true, name: true, is_active: true } },
  topic: {
    select: {
      assessment_topic_id: true,
      name: true,
      assessment_age_group_id: true,
      assessment_subject_id: true,
      assessment_theme_id: true,
      is_active: true,
    },
  },
  criterion: { select: { assessment_criterion_id: true, criterion_code: true, content: true } },
  requester: { select: { account_id: true, teacher: { select: { full_name: true } } } },
  requester_teacher: { select: { teacher_id: true, full_name: true, email: true } },
  requester_class: { select: { class_id: true, class_name: true, age_group: true } },
  reviewer: { select: { account_id: true, teacher: { select: { full_name: true } } } },
  canceller: { select: { account_id: true, teacher: { select: { full_name: true } } } },
  created_records: {
    select: {
      id: true,
      record_type: true,
      record_id: true,
      created_at: true,
    },
    orderBy: { id: 'asc' },
  },
};

function normalizeText(value) {
  return value?.trim() || null;
}

function normalizeContent(value) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function getCriterionProposalContent(row) {
  return normalizeText(row.description) ?? normalizeText(row.content);
}

async function linkCreatedRecord(tx, requestId, recordType, recordId) {
  return tx.assessmentContentRequestCreatedRecord.create({
    data: {
      request_id: requestId,
      record_type: recordType,
      record_id: recordId,
    },
  });
}

function formatCriterionCode(id) {
  return `TC-${String(id).padStart(6, '0')}`;
}

function pendingCriterionCode() {
  return `TP-${randomUUID().replaceAll('-', '').slice(0, 27)}`;
}

function startOfDate(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDate(value) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

async function createRequestCode(tx) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const prefix = `ACR-${y}${m}${d}`;
  const start = new Date(y, now.getMonth(), now.getDate());
  const end = new Date(y, now.getMonth(), now.getDate() + 1);
  const count = await tx.assessmentContentAdditionRequest.count({
    where: { created_at: { gte: start, lt: end } },
  });
  return `${prefix}-${String(count + 1).padStart(4, '0')}`;
}

async function getRequesterTeacher(accountId) {
  const teacher = await prisma.teacher.findFirst({
    where: { account_id: accountId, deleted_at: null },
    select: { teacher_id: true },
  });
  if (!teacher) throw Forbidden('Bạn không có quyền thực hiện thao tác này.');
  return teacher;
}

async function assertAgeGroupExists(tx, id) {
  const row = await tx.assessmentAgeGroup.findFirst({
    where: { assessment_age_group_id: id, deleted_at: null },
    select: { assessment_age_group_id: true },
  });
  if (!row) throw BadRequest('Phân loại đề xuất không hợp lệ.');
  return row;
}

async function assertDevelopmentFieldExists(tx, id) {
  const row = await tx.developmentField.findFirst({
    where: { development_field_id: id, deleted_at: null },
    select: { development_field_id: true },
  });
  if (!row) throw BadRequest('Phân loại đề xuất không hợp lệ.');
  return row;
}

async function assertSubjectExists(tx, id, requireActive = true) {
  const row = await tx.assessmentSubject.findFirst({
    where: {
      assessment_subject_id: id,
      deleted_at: null,
      ...(requireActive ? { is_active: true } : {}),
    },
    select: {
      assessment_subject_id: true,
      assessment_age_group_id: true,
      development_field_id: true,
    },
  });
  if (!row) throw BadRequest('Phân loại đề xuất không hợp lệ.');
  return row;
}

async function assertThemeExists(tx, id, requireActive = true) {
  const row = await tx.assessmentTheme.findFirst({
    where: {
      assessment_theme_id: id,
      deleted_at: null,
      ...(requireActive ? { is_active: true } : {}),
    },
    select: { assessment_theme_id: true, assessment_subject_id: true },
  });
  if (!row) throw BadRequest('Phân loại đề xuất không hợp lệ.');
  return row;
}

async function assertTopicExists(tx, dto, requireActive = true) {
  const row = await tx.assessmentTopic.findFirst({
    where: {
      assessment_topic_id: dto.topic_id,
      deleted_at: null,
      ...(requireActive ? { is_active: true } : {}),
    },
    select: {
      assessment_topic_id: true,
      assessment_age_group_id: true,
      assessment_subject_id: true,
      assessment_theme_id: true,
    },
  });
  if (!row) throw BadRequest('Phân loại đề xuất không hợp lệ.');
  if (
    row.assessment_age_group_id !== dto.age_group_id ||
    row.assessment_subject_id !== dto.subject_id ||
    row.assessment_theme_id !== dto.theme_id
  ) {
    throw BadRequest('Đề tài không thuộc phạm vi phân loại đã chọn.');
  }
  return row;
}

async function assertNoSubjectDuplicate(tx, ageGroupId, developmentFieldId, name) {
  const row = await tx.assessmentSubject.findFirst({
    where: {
      assessment_age_group_id: ageGroupId,
      development_field_id: developmentFieldId,
      name,
      deleted_at: null,
    },
    select: { assessment_subject_id: true },
  });
  if (row) throw Conflict('Dữ liệu đề xuất đã tồn tại trong hệ thống.');
}

async function assertNoThemeDuplicate(tx, subjectId, name) {
  const row = await tx.assessmentTheme.findFirst({
    where: { assessment_subject_id: subjectId, name, deleted_at: null },
    select: { assessment_theme_id: true },
  });
  if (row) throw Conflict('Dữ liệu đề xuất đã tồn tại trong hệ thống.');
}

async function assertNoTopicDuplicate(tx, dto) {
  const row = await tx.assessmentTopic.findFirst({
    where: {
      assessment_theme_id: dto.theme_id,
      assessment_age_group_id: dto.age_group_id,
      assessment_subject_id: dto.subject_id,
      name: dto.proposed_name,
      deleted_at: null,
    },
    select: { assessment_topic_id: true },
  });
  if (row) throw Conflict('Dữ liệu đề xuất đã tồn tại trong hệ thống.');
}

async function assertNoCriterionDuplicate(tx, dto, content) {
  const rows = await tx.assessmentCriterion.findMany({
    where: {
      assessment_age_group_id: dto.age_group_id,
      development_field_id: dto.development_field_id,
      assessment_subject_id: dto.subject_id,
      assessment_theme_id: dto.theme_id,
      assessment_topic_id: dto.topic_id,
      deleted_at: null,
    },
    select: { content: true },
  });
  const next = normalizeContent(content);
  if (rows.some((row) => normalizeContent(row.content) === next)) {
    throw Conflict('Dữ liệu đề xuất đã tồn tại trong hệ thống.');
  }
}

function normalizeCriterionProposal(row, fallback) {
  const content = getCriterionProposalContent(row);
  return {
    content,
    description: content,
    age_group_id: row.age_group_id ?? row.ageGroupId ?? fallback.age_group_id,
    development_field_id:
      row.development_field_id ?? row.developmentFieldId ?? fallback.development_field_id,
    subject_id: row.subject_id ?? row.subjectId ?? fallback.subject_id,
    theme_id: row.theme_id ?? row.themeId ?? fallback.theme_id,
  };
}

async function assertTopicScopeValid(tx, dto) {
  const [subject, theme] = await Promise.all([
    assertSubjectExists(tx, dto.subject_id),
    assertThemeExists(tx, dto.theme_id),
    assertAgeGroupExists(tx, dto.age_group_id),
  ]);
  if (dto.development_field_id && subject.development_field_id !== dto.development_field_id) {
    throw BadRequest('Phân loại đề xuất không hợp lệ.');
  }
  if (subject.assessment_age_group_id !== dto.age_group_id) {
    throw BadRequest('Môn học không thuộc nhóm tuổi và lĩnh vực phát triển đã chọn.');
  }
  if (theme.assessment_subject_id !== dto.subject_id) {
    throw BadRequest('Chủ đề không thuộc môn học đã chọn.');
  }
}

async function assertCriterionScopeValid(tx, dto) {
  const [subject, theme] = await Promise.all([
    assertSubjectExists(tx, dto.subject_id),
    assertThemeExists(tx, dto.theme_id),
    assertAgeGroupExists(tx, dto.age_group_id),
    assertDevelopmentFieldExists(tx, dto.development_field_id),
  ]);
  if (subject.development_field_id !== dto.development_field_id) {
    throw BadRequest('Phân loại đề xuất không hợp lệ.');
  }
  if (subject.assessment_age_group_id !== dto.age_group_id) {
    throw BadRequest('Môn học không thuộc nhóm tuổi và lĩnh vực phát triển đã chọn.');
  }
  if (theme.assessment_subject_id !== dto.subject_id) {
    throw BadRequest('Chủ đề không thuộc môn học đã chọn.');
  }
  await assertTopicExists(tx, dto);
}

async function validateRequestContent(tx, dto) {
  if (dto.request_type === 'SUBJECT') {
    await assertAgeGroupExists(tx, dto.age_group_id);
    await assertDevelopmentFieldExists(tx, dto.development_field_id);
    await assertNoSubjectDuplicate(
      tx,
      dto.age_group_id,
      dto.development_field_id,
      dto.proposed_name,
    );
  }
  if (dto.request_type === 'THEME') {
    const [subject] = await Promise.all([
      assertSubjectExists(tx, dto.subject_id),
      assertAgeGroupExists(tx, dto.age_group_id),
      assertDevelopmentFieldExists(tx, dto.development_field_id),
    ]);
    if (
      subject.assessment_age_group_id !== dto.age_group_id ||
      subject.development_field_id !== dto.development_field_id
    ) {
      throw BadRequest('Môn học không thuộc nhóm tuổi và lĩnh vực phát triển hiện tại.');
    }
    await assertNoThemeDuplicate(tx, dto.subject_id, dto.proposed_name);
  }
  if (dto.request_type === 'TOPIC') {
    await assertTopicScopeValid(tx, dto);
    await assertNoTopicDuplicate(tx, dto);
  }
  if (dto.request_type === 'CRITERION') {
    await assertCriterionScopeValid(tx, dto);
    await assertNoCriterionDuplicate(tx, dto, dto.proposed_name);
  }
  if (dto.request_type === 'TOPIC_WITH_CRITERIA') {
    await assertTopicScopeValid(tx, dto);
    await assertDevelopmentFieldExists(tx, dto.development_field_id);
    await assertNoTopicDuplicate(tx, dto);
  }
}

async function createCriterion(tx, dto, content, actorId) {
  await assertNoCriterionDuplicate(tx, dto, content);
  const created = await tx.assessmentCriterion.create({
    data: {
      criterion_code: pendingCriterionCode(),
      assessment_age_group_id: dto.age_group_id,
      development_field_id: dto.development_field_id,
      assessment_subject_id: dto.subject_id,
      assessment_theme_id: dto.theme_id,
      assessment_topic_id: dto.topic_id,
      content,
      description: normalizeText(dto.description),
      created_by: actorId,
      updated_by: actorId,
    },
    select: { assessment_criterion_id: true },
  });

  return tx.assessmentCriterion.update({
    where: { assessment_criterion_id: created.assessment_criterion_id },
    data: { criterion_code: formatCriterionCode(created.assessment_criterion_id) },
    select: { assessment_criterion_id: true },
  });
}

async function approveRequest(tx, request, actorId) {
  await validateRequestContent(tx, request);

  if (request.request_type === 'SUBJECT') {
    const subject = await tx.assessmentSubject.create({
      data: {
        assessment_age_group_id: request.age_group_id,
        development_field_id: request.development_field_id,
        name: request.proposed_name,
        description: normalizeText(request.proposed_description),
        created_by: actorId,
        updated_by: actorId,
      },
      select: { assessment_subject_id: true },
    });
    await initializeBaseThemes(tx, subject.assessment_subject_id);
    await linkCreatedRecord(tx, request.request_id, 'SUBJECT', subject.assessment_subject_id);
    return { subject_id: subject.assessment_subject_id };
  }

  if (request.request_type === 'THEME') {
    const theme = await tx.assessmentTheme.create({
      data: {
        assessment_subject_id: request.subject_id,
        name: request.proposed_name,
        description: normalizeText(request.proposed_description),
        created_by: actorId,
        updated_by: actorId,
      },
      select: { assessment_theme_id: true },
    });
    await linkCreatedRecord(tx, request.request_id, 'THEME', theme.assessment_theme_id);
    return { theme_id: theme.assessment_theme_id };
  }

  if (request.request_type === 'TOPIC') {
    const topic = await tx.assessmentTopic.create({
      data: {
        assessment_age_group_id: request.age_group_id,
        assessment_subject_id: request.subject_id,
        assessment_theme_id: request.theme_id,
        name: request.proposed_name,
        description: normalizeText(request.proposed_description),
        created_by: actorId,
        updated_by: actorId,
      },
      select: { assessment_topic_id: true },
    });
    await linkCreatedRecord(tx, request.request_id, 'TOPIC', topic.assessment_topic_id);
    return { topic_id: topic.assessment_topic_id };
  }

  if (request.request_type === 'CRITERION') {
    const criterion = await createCriterion(
      tx,
      {
        age_group_id: request.age_group_id,
        development_field_id: request.development_field_id,
        subject_id: request.subject_id,
        theme_id: request.theme_id,
        topic_id: request.topic_id,
        description: request.proposed_description,
      },
      request.proposed_name,
      actorId,
    );
    await linkCreatedRecord(tx, request.request_id, 'CRITERION', criterion.assessment_criterion_id);
    return { criterion_id: criterion.assessment_criterion_id };
  }

  const topic = await tx.assessmentTopic.create({
    data: {
      assessment_age_group_id: request.age_group_id,
      assessment_subject_id: request.subject_id,
      assessment_theme_id: request.theme_id,
      name: request.proposed_name,
      description: normalizeText(request.proposed_description),
      created_by: actorId,
      updated_by: actorId,
    },
    select: { assessment_topic_id: true },
  });
  await linkCreatedRecord(tx, request.request_id, 'TOPIC', topic.assessment_topic_id);

  for (const row of request.proposed_criteria ?? []) {
    const criterion = normalizeCriterionProposal(row, request);
    await assertCriterionScopeValid(tx, { ...criterion, topic_id: topic.assessment_topic_id });
    const createdCriterion = await createCriterion(
      tx,
      { ...criterion, topic_id: topic.assessment_topic_id, description: criterion.description },
      criterion.content,
      actorId,
    );
    await linkCreatedRecord(
      tx,
      request.request_id,
      'CRITERION',
      createdCriterion.assessment_criterion_id,
    );
  }

  return { topic_id: topic.assessment_topic_id };
}

async function enrichCreatedRecords(row) {
  const records = row.created_records ?? [];
  if (records.length === 0) {
    const { created_records, ...rest } = row;
    return { ...rest, createdRecords: [], createdRecordCount: 0 };
  }

  const idsByType = records.reduce((acc, record) => {
    acc[record.record_type] ??= [];
    acc[record.record_type].push(record.record_id);
    return acc;
  }, {});

  const [subjects, themes, topics, criteria] = await Promise.all([
    idsByType.SUBJECT
      ? prisma.assessmentSubject.findMany({
          where: { assessment_subject_id: { in: idsByType.SUBJECT } },
          select: { assessment_subject_id: true, name: true, description: true },
        })
      : [],
    idsByType.THEME
      ? prisma.assessmentTheme.findMany({
          where: { assessment_theme_id: { in: idsByType.THEME } },
          select: { assessment_theme_id: true, name: true, description: true },
        })
      : [],
    idsByType.TOPIC
      ? prisma.assessmentTopic.findMany({
          where: { assessment_topic_id: { in: idsByType.TOPIC } },
          select: { assessment_topic_id: true, name: true, description: true },
        })
      : [],
    idsByType.CRITERION
      ? prisma.assessmentCriterion.findMany({
          where: { assessment_criterion_id: { in: idsByType.CRITERION } },
          select: { assessment_criterion_id: true, criterion_code: true, content: true },
        })
      : [],
  ]);

  const maps = {
    SUBJECT: new Map(subjects.map((item) => [item.assessment_subject_id, item])),
    THEME: new Map(themes.map((item) => [item.assessment_theme_id, item])),
    TOPIC: new Map(topics.map((item) => [item.assessment_topic_id, item])),
    CRITERION: new Map(criteria.map((item) => [item.assessment_criterion_id, item])),
  };

  const createdRecords = records.map((record) => {
    const officialRecord = maps[record.record_type]?.get(record.record_id) ?? null;
    return {
      id: record.id,
      recordType: record.record_type,
      recordId: record.record_id,
      createdAt: record.created_at,
      displayName:
        officialRecord?.name ??
        officialRecord?.content ??
        officialRecord?.criterion_code ??
        String(record.record_id),
      officialRecord,
    };
  });

  const { created_records, ...rest } = row;
  return { ...rest, createdRecords, createdRecordCount: createdRecords.length };
}

export async function findAll(query, user) {
  const where = {};

  if (query.request_type) where.request_type = query.request_type;
  if (query.status) where.status = query.status;
  if (query.requester_teacher_id) where.requester_teacher_id = Number(query.requester_teacher_id);
  if (query.requester_class_id) where.requester_class_id = Number(query.requester_class_id);
  if (query.age_group_id) where.age_group_id = Number(query.age_group_id);
  if (query.development_field_id) where.development_field_id = Number(query.development_field_id);
  if (query.subject_id) where.subject_id = Number(query.subject_id);
  if (query.theme_id) where.theme_id = Number(query.theme_id);
  if (query.topic_id) where.topic_id = Number(query.topic_id);
  if (query.created_from || query.created_to) {
    where.created_at = {
      ...(query.created_from ? { gte: startOfDate(query.created_from) } : {}),
      ...(query.created_to ? { lte: endOfDate(query.created_to) } : {}),
    };
  }
  if (user.role === 'TEACHER') where.requester_id = user.sub;
  if (query.search) {
    where.OR = [
      { request_code: { contains: query.search, mode: 'insensitive' } },
      { proposed_name: { contains: query.search, mode: 'insensitive' } },
      { proposed_description: { contains: query.search, mode: 'insensitive' } },
      { proposed_reason: { contains: query.search, mode: 'insensitive' } },
      { requester_teacher: { full_name: { contains: query.search, mode: 'insensitive' } } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.assessmentContentAdditionRequest.findMany({
      where,
      select: REQUEST_SELECT,
      orderBy: { created_at: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.assessmentContentAdditionRequest.count({ where }),
  ]);
  return paginate(
    rows.map(({ created_records, ...row }) => ({
      ...row,
      createdRecordCount: created_records?.length ?? 0,
    })),
    total,
    query.page,
    query.pageSize,
  );
}

export async function findOne(id, user) {
  const row = await prisma.assessmentContentAdditionRequest.findUnique({
    where: { request_id: id },
    select: REQUEST_SELECT,
  });
  if (!row) throw NotFound('Không tìm thấy yêu cầu bổ sung nội dung.');
  if (user.role === 'TEACHER' && row.requester_id !== user.sub) {
    throw Forbidden('Bạn không có quyền thực hiện thao tác này.');
  }
  return enrichCreatedRecords(row);
}

export async function create(dto, user) {
  if (user.role !== 'TEACHER') throw Forbidden('Bạn không có quyền thực hiện thao tác này.');
  const requester = await getRequesterTeacher(user.sub);

  return prisma.$transaction(async (tx) => {
    await validateRequestContent(tx, dto);
    return tx.assessmentContentAdditionRequest.create({
      data: {
        request_code: await createRequestCode(tx),
        request_type: dto.request_type,
        status: 'PENDING',
        proposed_name: dto.proposed_name,
        proposed_description: normalizeText(dto.proposed_description),
        proposed_reason: normalizeText(dto.proposed_reason),
        proposed_criteria: dto.proposed_criteria ?? undefined,
        age_group_id: dto.age_group_id ?? null,
        development_field_id: dto.development_field_id ?? null,
        subject_id: dto.subject_id ?? null,
        theme_id: dto.theme_id ?? null,
        topic_id: dto.topic_id ?? null,
        requester_id: user.sub,
        requester_teacher_id: requester.teacher_id,
        requester_class_id: dto.requester_class_id ?? null,
      },
      select: REQUEST_SELECT,
    });
  });
}

export async function review(id, dto, user) {
  if (user.role !== 'PRINCIPAL') throw Forbidden('Bạn không có quyền thực hiện thao tác này.');

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT request_id FROM assessment_content_addition_requests WHERE request_id = ${id} FOR UPDATE`;
    const request = await tx.assessmentContentAdditionRequest.findUnique({
      where: { request_id: id },
    });
    if (!request) throw NotFound('Không tìm thấy yêu cầu bổ sung nội dung.');
    if (request.status !== 'PENDING') {
      throw Conflict('Chỉ yêu cầu đang chờ duyệt mới được xử lý.');
    }

    if (dto.action === 'reject') {
      return tx.assessmentContentAdditionRequest.update({
        where: { request_id: id },
        data: {
          status: 'REJECTED',
          reviewed_by: user.sub,
          reviewed_at: new Date(),
          review_note: dto.review_note,
        },
        select: REQUEST_SELECT,
      });
    }

    const createdLinks = await approveRequest(tx, request, user.sub);
    return tx.assessmentContentAdditionRequest.update({
      where: { request_id: id },
      data: {
        ...createdLinks,
        status: 'APPROVED',
        reviewed_by: user.sub,
        reviewed_at: new Date(),
        review_note: normalizeText(dto.review_note),
      },
      select: REQUEST_SELECT,
    });
  });
}

export async function cancel(id, user) {
  const request = await prisma.assessmentContentAdditionRequest.findUnique({
    where: { request_id: id },
    select: { request_id: true, requester_id: true, status: true },
  });
  if (!request) throw NotFound('Không tìm thấy yêu cầu bổ sung nội dung.');
  if (user.role !== 'TEACHER' || request.requester_id !== user.sub) {
    throw Forbidden('Bạn không có quyền thực hiện thao tác này.');
  }
  if (request.status !== 'PENDING') {
    throw Conflict('Chỉ yêu cầu đang chờ duyệt mới được xử lý.');
  }

  return prisma.assessmentContentAdditionRequest.update({
    where: { request_id: id },
    data: {
      status: 'CANCELLED',
      cancelled_by: user.sub,
      cancelled_at: new Date(),
    },
    select: REQUEST_SELECT,
  });
}
