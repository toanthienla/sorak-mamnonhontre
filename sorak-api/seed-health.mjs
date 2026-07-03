// One-off seed: health (monthly) + nutrition (cuối kỳ 1 + cuối kỳ 2) for ~60% students of 2025-2026.
// Run on the server: node --env-file=.env seed-health.mjs
import prisma from './src/config/prisma.js';
import { evaluateGrowth, referenceCurves, suggestNutritionStatus } from './src/utils/who-growth.js';

const YEAR_NAME = '2025-2026';
const PICK_RATIO = 0.6;

const year = await prisma.schoolYear.findFirst({ where: { name: YEAR_NAME } });
if (!year) {
  console.log('Year not found');
  process.exit(1);
}
const yid = year.school_year_id;
const start = new Date(year.start_date),
  end = new Date(year.end_date);

// Students with a class in this year
const enrollments = await prisma.studentEnrollment.findMany({
  where: { school_year_id: yid, left_date: null, class_id: { not: null } },
  include: { student: true },
});
// Deterministic 60% pick (every student, hash by id)
const picked = enrollments.filter((e, i) => i % 5 < 3); // 3/5 = 60%
console.log(
  `Year ${YEAR_NAME} (id ${yid}); ${enrollments.length} enrolled, picking ${picked.length}`,
);

// Monthly assessment dates within [start,end], 15th of each month, not after end
const months = [];
let d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 15));
while (d <= end) {
  if (d >= start) months.push(new Date(d));
  d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 15));
}

// pseudo-random but stable per (studentId, monthIndex)
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
  // bias per student: mostly normal, some under/over
  const bias = rng(s.student_id) < 0.15 ? -0.12 : rng(s.student_id) > 0.85 ? 0.12 : 0;

  let lastGrowth = null;
  for (let mi = 0; mi < months.length; mi++) {
    const date = months[mi];
    const am = ageM(date);
    const hm = hCurve.find((c) => c.month === am)?.median ?? 100;
    const wm = wCurve.find((c) => c.month === am)?.median ?? 16;
    const jit = (rng(s.student_id * 100 + mi) - 0.5) * 0.05; // ±2.5%
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
        class_id: e.class_id,
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

  // Nutrition: cuối kỳ 1 + cuối kỳ 2, derived from last growth
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
        class_id: e.class_id,
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
