import * as svc from '../services/accounts.service.js';

// POST /accounts/:id/assign-role — :id = teacher_id
export async function assignRole(req, res) {
  res.success(await svc.assignRole(Number(req.params.id), req.body.role, req.body.password));
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
