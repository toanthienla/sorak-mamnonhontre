import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, ArrowLeft, Archive, ArchiveRestore, CalendarDays, GraduationCap, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { useCreate, useUpdate } from '@/shared/hooks/use-crud';
import { apiClient } from '@/shared/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/shared/stores/auth.store';
import { toast } from 'sonner';
import { fmtDate } from '@/shared/utils/date';

const schema = z.object({
  name: z.string().regex(/^\d{4}-\d{4}$/, 'Định dạng: YYYY-YYYY'),
  start_date: z.string().min(1, 'Bắt buộc'),
  end_date: z.string().min(1, 'Bắt buộc'),
  status: z.enum(['active', 'inactive']).optional(),
});

function unwrap(d) {
  const r = d;
  if (r?.data && typeof r.data === 'object' && 'data' in r.data) return r.data.data;
  return r?.data ?? d;
}

const STATUS_BG = {
  active:   'bg-green-50 border-green-200',
  inactive: 'bg-card border-border',
};


export function AcademicYearsModal({ open, onOpenChange }) {
  const role = useAuthStore((s) => s.user?.role);
  const isBGH = role === 'BGH';
  const [view, setView] = useState('list'); // 'list' | 'form' | 'archive'
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [pendingValues, setPendingValues] = useState(null);
  const [confirmActivateOpen, setConfirmActivateOpen] = useState(false);
  const [confirmSetCurrentOpen, setConfirmSetCurrentOpen] = useState(false);

  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['academic-years'],
    queryFn: async () => {
      const res = await apiClient.get('/academic-years');
      return unwrap(res.data);
    },
  });

  const { data: archivedData, isLoading: archivedLoading } = useQuery({
    queryKey: ['academic-years-archived'],
    queryFn: async () => {
      const res = await apiClient.get('/academic-years/archived');
      return unwrap(res.data) ?? [];
    },
    enabled: view === 'archive',
  });

  const restore = useMutation({
    mutationFn: (id) => apiClient.post(`/academic-years/${id}/restore`),
    onSuccess: () => {
      toast.success('Đã khôi phục năm học');
      qc.invalidateQueries({ queryKey: ['academic-years'] });
      qc.invalidateQueries({ queryKey: ['academic-years-archived'] });
    },
  });

  const activate = useMutation({
    mutationFn: (id) => apiClient.patch(`/academic-years/${id}/activate`),
    onSuccess: () => {
      toast.success('Đã đặt làm năm học hiện tại');
      qc.invalidateQueries({ queryKey: ['academic-years'] });
      goList();
    },
  });

  const create = useCreate('academic-years', '/academic-years');
  const update = useUpdate('academic-years', '/academic-years');
  const del = useMutation({
    mutationFn: (id) => apiClient.delete(`/academic-years/${id}`),
    onSuccess: () => {
      toast.success('Đã lưu trữ năm học');
      qc.invalidateQueries({ queryKey: ['academic-years'] });
      qc.invalidateQueries({ queryKey: ['academic-years-archived'] });
    },
  });

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', start_date: '', end_date: '' },
  });

  const goCreate = () => {
    setEditing(null);
    // Auto-suggest next year name from latest existing year
    let suggestedName = '';
    let suggestedStart = '';
    let suggestedEnd = '';
    if (data?.length) {
      const latest = [...data].sort((a, b) => b.name.localeCompare(a.name))[0];
      const match = latest.name.match(/^(\d{4})-(\d{4})$/);
      if (match) {
        const endYear = parseInt(match[2]);
        suggestedName = `${endYear}-${endYear + 1}`;
        suggestedStart = `${endYear}-09-01`;
        suggestedEnd = `${endYear + 1}-05-31`;
      }
    }
    form.reset({ name: suggestedName, start_date: suggestedStart, end_date: suggestedEnd });

    // Warn if suggested name exists in archive
    if (suggestedName) {
      apiClient.get('/academic-years/archived').then((res) => {
        const all = unwrap(res.data) ?? [];
        const inArchive = all.find((y) => y.name === suggestedName);
        if (inArchive) {
          toast.warning(`Năm học "${suggestedName}" đã tồn tại trong lưu trữ. Khôi phục thay vì tạo mới.`, { duration: 5000 });
        }
      });
    }

    setView('form');
  };

  const goEdit = (y) => {
    setEditing(y);
    form.reset({
      name: y.name,
      start_date: y.start_date.slice(0, 10),
      end_date: y.end_date.slice(0, 10),
      status: y.status,
    });
    setView('form');
  };

  const goList = () => {
    setView('list');
    setEditing(null);
  };

  const goArchive = () => setView('archive');

  const doSubmit = async (v) => {
    if (editing) {
      await update.mutateAsync({ id: editing.school_year_id, data: v });
    } else {
      await create.mutateAsync(v);
    }
    goList();
  };

  const onSubmit = async (v) => {
    if (v.status === 'active' && editing?.status !== 'active') {
      const currentActive = data?.find(
        (y) => y.status === 'active' && y.school_year_id !== editing?.school_year_id,
      );
      if (currentActive) {
        setPendingValues(v);
        setConfirmActivateOpen(true);
        return;
      }
    }
    await doSubmit(v);
  };

  const handleOpenChange = (o) => {
    if (!o) goList();
    onOpenChange(o);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <div className="flex items-center gap-2">
              {(view === 'form' || view === 'archive') && (
                <button onClick={goList} className="p-1 rounded hover:bg-accent transition">
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <DialogTitle className="text-base font-semibold">
                {view === 'list' ? 'Năm học' : view === 'archive' ? 'Năm học đã lưu trữ' : editing ? 'Cập nhật năm học' : 'Tạo năm học'}
              </DialogTitle>
            </div>
          </div>

          <div className="px-5 pb-5 pt-2">
            {view === 'list' ? (
              <>
                {isLoading && (
                  <p className="text-sm text-muted-foreground text-center py-10">Đang tải...</p>
                )}
                {!isLoading && !data?.length && (
                  <div className="text-center py-10">
                    <GraduationCap className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Chưa có năm học nào</p>
                  </div>
                )}
                <div className="space-y-2">
                  {data?.map((y) => (
                      <div
                        key={y.school_year_id}
                        className={`rounded-lg border px-4 py-3 ${STATUS_BG[y.status] ?? STATUS_BG.inactive}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm">{y.name}</div>
                            <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                              <CalendarDays className="h-3 w-3 shrink-0" />
                              <span>{fmtDate(y.start_date)} – {fmtDate(y.end_date)}</span>
                            </div>
                          </div>
                          {isBGH && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground shrink-0 -mr-1">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-36">
                                <DropdownMenuItem onClick={() => goEdit(y)}>
                                  <Pencil className="h-3.5 w-3.5 mr-2" /> Chỉnh sửa
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setDeleting(y)} className="text-muted-foreground">
                                  <Archive className="h-3.5 w-3.5 mr-2" /> Lưu trữ
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>
                  ))}
                </div>
                {isBGH && (
                  <div className="flex items-center justify-end gap-2 pt-3 mt-1">
                    <Button size="sm" variant="secondary" onClick={goArchive} className="bg-muted text-muted-foreground hover:bg-muted/80">
                      <Archive className="h-3.5 w-3.5 mr-1.5" /> Xem lưu trữ
                    </Button>
                    <Button size="sm" onClick={goCreate}>
                      <Plus className="h-4 w-4 mr-1" /> Tạo năm học
                    </Button>
                  </div>
                )}
              </>
            ) : view === 'archive' ? (
              <div className="space-y-2 min-h-[80px]">
                {archivedLoading && <p className="text-sm text-muted-foreground text-center py-8">Đang tải...</p>}
                {!archivedLoading && !archivedData?.length && (
                  <div className="text-center py-10">
                    <Archive className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Không có năm học nào trong lưu trữ</p>
                  </div>
                )}
                {archivedData?.map((y) => (
                  <div key={y.school_year_id} className="rounded-lg border border-border bg-muted/30 px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-muted-foreground">{y.name}</div>
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <CalendarDays className="h-3 w-3 shrink-0" />
                        <span>{fmtDate(y.start_date)} – {fmtDate(y.end_date)}</span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs shrink-0" onClick={() => restore.mutate(y.school_year_id)} disabled={restore.isPending}>
                      <ArchiveRestore className="h-3.5 w-3.5" /> Khôi phục
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-1">
                <div>
                  <Label>Tên năm học <span className="text-destructive">*</span></Label>
                  <Input
                    className="mt-1 bg-muted text-muted-foreground cursor-not-allowed"
                    readOnly
                    {...form.register('name')}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Ngày bắt đầu <span className="text-destructive">*</span></Label>
                    <Input className="mt-1" type="date" {...form.register('start_date')} />
                    {form.formState.errors.start_date && (
                      <p className="text-xs text-destructive mt-1">{form.formState.errors.start_date.message}</p>
                    )}
                  </div>
                  <div>
                    <Label>Ngày kết thúc <span className="text-destructive">*</span></Label>
                    <Input className="mt-1" type="date" {...form.register('end_date')} />
                    {form.formState.errors.end_date && (
                      <p className="text-xs text-destructive mt-1">{form.formState.errors.end_date.message}</p>
                    )}
                  </div>
                </div>
                {editing && editing.status !== 'active' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmSetCurrentOpen(true)}
                  >
                    Đặt làm năm học hiện tại
                  </Button>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={goList}>Hủy</Button>
                  <Button type="submit" disabled={create.isPending || update.isPending}>
                    {editing ? 'Cập nhật' : 'Tạo năm học'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        title="Lưu trữ năm học?"
        description="Chỉ lưu trữ được nếu chưa có lớp liên kết."
        confirmLabel="Lưu trữ"
        loading={del.isPending}
        onConfirm={async () => {
          if (deleting) {
            await del.mutateAsync(deleting.school_year_id);
            setDeleting(null);
          }
        }}
      />

      <ConfirmDialog
        open={confirmActivateOpen}
        onOpenChange={(v) => {
          if (!v) {
            setConfirmActivateOpen(false);
            setPendingValues(null);
          }
        }}
        title="Chuyển năm học đang diễn ra?"
        description={`"${data?.find((y) => y.status === 'active')?.name}" đang diễn ra sẽ bị đóng lại. Tiếp tục?`}
        confirmLabel="Xác nhận"
        loading={update.isPending}
        onConfirm={async () => {
          if (pendingValues) {
            await doSubmit(pendingValues);
            setConfirmActivateOpen(false);
            setPendingValues(null);
          }
        }}
      />
      <ConfirmDialog
        open={confirmSetCurrentOpen}
        onOpenChange={(v) => !v && setConfirmSetCurrentOpen(false)}
        title="Đặt làm năm học hiện tại?"
        description={`Tất cả năm học khác sẽ chuyển sang không hoạt động. Tiếp tục?`}
        confirmLabel="Xác nhận"
        loading={activate.isPending}
        onConfirm={async () => {
          if (editing) {
            await activate.mutateAsync(editing.school_year_id);
            setConfirmSetCurrentOpen(false);
          }
        }}
      />
    </>
  );
}
