import * as svc from '../services/incoming-transfers.service.js';

export async function create(req, res) {
  res.success(await svc.create(req.body, req.user));
}
