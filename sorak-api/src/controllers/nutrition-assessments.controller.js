import * as svc from '../services/nutrition-assessments.service.js';

export async function grid(req, res) {
  res.success(await svc.grid(req.query, req.user));
}

export async function gridAll(req, res) {
  res.success(await svc.gridAll(req.query, req.user));
}
