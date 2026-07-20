import * as svc from '../services/academic-year-timetables.service.js';

export async function findAll(req, res) {
  res.paginated(await svc.findAll(req.query, req.user.sub));
}

export async function findOne(req, res) {
  res.success(await svc.findOne(Number(req.params.id)));
}

export async function create(req, res) {
  res.success(await svc.create(req.body, req.user.sub));
}

export async function update(req, res) {
  res.success(await svc.update(Number(req.params.id), req.body, req.user.sub));
}

export async function lock(req, res) {
  res.success(await svc.lock(Number(req.params.id), req.user.sub));
}

export async function unlock(req, res) {
  res.success(await svc.unlock(Number(req.params.id), req.body, req.user.sub));
}

export async function assignedWeekly(req, res) {
  res.success(await svc.assignedWeekly(req.query, req.user));
}

export async function assignedDailyActivities(req, res) {
  res.success(await svc.assignedDailyActivities(req.query, req.user));
}
