/**
 * seed-demo.js — Demo data: 2 academic years, classes, teachers, students, parents
 * Run: node prisma/seed-demo.js
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

function makeCard(fullName, year, seq) {
  const parts = fullName.trim().split(/\s+/);
  const initials = parts.map((p) => (p[0] ?? '').toUpperCase()).join('');
  return `${initials}${year}.${String(seq).padStart(3, '0')}`;
}

function defaultParentPassword(card) {
  return `${card}@123`;
}

// ─── DATA ────────────────────────────────────────────────────────────────────

const YEARS = [
  {
    name: '2024-2025',
    start_date: new Date('2024-09-01'),
    end_date: new Date('2025-05-31'),
    status: 'active',
    semesters: [
      { semester_number: 1, start_date: new Date('2024-09-01'), end_date: new Date('2025-01-19') },
      { semester_number: 2, start_date: new Date('2025-01-20'), end_date: new Date('2025-05-31') },
    ],
  },
  {
    name: '2025-2026',
    start_date: new Date('2025-09-01'),
    end_date: new Date('2026-05-31'),
    status: 'upcoming',
    semesters: [
      { semester_number: 1, start_date: new Date('2025-09-01'), end_date: new Date('2026-01-18') },
      { semester_number: 2, start_date: new Date('2026-01-19'), end_date: new Date('2026-05-31') },
    ],
  },
];

// Classes per age group (created in both years)
const CLASS_TEMPLATES = [
  { class_name: 'Nhà trẻ 1', age_group: 'Nhà trẻ', room: 'P.101' },
  { class_name: 'Nhà trẻ 2', age_group: 'Nhà trẻ', room: 'P.102' },
  { class_name: 'Mầm 1',     age_group: 'Mầm',     room: 'P.201' },
  { class_name: 'Mầm 2',     age_group: 'Mầm',     room: 'P.202' },
  { class_name: 'Chồi 1',    age_group: 'Chồi',    room: 'P.301' },
  { class_name: 'Chồi 2',    age_group: 'Chồi',    room: 'P.302' },
  { class_name: 'Lá 1',      age_group: 'Lá',      room: 'P.401' },
  { class_name: 'Lá 2',      age_group: 'Lá',      room: 'P.402' },
];

// Staff (position set = cán bộ)
const TEACHERS = [
  { full_name: 'Đặng Thị Linh',   email: 'linhdt@edu.vn',   position: 'Hiệu phó',  gender: 'Nữ',  qualification: 'Thạc sĩ Giáo dục Mầm non', role: 'BGH' },
  { full_name: 'Nguyễn Thị Mai',  email: 'maint@edu.vn',    position: 'Giáo viên', gender: 'Nữ',  qualification: 'Đại học Sư phạm Mầm non',   role: 'GV' },
  { full_name: 'Trần Văn Hùng',   email: 'hungtv@edu.vn',   position: 'Giáo viên', gender: 'Nam', qualification: 'Đại học Sư phạm Mầm non',   role: 'GV' },
  { full_name: 'Lê Thị Lan',      email: 'lantl@edu.vn',    position: 'Giáo viên', gender: 'Nữ',  qualification: 'Cao đẳng Sư phạm',          role: 'GV' },
  { full_name: 'Phạm Thị Hương',  email: 'huongpt@edu.vn',  position: 'Giáo viên', gender: 'Nữ',  qualification: 'Đại học Sư phạm Mầm non',   role: 'GV' },
  { full_name: 'Hoàng Văn Nam',   email: 'namhv@edu.vn',    position: 'Giáo viên', gender: 'Nam', qualification: 'Cao đẳng Sư phạm',          role: 'GV' },
  { full_name: 'Vũ Thị Thu',      email: 'thuvt@edu.vn',    position: 'Giáo viên', gender: 'Nữ',  qualification: 'Đại học Sư phạm Mầm non',   role: 'GV' },
  { full_name: 'Bùi Thị Nga',     email: 'ngabt@edu.vn',    position: 'Giáo viên', gender: 'Nữ',  qualification: 'Cao đẳng Sư phạm',          role: 'GV' },
];

// Homeroom assignments: class_name → teacher email (for 2024-2025)
const HOMEROOM_2425 = {
  'Nhà trẻ 1': 'maint@edu.vn',
  'Nhà trẻ 2': 'hungtv@edu.vn',
  'Mầm 1':     'lantl@edu.vn',
  'Mầm 2':     'huongpt@edu.vn',
  'Chồi 1':    'namhv@edu.vn',
  'Chồi 2':    'thuvt@edu.vn',
  'Lá 1':      'ngabt@edu.vn',
  'Lá 2':      'maint@edu.vn',
};

// Students per class (for 2024-2025). Each entry: { full_name, dob, gender, parent }
const STUDENTS_BY_CLASS = {
  'Nhà trẻ 1': [
    { full_name: 'Nguyễn Bảo An',   dob: '2022-03-15', gender: 'Nam', parent: { full_name: 'Nguyễn Văn Toàn',   relationship: 'Cha', phone: '0901234001' } },
    { full_name: 'Trần Minh Khôi',  dob: '2022-06-20', gender: 'Nam', parent: { full_name: 'Trần Thị Phương',   relationship: 'Mẹ',  phone: '0901234002' } },
    { full_name: 'Lê Thị Ngọc',     dob: '2022-01-10', gender: 'Nữ',  parent: { full_name: 'Lê Văn Hải',        relationship: 'Cha', phone: '0901234003' } },
    { full_name: 'Phạm Gia Huy',    dob: '2022-08-05', gender: 'Nam', parent: { full_name: 'Phạm Thị Nhung',    relationship: 'Mẹ',  phone: '0901234004' } },
    { full_name: 'Hoàng Thị Mai',   dob: '2022-11-22', gender: 'Nữ',  parent: { full_name: 'Hoàng Văn Đức',     relationship: 'Cha', phone: '0901234005' } },
  ],
  'Nhà trẻ 2': [
    { full_name: 'Vũ Trà My',       dob: '2022-04-18', gender: 'Nữ',  parent: { full_name: 'Vũ Văn Khánh',      relationship: 'Cha', phone: '0901234006' } },
    { full_name: 'Đỗ Thiên Bảo',    dob: '2022-07-09', gender: 'Nam', parent: { full_name: 'Đỗ Thị Hoa',        relationship: 'Mẹ',  phone: '0901234007' } },
    { full_name: 'Ngô Kim Ngân',    dob: '2022-02-14', gender: 'Nữ',  parent: { full_name: 'Ngô Văn Bình',      relationship: 'Cha', phone: '0901234008' } },
    { full_name: 'Bùi Gia Phúc',    dob: '2022-09-30', gender: 'Nam', parent: { full_name: 'Bùi Thị Lan',       relationship: 'Mẹ',  phone: '0901234009' } },
    { full_name: 'Phan Thị Quỳnh',  dob: '2022-12-01', gender: 'Nữ',  parent: { full_name: 'Phan Văn Minh',     relationship: 'Cha', phone: '0901234010' } },
  ],
  'Mầm 1': [
    { full_name: 'Đinh Trọng Nghĩa', dob: '2021-04-12', gender: 'Nam', parent: { full_name: 'Đinh Văn Sơn',     relationship: 'Cha', phone: '0901234011' } },
    { full_name: 'Lý Thị Lan',       dob: '2021-07-30', gender: 'Nữ',  parent: { full_name: 'Lý Văn Tài',       relationship: 'Cha', phone: '0901234012' } },
    { full_name: 'Tạ Quốc Bảo',      dob: '2021-02-18', gender: 'Nam', parent: { full_name: 'Tạ Thị Huệ',       relationship: 'Mẹ',  phone: '0901234013' } },
    { full_name: 'Cao Thị Hà',       dob: '2021-09-14', gender: 'Nữ',  parent: { full_name: 'Cao Văn Hùng',     relationship: 'Cha', phone: '0901234014' } },
    { full_name: 'Dương Minh Tuấn',  dob: '2021-12-03', gender: 'Nam', parent: { full_name: 'Dương Thị Yến',    relationship: 'Mẹ',  phone: '0901234015' } },
  ],
  'Mầm 2': [
    { full_name: 'Trịnh Thị Trang',  dob: '2021-05-25', gender: 'Nữ',  parent: { full_name: 'Trịnh Văn Cường',  relationship: 'Cha', phone: '0901234016' } },
    { full_name: 'Hà Minh Đức',      dob: '2021-08-11', gender: 'Nam', parent: { full_name: 'Hà Thị Thu',       relationship: 'Mẹ',  phone: '0901234017' } },
    { full_name: 'Mai Thị Kim',       dob: '2021-03-07', gender: 'Nữ',  parent: { full_name: 'Mai Văn Long',     relationship: 'Cha', phone: '0901234018' } },
    { full_name: 'Lưu Văn Dũng',     dob: '2021-10-19', gender: 'Nam', parent: { full_name: 'Lưu Thị Hồng',     relationship: 'Mẹ',  phone: '0901234019' } },
    { full_name: 'Đào Thị Phương',   dob: '2021-01-28', gender: 'Nữ',  parent: { full_name: 'Đào Văn Tuấn',     relationship: 'Cha', phone: '0901234020' } },
  ],
  'Chồi 1': [
    { full_name: 'Nguyễn Quốc Hải',  dob: '2020-06-14', gender: 'Nam', parent: { full_name: 'Nguyễn Văn Hiếu',  relationship: 'Cha', phone: '0901234021' } },
    { full_name: 'Trần Thị Thu',      dob: '2020-09-22', gender: 'Nữ',  parent: { full_name: 'Trần Văn Phúc',   relationship: 'Cha', phone: '0901234022' } },
    { full_name: 'Lê Văn Bình',       dob: '2020-04-08', gender: 'Nam', parent: { full_name: 'Lê Thị Diệu',     relationship: 'Mẹ',  phone: '0901234023' } },
    { full_name: 'Phạm Thị Thảo',    dob: '2020-11-30', gender: 'Nữ',  parent: { full_name: 'Phạm Văn Khải',   relationship: 'Cha', phone: '0901234024' } },
    { full_name: 'Hoàng Minh Hiếu',  dob: '2020-02-15', gender: 'Nam', parent: { full_name: 'Hoàng Thị Linh',  relationship: 'Mẹ',  phone: '0901234025' } },
  ],
  'Chồi 2': [
    { full_name: 'Vũ Thị Quỳnh',     dob: '2020-07-20', gender: 'Nữ',  parent: { full_name: 'Vũ Văn Dũng',     relationship: 'Cha', phone: '0901234026' } },
    { full_name: 'Đỗ Hữu Nghĩa',     dob: '2020-10-05', gender: 'Nam', parent: { full_name: 'Đỗ Thị Nga',      relationship: 'Mẹ',  phone: '0901234027' } },
    { full_name: 'Ngô Thị Hà',       dob: '2020-03-17', gender: 'Nữ',  parent: { full_name: 'Ngô Văn Nam',     relationship: 'Cha', phone: '0901234028' } },
    { full_name: 'Bùi Văn Thắng',    dob: '2020-08-29', gender: 'Nam', parent: { full_name: 'Bùi Thị Mai',     relationship: 'Mẹ',  phone: '0901234029' } },
    { full_name: 'Phan Thị Ngọc',    dob: '2020-12-11', gender: 'Nữ',  parent: { full_name: 'Phan Văn Hùng',   relationship: 'Cha', phone: '0901234030' } },
  ],
  'Lá 1': [
    { full_name: 'Đinh Văn Toàn',    dob: '2019-05-02', gender: 'Nam', parent: { full_name: 'Đinh Thị Lan',    relationship: 'Mẹ',  phone: '0901234031' } },
    { full_name: 'Lý Thị Hương',     dob: '2019-08-18', gender: 'Nữ',  parent: { full_name: 'Lý Văn Tùng',    relationship: 'Cha', phone: '0901234032' } },
    { full_name: 'Tạ Minh Khoa',     dob: '2019-03-25', gender: 'Nam', parent: { full_name: 'Tạ Thị Vân',     relationship: 'Mẹ',  phone: '0901234033' } },
    { full_name: 'Cao Thị Linh',     dob: '2019-10-07', gender: 'Nữ',  parent: { full_name: 'Cao Văn Sáng',   relationship: 'Cha', phone: '0901234034' } },
    { full_name: 'Dương Văn Khải',   dob: '2019-01-14', gender: 'Nam', parent: { full_name: 'Dương Thị Hoa',  relationship: 'Mẹ',  phone: '0901234035' } },
  ],
  'Lá 2': [
    { full_name: 'Trịnh Thị Kim',    dob: '2019-06-11', gender: 'Nữ',  parent: { full_name: 'Trịnh Văn Tài',  relationship: 'Cha', phone: '0901234036' } },
    { full_name: 'Hà Quốc Tuấn',     dob: '2019-09-03', gender: 'Nam', parent: { full_name: 'Hà Thị Xuân',   relationship: 'Mẹ',  phone: '0901234037' } },
    { full_name: 'Mai Thị Phúc',     dob: '2019-04-22', gender: 'Nữ',  parent: { full_name: 'Mai Văn Bảo',   relationship: 'Cha', phone: '0901234038' } },
    { full_name: 'Lưu Văn Hải',      dob: '2019-11-16', gender: 'Nam', parent: { full_name: 'Lưu Thị Thu',   relationship: 'Mẹ',  phone: '0901234039' } },
    { full_name: 'Đào Thị Trang',    dob: '2019-02-08', gender: 'Nữ',  parent: { full_name: 'Đào Văn Minh',  relationship: 'Cha', phone: '0901234040' } },
  ],
};

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding demo data...\n');

  // 1. Roles (ensure exist)
  const [bghRole, gvRole] = await Promise.all([
    prisma.role.upsert({ where: { role_name: 'BGH' }, update: {}, create: { role_name: 'BGH', description: 'Ban Giám Hiệu' } }),
    prisma.role.upsert({ where: { role_name: 'GV' },  update: {}, create: { role_name: 'GV',  description: 'Giáo viên' } }),
  ]);

  // 2. Teachers
  console.log('👩‍🏫 Creating teachers...');
  const teacherMap = {}; // email → account_id
  for (const t of TEACHERS) {
    const role = t.role === 'BGH' ? bghRole : gvRole;
    const password_hash = await bcrypt.hash('changeme@123', 12);
    const acc = await prisma.account.upsert({
      where: { email: t.email },
      update: { full_name: t.full_name, position: t.position, role_id: role.role_id, is_active: true },
      create: {
        email: t.email,
        full_name: t.full_name,
        position: t.position,
        gender: t.gender,
        qualification: t.qualification,
        role_id: role.role_id,
        password_hash,
        is_active: true,
      },
    });
    teacherMap[t.email] = acc.account_id;
    console.log(`  ✓ ${t.full_name} (${t.position}) — ${t.email} / changeme@123`);
  }

  // 3. Wipe all existing classes (students + teacher assignments cascade via service logic)
  console.log('\n🧹 Cleaning existing classes...');
  const existingClasses = await prisma.class.findMany({ select: { class_id: true } });
  for (const c of existingClasses) {
    await prisma.studentClass.deleteMany({ where: { class_id: c.class_id } });
    await prisma.teacherClass.deleteMany({ where: { class_id: c.class_id } });
  }
  await prisma.class.deleteMany({});
  // Also wipe students (demo reset)
  const existingStudents = await prisma.student.findMany({ select: { student_id: true } });
  for (const s of existingStudents) {
    await prisma.studentParent.deleteMany({ where: { student_id: s.student_id } });
  }
  await prisma.student.deleteMany({});
  await prisma.parent.deleteMany({});
  console.log(`  ✓ Cleared ${existingClasses.length} classes, ${existingStudents.length} students`);

  // Academic years + semesters + classes
  console.log('\n📅 Creating academic years & classes...');
  const classMap = {}; // `${year_name}:${class_name}` → class_id

  for (const yr of YEARS) {
    // unique constraint on status — clear conflicts first
    await prisma.schoolYear.updateMany({
      where: { status: yr.status, name: { not: yr.name } },
      data: { status: 'upcoming' },
    });

    const schoolYear = await prisma.schoolYear.upsert({
      where: { name: yr.name },
      update: { status: yr.status },
      create: { name: yr.name, start_date: yr.start_date, end_date: yr.end_date, status: yr.status },
    });
    console.log(`\n  📆 ${yr.name} (${yr.status})`);

    // Semesters
    for (const sem of yr.semesters) {
      await prisma.semester.upsert({
        where: { school_year_id_semester_number: { school_year_id: schoolYear.school_year_id, semester_number: sem.semester_number } },
        update: {},
        create: { school_year_id: schoolYear.school_year_id, ...sem },
      });
    }

    // Classes
    for (const tpl of CLASS_TEMPLATES) {
      const existing = await prisma.class.findFirst({
        where: { class_name: tpl.class_name, school_year_id: schoolYear.school_year_id, deleted_at: null },
      });
      const cls = existing ?? await prisma.class.create({
        data: { class_name: tpl.class_name, age_group: tpl.age_group, room: tpl.room, school_year_id: schoolYear.school_year_id },
      });
      classMap[`${yr.name}:${tpl.class_name}`] = cls.class_id;
      console.log(`    + ${tpl.class_name} (${tpl.age_group}) — ${tpl.room ?? '?'}`);
    }
  }

  // 4. Assign homeroom teachers to 2024-2025 classes
  console.log('\n🏫 Assigning homeroom teachers (2024-2025)...');
  for (const [className, email] of Object.entries(HOMEROOM_2425)) {
    const classId = classMap[`2024-2025:${className}`];
    const accountId = teacherMap[email];
    if (!classId || !accountId) continue;

    // Remove old homeroom assignments for this class
    await prisma.teacherClass.updateMany({
      where: { class_id: classId, is_homeroom: true, removed_at: null },
      data: { removed_at: new Date() },
    });

    await prisma.teacherClass.upsert({
      where: { account_id_class_id: { account_id: accountId, class_id: classId } },
      update: { is_homeroom: true, removed_at: null },
      create: { account_id: accountId, class_id: classId, is_homeroom: true },
    });
    const teacher = TEACHERS.find((t) => t.email === email);
    console.log(`  ✓ ${className} ← ${teacher?.full_name}`);
  }

  // 5. Students (2024-2025 only)
  console.log('\n👦 Creating students (2024-2025)...');
  let seq = 1;

  for (const [className, students] of Object.entries(STUDENTS_BY_CLASS)) {
    const classId = classMap[`2024-2025:${className}`];
    console.log(`\n  📚 ${className}`);

    for (const s of students) {
      const card = makeCard(s.full_name, 2024, seq++);
      const password_hash = await bcrypt.hash(defaultParentPassword(card), 12);

      const student = await prisma.student.upsert({
        where: { student_id_card_number: card },
        update: {},
        create: {
          student_id_card_number: card,
          full_name: s.full_name,
          date_of_birth: new Date(s.dob),
          gender: s.gender,
          grade_level: CLASS_TEMPLATES.find((c) => c.class_name === className)?.age_group ?? null,
          enrollment_date: new Date('2024-09-01'),
          password_hash,
          student_status: 'Đang học',
          is_active: true,
        },
      });

      // Enroll in class if not already
      const enrolled = await prisma.studentClass.findFirst({
        where: { student_id: student.student_id, class_id: classId, left_date: null },
      });
      if (!enrolled) {
        await prisma.studentClass.create({
          data: { student_id: student.student_id, class_id: classId, enrolled_date: new Date('2024-09-01') },
        });
      }

      // Parent
      const existingParents = await prisma.studentParent.findMany({
        where: { student_id: student.student_id },
      });
      if (existingParents.length === 0) {
        const parent = await prisma.parent.create({
          data: {
            full_name: s.parent.full_name,
            relationship: s.parent.relationship,
            phone: s.parent.phone,
          },
        });
        await prisma.studentParent.create({
          data: { student_id: student.student_id, parent_id: parent.parent_id, is_primary_contact: true },
        });
      }

      console.log(`    ✓ ${s.full_name} [${card}] — PH mặc định: ${defaultParentPassword(card)}`);
    }
  }

  console.log('\n✅ Demo seed complete!');
  console.log('   Tài khoản giáo viên: changeme@123');
  console.log('   Tài khoản phụ huynh: <mã_thẻ>@123');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
