import * as svc from '../services/health-assessments.service.js';

export async function create(req, res) {
  res.success(await svc.create(req.body, req.user));
}

export async function findAll(req, res) {
  res.paginated(await svc.findAll(req.query, req.user));
}

export async function findOne(req, res) {
  res.success(await svc.findOne(Number(req.params.id), req.user));
}

export async function history(req, res) {
  res.success(await svc.history(req.query, req.user));
}

export async function curves(req, res) {
  res.success(svc.curves(req.query));
}

export async function bulkUpsert(req, res) {
  res.success(await svc.bulkUpsert(req.body, req.user));
}

export async function byClassDate(req, res) {
  res.success(await svc.byClassDate(req.query, req.user));
}

export async function update(req, res) {
  res.success(await svc.update(Number(req.params.id), req.body, req.user));
}
