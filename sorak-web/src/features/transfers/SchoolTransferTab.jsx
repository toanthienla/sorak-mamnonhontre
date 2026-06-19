// Shared tab for Outgoing (chuyển đi) and Incoming (chuyển đến) school transfers
// direction: 'outgoing' | 'incoming'
import { useState } from 'react';
import { Plus, Search, Pencil, Trash2, Ban, FileSpreadsheet, MoreHorizontal } from 'lucide-react';
import { ColumnToggle } from '@/shared/components/column-toggle';
import { useColumnSettings } from '@/shared/hooks/use-column-settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DataPagination } from '@/shared/components/data-pagination';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { useList } from '@/shared/hooks/use-crud';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/client';
import { useAuthStore } from '@/shared/stores/auth.store';
import { useYearStore } from '@/shared/stores/year.store';
import { toast } from 'sonner';
import {
  StatusBadge,
  fmtDate,
  InfoRow,
  DetailSection,
  StudentHeader,
  schoolTransferCols,
} from './transfer-shared';

const CONFIG = {
  outgoing: {
    path: '/outgoing-transfers',
    key: 'outgoing-transfers',
    schoolField: 'destination_school',
    schoolLabel: 'Trường chuyển đến',
    recordTitle: 'Ghi nhận chuyển trường đi',
    emptyText: 'Chưa có hồ sơ chuyển đi',
    cancelWarning:
      'Hủy hồ sơ sẽ khôi phục trạng thái "Đang học" và kích hoạt lại tài khoản của học sinh.',
  },
  incoming: {
    path: '/incoming-transfers',
    key: 'incoming-transfers',
    schoolField: 'previous_school',
    schoolLabel: 'Trường chuyển từ',
    recordTitle: 'Ghi nhận chuyển trường đến',
    emptyText: 'Chưa có hồ sơ chuyển đến',
    cancelWarning: 'Hồ sơ hủy vẫn được lưu để đối chiếu nhưng không tính vào báo cáo chính thức.',
  },
};

