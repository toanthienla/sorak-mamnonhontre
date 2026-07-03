import * as svc from '../services/classes.service.js';
import { BadRequest } from '../utils/http-error.js';

export async function create(req, res) {
  res.success(await svc.create(req.body));
}

export async function findAll(req, res) {
  res.paginated(await svc.findAll(req.query, req.user));
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

export async function addTeacher(req, res) {
  res.success(await svc.addTeacher(Number(req.params.id), req.body.account_id));
}

export async function removeTeacher(req, res) {
  res.success(await svc.removeTeacher(Number(req.params.id), Number(req.params.teacherId)));
}

export async function importTemplate(req, res) {
  const buf = await svc.importTemplate();
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader('Content-Disposition', 'attachment; filename="mau_nhap_lop.xlsx"');
  res.send(buf);
}

export async function previewImport(req, res) {
  if (!req.file) throw BadRequest('Thiếu file');
  res.success(await svc.previewImport(req.file.buffer));
}

export async function importExcel(req, res) {
  if (!req.file) throw BadRequest('Thiếu file');
  res.success(await svc.importExcel(req.file.buffer));
}

export async function exportExcel(req, res) {
  const sy = req.query.school_year_id ? Number(req.query.school_year_id) : undefined;
  const buf = await svc.exportExcel(sy);
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader('Content-Disposition', `attachment; filename="classes_${Date.now()}.xlsx"`);
  res.send(buf);
}
