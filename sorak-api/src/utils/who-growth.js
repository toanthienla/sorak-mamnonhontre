// WHO growth evaluation engine — BR-097..099, BR-108..110, BR-117
// LMS data: WHO Child Growth Standards (0-60m) + WHO 2007 Reference (61m+)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LMS = JSON.parse(readFileSync(path.join(__dirname, '../data/who-lms.json'), 'utf8'));

export const MIN_MONTHS = 24;
export const MAX_MONTHS = 72;

// Age in completed months at a given date
export function ageInMonths(dateOfBirth, atDate) {
  const dob = new Date(dateOfBirth);
  const at = new Date(atDate);
  let months = (at.getFullYear() - dob.getFullYear()) * 12 + (at.getMonth() - dob.getMonth());
  if (at.getDate() < dob.getDate()) months -= 1;
  return months;
}

// BR-099: BMI = kg / m²
export function calcBmi(weightKg, heightCm) {
  if (!weightKg || !heightCm) return null;
  const h = heightCm / 100;
  return Math.round((weightKg / (h * h)) * 100) / 100;
}

// LMS z-score: ((value/M)^L - 1) / (L*S), or ln(value/M)/S when L=0
function lmsZ(value, { l, m, s }) {
  const z = l !== 0 ? (Math.pow(value / m, l) - 1) / (l * s) : Math.log(value / m) / s;
  return Math.round(z * 100) / 100;
}

function refFor(indicator, gender, months) {
  const sexKey = gender === 'Nam' ? 'male' : gender === 'Nữ' ? 'female' : null;
  if (!sexKey) return null;
  const clamped = Math.min(Math.max(months, MIN_MONTHS), MAX_MONTHS);
  return LMS.indicators[indicator]?.[sexKey]?.[clamped] ?? null;
}

// Vietnamese classifications per WHO cutoffs
function classifyWeight(z) {
  if (z == null) return null;
  if (z < -3) return 'SDD nặng (nhẹ cân)';
  if (z < -2) return 'Suy dinh dưỡng (nhẹ cân)';
  if (z > 2) return 'Cân nặng cao so với tuổi';
  return 'Bình thường';
}

function classifyHeight(z) {
  if (z == null) return null;
  if (z < -3) return 'Thấp còi nặng';
  if (z < -2) return 'Thấp còi';
  if (z > 2) return 'Cao so với tuổi';
  return 'Bình thường';
}

// Under-5 cutoffs: >+2 thừa cân, >+3 béo phì; from 61 months (WHO 2007): >+1, >+2
function classifyBmi(z, months) {
  if (z == null) return null;
  const over = months > 60 ? 1 : 2;
  const obese = months > 60 ? 2 : 3;
  if (z < -3) return 'Gầy còm nặng';
  if (z < -2) return 'Gầy còm';
  if (z > obese) return 'Béo phì';
  if (z > over) return 'Thừa cân';
  return 'Bình thường';
}

// Full evaluation for one measurement. Returns null fields when data missing.
export function evaluateGrowth({ gender, dateOfBirth, assessmentDate, heightCm, weightKg }) {
  const months = ageInMonths(dateOfBirth, assessmentDate);
  const bmi = calcBmi(weightKg, heightCm);

  const result = {
    age_months: months,
    bmi,
    bmi_z: null,
    height_z: null,
    weight_z: null,
    bmi_status: null,
    height_status: null,
    weight_status: null,
  };

  if (heightCm) {
    const ref = refFor('height', gender, months);
    if (ref) {
      result.height_z = lmsZ(heightCm, ref);
      result.height_status = classifyHeight(result.height_z);
    }
  }
  if (weightKg) {
    const ref = refFor('weight', gender, months);
    if (ref) {
      result.weight_z = lmsZ(weightKg, ref);
      result.weight_status = classifyWeight(result.weight_z);
    }
  }
  if (bmi) {
    const ref = refFor('bmi', gender, months);
    if (ref) {
      result.bmi_z = lmsZ(bmi, ref);
      result.bmi_status = classifyBmi(result.bmi_z, months);
    }
  }
  return result;
}

// BR-117: suggested nutrition status from growth indicators
// Priority: Béo phì > Thừa cân > Suy dinh dưỡng > Bình thường
export function suggestNutritionStatus({ bmi_status, weight_status, height_status }) {
  if (!bmi_status && !weight_status && !height_status) return null;
  if (bmi_status === 'Béo phì') return 'Béo phì';
  if (bmi_status === 'Thừa cân') return 'Thừa cân';
  const under =
    bmi_status?.startsWith('Gầy còm') ||
    weight_status?.includes('nhẹ cân') ||
    weight_status?.startsWith('SDD') ||
    height_status?.startsWith('Thấp còi');
  if (under) return 'Suy dinh dưỡng';
  return 'Bình thường';
}

export const FINAL_NUTRITION_STATUSES = ['Bình thường', 'Suy dinh dưỡng', 'Thừa cân', 'Béo phì'];

// WHO reference curves for charts: returns [{month, sd3neg, sd2neg, median, sd2, sd3}]
export function referenceCurves(indicator, gender) {
  const sexKey = gender === 'Nam' ? 'male' : 'female';
  const table = LMS.indicators[indicator]?.[sexKey] ?? {};
  const valueAtZ = ({ l, m, s }, z) =>
    l !== 0 ? m * Math.pow(1 + l * s * z, 1 / l) : m * Math.exp(s * z);
  return Object.entries(table).map(([month, ref]) => ({
    month: Number(month),
    sd3neg: Math.round(valueAtZ(ref, -3) * 10) / 10,
    sd2neg: Math.round(valueAtZ(ref, -2) * 10) / 10,
    median: Math.round(valueAtZ(ref, 0) * 10) / 10,
    sd2: Math.round(valueAtZ(ref, 2) * 10) / 10,
    sd3: Math.round(valueAtZ(ref, 3) * 10) / 10,
  }));
}
