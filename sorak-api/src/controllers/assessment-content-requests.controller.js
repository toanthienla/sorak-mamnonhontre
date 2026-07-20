import * as svc from '../services/assessment-content-requests.service.js';

export async function create(req, res) {
  res.success(await svc.create(req.body, req.user));
}

export async function findAll(req, res) {
  res.paginated(await svc.findAll(req.query, req.user));
}

export async function findOne(req, res) {
  res.success(await svc.findOne(Number(req.params.id), req.user));
}

export async function review(req, res) {
  res.success(await svc.review(Number(req.params.id), req.body, req.user));
}

export async function cancel(req, res) {
  res.success(await svc.cancel(Number(req.params.id), req.user));
}
