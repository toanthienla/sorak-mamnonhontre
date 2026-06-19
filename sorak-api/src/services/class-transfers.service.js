// Chuyển lớp Requests — UC-46..49
// BR-057..072: teacher requests within own class, same year + grade, max 2/semester,
// approve/reject by PRINCIPAL, applied on effective date (cron)
import prisma from '../config/prisma.js';
import { paginate } from '../utils/paginate.js';
import { searchIds } from '../utils/search.js';
import { BadRequest, Conflict, Forbidden, NotFound } from '../utils/http-error.js';
import logger from '../utils/logger.js';

const REQUEST_INCLUDE = {
  student: {
    select: { student_id: true, full_name: true, student_id_card_number: true, grade_level: true },
  },
  from_class: { select: { class_id: true, class_name: true, age_group: true } },
  to_class: { select: { class_id: true, class_name: true, age_group: true } },
  school_year: { select: { school_year_id: true, name: true } },
  semester: { select: { semester_id: true, semester_number: true } },
  requester: { select: { account_id: true, teacher: { select: { full_name: true } } } },
  reviewer: { select: { account_id: true, teacher: { select: { full_name: true } } } },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Class ids the teacher (by account_id) is currently assigned to
async function getTeacherClassIds(accountId) {
  const teacher = await prisma.teacher.findUnique({
    where: { account_id: accountId },
    select: {
      teacher_classes: { where: { removed_at: null }, select: { class_id: true } },
    },
  });
  return teacher?.teacher_classes.map((tc) => tc.class_id) ?? [];
}

async function getActiveYear() {
  const year = await prisma.schoolYear.findFirst({ where: { status: 'active', deleted_at: null } });
  if (!year) throw BadRequest('Không có năm học đang hoạt động');
  return year;
}

// ─── Create (UC-46) ──────────────────────────────────────────────────────────
export async function create(dto, user) {
  const { student_id, to_class_id, reason, effective_date } = dto;
  const effDate = new Date(effective_date);

  const student = await prisma.student.findFirst({
    where: { student_id, deleted_at: null },
  });
  if (!student) throw NotFound('Học sinh không tồn tại');

  // BR-059: only within active academic year
  const year = await getActiveYear();

  // BR-060: not after year end / not before year start
  if (effDate < year.start_date || effDate > year.end_date) {
    throw BadRequest('Ngày hiệu lực phải nằm trong năm học hiện tại');
  }

  // BR-058 + BR-061: student must have a class in the active year — that is the source class
  const enrollment = await prisma.studentEnrollment.findFirst({
    where: { student_id, school_year_id: year.school_year_id, left_date: null },
  });
  if (!enrollment?.class_id) throw BadRequest('Học sinh chưa được xếp lớp trong năm học hiện tại');
  const fromClassId = enrollment.class_id;

  if (to_class_id === fromClassId) throw BadRequest('Lớp đích phải khác lớp hiện tại');

  const [fromClass, toClass] = await Promise.all([
    prisma.class.findUnique({ where: { class_id: fromClassId } }),
    prisma.class.findUnique({ where: { class_id: to_class_id } }),
  ]);
  if (!toClass) throw NotFound('Lớp đích không tồn tại');
  // BR-064: not archived
  if (toClass.deleted_at) throw BadRequest('Không thể chuyển vào lớp đã lưu trữ');
  // BR-062: same academic year
  if (toClass.school_year_id !== year.school_year_id) {
    throw BadRequest('Lớp đích phải thuộc năm học hiện tại');
  }
  // BR-063: same grade level (age_group)
  if (fromClass.age_group !== toClass.age_group) {
    throw BadRequest('Lớp đích phải cùng khối với lớp hiện tại');
  }

  // BR-057: teacher may only request for students in their assigned class
  if (user.role === 'TEACHER') {
    const myClassIds = await getTeacherClassIds(user.sub);
    if (!myClassIds.includes(fromClassId)) {
      throw Forbidden('Chỉ được tạo yêu cầu cho học sinh thuộc lớp mình phụ trách');
    }
  }

  // Resolve semester from effective date — needed for the per-semester limit
  const semester = await prisma.semester.findFirst({
    where: {
      school_year_id: year.school_year_id,
      start_date: { lte: effDate },
      end_date: { gte: effDate },
    },
  });

  // BR-065: max 2 transfers per semester (count Pending + Approved to block over-booking)
  if (semester) {
    const count = await prisma.classTransferRequest.count({
      where: {
        student_id,
        semester_id: semester.semester_id,
        status: { in: ['Pending', 'Approved'] },
      },
    });
    if (count >= 2) throw Conflict('Học sinh đã đạt giới hạn 2 lần chuyển lớp trong học kỳ này');
  }

  // Prevent duplicate pending request for the same student
  const dup = await prisma.classTransferRequest.findFirst({
    where: { student_id, status: 'Pending' },
  });
  if (dup) throw Conflict('Học sinh đang có yêu cầu chuyển lớp chờ duyệt');

  const request = await prisma.classTransferRequest.create({
    data: {
      student_id,
      school_year_id: year.school_year_id,
      semester_id: semester?.semester_id ?? null,
      from_class_id: fromClassId,
      to_class_id,
      reason,
      effective_date: effDate,
      status: 'Pending',
      requested_by: user.sub,
    },
    include: REQUEST_INCLUDE,
  });
  logger.info(`Class transfer request #${request.request_id} created for student ${student_id}`);
  return request;
}

// ─── List (UC-47) ────────────────────────────────────────────────────────────
export async function findAll(query, user) {
  const { page, pageSize, search } = query;
  const where = {};

  if (query.status) where.status = query.status;
  if (query.school_year_id) where.school_year_id = Number(query.school_year_id);
  if (query.student_id) where.student_id = Number(query.student_id);
  if (query.class_id) {
    where.OR = [{ from_class_id: Number(query.class_id) }, { to_class_id: Number(query.class_id) }];
  }

  // Teachers only see requests they created
  if (user.role === 'TEACHER') {
    where.requested_by = user.sub;
  }

  if (search) {
    const ids = await searchIds(
      'students',
      'student_id',
      ['full_name', 'student_id_card_number'],
      search,
    );
    where.student_id = ids ? { in: ids } : where.student_id;
  }

  const [data, total] = await prisma.$transaction([
    prisma.classTransferRequest.findMany({
      where,
      include: REQUEST_INCLUDE,
      orderBy: { request_id: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.classTransferRequest.count({ where }),
  ]);
  return paginate(data, total, page, pageSize);
}

// ─── Details (UC-48) ─────────────────────────────────────────────────────────
export async function findOne(id, user) {
  const request = await prisma.classTransferRequest.findUnique({
    where: { request_id: id },
    include: REQUEST_INCLUDE,
  });
  if (!request) throw NotFound('Yêu cầu chuyển lớp không tồn tại');

  if (user.role === 'TEACHER') {
    const myClassIds = await getTeacherClassIds(user.sub);
    const related =
      myClassIds.includes(request.from_class_id) || myClassIds.includes(request.to_class_id);
    if (!related) throw Forbidden('Không có quyền xem yêu cầu này');
  }
  return request;
}

// ─── Apply one approved request: move student to target class ────────────────
async function applyRequest(tx, request) {
  await tx.studentEnrollment.updateMany({
    where: {
      student_id: request.student_id,
      school_year_id: request.school_year_id,
      left_date: null,
    },
    data: { class_id: request.to_class_id },
  });
  await tx.classTransferRequest.update({
    where: { request_id: request.request_id },
    data: { applied_at: new Date() },
  });
}

// ─── Update status (UC-49) ───────────────────────────────────────────────────
export async function updateStatus(id, dto, user) {
  const { action, note } = dto; // approve | reject | cancel | revert
  const request = await prisma.classTransferRequest.findUnique({ where: { request_id: id } });
  if (!request) throw NotFound('Yêu cầu chuyển lớp không tồn tại');

  // Revert: Approved → Pending, only before the transfer has been applied
  if (action === 'revert') {
    if (user.role !== 'PRINCIPAL') throw Forbidden('Chỉ Ban Giám Hiệu được hoàn tác duyệt');
    if (request.status !== 'Approved') throw Conflict('Chỉ hoàn tác được yêu cầu đã duyệt');
    if (request.applied_at) throw Conflict('Yêu cầu đã được áp dụng — không thể hoàn tác');
    const reverted = await prisma.classTransferRequest.update({
      where: { request_id: id },
      data: { status: 'Pending', reviewed_by: null, review_note: null, reviewed_at: null },
      include: REQUEST_INCLUDE,
    });
    logger.info(`Class transfer request #${id} reverted to Pending by account ${user.sub}`);
    return reverted;
  }

  // EF-49-01: already processed
  if (request.status !== 'Pending') throw Conflict('Yêu cầu đã được xử lý');

  // BR-068: only PRINCIPAL approves/rejects
  if ((action === 'approve' || action === 'reject') && user.role !== 'PRINCIPAL') {
    throw Forbidden('Chỉ Ban Giám Hiệu được duyệt hoặc từ chối yêu cầu');
  }
  // Late approve blocked: effective date already passed (before today) → request must be re-created
  if (action === 'approve') {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    if (new Date(request.effective_date) < startOfToday) {
      throw Conflict('Ngày hiệu lực đã qua — yêu cầu cần được tạo lại với ngày mới');
    }
  }
  // Cancel: requesting teacher or PRINCIPAL
  if (action === 'cancel' && user.role !== 'PRINCIPAL' && request.requested_by !== user.sub) {
    throw Forbidden('Chỉ người tạo yêu cầu được hủy yêu cầu này');
  }

  const STATUS_MAP = { approve: 'Approved', reject: 'Rejected', cancel: 'Cancelled' };
  const newStatus = STATUS_MAP[action];

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.classTransferRequest.update({
      where: { request_id: id },
      data: {
        status: newStatus,
        reviewed_by: user.sub,
        review_note: note ?? null,
        reviewed_at: new Date(),
      },
      include: REQUEST_INCLUDE,
    });

    // BR-069/071: if approved and effective date already reached → apply now
    if (newStatus === 'Approved' && new Date(updated.effective_date) <= new Date()) {
      await applyRequest(tx, updated);
    }
    return updated;
  });

  logger.info(`Class transfer request #${id} → ${newStatus} by account ${user.sub}`);
  return result;
}

// ─── Cron: apply approved requests due today (BR-071) ───────────────────────
