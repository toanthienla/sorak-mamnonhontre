import * as svc from '../services/nutrition-assessments.service.js';

export async function grid(req, res) {
  res.success(await svc.grid(req.query, req.user));
}

export async function gridAll(req, res) {
  res.success(await svc.gridAll(req.query, req.user));
}

export async function bulkUpsert(req, res) {
  res.success(await svc.bulkUpsert(req.body, req.user));
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
      req.query.period,
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
  res.setHeader('Content-Disposition', 'attachment; filename="mau_nhap_dinh_duong.xlsx"');
  res.send(Buffer.from(buf));
}