export function SchoolTransferTab({ direction }) {
  const cfg = CONFIG[direction];
  const user = useAuthStore((s) => s.user);
  const isBGH = user?.role === 'PRINCIPAL';
  const selectedYearId = useYearStore((s) => s.selectedYearId);
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [deleting, setDeleting] = useState(null);

  // Form state
  const [studentId, setStudentId] = useState('');
  const [school, setSchool] = useState('');
  const [transferDate, setTransferDate] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');

  const COLS = schoolTransferCols(direction);
  const { hidden, setHidden, order, setOrder } = useColumnSettings(
    `col:${cfg.key}`,
    COLS.map((c) => c.key),
  );
  const orderedCols = order.map((k) => COLS.find((c) => c.key === k)).filter(Boolean);
  const visibleCols = orderedCols.filter((c) => !hidden.has(c.key));

  const { data, isLoading } = useList(cfg.key, cfg.path, {
    page,
    pageSize: 20,
    school_year_id: selectedYearId ?? undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    search: search || undefined,
  });

  // Students for record dialog
  const { data: students } = useQuery({
    queryKey: ['students-for-transfer', selectedYearId],
    queryFn: async () => {
      const res = await apiClient.get('/students', {
        params: { pageSize: 500, school_year_id: selectedYearId ?? undefined },
      });
      return res.data?.data ?? [];
    },
    enabled: formOpen && !editing,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: [cfg.key] });

  const createMut = useMutation({
    mutationFn: async (dto) => (await apiClient.post(cfg.path, dto)).data,
    onSuccess: () => {
      toast.success('Đã ghi nhận hồ sơ');
      refresh();
      setFormOpen(false);
    },
  });
  const updateMut = useMutation({
    mutationFn: async ({ id, dto }) => (await apiClient.patch(`${cfg.path}/${id}`, dto)).data,
    onSuccess: () => {
      toast.success('Đã cập nhật hồ sơ');
      refresh();
      setFormOpen(false);
    },
  });
  const cancelMut = useMutation({
    mutationFn: async ({ id, cancel_reason }) =>
      (await apiClient.patch(`${cfg.path}/${id}/cancel`, { cancel_reason })).data,
    onSuccess: () => {
      toast.success('Đã hủy hồ sơ');
      refresh();
      setCancelling(null);
      setCancelReason('');
      setViewing(null);
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });
  const deleteMut = useMutation({
    mutationFn: async (id) => (await apiClient.delete(`${cfg.path}/${id}`)).data,
    onSuccess: () => {
      toast.success('Đã xóa hồ sơ');
      refresh();
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });

  const onOpenCreate = () => {
    setEditing(null);
    setStudentId('');
    setSchool('');
    setTransferDate('');
    setReason('');
    setNote('');
    setFormOpen(true);
  };

  const handleExport = async () => {
    const params = selectedYearId ? { school_year_id: selectedYearId } : {};
    const res = await apiClient.get(`${cfg.path}/export/excel`, { params, responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${direction}_transfers_${Date.now()}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onOpenEdit = (r) => {
    setEditing(r);
    setStudentId(String(r.student_id));
    setSchool(r[cfg.schoolField] ?? '');
    setTransferDate(r.transfer_date?.slice(0, 10) ?? '');
    setReason(r.reason ?? '');
    setNote(r.note ?? '');
    setFormOpen(true);
  };

  const editDirty =
    editing &&
    (school !== (editing[cfg.schoolField] ?? '') ||
      transferDate !== (editing.transfer_date?.slice(0, 10) ?? '') ||
      reason !== (editing.reason ?? '') ||
      note !== (editing.note ?? ''));

  const canSubmit = editing
    ? editDirty && school.trim() && transferDate
    : studentId && school.trim() && transferDate;

  const submitForm = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    const dto = {
      [cfg.schoolField]: school.trim(),
      transfer_date: transferDate,
      reason: reason.trim() || null,
      note: note.trim() || null,
    };
    if (editing) {
      updateMut.mutate({ id: editing.transfer_id, dto });
    } else {
      createMut.mutate({ student_id: Number(studentId), ...dto });
    }
  };

  // Outgoing: only students currently active can be recorded; incoming: must have a class
  const selectableStudents = (students ?? []).filter((s) =>
    direction === 'outgoing' ? s.student_status === 'Đang học' : true,
  );

  return (
    <>
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setSearch(searchInput);
          }}
          className="flex gap-2 flex-1 max-w-sm"
        >
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Tìm học sinh..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <Button type="submit" variant="secondary">
            Tìm
          </Button>
        </form>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Trạng thái" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả trạng thái</SelectItem>
            <SelectItem value="Recorded">Đã ghi nhận</SelectItem>
            <SelectItem value="Cancelled">Đã hủy</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <ColumnToggle
          columns={COLS}
          hidden={hidden}
          onHiddenChange={setHidden}
          order={order}
          onOrderChange={setOrder}
        />
        <Button variant="outline" size="sm" onClick={handleExport}>
          <FileSpreadsheet className="h-4 w-4 mr-1.5" /> Xuất Excel
        </Button>
        {isBGH && (
          <Button size="sm" onClick={onOpenCreate}>
            <Plus className="h-4 w-4 mr-1.5" /> Ghi nhận
          </Button>
        )}
      </div>

      <div className="bg-card rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {visibleCols.map((col) => (
                <TableHead key={col.key}>{col.label}</TableHead>
              ))}
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell
                  colSpan={visibleCols.length + 1}
                  className="text-center py-8 text-muted-foreground"
                >
                  Đang tải...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && !data?.data?.length && (
              <TableRow>
                <TableCell
                  colSpan={visibleCols.length + 1}
                  className="text-center py-10 text-muted-foreground"
                >
                  {cfg.emptyText}
                </TableCell>
              </TableRow>
            )}
            {data?.data?.map((r) => {
              const renderCell = (key) => {
                switch (key) {
                  case 'student':
                    return (
                      <TableCell key={key}>
                        <div className="font-medium">{r.student?.full_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.student?.student_id_card_number}
                        </div>
                      </TableCell>
                    );
                  case 'class':
                    return <TableCell key={key}>{r.class?.class_name ?? '—'}</TableCell>;
                  case 'year':
                    return <TableCell key={key}>{r.school_year?.name}</TableCell>;
                  case 'school':
                    return <TableCell key={key}>{r[cfg.schoolField]}</TableCell>;
                  case 'date':
                    return <TableCell key={key}>{fmtDate(r.transfer_date)}</TableCell>;
                  case 'status':
                    return (
                      <TableCell key={key}>
                        <StatusBadge status={r.status} />
                      </TableCell>
                    );
                  default:
                    return null;
                }
              };
              return (
                <TableRow
                  key={r.transfer_id}
                  className="cursor-pointer hover:bg-accent"
                  onClick={() => setViewing(r)}
                >
                  {visibleCols.map((col) => renderCell(col.key))}
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        {isBGH && r.status === 'Recorded' && (
                          <>
                            <DropdownMenuItem onClick={() => onOpenEdit(r)}>
                              <Pencil className="h-4 w-4 mr-2" /> Chỉnh sửa
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setCancelling(r);
                                setCancelReason('');
                              }}
                            >
                              <Ban className="h-4 w-4 mr-2" /> Hủy hồ sơ
                            </DropdownMenuItem>
                          </>
                        )}
                        {isBGH ? (
                          <>
                            {r.status === 'Recorded' && <DropdownMenuSeparator />}
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleting(r)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Xóa
                            </DropdownMenuItem>
                          </>
                        ) : (
                          <DropdownMenuItem disabled>Không có thao tác</DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {data && data.meta.total > 0 && (
        <DataPagination
          page={data.meta.page}
          pageSize={data.meta.pageSize}
          total={data.meta.total}
          totalPages={data.meta.totalPages}
          onPageChange={setPage}
        />
      )}

      {/* Record / Edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Cập nhật hồ sơ' : cfg.recordTitle}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitForm} className="space-y-3">
            <div>
              <Label>
                Học sinh <span className="text-destructive">*</span>
              </Label>
              {editing ? (
                <Input
                  disabled
                  value={`${editing.student?.full_name} — ${editing.student?.student_id_card_number}`}
                  className="bg-muted text-muted-foreground cursor-not-allowed"
                />
              ) : (
                <Select value={studentId} onValueChange={setStudentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn học sinh" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectableStudents.map((s) => (
                      <SelectItem key={s.student_id} value={String(s.student_id)}>
                        {s.full_name} — {s.student_id_card_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {!editing && direction === 'incoming' && (
                <p className="text-xs text-muted-foreground mt-1">
                  Học sinh phải có hồ sơ và đã được xếp lớp.
                </p>
              )}
            </div>
            <div>
              <Label>
                {cfg.schoolLabel} <span className="text-destructive">*</span>
              </Label>
              <Input value={school} onChange={(e) => setSchool(e.target.value)} />
            </div>
            <div>
              <Label>
                Ngày chuyển <span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Lý do</Label>
              <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <div>
              <Label>Ghi chú</Label>
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            {!editing && direction === 'outgoing' && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                Học sinh sẽ chuyển sang trạng thái <b>Đã chuyển trường</b> và tài khoản phụ huynh bị
                khóa.
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Hủy
              </Button>
              <Button
                type="submit"
                disabled={!canSubmit || createMut.isPending || updateMut.isPending}
              >
                {editing ? 'Cập nhật' : 'Ghi nhận'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Details drawer */}
      <Sheet open={!!viewing} onOpenChange={(v) => !v && setViewing(null)}>
        <SheetContent side="right" className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Chi tiết hồ sơ chuyển trường</SheetTitle>
          </SheetHeader>
          {viewing && (
            <div className="space-y-4 mt-5">
              <StudentHeader student={viewing.student} status={viewing.status} />

              <DetailSection title="Thông tin chuyển trường">
                <InfoRow label={cfg.schoolLabel} value={viewing[cfg.schoolField]} />
                <InfoRow label="Ngày chuyển" value={fmtDate(viewing.transfer_date)} />
                <InfoRow label="Lớp" value={viewing.class?.class_name} />
                <InfoRow label="Năm học" value={viewing.school_year?.name} />
                <InfoRow label="Lý do" value={viewing.reason} />
                <InfoRow label="Ghi chú" value={viewing.note} />
              </DetailSection>

              <DetailSection title="Hệ thống">
                {viewing.cancel_reason && (
                  <InfoRow label="Lý do hủy" value={viewing.cancel_reason} />
                )}
                <InfoRow label="Ngày tạo" value={fmtDate(viewing.created_at)} />
                <InfoRow label="Cập nhật" value={fmtDate(viewing.updated_at)} />
              </DetailSection>

              {/* Actions */}
              {isBGH && (
                <div className="border-t pt-4 flex flex-wrap gap-2 justify-end">
                  <Button
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      const r = viewing;
                      setViewing(null);
                      setDeleting(r);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" /> Xóa
                  </Button>
                  {viewing.status === 'Recorded' && (
                    <>
                      <Button
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          const r = viewing;
                          setViewing(null);
                          setCancelling(r);
                          setCancelReason('');
                        }}
                      >
                        <Ban className="h-4 w-4 mr-1.5" /> Hủy hồ sơ
                      </Button>
                      <Button
                        onClick={() => {
                          const r = viewing;
                          setViewing(null);
                          onOpenEdit(r);
                        }}
                      >
                        <Pencil className="h-4 w-4 mr-1.5" /> Chỉnh sửa
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Cancel confirm */}
      <ConfirmDialog
        open={!!cancelling}
        onOpenChange={(v) => {
          if (!v) {
            setCancelling(null);
            setCancelReason('');
          }
        }}
        title="Hủy hồ sơ chuyển trường?"
        description={cfg.cancelWarning}
        variant="destructive"
        confirmLabel="Hủy hồ sơ"
        loading={cancelMut.isPending}
        onConfirm={() =>
          cancelMut.mutate({
            id: cancelling.transfer_id,
            cancel_reason: cancelReason.trim() || undefined,
          })
        }
      >
        {cancelling && (
          <div className="space-y-2">
            <p className="text-muted-foreground">
              Học sinh: <b>{cancelling.student?.full_name}</b> — {cancelling[cfg.schoolField]}
            </p>
            <div>
              <Label>Lý do hủy</Label>
              <Textarea
                rows={2}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>
          </div>
        )}
      </ConfirmDialog>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        title="Xóa hồ sơ chuyển trường?"
        description={
          direction === 'outgoing'
            ? 'Hồ sơ sẽ bị ẩn khỏi danh sách. Nếu hồ sơ đang hiệu lực, học sinh sẽ được khôi phục trạng thái "Đang học".'
            : 'Hồ sơ sẽ bị ẩn khỏi danh sách (xóa mềm, dữ liệu vẫn được lưu).'
        }
        variant="destructive"
        confirmLabel="Xóa"
        loading={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate(deleting.transfer_id)}
      />
    </>
  );
}
