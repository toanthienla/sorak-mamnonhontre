// One-off seed: health (monthly) + nutrition (cuối kỳ 1 + cuối năm) for ~90% students of class "Mầm 1".
// Run on the server: node --env-file=.env seed-health-mam1.mjs
import prisma from './src/config/prisma.js';
import { evaluateGrowth, referenceCurves } from './src/utils/who-growth.js';

const CLASS_NAME = 'Mầm 1';
const PICK_RATIO = 0.9;

// Pick the most recent class named "Mầm 1" (by school_year start)
const cls = await prisma.class.findFirst({
  where: { class_name: CLASS_NAME, deleted_at: null },
  include: { school_year: true },
  orderBy: { school_year: { start_date: 'desc' } },
});
if (!cls) {
  console.log(`Class "${CLASS_NAME}" not found`);
  process.exit(1);
}
const yid = cls.school_year_id;
const start = new Date(cls.school_year.start_date),
  end = new Date(cls.school_year.end_date);
console.log(`Class "${CLASS_NAME}" #${cls.class_id}, year ${cls.school_year.name} (id ${yid})`);

const enrollments = await prisma.studentEnrollment.findMany({
  where: { class_id: cls.class_id, school_year_id: yid, left_date: null },
  include: { student: true },
  orderBy: { student_id: 'asc' },
});
// Deterministic 90% pick (9 of every 10)
const picked = enrollments.filter((e, i) => i % 10 < 9);
console.log(`${enrollments.length} enrolled, picking ${picked.length} (${PICK_RATIO * 100}%)`);

// Monthly assessment dates (15th of each month within [start,end], not after today)
const today = new Date();
const cap = end < today ? end : today;
const months = [];
let d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 15));
while (d <= cap) {
  if (d >= start) months.push(new Date(d));
  d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 15));
}
console.log(`${months.length} monthly dates`);

const rng = (s) => {
  let x = Math.sin(s) * 10000;
  return x - Math.floor(x);
};

let hCount = 0,
  nCount = 0;
for (const e of picked) {
  const s = e.student;
  const gender = s.gender === 'Nam' || s.gender === 'Nữ' ? s.gender : 'Nam';
  const hCurve = referenceCurves('height', gender);
  const wCurve = referenceCurves('weight', gender);
  const ageM = (at) => {
    const b = new Date(s.date_of_birth);
    let m = (at.getUTCFullYear() - b.getUTCFullYear()) * 12 + (at.getUTCMonth() - b.getUTCMonth());
    if (at.getUTCDate() < b.getUTCDate()) m -= 1;
    return Math.min(72, Math.max(24, m));
  };
  const bias = rng(s.student_id) < 0.15 ? -0.12 : rng(s.student_id) > 0.85 ? 0.12 : 0;

  let lastGrowth = null;
  for (let mi = 0; mi < months.length; mi++) {
    const date = months[mi];
    const am = ageM(date);
    const hm = hCurve.find((c) => c.month === am)?.median ?? 100;
    const wm = wCurve.find((c) => c.month === am)?.median ?? 16;
    const jit = (rng(s.student_id * 100 + mi) - 0.5) * 0.05;
    const height_cm = Math.round(hm * (1 + bias * 0.4 + jit) * 10) / 10;
    const weight_kg = Math.round(wm * (1 + bias + jit) * 10) / 10;
    const g = evaluateGrowth({
      gender,
      dateOfBirth: s.date_of_birth,
      assessmentDate: date,
      heightCm: height_cm,
      weightKg: weight_kg,
    });
    lastGrowth = g;
    await prisma.healthAssessment.upsert({
      where: { student_id_assessment_date: { student_id: s.student_id, assessment_date: date } },
      update: {},
      create: {
        student_id: s.student_id,
        school_year_id: yid,
        class_id: cls.class_id,
        assessment_date: date,
        height_cm,
        weight_kg,
        bmi: g.bmi,
        bmi_z: g.bmi_z,
        height_z: g.height_z,
        weight_z: g.weight_z,
        bmi_status: g.bmi_status,
        height_status: g.height_status,
        weight_status: g.weight_status,
      },
    });
    hCount++;
  }

  const channel =
    lastGrowth?.bmi_status === 'Thừa cân'
      ? 'Cân nặng cao hơn tuổi'
      : lastGrowth?.weight_status?.includes('nhẹ cân') ||
          lastGrowth?.bmi_status?.startsWith('Gầy còm')
        ? 'Suy dinh dưỡng thể nhẹ cân'
        : null;
  const flags = {
    is_obese: lastGrowth?.bmi_status === 'Béo phì',
    is_stunting: lastGrowth?.height_status === 'Thấp còi',
    is_severe_stunting: lastGrowth?.height_status === 'Thấp còi nặng',
  };
  for (const period of ['cuoi_ky_1', 'cuoi_nam']) {
    await prisma.nutritionAssessment.upsert({
      where: {
        student_id_school_year_id_period: { student_id: s.student_id, school_year_id: yid, period },
      },
      update: {},
      create: {
        student_id: s.student_id,
        school_year_id: yid,
        class_id: cls.class_id,
        period,
        weight_channel: channel,
        ...flags,
      },
    });
    nCount++;
  }
}
console.log(
  `Done: ${hCount} health records (${months.length} months/student), ${nCount} nutrition records`,
);
await prisma.$disconnect();
