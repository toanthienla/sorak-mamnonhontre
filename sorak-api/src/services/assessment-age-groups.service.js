import prisma from '../config/prisma.js';

const SELECT = {
  assessment_age_group_id: true,
  code: true,
  name_en: true,
  name_vi: true,
  class_group_label: true,
  display_order: true,
};

export function findAll() {
  return prisma.assessmentAgeGroup.findMany({
    where: { deleted_at: null },
    select: SELECT,
    orderBy: { display_order: 'asc' },
  });
}
