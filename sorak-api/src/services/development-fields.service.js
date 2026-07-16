import prisma from '../config/prisma.js';

const SELECT = {
  development_field_id: true,
  code: true,
  name_en: true,
  name_vi: true,
  display_order: true,
};

export function findAll() {
  return prisma.developmentField.findMany({
    where: { deleted_at: null },
    select: SELECT,
    orderBy: { display_order: 'asc' },
  });
}
