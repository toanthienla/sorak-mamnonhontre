import * as svc from '../services/incoming-transfers.service.js';

export async function create(req, res) {
  res.success(await svc.create(req.body, req.user));
}

export async function findAll(req, res) {
  res.paginated(await svc.findAll(req.query, req.user));
}

export async function findOne(req, res) {
  res.success(await svc.findOne(Number(req.params.id)));
}

export async function update(req, res) {
  res.success(await svc.update(Number(req.params.id), req.body, req.user));
}

export async function cancel(req, res) {
  res.success(await svc.cancel(Number(req.params.id), req.body, req.user));
}

export async function softDelete(req, res) {
  res.success(await svc.softDelete(Number(req.params.id), req.user));
}

export async function exportExcel(req, res) {
  const buf = await svc.exportExcel(req.query);
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="incoming_transfers_${Date.now()}.xlsx"`,
  );
  res.send(Buffer.from(buf));
}
