-- Chỉ 1 school_year có status='active' tại 1 thời điểm
CREATE UNIQUE INDEX one_active_school_year
  ON school_years(status)
  WHERE status = 'active' AND deleted_at IS NULL;
