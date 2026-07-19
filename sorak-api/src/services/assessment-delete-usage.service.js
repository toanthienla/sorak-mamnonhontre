import prisma from '../config/prisma.js';

function assertSafeIdentifier(value) {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) {
    throw new Error('Unsafe database identifier');
  }
}

async function columnExists(table, column) {
  const rows = await prisma.$queryRaw`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ${table}
        AND column_name = ${column}
    ) AS "exists"
  `;
  return Boolean(rows[0]?.exists);
}

async function countColumnReferences(table, column, id) {
  assertSafeIdentifier(table);
  assertSafeIdentifier(column);

  if (!(await columnExists(table, column))) return 0;

  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS count FROM public.${table} WHERE ${column} = $1`,
    id,
  );
  return Number(rows[0]?.count ?? 0);
}

export async function countReferences(checks, id) {
  const results = [];

  for (const check of checks) {
    const count = await countColumnReferences(check.table, check.column, id);
    if (count > 0) {
      results.push({ ...check, count });
    }
  }

  return results;
}
