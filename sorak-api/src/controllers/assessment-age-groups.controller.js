import * as svc from '../services/assessment-age-groups.service.js';

export async function findAll(req, res) {
  res.success(await svc.findAll());
}
