import bcrypt from "bcrypt";
import ExcelJS from "exceljs";
import prisma from "../config/prisma.js";
import { paginate } from "../utils/paginate.js";
import { BadRequest, Conflict, NotFound } from "../utils/http-error.js";
import { defaultParentPassword } from "./auth.service.js";

async function assertExists(id) {
  const s = await prisma.student.findFirst({
    where: { student_id: id, deleted_at: null },
  });
  if (!s) throw NotFound("Student not found");
  return s;
}

async function assertClassExists(id) {
  const c = await prisma.class.findFirst({
    where: { class_id: id, deleted_at: null },
  });
  if (!c) throw BadRequest("Lớp không tồn tại");
}

// Generate card number: initials + enrollment_year + 3-digit seq (reset per year)
// e.g. NVA2024.001, NVA2025.001 (seq resets each year)
function buildCardNumber(fullName, enrollmentDate, seqInYear) {
  const parts = (fullName || "").trim().split(/\s+/);
  const initials = parts.map((p) => (p[0] ?? "").toUpperCase()).join("");
  const year = enrollmentDate
    ? new Date(enrollmentDate).getFullYear()
    : new Date().getFullYear();
  const seq = String(seqInYear).padStart(3, "0");
  return `${initials}${year}.${seq}`;
}

