import * as svc from '../services/health-assessments.service.js';

export async function create(req, res) {
  res.success(await svc.create(req.body, req.user));
}
