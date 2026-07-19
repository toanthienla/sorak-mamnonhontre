export const BASE_THEME_NAMES = [
  'Trường mầm non',
  'Bản thân',
  'Gia đình',
  'Ngành nghề',
  'Động vật',
  'Thực vật',
  'Phương tiện và luật giao thông',
  'Hiện tượng tự nhiên',
  'Quê hương - Đất nước - Bác Hồ',
  'Trường tiểu học',
];

const LEGACY_THEME_ALIASES = new Map([['nghề nghiệp', 'ngành nghề']]);

export function normalizeThemeName(value) {
  const normalized = String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('vi-VN');
  return LEGACY_THEME_ALIASES.get(normalized) ?? normalized;
}

export function getBaseThemeName(value) {
  const normalized = normalizeThemeName(value);
  return BASE_THEME_NAMES.find((name) => normalizeThemeName(name) === normalized) ?? null;
}

export async function initializeBaseThemes(tx, subjectId) {
  for (const name of BASE_THEME_NAMES) {
    await tx.$executeRaw`
      INSERT INTO assessment_themes (assessment_subject_id, name, is_active, created_at, updated_at)
      SELECT ${Number(subjectId)}, ${name}, true, NOW(), NOW()
      WHERE NOT EXISTS (
        SELECT 1
        FROM assessment_themes
        WHERE assessment_subject_id = ${Number(subjectId)}
          AND deleted_at IS NULL
          AND LOWER(BTRIM(name)) = LOWER(BTRIM(${name}))
      )
    `;
  }
}