export async function create(dto, actorId) {
  if (dto.class_id) await assertClassExists(dto.class_id);

  // Placeholder card — will be replaced with real one after insert
  const tempCard = `TEMP_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  return prisma.$transaction(async (tx) => {
    const student = await tx.student.create({
      data: {
        student_id_card_number: tempCard,
        full_name: dto.full_name,
        date_of_birth: new Date(dto.date_of_birth),
        gender: dto.gender,
        grade_level: dto.grade_level || null,
        enrollment_date: dto.enrollment_date
          ? new Date(dto.enrollment_date)
          : null,
        ethnicity: dto.ethnicity || null,
        nationality: dto.nationality || null,
        religion: dto.religion || null,
        blood_type: dto.blood_type || null,
        birth_place: dto.birth_place || null,
        contact_phone: dto.contact_phone || null,
        permanent_province: dto.permanent_province || null,
        permanent_ward: dto.permanent_ward || null,
        permanent_address_detail: dto.permanent_address_detail || null,
        current_address: dto.current_address || null,
        hometown_province: dto.hometown_province || null,
        hometown_ward: dto.hometown_ward || null,
        photo_url: dto.photo_url || null,
        created_by: actorId,
        updated_by: actorId,
      },
    });

    if (dto.class_id) {
      await tx.studentClass.create({
        data: { student_id: student.student_id, class_id: dto.class_id },
      });
    }

    if (dto.parents && dto.parents.length > 0) {
      for (const p of dto.parents) {
        await tx.parent.create({
          data: {
            student_id: student.student_id,
            full_name: p.full_name,
            phone: p.phone?.trim() || null,
            relationship: p.relationship || null,
          },
        });
      }
    }

    // Count students enrolled in same year to get seq (reset per year)
    const enrollYear = dto.enrollment_date
      ? new Date(dto.enrollment_date).getFullYear()
      : new Date().getFullYear();
    const startOfYear = new Date(`${enrollYear}-01-01`);
    const endOfYear = new Date(`${enrollYear + 1}-01-01`);
    const countInYear = await tx.student.count({
      where: { enrollment_date: { gte: startOfYear, lt: endOfYear } },
    });
    const realCard = buildCardNumber(
      dto.full_name,
      dto.enrollment_date,
      countInYear,
    );
    const defaultPw = defaultParentPassword(realCard);
    const pwHash = await bcrypt.hash(defaultPw, 12);

    // Create PH account for this student
    const acc = await tx.account.create({
      data: { role: "PH", password_hash: pwHash, is_active: true },
    });
    await tx.student.update({
      where: { student_id: student.student_id },
      data: { student_id_card_number: realCard, account_id: acc.account_id },
    });

    return { ...student, student_id_card_number: realCard };
  });
}

export async function findArchived(query = {}) {
  const page = Number(query.page ?? 1);
  const pageSize = Number(query.pageSize ?? 100);
  const where = { deleted_at: { not: null } };
  if (query.search) {
    where.OR = [
      { full_name: { contains: query.search, mode: "insensitive" } },
      {
        student_id_card_number: { contains: query.search, mode: "insensitive" },
      },
    ];
  }
  const [data, total] = await prisma.$transaction([
    prisma.student.findMany({
      where,
      select: {
        student_id: true,
        student_id_card_number: true,
        full_name: true,
        deleted_at: true,
        student_classes: {
          orderBy: { enrolled_date: "desc" },
          take: 1,
          select: { class: { select: { class_name: true } } },
        },
      },
      orderBy: { deleted_at: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.student.count({ where }),
  ]);
  return paginate(data, total, page, pageSize);
}

export async function findAll(query) {
  const {
    page,
    pageSize,
    search,
    sortBy,
    sortOrder,
    school_year_id,
    class_id,
    grade_level,
  } = query;

  const where = { deleted_at: null };
  if (grade_level) where.grade_level = grade_level;
  if (query.is_active === "true") where.account = { is_active: true };
  else if (query.is_active === "false") where.account = { is_active: false };
  if (query.student_status) where.student_status = query.student_status;
  if (search) {
    where.OR = [
      { full_name: { contains: search, mode: "insensitive" } },
      { student_id_card_number: { contains: search } },
    ];
  }
  if (class_id) {
    where.student_classes = { some: { left_date: null, class_id } };
  } else if (school_year_id) {
    // Include students with a class in this year OR enrolled via StudentYearEnrollment (no class yet)
    where.OR = [
      ...(where.OR ?? []),
      { student_classes: { some: { class: { school_year_id } } } },
      { student_year_enrollments: { some: { school_year_id } } },
    ];
    // If there was a search OR already on where.OR, merge carefully
    if (search) {
      // Wrap: (name/card MATCH) AND (in year via class OR enrollment)
      where.AND = [
        {
          OR: [
            { full_name: { contains: search, mode: "insensitive" } },
            { student_id_card_number: { contains: search } },
          ],
        },
        {
          OR: [
            { student_classes: { some: { class: { school_year_id } } } },
            { student_year_enrollments: { some: { school_year_id } } },
          ],
        },
      ];
      delete where.OR;
    }
  }

  const orderBy = sortBy ? { [sortBy]: sortOrder } : { created_at: "desc" };

  const [data, total] = await prisma.$transaction([
    prisma.student.findMany({
      where,
      select: {
        student_id: true,
        student_id_card_number: true,
        full_name: true,
        date_of_birth: true,
        gender: true,
        grade_level: true,
        account_id: true,
        enrollment_date: true,
        student_status: true,
        contact_phone: true,
        account: { select: { is_active: true } },
        current_address: true,
        ethnicity: true,
        nationality: true,
        religion: true,
        area_type: true,
        blood_type: true,
        birth_place: true,
        permanent_province: true,
        permanent_ward: true,
        permanent_address_detail: true,
        hometown_province: true,
        hometown_ward: true,
        photo_url: true,
        created_at: true,
        deleted_at: true,
        parents: {
          select: {
            parent_id: true,
            full_name: true,
            phone: true,
            relationship: true,
          },
        },
        student_classes: {
          where: school_year_id
            ? { class: { school_year_id } }
            : { left_date: null },
          select: {
            student_status: true,
            left_date: true,
            class: {
              select: {
                class_id: true,
                class_name: true,
                school_year: { select: { school_year_id: true, name: true } },
              },
            },
          },
          orderBy: { enrolled_date: "desc" },
          take: 1,
        },
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.student.count({ where }),
  ]);

  return paginate(data, total, page, pageSize);
}

export async function findOne(id) {
  const student = await prisma.student.findFirst({
    where: { student_id: id, deleted_at: null },
    include: {
      parents: true,
      student_classes: {
        include: {
          class: { include: { school_year: { select: { name: true } } } },
        },
        orderBy: { enrolled_date: "desc" },
      },
      created_by_account: {
        select: { account_id: true, teacher: { select: { full_name: true } } },
      },
      updated_by_account: {
        select: { account_id: true, teacher: { select: { full_name: true } } },
      },
    },
  });
  if (!student) throw NotFound("Student not found");
  return student;
}

export async function update(id, dto, actorId) {
  await assertExists(id);
  const data = { ...dto, updated_by: actorId };
  // '' → null for nullable string columns
  for (const k of Object.keys(data)) {
    if (data[k] === "") data[k] = null;
  }
  if (dto.date_of_birth) data.date_of_birth = new Date(dto.date_of_birth);
  data.enrollment_date = dto.enrollment_date
    ? new Date(dto.enrollment_date)
    : data.enrollment_date;

  return prisma.$transaction(async (tx) => {
    const student = await tx.student.update({
      where: { student_id: id },
      data,
    });
    // Sync student_status to current active StudentClass record
    if (dto.student_status) {
      await tx.studentClass.updateMany({
        where: { student_id: id, left_date: null },
        data: { student_status: dto.student_status },
      });
    }
    return student;
  });
}

export async function softDelete(id, actorId) {
  await assertExists(id);
  return prisma.$transaction(async (tx) => {
    await tx.studentClass.updateMany({
      where: { student_id: id, left_date: null },
      data: { left_date: new Date() },
    });
    return tx.student.update({
      where: { student_id: id },
      data: {
        deleted_at: new Date(),
        student_status: "Thôi học kỳ 1",
        updated_by: actorId,
      },
    });
  });
}

// Toggle PH account-active (via accounts table).
export async function setActive(id, isActive) {
  const s = await prisma.student.findUnique({
    where: { student_id: id },
    select: { account_id: true },
  });
  if (!s) throw NotFound("Học sinh không tồn tại");
  if (!s.account_id) throw BadRequest("Học sinh chưa có tài khoản");
  return prisma.account.update({
    where: { account_id: s.account_id },
    data: { is_active: Boolean(isActive) },
  });
}

export async function restore(id) {
  const student = await prisma.student.findFirst({ where: { student_id: id } });
  if (!student) throw NotFound("Học sinh không tồn tại");
  if (!student.deleted_at) throw BadRequest("Học sinh chưa bị xóa");
  return prisma.student.update({
    where: { student_id: id },
    data: { deleted_at: null, student_status: "Đang học" },
  });
}

export async function addParent(studentId, dto) {
  await assertExists(studentId);
  return prisma.parent.create({
    data: {
      student_id: studentId,
      full_name: dto.full_name,
      phone: dto.phone?.trim() || null,
      relationship: dto.relationship || null,
    },
  });
}

export async function updateParent(parentId, dto) {
  const parent = await prisma.parent.findUnique({
    where: { parent_id: parentId },
  });
  if (!parent) throw NotFound("Phụ huynh không tồn tại");
  return prisma.parent.update({
    where: { parent_id: parentId },
    data: {
      full_name: dto.full_name ?? undefined,
      phone: dto.phone?.trim() ?? undefined,
      relationship: dto.relationship ?? undefined,
    },
  });
}

export async function importExcel(buffer, actorId) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheet = wb.worksheets[0];
  if (!sheet) throw BadRequest("File Excel không có sheet");

  const errors = [];
  const created = [];

  for (let i = 2; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    // Col layout matches export:
    // 1=Mã thẻ(auto, skip) 2=Họ tên 3=Ngày sinh 4=Giới tính 5=Khối
    // 6=Lớp(class lookup) 7=Năm học(skip) 8=Địa chỉ
    // 9=PH1 Họ tên 10=PH1 Quan hệ 11=PH1 SĐT
    // 12=PH2 Họ tên 13=PH2 Quan hệ 14=PH2 SĐT
    const full_name = String(row.getCell(2).value ?? "").trim();
    const dobRaw = row.getCell(3).value;
    const gender = String(row.getCell(4).value ?? "").trim();
    const grade_level = String(row.getCell(5).value ?? "").trim() || undefined;
    const class_name_raw =
      String(row.getCell(6).value ?? "").trim() || undefined;
    // col 7 = Năm học (read-only, skip)
    const current_address =
      String(row.getCell(8).value ?? "").trim() || undefined;
    const p1_name = String(row.getCell(9).value ?? "").trim() || undefined;
    const p1_rel = String(row.getCell(10).value ?? "").trim() || undefined;
    const p1_phone = String(row.getCell(11).value ?? "").trim() || undefined;
    const p2_name = String(row.getCell(12).value ?? "").trim() || undefined;
    const p2_rel = String(row.getCell(13).value ?? "").trim() || undefined;
    const p2_phone = String(row.getCell(14).value ?? "").trim() || undefined;

    if (!full_name && !dobRaw) continue;
    if (!full_name || !dobRaw || !gender) {
      errors.push({ row: i, message: "Thiếu full_name/date_of_birth/gender" });
      continue;
    }

    try {
      const dob =
        dobRaw instanceof Date
          ? dobRaw.toISOString().slice(0, 10)
          : String(dobRaw).slice(0, 10);

      // Resolve class_id from class_name if provided
      let class_id;
      if (class_name_raw) {
        const cls = await prisma.class.findFirst({
          where: { class_name: class_name_raw, deleted_at: null },
          orderBy: { school_year_id: "desc" },
          select: { class_id: true },
        });
        if (cls) class_id = cls.class_id;
      }

      const parents = [];
      if (p1_name)
        parents.push({
          full_name: p1_name,
          relationship: p1_rel,
          phone: p1_phone,
        });
      if (p2_name)
        parents.push({
          full_name: p2_name,
          relationship: p2_rel,
          phone: p2_phone,
        });

      const student = await create(
        {
          full_name,
          date_of_birth: dob,
          gender,
          grade_level,
          class_id,
          current_address,
          parents,
        },
        actorId,
      );
      created.push({
        row: i,
        student_id: student.student_id,
        full_name: student.full_name,
      });
    } catch (e) {
      errors.push({ row: i, message: e.message });
    }
  }

  return {
    success_count: created.length,
    error_count: errors.length,
    created,
    errors,
  };
}

export async function exportExcel(filter) {
  const where = { deleted_at: null };
  if (filter.class_id || filter.school_year_id) {
    where.student_classes = {
      some: {
        left_date: null,
        ...(filter.class_id ? { class_id: filter.class_id } : {}),
        ...(filter.school_year_id
          ? { class: { school_year_id: filter.school_year_id } }
          : {}),
      },
    };
  }

  const students = await prisma.student.findMany({
    where,
    include: {
      student_parents: { include: { parent: true } },
      student_classes: {
        where: { left_date: null },
        include: {
          class: { include: { school_year: { select: { name: true } } } },
        },
      },
    },
    orderBy: { full_name: "asc" },
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Học sinh");
  ws.columns = [
    { header: "Mã thẻ HS", key: "card", width: 14 },
    { header: "Họ tên", key: "name", width: 25 },
    { header: "Ngày sinh", key: "dob", width: 12 },
    { header: "Giới tính", key: "gender", width: 10 },
    { header: "Khối", key: "grade", width: 10 },
    { header: "Lớp", key: "class", width: 12 },
    { header: "Năm học", key: "year", width: 12 },
    { header: "Địa chỉ", key: "address", width: 35 },
    { header: "PH 1 - Họ tên", key: "p1_name", width: 25 },
    { header: "PH 1 - Quan hệ", key: "p1_rel", width: 12 },
    { header: "PH 1 - SĐT", key: "p1_phone", width: 15 },
    { header: "PH 2 - Họ tên", key: "p2_name", width: 25 },
    { header: "PH 2 - Quan hệ", key: "p2_rel", width: 12 },
    { header: "PH 2 - SĐT", key: "p2_phone", width: 15 },
  ];
  ws.getRow(1).font = { bold: true };

  for (const s of students) {
    const sc = s.student_classes[0];
    const p1 = s.student_parents[0]?.parent;
    const p2 = s.student_parents[1]?.parent;
    ws.addRow({
      card: s.student_id_card_number,
      name: s.full_name,
      dob: s.date_of_birth.toISOString().slice(0, 10),
      gender: s.gender,
      grade: s.grade_level ?? "",
      class: sc?.class.class_name ?? "",
      year: sc?.class.school_year.name ?? "",
      address: s.current_address ?? "",
      p1_name: p1?.full_name ?? "",
      p1_rel: p1?.relationship ?? "",
      p1_phone: p1?.phone ?? "",
      p2_name: p2?.full_name ?? "",
      p2_rel: p2?.relationship ?? "",
      p2_phone: p2?.phone ?? "",
    });
  }

  const arr = await wb.xlsx.writeBuffer();
  return Buffer.from(arr);
}
