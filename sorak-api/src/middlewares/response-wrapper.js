// Attach res.success() and res.paginated() helpers so controllers stay terse.
export function responseWrapper(req, res, next) {
  res.success = (data, meta) => {
    res.json({ success: true, data, ...(meta && { meta }) });
  };

  res.paginated = (result) => {
    res.json({ success: true, data: result.data, meta: result.meta });
  };

  next();
}
