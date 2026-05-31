import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

function defaultParentPassword(card) {
  return `${card}@123`;
}

async function main() {
  console.log('🌱 Seeding database...');

  const [bgh, gv, ph] = await Promise.all([
    prisma.role.upsert({
      where: { role_name: 'BGH' },
      update: {},
      create: { role_name: 'BGH', description: 'Ban Giám Hiệu — toàn quyền' },
    }),
    prisma.role.upsert({
      where: { role_name: 'GV' },
      update: {},
      create: { role_name: 'GV', description: 'Giáo viên — quản lý lớp được phân công' },
    }),
    prisma.role.upsert({
      where: { role_name: 'PH' },
      update: {},
      create: { role_name: 'PH', description: 'Phụ huynh — đăng nhập bằng mã thẻ HS' },
    }),
  ]);
  console.log(`  ✓ Roles: ${bgh.role_name}, ${gv.role_name}, ${ph.role_name}`);

  // Admin
  const email = process.env.SEED_ADMIN_EMAIL ?? 'phanthihoa@edu.vn';
  const phone = process.env.SEED_ADMIN_PHONE ?? null;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Hoa@12345';
  const password_hash = await bcrypt.hash(adminPassword, 12);

  await prisma.account.upsert({
    where: { email },
    update: { password_hash, deleted_at: null, is_active: true },
    create: {
      email,
      phone,
      password_hash,
      full_name: 'Phan Thị Hoà',
      role_id: bgh.role_id,
      position: 'Hiệu trưởng',
      is_active: true,
    },
  });
  console.log(`  ✓ Admin: ${email} / mật khẩu: ${adminPassword}`);

  // Backfill student default passwords (HS chưa có password_hash)
  const students = await prisma.student.findMany({
    where: { password_hash: null, deleted_at: null },
    select: { student_id: true, student_id_card_number: true },
  });
  for (const s of students) {
    const hash = await bcrypt.hash(defaultParentPassword(s.student_id_card_number), 12);
    await prisma.student.update({
      where: { student_id: s.student_id },
      data: { password_hash: hash },
    });
  }
  if (students.length) console.log(`  ✓ Backfilled ${students.length} student PH passwords`);

  // Backfill existing accounts (GV) with null password_hash → set default
  const accountsNoPw = await prisma.account.findMany({
    where: { password_hash: null, deleted_at: null, NOT: { email } },
    select: { account_id: true, email: true },
  });
  for (const a of accountsNoPw) {
    const hash = await bcrypt.hash('changeme@123', 12);
    await prisma.account.update({
      where: { account_id: a.account_id },
      data: { password_hash: hash },
    });
    console.log(`  ✓ Reset ${a.email} → mật khẩu mặc định: changeme@123`);
  }

  console.log('✅ Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
