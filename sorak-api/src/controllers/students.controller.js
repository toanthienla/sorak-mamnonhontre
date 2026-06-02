import * as svc from "../services/students.service.js";
import * as authSvc from "../services/auth.service.js";
import * as storage from "../services/storage.service.js";
import { BadRequest } from "../utils/http-error.js";

export async function create(req, res) {
  res.success(await svc.create(req.body, req.user.sub));
}

export async function findAll(req, res) {
  res.paginated(await svc.findAll(req.query));
}

export async function findArchived(req, res) {
  res.paginated(await svc.findArchived(req.query));
}

export async function findOne(req, res) {
  res.success(await svc.findOne(Number(req.params.id)));
}

export async function update(req, res) {
  res.success(await svc.update(Number(req.params.id), req.body, req.user.sub));
}

export async function softDelete(req, res) {
  res.success(await svc.softDelete(Number(req.params.id), req.user.sub));
}

export async function restore(req, res) {
  res.success(await svc.restore(Number(req.params.id)));
}

export async function setActive(req, res) {
  res.success(await svc.setActive(Number(req.params.id), req.body.is_active));
}
