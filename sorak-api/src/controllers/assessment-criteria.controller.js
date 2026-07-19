import * as svc from '../services/assessment-criteria.service.js';

export async function findAll(req, res) {
  res.paginated(await svc.findAll(req.query));
}

export async function findOne(req, res) {
  res.success(await svc.findOne(Number(req.params.id)));
}

export async function findUsages(req, res) {
  res.success(await svc.findUsages(Number(req.params.id)));
}

export async function create(req, res) {
  res.success(await svc.create(req.body, req.user.sub));
}

export async function update(req, res) {
  res.success(await svc.update(Number(req.params.id), req.body, req.user.sub));
}

export async function setStatus(req, res) {
  res.success(await svc.setStatus(Number(req.params.id), req.body.is_active, req.user.sub));
}

export async function remove(req, res) {
  res.success(await svc.hardDelete(Number(req.params.id)));
}
