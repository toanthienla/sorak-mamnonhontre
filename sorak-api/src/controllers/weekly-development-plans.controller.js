import * as svc from '../services/weekly-development-plans.service.js';

export async function findAll(req, res) {
  res.paginated(await svc.findAll(req.query, req.user));
}

export async function createOptions(req, res) {
  res.success(await svc.createOptions(req.query, req.user));
}

export async function create(req, res) {
  res.success(await svc.create(req.body, req.user));
}

export async function findOne(req, res) {
  res.success(await svc.findOne(Number(req.params.id), req.user));
}

export async function updateMappings(req, res) {
  res.success(await svc.updateMappings(Number(req.params.id), req.body, req.user));
}

export async function complete(req, res) {
  res.success(await svc.complete(Number(req.params.id), req.body, req.user));
}

export async function revertToDraft(req, res) {
  res.success(await svc.revertToDraft(Number(req.params.id), req.user));
}

export async function remove(req, res) {
  res.success(await svc.softDelete(Number(req.params.id), req.user));
}
