import prisma from '../config/prisma.js';

/**
 * Accent-insensitive + case-insensitive search using PostgreSQL unaccent.
 * Returns array of matching IDs for the given table/column(s).
 *
 * @param {string} table      - table name (e.g. 'teachers')
 * @param {string} idCol      - primary key column (e.g. 'teacher_id')
 * @param {string[]} cols     - columns to search (e.g. ['full_name', 'email'])
 * @param {string} term       - search term
 * @returns {Promise<number[]>}
 */
export async function searchIds(table, idCol, cols, term) {
  if (!term?.trim()) return null;
  const pattern = `%${term.trim()}%`;
  const conditions = cols
    .map((c) => `unaccent(lower("${c}")) LIKE unaccent(lower($1))`)
    .join(' OR ');
  const sql = `SELECT "${idCol}" FROM "${table}" WHERE ${conditions}`;
  const rows = await prisma.$queryRawUnsafe(sql, pattern);
  return rows.map((r) => Number(r[idCol]));
}
