import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle } from 'lucide-react';

/**
 * Reusable import preview/confirm dialog.
 *
 * props:
 *  - open, onOpenChange
 *  - title
 *  - columns: [{ key, label }]
 *  - preview: { rows:[{row, valid, errors:[], ...data}], valid_count, error_count } | null
 *  - loading: preview fetch in-flight
 *  - confirming: import in-flight
 *  - onConfirm: () => void
 */
export function ImportPreviewDialog({
  open,
  onOpenChange,
  title = 'Xem trước nhập Excel',
  columns = [],
  preview,
  loading,
  confirming,
  onConfirm,
}) {
  const rows = preview?.rows ?? [];
  const validCount = preview?.valid_count ?? 0;
  const errorCount = preview?.error_count ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Đang đọc file...</div>
        ) : preview?.fatal ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {preview.fatal}
          </div>
        ) : (
          <>
            <div className="flex gap-3">
              <div className="flex-1 rounded-md border bg-green-50 px-3 py-2 text-center">
                <div className="text-2xl font-bold text-green-700">{validCount}</div>
                <div className="text-xs text-green-700">Hợp lệ</div>
              </div>
              <div className="flex-1 rounded-md border bg-red-50 px-3 py-2 text-center">
                <div className="text-2xl font-bold text-red-600">{errorCount}</div>
                <div className="text-xs text-red-600">Lỗi</div>
              </div>
              <div className="flex-1 rounded-md border bg-muted px-3 py-2 text-center">
                <div className="text-2xl font-bold">{rows.length}</div>
                <div className="text-xs text-muted-foreground">Tổng dòng</div>
              </div>
            </div>

            <div className="rounded-md border max-h-[55vh] overflow-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 bg-muted/90 backdrop-blur">
                  <tr>
                    <th className="px-2 py-2 text-left text-xs font-medium w-12">Dòng</th>
                    <th className="px-2 py-2 text-center text-xs font-medium w-10"></th>
                    {columns.map((c) => (
                      <th
                        key={c.key}
                        className="px-2 py-2 text-left text-xs font-medium whitespace-nowrap"
                      >
                        {c.label}
                      </th>
                    ))}
                    <th className="px-2 py-2 text-left text-xs font-medium">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={columns.length + 3}
                        className="px-3 py-6 text-center text-muted-foreground"
                      >
                        Không có dòng dữ liệu
                      </td>
                    </tr>
                  )}
                  {rows.map((r) => (
                    <tr
                      key={r.row}
                      className={`border-t ${r.valid ? 'bg-green-50/60' : 'bg-red-50/70'}`}
                    >
                      <td className="px-2 py-1.5 font-mono text-xs text-muted-foreground">
                        {r.row}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {r.valid ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600 inline" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500 inline" />
                        )}
                      </td>
                      {columns.map((c) => (
                        <td key={c.key} className="px-2 py-1.5 whitespace-nowrap">
                          {r[c.key] || <span className="text-muted-foreground/50">—</span>}
                        </td>
                      ))}
                      <td className="px-2 py-1.5 text-xs text-red-600">
                        {r.errors?.length > 0 ? r.errors.join('; ') : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {errorCount > 0 && (
              <p className="text-xs text-muted-foreground">
                Chỉ {validCount} dòng hợp lệ sẽ được nhập. {errorCount} dòng lỗi bị bỏ qua.
              </p>
            )}
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            onClick={onConfirm}
            disabled={loading || confirming || validCount === 0 || preview?.fatal}
          >
            {confirming ? 'Đang nhập...' : `Nhập ${validCount} dòng hợp lệ`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
