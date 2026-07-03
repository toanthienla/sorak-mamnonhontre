import * as svc from '../services/accounts.service.js';

// POST /accounts/:id/assign-role — :id = teacher_id
export async function assignRole(req, res) {
  res.success(await svc.assignRole(Number(req.params.id), req.body.role, req.body.password));
}

export async function findAll(req, res) {
  res.paginated(await svc.findAll(req.query));
}

export async function findOne(req, res) {
  res.success(await svc.findOne(Number(req.params.id)));
}

export async function changeRole(req, res) {
  res.success(await svc.changeRole(Number(req.params.id), req.body.role));
}

export async function setPassword(req, res) {
  res.success(await svc.setPassword(Number(req.params.id), req.body.password));
}

export async function setActive(req, res) {
  res.success(await svc.setActive(Number(req.params.id), req.body.is_active));
}

export async function softDelete(req, res) {
  res.success(await svc.softDelete(Number(req.params.id), req.user.sub));
}

export async function restore(req, res) {
  res.success(await svc.restore(Number(req.params.id)));
}
