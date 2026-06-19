import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus,
  ArrowLeft,
  CalendarDays,
  CalendarCheck,
  GraduationCap,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
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
  active: 'bg-green-50 border-green-200 hover:bg-green-100/70',
  inactive: 'bg-card border-border hover:bg-muted/40',
};

export function AcademicYearsModal({ open, onOpenChange }) {
  const role = useAuthStore((s) => s.user?.role);
  const isBGH = role === 'PRINCIPAL';
  const [view, setView] = useState('list'); // 'list' | 'form'
  const [editing, setEditing] = useState(null);
  const [pendingValues, setPendingValues] = useState(null);
  const [confirmActivateOpen, setConfirmActivateOpen] = useState(false);
  const [confirmSetCurrentOpen, setConfirmSetCurrentOpen] = useState(false);
  const [confirmPromoteOpen, setConfirmPromoteOpen] = useState(false);
  const [nameInArchive, setNameInArchive] = useState(false);

  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['academic-years'],
    queryFn: async () => {
      const res = await apiClient.get('/academic-years');
      return unwrap(res.data);
    },
  });

  const activeYear = data?.find((y) => y.status === 'active');
  const hasFutureYear = data?.some(
    (y) => y.status === 'inactive' && (!activeYear || y.name > activeYear.name),
  );

  const activate = useMutation({
    mutationFn: (id) => apiClient.patch(`/academic-years/${id}/activate`),
    onSuccess: () => {
      toast.success('Đã đặt làm năm học hiện tại');
      qc.invalidateQueries({ queryKey: ['academic-years'] });
      goList();
    },
  });

  // Promote prev-year completed students into this (active) year — separate from activate
  const promote = useMutation({
    mutationFn: (id) => apiClient.post(`/academic-years/${id}/promote`),
    onSuccess: (res) => {
      const r = res.data?.data ?? res.data ?? {};
      toast.success(
        `Đã lên lớp: ${r.promoted ?? 0} · Tốt nghiệp: ${r.graduated ?? 0} · Bỏ qua: ${r.skipped ?? 0}`,
        { duration: 8000 },
      );
      qc.invalidateQueries({ queryKey: ['academic-years'] });
    },
  });

  const create = useCreate('academic-years', '/academic-years');
  const update = useUpdate('academic-years', '/academic-years');

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
    setNameInArchive(false);
    form.reset({ name: suggestedName, start_date: suggestedStart, end_date: suggestedEnd });

    // Check if suggested name exists in archive → disable submit
    if (suggestedName) {
      apiClient.get('/academic-years/archived').then((res) => {
        const all = unwrap(res.data) ?? [];
        const inArchive = all.find((y) => y.name === suggestedName);
        if (inArchive) setNameInArchive(true);
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
              {view === 'form' && (
                <button onClick={goList} className="p-1 rounded hover:bg-accent transition">
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <DialogTitle className="text-base font-semibold">
                {view === 'list' ? 'Năm học' : editing ? 'Cập nhật năm học' : 'Tạo năm học'}
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
                    <button
                      key={y.school_year_id}
                      type="button"
                      onClick={() => isBGH && goEdit(y)}
                      disabled={!isBGH}
                      className={`w-full text-left rounded-lg border px-4 py-3 transition-colors ${STATUS_BG[y.status] ?? STATUS_BG.inactive} ${isBGH ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm">{y.name}</div>
                          <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                            <CalendarDays className="h-3 w-3 shrink-0" />
                            <span>
                              {fmtDate(y.start_date)} – {fmtDate(y.end_date)}
                            </span>
                          </div>
                        </div>
                        {isBGH && (
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
                {isBGH && (
                  <div className="flex items-center justify-end gap-2 pt-3 mt-1">
                    <Button
                      size="sm"
                      onClick={goCreate}
                      disabled={hasFutureYear}
                      title={
                        hasFutureYear
                          ? 'Đã có năm học sắp tới — kích hoạt trước khi tạo thêm'
                          : undefined
                      }
                    >
                      <Plus className="h-4 w-4 mr-1" /> Tạo năm học
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-1">
                <div>
                  <Label>
                    Tên năm học <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    className="mt-1 bg-muted text-muted-foreground cursor-not-allowed"
                    readOnly
                    {...form.register('name')}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>
                      Ngày bắt đầu <span className="text-destructive">*</span>
                    </Label>
                    <Input className="mt-1" type="date" {...form.register('start_date')} />
                    {form.formState.errors.start_date && (
                      <p className="text-xs text-destructive mt-1">
                        {form.formState.errors.start_date.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>
                      Ngày kết thúc <span className="text-destructive">*</span>
                    </Label>
                    <Input className="mt-1" type="date" {...form.register('end_date')} />
                    {form.formState.errors.end_date && (
                      <p className="text-xs text-destructive mt-1">
                        {form.formState.errors.end_date.message}
                      </p>
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
                    <CalendarCheck className="h-3.5 w-3.5 mr-1.5" /> Đặt làm năm học hiện tại
                  </Button>
                )}
                {editing && editing.status === 'active' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmPromoteOpen(true)}
                    disabled={promote.isPending}
                  >
                    <GraduationCap className="h-3.5 w-3.5 mr-1.5" /> Lên lớp học sinh
                  </Button>
                )}
                {!editing && nameInArchive && (
                  <p className="text-xs text-amber-600 text-right pb-1">
                    Năm học này đã có trong lưu trữ — hãy khôi phục thay vì tạo mới.
                  </p>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={goList}>
                    Hủy
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      create.isPending ||
                      update.isPending ||
                      (!!editing && !form.formState.isDirty) ||
                      (!editing && nameInArchive)
                    }
                  >
                    {editing ? 'Cập nhật' : 'Tạo năm học'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
        title={`Kích hoạt năm học ${editing?.name}?`}
        confirmLabel="Kích hoạt"
        contentClassName="sm:max-w-sm"
        loading={activate.isPending}
        onConfirm={async () => {
          if (editing) {
            await activate.mutateAsync(editing.school_year_id);
            setConfirmSetCurrentOpen(false);
          }
        }}
      >
        {/* Thời gian — timeline (sorted chronologically) */}
        {(() => {
          const fmt = (d) => (d ? d.toLocaleDateString('vi-VN') : '—');
          const points = [
            { label: 'Bắt đầu', date: editing?.start_date ? new Date(editing.start_date) : null },
            { label: 'Hôm nay', date: new Date(), highlight: true },
            { label: 'Kết thúc', date: editing?.end_date ? new Date(editing.end_date) : null },
          ]
            .filter((p) => p.date)
            .sort((a, b) => a.date - b.date)
            .map((p) => ({ ...p, value: fmt(p.date) }));
          return (
            <div className="rounded-lg border bg-muted/30 px-4 py-3">
              {points.map((p, i) => (
                <div key={p.label} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={`mt-1 h-2.5 w-2.5 rounded-full ${p.highlight ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                    />
                    {i < points.length - 1 && <span className="w-px flex-1 bg-border" />}
                  </div>
                  <div className={i === points.length - 1 ? '' : 'pb-3'}>
                    <p className="text-xs text-muted-foreground leading-tight">{p.label}</p>
                    <p
                      className={`text-sm font-semibold leading-tight ${p.highlight ? 'text-primary' : ''}`}
                    >
                      {p.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmPromoteOpen}
        onOpenChange={(v) => !v && setConfirmPromoteOpen(false)}
        title={`Lên lớp học sinh — ${editing?.name}?`}
        confirmLabel="Lên lớp"
        loading={promote.isPending}
        onConfirm={async () => {
          if (editing) {
            await promote.mutateAsync(editing.school_year_id);
            setConfirmPromoteOpen(false);
          }
        }}
      >
        {/* Chuyển cấp */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Chuyển cấp
          </p>
          <div className="rounded-md border divide-y text-sm">
            {[
              { from: 'Nhà trẻ', to: 'Mầm' },
              { from: 'Mầm', to: 'Chồi' },
              { from: 'Chồi', to: 'Lá' },
              { from: 'Lá', to: 'Tốt nghiệp', highlight: true },
            ].map(({ from, to, highlight }) => (
              <div key={from} className="flex items-center justify-between px-3 py-2">
                <span className="font-medium w-20">{from}</span>
                <span className="text-muted-foreground text-xs">→</span>
                <span
                  className={`flex-1 text-center ${highlight ? 'text-amber-600 font-medium' : ''}`}
                >
                  {to}
                </span>
              </div>
            ))}
          </div>
          <ul className="text-xs text-muted-foreground pt-1 space-y-0.5 list-disc pl-4">
            <li>
              Chỉ lên lớp học sinh <span className="font-medium text-foreground">có lớp</span> và{' '}
              <span className="font-medium text-foreground">đã hoàn thành chương trình</span>.
            </li>
            <li>
              Lớp <span className="font-medium text-foreground">Lá</span> tốt nghiệp —{' '}
              <span className="font-medium text-foreground">không đem lên</span>.
            </li>
            <li>
              Học sinh <span className="font-medium text-foreground">đã lên lớp</span> ở năm này sẽ
              được <span className="font-medium text-foreground">bỏ qua</span>.
            </li>
            <li>
              Học sinh lên lớp{' '}
              <span className="font-medium text-foreground">chưa được xếp lớp</span>, xếp thủ công
              sau.
            </li>
          </ul>
        </div>
      </ConfirmDialog>
    </>
  );
}
