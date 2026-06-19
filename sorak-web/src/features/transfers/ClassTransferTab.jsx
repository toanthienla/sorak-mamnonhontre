import { useState, useMemo } from 'react';
import { Plus, Search, MoreHorizontal, Check, X, Ban, RotateCcw } from 'lucide-react';
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
  STATUS_LABELS,
  fmtDate,
  InfoRow,
  DetailSection,
  StudentHeader,
  CLASS_TRANSFER_COLS,
} from './transfer-shared';

export function ClassTransferTab() {
  const user = useAuthStore((s) => s.user);
  const isBGH = user?.role === 'PRINCIPAL';
  const selectedYearId = useYearStore((s) => s.selectedYearId);
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null); // { action, request }
  const [actionNote, setActionNote] = useState('');

  // Create form state
  const [fromClassId, setFromClassId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [toClassId, setToClassId] = useState('');
  const [reason, setReason] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');

  const { hidden, setHidden, order, setOrder } = useColumnSettings(
    'col:class-transfers',
    CLASS_TRANSFER_COLS.map((c) => c.key),
  );
  const orderedCols = order
    .map((k) => CLASS_TRANSFER_COLS.find((c) => c.key === k))
    .filter(Boolean);
  const visibleCols = orderedCols.filter((c) => !hidden.has(c.key));

  const { data, isLoading } = useList('class-transfers', '/class-transfers', {
    page,
    pageSize: 20,
    school_year_id: selectedYearId ?? undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    search: search || undefined,
  });

  // Active-year classes for create dialog
  const { data: classes } = useQuery({
    queryKey: ['classes-for-transfer', selectedYearId],
    queryFn: async () => {
      const res = await apiClient.get('/classes', {
        params: { pageSize: 100, school_year_id: selectedYearId ?? undefined },
      });
      return res.data?.data ?? [];
    },
    enabled: createOpen,
  });

  // Teacher → own classes only (BR-057); Principal → all
  const sourceClasses = useMemo(() => {
    if (!classes) return [];
    if (isBGH) return classes;
    return classes.filter((c) =>
      c.teacher_classes?.some((tc) => tc.teacher?.teacher_id === user?.teacher_id),
    );
  }, [classes, isBGH, user]);

  const fromClass = classes?.find((c) => String(c.class_id) === fromClassId);

  // Target: same grade (age_group), same year, different class (BR-061..063)
  const targetClasses = useMemo(() => {
    if (!classes || !fromClass) return [];
    return classes.filter(
      (c) => c.class_id !== fromClass.class_id && c.age_group === fromClass.age_group,
    );
  }, [classes, fromClass]);

  // Students of the selected source class
  const { data: students } = useQuery({
    queryKey: ['students-of-class', fromClassId],
    queryFn: async () => {
      const res = await apiClient.get('/students', {
        params: { pageSize: 200, class_id: Number(fromClassId) },
      });
      return res.data?.data ?? [];
    },
    enabled: createOpen && !!fromClassId,
  });

  const createMut = useMutation({
    mutationFn: async (dto) => (await apiClient.post('/class-transfers', dto)).data,
    onSuccess: () => {
      toast.success('Đã tạo yêu cầu chuyển lớp');
      queryClient.invalidateQueries({ queryKey: ['class-transfers'] });
      setCreateOpen(false);
    },
  });

  const statusMut = useMutation({
    mutationFn: async ({ id, action, note }) =>
      (await apiClient.patch(`/class-transfers/${id}/status`, { action, note })).data,
    onSuccess: () => {
      toast.success('Đã cập nhật trạng thái');
      queryClient.invalidateQueries({ queryKey: ['class-transfers'] });
      setConfirmAction(null);
      setActionNote('');
      setViewing(null);
    },
  });

  const onOpenCreate = () => {
    setFromClassId('');
    setStudentId('');
    setToClassId('');
    setReason('');
    setEffectiveDate('');
    setCreateOpen(true);
  };

  const canSubmit = fromClassId && studentId && toClassId && reason.trim() && effectiveDate;

  const submitCreate = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    createMut.mutate({
      student_id: Number(studentId),
      to_class_id: Number(toClassId),
      reason: reason.trim(),
      effective_date: effectiveDate,
    });
  };

  const ACTION_LABELS = {
    approve: 'Duyệt',
    reject: 'Từ chối',
    cancel: 'Hủy yêu cầu',
    revert: 'Hoàn tác duyệt',
  };

  // Action availability per UC-49
  const canCancel = (r) =>
    r.status === 'Pending' && (isBGH || r.requester?.account_id === user?.account_id);
  const canReview = (r) => r.status === 'Pending' && isBGH;
  // Approved but not yet applied (before effective date) → principal can revert to Pending
  const canRevert = (r) => r.status === 'Approved' && !r.applied_at && isBGH;

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
            {Object.entries(STATUS_LABELS)
              .filter(([k]) => k !== 'Recorded')
              .map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <ColumnToggle
          columns={CLASS_TRANSFER_COLS}
          hidden={hidden}
          onHiddenChange={setHidden}
          order={order}
          onOrderChange={setOrder}
        />
        <Button size="sm" onClick={onOpenCreate}>
          <Plus className="h-4 w-4 mr-1.5" /> Tạo yêu cầu
        </Button>
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
                  Chưa có yêu cầu chuyển lớp
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
                  case 'from_class':
                    return <TableCell key={key}>{r.from_class?.class_name}</TableCell>;
                  case 'to_class':
                    return <TableCell key={key}>{r.to_class?.class_name}</TableCell>;
                  case 'effective_date':
                    return <TableCell key={key}>{fmtDate(r.effective_date)}</TableCell>;
                  case 'requester':
                    return (
                      <TableCell key={key}>{r.requester?.teacher?.full_name ?? '—'}</TableCell>
                    );
                  case 'status':
                    return (
                      <TableCell key={key}>
                        <StatusBadge status={r.status} appliedAt={r.applied_at} />
                      </TableCell>
                    );
                  default:
                    return null;
                }
              };
              return (
                <TableRow
                  key={r.request_id}
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
                        {canReview(r) && (
                          <>
                            <DropdownMenuItem
                              onClick={() => setConfirmAction({ action: 'approve', request: r })}
                            >
                              <Check className="h-4 w-4 mr-2" /> Duyệt
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setConfirmAction({ action: 'reject', request: r })}
                            >
                              <X className="h-4 w-4 mr-2" /> Từ chối
                            </DropdownMenuItem>
                          </>
                        )}
                        {canCancel(r) && (
                          <>
                            {canReview(r) && <DropdownMenuSeparator />}
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setConfirmAction({ action: 'cancel', request: r })}
                            >
                              <Ban className="h-4 w-4 mr-2" /> Hủy yêu cầu
                            </DropdownMenuItem>
                          </>
                        )}
                        {canRevert(r) && (
                          <DropdownMenuItem
                            onClick={() => setConfirmAction({ action: 'revert', request: r })}
                          >
                            <RotateCcw className="h-4 w-4 mr-2" /> Hoàn tác duyệt
                          </DropdownMenuItem>
                        )}
                        {!canReview(r) && !canCancel(r) && !canRevert(r) && (
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

      {/* Create dialog (UC-46) */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tạo yêu cầu chuyển lớp</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitCreate} className="space-y-3">
            <div>
              <Label>
                Lớp hiện tại <span className="text-destructive">*</span>
              </Label>
              <Select
                value={fromClassId}
                onValueChange={(v) => {
                  setFromClassId(v);
                  setStudentId('');
                  setToClassId('');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn lớp" />
                </SelectTrigger>
                <SelectContent>
                  {sourceClasses.map((c) => (
                    <SelectItem key={c.class_id} value={String(c.class_id)}>
                      {c.class_name}
                      {c.age_group ? ` — ${c.age_group}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!isBGH && (
                <p className="text-xs text-muted-foreground mt-1">
                  Chỉ hiển thị lớp bạn phụ trách.
                </p>
              )}
            </div>
            <div>
              <Label>
                Học sinh <span className="text-destructive">*</span>
              </Label>
              <Select value={studentId} onValueChange={setStudentId} disabled={!fromClassId}>
                <SelectTrigger>
                  <SelectValue placeholder={fromClassId ? 'Chọn học sinh' : 'Chọn lớp trước'} />
                </SelectTrigger>
                <SelectContent>
                  {(students ?? [])
                    .filter((s) => s.student_status === 'Đang học')
                    .map((s) => (
                      <SelectItem key={s.student_id} value={String(s.student_id)}>
                        {s.full_name} — {s.student_id_card_number}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>
                Lớp chuyển đến <span className="text-destructive">*</span>
              </Label>
              <Select value={toClassId} onValueChange={setToClassId} disabled={!fromClassId}>
                <SelectTrigger>
                  <SelectValue placeholder={fromClassId ? 'Chọn lớp đích' : 'Chọn lớp trước'} />
                </SelectTrigger>
                <SelectContent>
                  {targetClasses.map((c) => (
                    <SelectItem key={c.class_id} value={String(c.class_id)}>
                      {c.class_name}
                      {c.age_group ? ` — ${c.age_group}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Chỉ lớp cùng khối, cùng năm học.</p>
            </div>
            <div>
              <Label>
                Lý do <span className="text-destructive">*</span>
              </Label>
              <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <div>
              <Label>
                Ngày hiệu lực <span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" disabled={!canSubmit || createMut.isPending}>
                {createMut.isPending ? 'Đang tạo...' : 'Gửi yêu cầu'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Details drawer (UC-48) */}
      <Sheet open={!!viewing} onOpenChange={(v) => !v && setViewing(null)}>
        <SheetContent side="right" className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Chi tiết yêu cầu chuyển lớp</SheetTitle>
          </SheetHeader>
          {viewing && (
            <div className="space-y-4 mt-5">
              <StudentHeader
                student={viewing.student}
                status={viewing.status}
                appliedAt={viewing.applied_at}
              />

              {/* From → To */}
              <div className="rounded-lg border bg-card px-4 py-3 flex items-center justify-center gap-3 text-sm font-semibold">
                <span>{viewing.from_class?.class_name}</span>
                <span className="text-muted-foreground">→</span>
                <span>{viewing.to_class?.class_name}</span>
              </div>

              <DetailSection title="Thông tin yêu cầu">
                <InfoRow label="Năm học" value={viewing.school_year?.name} />
                <InfoRow label="Ngày hiệu lực" value={fmtDate(viewing.effective_date)} />
                <InfoRow label="Lý do" value={viewing.reason} />
                <InfoRow label="Người tạo" value={viewing.requester?.teacher?.full_name} />
                <InfoRow label="Ngày tạo" value={fmtDate(viewing.created_at)} />
              </DetailSection>

              {(viewing.reviewed_at || viewing.applied_at) && (
                <DetailSection title="Xử lý">
                  {viewing.reviewed_at && (
                    <>
                      <InfoRow label="Người duyệt" value={viewing.reviewer?.teacher?.full_name} />
                      <InfoRow label="Ngày duyệt" value={fmtDate(viewing.reviewed_at)} />
                      {viewing.review_note && (
                        <InfoRow label="Ghi chú" value={viewing.review_note} />
                      )}
                    </>
                  )}
                  {viewing.applied_at && (
                    <InfoRow label="Đã chuyển lớp ngày" value={fmtDate(viewing.applied_at)} />
                  )}
                </DetailSection>
              )}

              {/* Actions */}
              {(canReview(viewing) || canCancel(viewing) || canRevert(viewing)) && (
                <div className="border-t pt-4 flex flex-wrap gap-2 justify-end">
                  {canCancel(viewing) && (
                    <Button
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setConfirmAction({ action: 'cancel', request: viewing })}
                    >
                      <Ban className="h-4 w-4 mr-1.5" /> Hủy yêu cầu
                    </Button>
                  )}
                  {canRevert(viewing) && (
                    <Button
                      variant="outline"
                      onClick={() => setConfirmAction({ action: 'revert', request: viewing })}
                    >
                      <RotateCcw className="h-4 w-4 mr-1.5" /> Hoàn tác duyệt
                    </Button>
                  )}
                  {canReview(viewing) && (
                    <>
                      <Button
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setConfirmAction({ action: 'reject', request: viewing })}
                      >
                        <X className="h-4 w-4 mr-1.5" /> Từ chối
                      </Button>
                      <Button
                        onClick={() => setConfirmAction({ action: 'approve', request: viewing })}
                      >
                        <Check className="h-4 w-4 mr-1.5" /> Duyệt
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Confirm action */}
      <ConfirmDialog
        open={!!confirmAction}
        onOpenChange={(v) => {
          if (!v) {
            setConfirmAction(null);
            setActionNote('');
          }
        }}
        title={confirmAction ? `${ACTION_LABELS[confirmAction.action]} yêu cầu chuyển lớp?` : ''}
        variant={confirmAction?.action === 'reject' ? 'destructive' : 'default'}
        confirmLabel={confirmAction ? ACTION_LABELS[confirmAction.action] : ''}
        loading={statusMut.isPending}
        onConfirm={() =>
          statusMut.mutate({
            id: confirmAction.request.request_id,
            action: confirmAction.action,
            note: actionNote.trim() || undefined,
          })
        }
      >
        {confirmAction && (
          <div className="space-y-2">
            <p className="text-muted-foreground">
              Học sinh <b>{confirmAction.request.student?.full_name}</b>:{' '}
              {confirmAction.request.from_class?.class_name} →{' '}
              {confirmAction.request.to_class?.class_name}
              {confirmAction.action === 'approve' && (
                <>
                  {' '}
                  — sẽ đổi lớp vào ngày <b>{fmtDate(confirmAction.request.effective_date)}</b>.
                </>
              )}
            </p>
            <div>
              <Label>Ghi chú</Label>
              <Textarea
                rows={2}
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
              />
            </div>
          </div>
        )}
      </ConfirmDialog>
    </>
  );
}
