import * as svc from '../services/monthly-theme-plans.service.js';

export async function findAll(req, res) {
  res.paginated(await svc.findAll(req.query, req.user));
}

export async function create(req, res) {
  res.success(await svc.create(req.body, req.user));
}

export async function findOne(req, res) {
  res.success(await svc.findOne(Number(req.params.id), req.user));
}

export async function planningWeeks(req, res) {
  res.success(await svc.planningWeeks(req.query, req.user));
}

export async function update(req, res) {
  res.success(await svc.update(Number(req.params.id), req.body, req.user));
}

export async function remove(req, res) {
  res.success(await svc.softDelete(Number(req.params.id), req.user));
}

export async function criteriaBank(req, res) {
  res.success(await svc.criteriaBank(Number(req.params.id), req.query, req.user));
}

export async function updateSelectedCriteria(req, res) {
  res.success(await svc.updateSelectedCriteria(Number(req.params.id), req.body, req.user));
}

export async function complete(req, res) {
  res.success(await svc.complete(Number(req.params.id), req.body, req.user));
}

export async function revertToDraft(req, res) {
  res.success(await svc.revertToDraft(Number(req.params.id), req.user));
}
