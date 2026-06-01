import * as svc from "../services/academic-years.service.js";

export async function create(req, res) {
  const year = await svc.create(req.body);
  res.success(year);
}

export async function findAll(req, res) {
  res.success(await svc.findAll());
}

export async function findArchived(req, res) {
  res.success(await svc.findArchived());
}

export async function findOne(req, res) {
  res.success(await svc.findOne(Number(req.params.id)));
}
