export const STATUS_LABELS = {
  Pending: 'Chờ duyệt',
  Approved: 'Đã duyệt',
  Rejected: 'Từ chối',
  Cancelled: 'Đã hủy',
  Expired: 'Quá hạn',
  Recorded: 'Đã ghi nhận',
};

const STATUS_TEXT_CLASSES = {
  Pending: 'text-amber-600',
  Approved: 'text-blue-600',
  Applied: 'text-green-600',
  Rejected: 'text-red-600',
  Cancelled: 'text-muted-foreground',
  Expired: 'text-muted-foreground',
  Recorded: 'text-green-600',
};

// Colored plain text status — no chip/badge
// appliedAt: for Approved class transfers, distinguishes waiting vs already moved
export function StatusBadge({ status, appliedAt }) {
  if (status === 'Approved') {
    return appliedAt ? (
      <span className={STATUS_TEXT_CLASSES.Applied}>Đã chuyển lớp</span>
    ) : (
      <span className={STATUS_TEXT_CLASSES.Approved}>Đã duyệt (chờ hiệu lực)</span>
    );
  }
  return (
    <span className={STATUS_TEXT_CLASSES[status] ?? ''}>{STATUS_LABELS[status] ?? status}</span>
  );
}

export const CLASS_TRANSFER_COLS = [
  { key: 'student', label: 'Học sinh' },
  { key: 'from_class', label: 'Lớp hiện tại' },
  { key: 'to_class', label: 'Lớp chuyển đến' },
  { key: 'effective_date', label: 'Ngày hiệu lực' },
  { key: 'requester', label: 'Người tạo' },
  { key: 'status', label: 'Trạng thái' },
];

export const schoolTransferCols = (direction) => [
  { key: 'student', label: 'Học sinh' },
  { key: 'class', label: 'Lớp' },
  { key: 'year', label: 'Năm học' },
  { key: 'school', label: direction === 'outgoing' ? 'Trường chuyển đến' : 'Trường chuyển từ' },
  { key: 'date', label: 'Ngày chuyển' },
  { key: 'status', label: 'Trạng thái' },
];

export function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('vi-VN');
}

export { InfoRow, DetailSection } from '@/shared/components/detail-sheet';

// Student header card for detail drawers
export function StudentHeader({ student, status, appliedAt }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-4 py-3">
      <p className="font-semibold">{student?.full_name}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{student?.student_id_card_number}</p>
      <p className="text-sm mt-1.5">
        <StatusBadge status={status} appliedAt={appliedAt} />
      </p>
    </div>
  );
}
