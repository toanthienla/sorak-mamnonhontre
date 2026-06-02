import * as svc from '../services/teachers.service.js';
import { BadRequest } from '../utils/http-error.js';

export async function create(req, res) {
  res.success(await svc.create(req.body));
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
  res.success(await svc.update(Number(req.params.id), req.body));
}

export async function softDelete(req, res) {
  res.success(await svc.softDelete(Number(req.params.id)));
}

export async function restore(req, res) {
  res.success(await svc.restore(Number(req.params.id)));
}

export async function importExcel(req, res) {
  if (!req.file) throw BadRequest('Thiếu file');
  res.success(await svc.importExcel(req.file.buffer));
}

export async function exportExcel(req, res) {
  const buf = await svc.exportExcel();
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader('Content-Disposition', `attachment; filename="teachers_${Date.now()}.xlsx"`);
  res.send(buf);
}
