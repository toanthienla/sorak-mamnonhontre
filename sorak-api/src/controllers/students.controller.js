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
