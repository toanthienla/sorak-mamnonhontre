import * as svc from '../services/students.service.js';
import * as authSvc from '../services/auth.service.js';
import * as storage from '../services/storage.service.js';
import { BadRequest } from '../utils/http-error.js';

export async function create(req, res) {
  res.success(await svc.create(req.body, req.user.sub));
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
  res.success(await svc.update(Number(req.params.id), req.body, req.user.sub));
}

export async function softDelete(req, res) {
  res.success(await svc.softDelete(Number(req.params.id), req.user.sub));
}

export async function restore(req, res) {
  res.success(await svc.restore(Number(req.params.id)));
}

export async function resetPassword(req, res) {
  res.success(await authSvc.resetParentPassword(Number(req.params.id)));
}

export async function setActive(req, res) {
  res.success(await svc.setActive(Number(req.params.id), req.body.is_active));
}

export async function addParent(req, res) {
  res.success(await svc.addParent(Number(req.params.id), req.body));
}

export async function updateParent(req, res) {
  res.success(await svc.updateParent(Number(req.params.parentId), req.body));
}

export async function batchUpdateParents(req, res) {
  res.success(await svc.batchUpdateParents(Number(req.params.id), req.body.parents));
}

export async function uploadPhoto(req, res) {
  // file presence + type/size already enforced by uploadPhoto middleware
  const id = Number(req.params.id);
  await svc.assertExists(id); // verify student exists BEFORE uploading (avoid orphan Cloudinary file)
  const ext = req.file.mimetype.split('/')[1].replace('jpeg', 'jpg');
  const key = `students/${id}/photo_${Date.now()}.${ext}`;
  const { url } = await storage.upload(key, req.file.buffer, req.file.mimetype);
  await svc.update(id, { photo_url: url }, req.user.sub);
  res.success({ photo_url: url });
}

export async function importTemplate(req, res) {
  const buf = await svc.importTemplate();
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader('Content-Disposition', 'attachment; filename="mau_nhap_hoc_sinh.xlsx"');
  res.send(buf);
}

export async function previewImport(req, res) {
  if (!req.file) throw BadRequest('Thiếu file');
  res.success(await svc.previewImport(req.file.buffer));
}

export async function importExcel(req, res) {
  if (!req.file) throw BadRequest('Thiếu file');
  res.success(await svc.importExcel(req.file.buffer, req.user.sub));
}

export async function exportExcel(req, res) {
  const buf = await svc.exportExcel({
    class_id: req.query.class_id ? Number(req.query.class_id) : undefined,
    school_year_id: req.query.school_year_id ? Number(req.query.school_year_id) : undefined,
  });
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader('Content-Disposition', `attachment; filename="students_${Date.now()}.xlsx"`);
  res.send(buf);
}
