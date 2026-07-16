import * as svc from '../services/development-fields.service.js';

export async function findAll(req, res) {
  res.success(await svc.findAll());
}
