/**
 * Format any date value to dd/mm/yyyy.
 * Accepts ISO string, Date object, or null/undefined.
 */
export function fmtDate(value) {
  if (!value) return '—';
  const s = typeof value === 'string' ? value : value.toISOString();
  const [y, m, d] = s.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}
