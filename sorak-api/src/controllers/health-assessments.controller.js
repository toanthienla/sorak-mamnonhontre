import * as svc from '../services/health-assessments.service.js';

export async function create(req, res) {
  res.success(await svc.create(req.body, req.user));
}

export async function findAll(req, res) {
  res.paginated(await svc.findAll(req.query, req.user));
}

export async function findOne(req, res) {
  res.success(await svc.findOne(Number(req.params.id), req.user));
}

export async function history(req, res) {
  res.success(await svc.history(req.query, req.user));
}

export async function curves(req, res) {
  res.success(svc.curves(req.query));
}

export async function bulkUpsert(req, res) {
  res.success(await svc.bulkUpsert(req.body, req.user));
}

export async function byClassDate(req, res) {
  res.success(await svc.byClassDate(req.query, req.user));
}

export async function update(req, res) {
  res.success(await svc.update(Number(req.params.id), req.body, req.user));
}

export async function remove(req, res) {
  res.success(await svc.remove(Number(req.params.id), req.user));
}

export async function previewImport(req, res) {
  res.success(
    await svc.previewImport(
      req.file.buffer,
      Number(req.query.class_id),
      Number(req.query.school_year_id),
      req.user,
    ),
  );
}

export async function importExcel(req, res) {
  res.success(
    await svc.importExcel(
      req.file.buffer,
      Number(req.query.class_id),
      Number(req.query.school_year_id),
      req.user,
    ),
  );
}

export async function importTemplate(req, res) {
  const buf = await svc.importTemplate();
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader('Content-Disposition', 'attachment; filename="mau_nhap_suc_khoe.xlsx"');
  res.send(Buffer.from(buf));
}

export async function exportExcel(req, res) {
  const buf = await svc.exportExcel(req.query, req.user);
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="health_assessments_${Date.now()}.xlsx"`,
  );
  res.send(Buffer.from(buf));
}
