import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  FolderPlus,
  Pencil,
  Save,
  Search,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/shared/components/page-header';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { apiClient } from '@/shared/api/client';
import { fmtDate } from '@/shared/utils/date';
import { useYearStore } from '@/shared/stores/year.store';
import { WeeklyDevelopmentPlansTab } from './WeeklyDevelopmentPlans';

function getErrorMessage(error, fallback) {
  return error?.response?.data?.message || fallback;
}

function monthlyPlanStatusMeta(status) {
  if (status === 'READY')
    return { label: 'Chính thức', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
  if (status === 'USED')
    return { label: 'Đã sử dụng', className: 'border-blue-200 bg-blue-50 text-blue-700' };
  return { label: 'Bản nháp', className: '' };
}

function MonthlyPlanStatusBadge({ status }) {
  const meta = monthlyPlanStatusMeta(status);
  return (
    <Badge variant="outline" className={`shrink-0 ${meta.className}`}>
      {meta.label}
    </Badge>
  );
}

function countSelectedCriteria(criteria, selectedIds) {
  return (criteria ?? []).filter((criterion) => selectedIds.has(criterion.criterionId)).length;
}

function countTopic(topic, selectedIds) {
  return countSelectedCriteria(topic.criteria, selectedIds);
}

function countTheme(theme, selectedIds) {
  return (theme.topics ?? []).reduce((sum, topic) => sum + countTopic(topic, selectedIds), 0);
}

function countSubject(subject, selectedIds) {
  return (subject.themes ?? []).reduce((sum, theme) => sum + countTheme(theme, selectedIds), 0);
}

function countField(field, selectedIds) {
  return (field.subjects ?? []).reduce(
    (sum, subject) => sum + countSubject(subject, selectedIds),
    0,
  );
}

function countSelectedTopics(tree, selectedIds) {
  let total = 0;
  for (const field of tree ?? []) {
    for (const subject of field.subjects ?? []) {
      for (const theme of subject.themes ?? []) {
        for (const topic of theme.topics ?? []) {
          if (countTopic(topic, selectedIds) > 0) total += 1;
        }
      }
    }
  }
  return total;
}

function countSelectedFields(tree, selectedIds) {
  return (tree ?? []).filter((field) => countField(field, selectedIds) > 0).length;
}

function filterTreeByControls(tree, filters) {
  return (tree ?? [])
    .filter(
      (field) => filters.fieldId === 'ALL' || String(field.developmentFieldId) === filters.fieldId,
    )
    .map((field) => ({
      ...field,
      subjects: field.subjects
        .filter(
          (subject) =>
            filters.subjectId === 'ALL' || String(subject.subjectId) === filters.subjectId,
        )
        .map((subject) => ({
          ...subject,
          themes: subject.themes
            .filter(
              (theme) => filters.themeId === 'ALL' || String(theme.themeId) === filters.themeId,
            )
            .map((theme) => ({
              ...theme,
              topics: theme.topics,
            }))
            .filter((theme) => theme.topics.length > 0),
        }))
        .filter((subject) => subject.themes.length > 0),
    }))
    .filter((field) => field.subjects.length > 0);
}

function buildBankFilters(tree, filters = {}) {
  const fields = [];
  const subjects = new Map();
  const themes = new Map();

  for (const field of tree ?? []) {
    fields.push({
      id: String(field.developmentFieldId),
      name: field.developmentFieldName,
    });
    if (
      filters.fieldId &&
      filters.fieldId !== 'ALL' &&
      String(field.developmentFieldId) !== filters.fieldId
    ) {
      continue;
    }
    for (const subject of field.subjects ?? []) {
      subjects.set(String(subject.subjectId), subject.subjectName);
      if (
        filters.subjectId &&
        filters.subjectId !== 'ALL' &&
        String(subject.subjectId) !== filters.subjectId
      ) {
        continue;
      }
      for (const theme of subject.themes ?? []) {
        themes.set(String(theme.themeId), theme.themeName);
      }
    }
  }

  return {
    fields,
    subjects: [...subjects].map(([id, name]) => ({ id, name })),
    themes: [...themes].map(([id, name]) => ({ id, name })),
  };
}

function filterTreeBySelection(tree, selectedIds) {
  if (selectedIds.size === 0) return [];
  return (tree ?? [])
    .map((field) => ({
      ...field,
      subjects: field.subjects
        .map((subject) => ({
          ...subject,
          themes: subject.themes
            .map((theme) => ({
              ...theme,
              topics: theme.topics
                .map((topic) => ({
                  ...topic,
                  criteria: topic.criteria.filter((criterion) =>
                    selectedIds.has(criterion.criterionId),
                  ),
                }))
                .filter((topic) => topic.criteria.length > 0),
            }))
            .filter((theme) => theme.topics.length > 0),
        }))
        .filter((subject) => subject.themes.length > 0),
    }))
    .filter((field) => field.subjects.length > 0);
}

function contextText(context) {
  if (!context) return '';
  return `Lớp: ${context.class?.class_name ?? ''} · Nhóm tuổi: ${
    context.ageGroup?.name_vi ?? ''
  } · Năm học: ${context.academicYear?.name ?? ''}`;
}

function formatPlanningMonth(plan) {
  if (!plan?.planning_month || !plan?.planning_year) return '-';
  return `${String(plan.planning_month).padStart(2, '0')}/${plan.planning_year}`;
}

function formatApplicableWeeks(weeks = []) {
  if (!weeks.length) return '-';
  const sorted = [...weeks].sort((a, b) => a.week_number - b.week_number);
  const first = sorted[0].week_number;
  const last = sorted[sorted.length - 1].week_number;
  return first === last ? `Tuần ${first}` : `Tuần ${first} - Tuần ${last}`;
}

function monthValueFromPlan(plan) {
  if (!plan?.planning_year || !plan?.planning_month) return '';
  return `${plan.planning_year}-${String(plan.planning_month).padStart(2, '0')}`;
}

function parseMonthValue(value) {
  const [year, month] = value.split('-').map(Number);
  return { year, month };
}

export function MonthlyThemePlansPage() {
  const { id } = useParams();
  const location = useLocation();
  if (location.pathname.endsWith('/new')) return <PlanListPage />;
  if (id && location.pathname.endsWith('/edit')) return <PlanDetailPage id={Number(id)} />;
  if (id) return <PlanDetailPage id={Number(id)} />;
  return <EducationPlanningPage />;
}

function EducationPlanningPage() {
  return (
    <div>
      <PageHeader
        title="Kế hoạch giáo dục"
        description="Quản lý kế hoạch tháng/chủ đề và kế hoạch tuần cho lớp được phân công."
      />
      <Tabs defaultValue="monthly" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="monthly">Kế hoạch tháng/chủ đề</TabsTrigger>
          <TabsTrigger value="weekly">Kế hoạch tuần</TabsTrigger>
        </TabsList>
        <TabsContent value="monthly">
          <PlanListPage embedded />
        </TabsContent>
        <TabsContent value="weekly">
          <WeeklyDevelopmentPlansTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PlanListPage({ embedded = false }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const selectedYearId = useYearStore((state) => state.selectedYearId);
  const [keyword, setKeyword] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const params = useMemo(
    () => ({
      page: 1,
      pageSize: 100,
      ...(selectedYearId ? { academicYearId: selectedYearId } : {}),
      ...(keyword.trim() ? { keyword: keyword.trim() } : {}),
    }),
    [keyword, selectedYearId],
  );
  const { data, isLoading, error } = useQuery({
    queryKey: ['monthly-theme-plans', params],
    queryFn: async () => {
      const res = await apiClient.get('/monthly-theme-plans', { params });
      return res.data;
    },
    retry: false,
  });
  const plans = data?.data ?? [];
  const context = data?.meta?.context;
  const createMut = useMutation({
    mutationFn: async (payload) => {
      const res = await apiClient.post('/monthly-theme-plans', payload);
      return res.data.data;
    },
    onSuccess: (plan) => {
      toast.success('Tạo kế hoạch thành công.');
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ['monthly-theme-plans'] });
      navigate(`/monthly-theme-plans/${plan.monthly_theme_plan_id}`);
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Không thể tạo kế hoạch.')),
  });
  const deleteMut = useMutation({
    mutationFn: async (planId) => {
      const res = await apiClient.delete(`/monthly-theme-plans/${planId}`);
      return res.data.data;
    },
    onSuccess: () => {
      toast.success('Đã xóa kế hoạch.');
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: ['monthly-theme-plans'] });
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Không thể xóa kế hoạch.')),
  });
  const updateMut = useMutation({
    mutationFn: async ({ planId, payload }) => {
      const res = await apiClient.put(`/monthly-theme-plans/${planId}`, payload);
      return res.data.data;
    },
    onSuccess: () => {
      toast.success('Cập nhật kế hoạch thành công.');
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['monthly-theme-plans'] });
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Không thể cập nhật kế hoạch.')),
  });

  return (
    <div>
      {!embedded && (
        <PageHeader
          title="Kế hoạch tháng/chủ đề"
          description="Tạo không gian lưu trữ đề tài và tiêu chí đánh giá cho lớp được phân công."
        />
      )}
      {context && (
        <div className="mb-4 rounded-md border bg-muted/20 px-3 py-2 text-sm font-medium">
          {contextText(context)}
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border bg-card p-3">
        <div className="flex min-w-64 flex-1 items-center gap-2 rounded-md border bg-background px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Tìm tên kế hoạch..."
            className="border-0 px-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <Button onClick={() => setCreateOpen(true)} className="ml-auto shrink-0">
          <FolderPlus className="mr-1.5 h-4 w-4" />
          Thêm kế hoạch
        </Button>
      </div>
      {error ? (
        <div className="rounded-md border bg-card p-6 text-center text-sm text-muted-foreground">
          {getErrorMessage(error, 'Không thể tải kế hoạch tháng/chủ đề.')}
        </div>
      ) : isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-40 animate-pulse rounded-md border bg-muted/40" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <div className="rounded-md border bg-card p-6 text-center text-sm text-muted-foreground">
          Chưa có kế hoạch tháng/chủ đề nào.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {plans.map((plan) => (
            <div
              key={plan.monthly_theme_plan_id}
              className="flex min-h-40 flex-col justify-between rounded-md border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/10"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="line-clamp-2 font-semibold leading-6">{plan.name}</h3>
                  <MonthlyPlanStatusBadge status={plan.status} />
                </div>
                <p className="text-sm text-muted-foreground">
                  Tháng triển khai: {formatPlanningMonth(plan)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatApplicableWeeks(plan.weeks)} · {fmtDate(plan.expected_start_date)} -{' '}
                  {fmtDate(plan.expected_end_date)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {plan.selectedTopicCount ?? 0} đề tài · {plan.selectedCriterionCount ?? 0} tiêu
                  chí
                </p>
                <p className="text-xs text-muted-foreground">
                  Cập nhật: {fmtDate(plan.updated_at)}
                </p>
              </div>
              <div className="mt-4 grid gap-2">
                <Button asChild className="w-full" variant="outline">
                  <Link to={`/monthly-theme-plans/${plan.monthly_theme_plan_id}`}>
                    Xem chi tiết
                  </Link>
                </Button>
                {plan.status === 'DRAFT' && (
                  <Button className="w-full" variant="outline" onClick={() => setEditing(plan)}>
                    <Pencil className="mr-1.5 h-4 w-4" />
                    Chỉnh sửa thông tin
                  </Button>
                )}
                {plan.status !== 'USED' && (
                  <Button
                    type="button"
                    className="w-full"
                    variant="destructive"
                    onClick={() => setDeleting(plan)}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    Xóa
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <CreatePlanDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        selectedYearId={selectedYearId}
        loading={createMut.isPending}
        onSubmit={(payload) => createMut.mutate(payload)}
      />
      <PlanInfoDialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        plan={editing}
        selectedYearId={selectedYearId}
        loading={updateMut.isPending}
        onSubmit={(payload) =>
          editing && updateMut.mutate({ planId: editing.monthly_theme_plan_id, payload })
        }
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Xóa kế hoạch?"
        description={
          deleting
            ? `Kế hoạch "${deleting.name}" sẽ bị xóa khỏi danh sách. Các tiêu chí đã chọn trong kế hoạch này cũng sẽ không còn được lưu trong kế hoạch. Bạn có chắc muốn xóa không?`
            : ''
        }
        confirmLabel="Xóa kế hoạch"
        variant="destructive"
        loading={deleteMut.isPending}
        onConfirm={() => deleting && deleteMut.mutate(deleting.monthly_theme_plan_id)}
      />
    </div>
  );
}

function CreatePlanDialog({ open, onOpenChange, selectedYearId, loading, onSubmit }) {
  const [form, setForm] = useState({
    name: '',
    planningMonth: '',
    selectedWeeks: [],
    note: '',
  });

  useEffect(() => {
    if (open) {
      setForm({ name: '', planningMonth: '', selectedWeeks: [], note: '' });
    }
  }, [open]);

  const { year, month } = form.planningMonth ? parseMonthValue(form.planningMonth) : {};
  const weeksQuery = useQuery({
    queryKey: ['monthly-theme-plan-weeks-create', selectedYearId, year, month],
    queryFn: async () => {
      const res = await apiClient.get('/monthly-theme-plans/planning-weeks', {
        params: {
          ...(selectedYearId ? { academicYearId: selectedYearId } : {}),
          year,
          month,
        },
      });
      return res.data.data;
    },
    enabled: open && Boolean(year && month),
    retry: false,
  });
  const weeks = weeksQuery.data?.weeks ?? [];
  const sortedSelectedWeeks = [...form.selectedWeeks].sort((a, b) => a - b);
  const hasGap = sortedSelectedWeeks.some(
    (weekNumber, index) => index > 0 && weekNumber !== sortedSelectedWeeks[index - 1] + 1,
  );
  const canSave =
    form.name.trim() && form.planningMonth && form.selectedWeeks.length > 0 && !hasGap;

  const toggleWeek = (weekNumber) => {
    setForm((current) => {
      const selected = new Set(current.selectedWeeks);
      if (selected.has(weekNumber)) selected.delete(weekNumber);
      else selected.add(weekNumber);
      return { ...current, selectedWeeks: [...selected].sort((a, b) => a - b) };
    });
  };

  const submit = (event) => {
    event.preventDefault();
    const { year: planningYear, month: planningMonth } = parseMonthValue(form.planningMonth);
    onSubmit({
      name: form.name.trim(),
      planningYear,
      planningMonth,
      selectedWeeks: sortedSelectedWeeks,
      note: form.note.trim(),
      ...(selectedYearId ? { academicYearId: selectedYearId } : {}),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Thêm kế hoạch tháng/chủ đề</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>
                  Tên kế hoạch <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={form.name}
                  onChange={(event) => setForm((cur) => ({ ...cur, name: event.target.value }))}
                  placeholder="Ví dụ: Chủ đề Động vật"
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  Tháng triển khai <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="month"
                  value={form.planningMonth}
                  onChange={(event) =>
                    setForm((cur) => ({
                      ...cur,
                      planningMonth: event.target.value,
                      selectedWeeks: [],
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Ghi chú</Label>
                <Textarea
                  value={form.note}
                  onChange={(event) => setForm((cur) => ({ ...cur, note: event.target.value }))}
                  placeholder="Nhập ghi chú nếu cần"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>
                Tuần áp dụng <span className="text-destructive">*</span>
              </Label>
              {weeksQuery.error ? (
                <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  {getErrorMessage(weeksQuery.error, 'Không thể tải danh sách tuần.')}
                </div>
              ) : !form.planningMonth ? (
                <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  Chọn tháng triển khai để xem các tuần áp dụng.
                </div>
              ) : weeksQuery.isLoading ? (
                <div className="h-28 animate-pulse rounded-md bg-muted/40" />
              ) : (
                <WeekPicker
                  weeks={weeks}
                  selectedWeeks={form.selectedWeeks}
                  onToggle={toggleWeek}
                />
              )}
              {hasGap && (
                <p className="text-sm text-destructive">
                  Các tuần áp dụng của một kế hoạch cần liên tiếp nhau.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={!canSave || loading}>
              Lưu và tiếp tục
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PlanInfoDialog({ open, onOpenChange, plan, selectedYearId, loading, onSubmit }) {
  const [form, setForm] = useState({
    name: '',
    planningMonth: '',
    selectedWeeks: [],
    note: '',
  });

  useEffect(() => {
    if (!open || !plan) return;
    setForm({
      name: plan.name ?? '',
      planningMonth: monthValueFromPlan(plan),
      selectedWeeks: (plan.weeks ?? []).map((week) => week.week_number),
      note: plan.note ?? '',
    });
  }, [open, plan]);

  const { year, month } = form.planningMonth ? parseMonthValue(form.planningMonth) : {};
  const weeksQuery = useQuery({
    queryKey: [
      'monthly-theme-plan-weeks-edit-modal',
      selectedYearId,
      year,
      month,
      plan?.monthly_theme_plan_id,
    ],
    queryFn: async () => {
      const res = await apiClient.get('/monthly-theme-plans/planning-weeks', {
        params: {
          ...(selectedYearId ? { academicYearId: selectedYearId } : {}),
          year,
          month,
          ...(plan?.monthly_theme_plan_id ? { exceptId: plan.monthly_theme_plan_id } : {}),
        },
      });
      return res.data.data;
    },
    enabled: open && Boolean(year && month),
    retry: false,
  });
  const weeks = weeksQuery.data?.weeks ?? [];
  const sortedSelectedWeeks = [...form.selectedWeeks].sort((a, b) => a - b);
  const hasGap = sortedSelectedWeeks.some(
    (weekNumber, index) => index > 0 && weekNumber !== sortedSelectedWeeks[index - 1] + 1,
  );
  const canSave =
    form.name.trim() && form.planningMonth && form.selectedWeeks.length > 0 && !hasGap;

  const toggleWeek = (weekNumber) => {
    setForm((current) => {
      const selected = new Set(current.selectedWeeks);
      if (selected.has(weekNumber)) selected.delete(weekNumber);
      else selected.add(weekNumber);
      return { ...current, selectedWeeks: [...selected].sort((a, b) => a - b) };
    });
  };

  const submit = (event) => {
    event.preventDefault();
    const { year: planningYear, month: planningMonth } = parseMonthValue(form.planningMonth);
    onSubmit({
      name: form.name.trim(),
      planningYear,
      planningMonth,
      selectedWeeks: sortedSelectedWeeks,
      note: form.note.trim(),
      ...(selectedYearId ? { academicYearId: selectedYearId } : {}),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa thông tin kế hoạch</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>
                  Tên kế hoạch <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={form.name}
                  onChange={(event) => setForm((cur) => ({ ...cur, name: event.target.value }))}
                  placeholder="Ví dụ: Chủ đề Động vật"
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  Tháng triển khai <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="month"
                  value={form.planningMonth}
                  onChange={(event) =>
                    setForm((cur) => ({
                      ...cur,
                      planningMonth: event.target.value,
                      selectedWeeks: [],
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Ghi chú</Label>
                <Textarea
                  value={form.note}
                  onChange={(event) => setForm((cur) => ({ ...cur, note: event.target.value }))}
                  placeholder="Nhập ghi chú nếu cần"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>
                Tuần áp dụng <span className="text-destructive">*</span>
              </Label>
              {weeksQuery.error ? (
                <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  {getErrorMessage(weeksQuery.error, 'Không thể tải danh sách tuần.')}
                </div>
              ) : !form.planningMonth ? (
                <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  Chọn tháng triển khai để xem các tuần áp dụng.
                </div>
              ) : weeksQuery.isLoading ? (
                <div className="h-28 animate-pulse rounded-md bg-muted/40" />
              ) : (
                <WeekPicker
                  weeks={weeks}
                  selectedWeeks={form.selectedWeeks}
                  onToggle={toggleWeek}
                />
              )}
              {hasGap && (
                <p className="text-sm text-destructive">
                  Các tuần áp dụng của một kế hoạch cần liên tiếp nhau.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={!canSave || loading}>
              Cập nhật
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function WeekPicker({ weeks, selectedWeeks, onToggle }) {
  return (
    <div className="space-y-2">
      {weeks.map((week) => {
        const checked = selectedWeeks.includes(week.weekNumber);
        const disabled = Boolean(week.occupiedByPlanId);
        return (
          <div
            key={week.weekNumber}
            role="button"
            tabIndex={disabled ? -1 : 0}
            onClick={() => !disabled && onToggle(week.weekNumber)}
            onKeyDown={(event) => {
              if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                onToggle(week.weekNumber);
              }
            }}
            className={`w-full rounded-md border p-3 text-left text-sm transition ${
              checked ? 'border-primary bg-primary/5' : 'bg-background hover:bg-muted/30'
            } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
          >
            <div className="flex items-center gap-2 font-medium">
              <span
                className={`grid h-4 w-4 shrink-0 place-content-center rounded-sm border ${
                  checked
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-background'
                }`}
                aria-hidden="true"
              >
                {checked && <Check className="h-3.5 w-3.5" />}
              </span>
              <span>
                Tuần {week.weekNumber} · {week.displayRange}
              </span>
            </div>
            {week.occupiedByPlanName && (
              <div className="mt-1 pl-6 text-xs text-muted-foreground">
                Đã thuộc kế hoạch: {week.occupiedByPlanName}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PlanFormPage({ id }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const selectedYearId = useYearStore((state) => state.selectedYearId);
  const isEdit = Boolean(id);
  const [form, setForm] = useState({
    name: '',
    planningMonth: '',
    selectedWeeks: [],
    note: '',
  });

  const detailQuery = useQuery({
    queryKey: ['monthly-theme-plan', id],
    queryFn: async () => {
      const res = await apiClient.get(`/monthly-theme-plans/${id}`);
      return res.data.data;
    },
    enabled: isEdit,
    retry: false,
  });

  useEffect(() => {
    const plan = detailQuery.data;
    if (!plan) return;
    setForm({
      name: plan.name ?? '',
      planningMonth: monthValueFromPlan(plan),
      selectedWeeks: (plan.weeks ?? []).map((week) => week.week_number),
      note: plan.note ?? '',
    });
  }, [detailQuery.data]);

  const { year, month } = form.planningMonth ? parseMonthValue(form.planningMonth) : {};
  const weeksQuery = useQuery({
    queryKey: ['monthly-theme-plan-weeks', selectedYearId, year, month, id],
    queryFn: async () => {
      const res = await apiClient.get('/monthly-theme-plans/planning-weeks', {
        params: {
          ...(selectedYearId ? { academicYearId: selectedYearId } : {}),
          year,
          month,
          ...(id ? { exceptId: id } : {}),
        },
      });
      return res.data.data;
    },
    enabled: Boolean(year && month),
    retry: false,
  });
  const weeks = weeksQuery.data?.weeks ?? [];
  const sortedSelectedWeeks = [...form.selectedWeeks].sort((a, b) => a - b);
  const hasGap = sortedSelectedWeeks.some(
    (weekNumber, index) => index > 0 && weekNumber !== sortedSelectedWeeks[index - 1] + 1,
  );
  const canSave =
    form.name.trim() && form.planningMonth && form.selectedWeeks.length > 0 && !hasGap;

  const saveMut = useMutation({
    mutationFn: async () => {
      const { year: planningYear, month: planningMonth } = parseMonthValue(form.planningMonth);
      const payload = {
        name: form.name.trim(),
        planningYear,
        planningMonth,
        selectedWeeks: sortedSelectedWeeks,
        note: form.note.trim(),
        ...(selectedYearId ? { academicYearId: selectedYearId } : {}),
      };
      const res = isEdit
        ? await apiClient.put(`/monthly-theme-plans/${id}`, payload)
        : await apiClient.post('/monthly-theme-plans', payload);
      return res.data.data;
    },
    onSuccess: (plan) => {
      toast.success(isEdit ? 'Cập nhật kế hoạch thành công.' : 'Tạo kế hoạch thành công.');
      queryClient.invalidateQueries({ queryKey: ['monthly-theme-plans'] });
      queryClient.invalidateQueries({ queryKey: ['monthly-theme-plan', id] });
      navigate(`/monthly-theme-plans/${plan.monthly_theme_plan_id}`);
    },
    onError: (error) =>
      toast.error(
        getErrorMessage(error, isEdit ? 'Không thể cập nhật kế hoạch.' : 'Không thể tạo kế hoạch.'),
      ),
  });

  const toggleWeek = (weekNumber) => {
    setForm((current) => {
      const selected = new Set(current.selectedWeeks);
      if (selected.has(weekNumber)) selected.delete(weekNumber);
      else selected.add(weekNumber);
      return { ...current, selectedWeeks: [...selected].sort((a, b) => a - b) };
    });
  };

  if (detailQuery.error) {
    return (
      <div className="rounded-md border bg-card p-6 text-center text-sm text-muted-foreground">
        {getErrorMessage(detailQuery.error, 'Không thể tải kế hoạch.')}
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Chỉnh sửa kế hoạch tháng/chủ đề' : 'Thêm kế hoạch tháng/chủ đề'}
        description="Chọn tháng triển khai và các tuần áp dụng liên tiếp cho kế hoạch."
      />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          saveMut.mutate();
        }}
        className="space-y-4 rounded-md border bg-card p-4"
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>
                Tên kế hoạch <span className="text-destructive">*</span>
              </Label>
              <Input
                value={form.name}
                onChange={(event) => setForm((cur) => ({ ...cur, name: event.target.value }))}
                placeholder="Ví dụ: Chủ đề Động vật"
              />
            </div>
            <div className="space-y-1.5">
              <Label>
                Tháng triển khai <span className="text-destructive">*</span>
              </Label>
              <Input
                type="month"
                value={form.planningMonth}
                onChange={(event) =>
                  setForm((cur) => ({
                    ...cur,
                    planningMonth: event.target.value,
                    selectedWeeks: [],
                  }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Ghi chú</Label>
              <Textarea
                value={form.note}
                onChange={(event) => setForm((cur) => ({ ...cur, note: event.target.value }))}
                placeholder="Nhập ghi chú nếu cần"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>
              Tuần áp dụng <span className="text-destructive">*</span>
            </Label>
            {weeksQuery.error ? (
              <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                {getErrorMessage(weeksQuery.error, 'Không thể tải danh sách tuần.')}
              </div>
            ) : !form.planningMonth ? (
              <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                Chọn tháng triển khai để xem các tuần áp dụng.
              </div>
            ) : weeksQuery.isLoading ? (
              <div className="h-28 animate-pulse rounded-md bg-muted/40" />
            ) : (
              <div className="space-y-2">
                {weeks.map((week) => {
                  const checked = form.selectedWeeks.includes(week.weekNumber);
                  const disabled = Boolean(week.occupiedByPlanId);
                  return (
                    <div
                      key={week.weekNumber}
                      role="button"
                      tabIndex={disabled ? -1 : 0}
                      onClick={() => !disabled && toggleWeek(week.weekNumber)}
                      onKeyDown={(event) => {
                        if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
                          event.preventDefault();
                          toggleWeek(week.weekNumber);
                        }
                      }}
                      className={`w-full rounded-md border p-3 text-left text-sm transition ${
                        checked ? 'border-primary bg-primary/5' : 'bg-background hover:bg-muted/30'
                      } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                    >
                      <div className="flex items-center gap-2 font-medium">
                        <span
                          className={`grid h-4 w-4 shrink-0 place-content-center rounded-sm border ${
                            checked
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-input bg-background'
                          }`}
                          aria-hidden="true"
                        >
                          {checked && <Check className="h-3.5 w-3.5" />}
                        </span>
                        <span>
                          Tuần {week.weekNumber} · {week.displayRange}
                        </span>
                      </div>
                      {week.occupiedByPlanName && (
                        <div className="mt-1 pl-6 text-xs text-muted-foreground">
                          Đã thuộc kế hoạch: {week.occupiedByPlanName}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {hasGap && (
              <p className="text-sm text-destructive">
                Các tuần áp dụng của một kế hoạch cần liên tiếp nhau.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => navigate('/monthly-theme-plans')}>
            Hủy
          </Button>
          <Button type="submit" disabled={!canSave || saveMut.isPending}>
            Lưu và tiếp tục
          </Button>
        </DialogFooter>
      </form>
    </div>
  );
}

function PlanDetailPage({ id }) {
  const queryClient = useQueryClient();
  const selectedYearId = useYearStore((state) => state.selectedYearId);
  const [keyword, setKeyword] = useState('');
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [fieldFilter, setFieldFilter] = useState('ALL');
  const [subjectFilter, setSubjectFilter] = useState('ALL');
  const [themeFilter, setThemeFilter] = useState('ALL');
  const [expandMode, setExpandMode] = useState('selected');
  const [incompleteFieldWarning, setIncompleteFieldWarning] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const bankParams = useMemo(
    () => ({
      ...(keyword.trim() ? { keyword: keyword.trim() } : {}),
    }),
    [keyword],
  );
  const detailQuery = useQuery({
    queryKey: ['monthly-theme-plan', id],
    queryFn: async () => {
      const res = await apiClient.get(`/monthly-theme-plans/${id}`);
      return res.data.data;
    },
    retry: false,
  });
  const bankQuery = useQuery({
    queryKey: ['monthly-theme-plan-bank', id, bankParams],
    queryFn: async () => {
      const res = await apiClient.get(`/monthly-theme-plans/${id}/criteria-bank`, {
        params: bankParams,
      });
      return res.data.data;
    },
    retry: false,
  });
  const plan = detailQuery.data;
  const fullTree = bankQuery.data?.tree ?? [];
  const fieldCoverage = bankQuery.data?.fieldCoverage;
  const filterOptions = useMemo(
    () => buildBankFilters(fullTree, { fieldId: fieldFilter, subjectId: subjectFilter }),
    [fieldFilter, fullTree, subjectFilter],
  );
  const filteredTree = useMemo(
    () =>
      filterTreeByControls(fullTree, {
        fieldId: fieldFilter,
        subjectId: subjectFilter,
        themeId: themeFilter,
      }),
    [fieldFilter, fullTree, subjectFilter, themeFilter],
  );
  const tree = selectedOnly ? filterTreeBySelection(filteredTree, selectedIds) : filteredTree;
  const selectedTopicCount = countSelectedTopics(fullTree, selectedIds);
  const selectedFieldCount = countSelectedFields(fullTree, selectedIds);
  const noResultText =
    keyword.trim() || fieldFilter !== 'ALL' || subjectFilter !== 'ALL' || themeFilter !== 'ALL'
      ? 'Không tìm thấy tiêu chí phù hợp'
      : 'Không có tiêu chí phù hợp';
  const isDraft = plan?.status === 'DRAFT';
  const isReadOnly = Boolean(plan && !isDraft);

  useEffect(() => {
    if (plan?.criteria) {
      setSelectedIds(new Set(plan.criteria.map((item) => item.criterion_id)));
    }
  }, [plan?.monthly_theme_plan_id, plan?.criteria]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const res = await apiClient.put(`/monthly-theme-plans/${id}/selected-criteria`, {
        criterionIds: [...selectedIds],
      });
      return res.data.data;
    },
    onSuccess: () => {
      toast.success('Đã lưu tiêu chí cho kế hoạch.');
      queryClient.invalidateQueries({ queryKey: ['monthly-theme-plan', id] });
      queryClient.invalidateQueries({ queryKey: ['monthly-theme-plan-bank', id] });
      queryClient.invalidateQueries({ queryKey: ['monthly-theme-plans'] });
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Không thể lưu tiêu chí.')),
  });

  const completeMut = useMutation({
    mutationFn: async ({ confirmIncompleteFields = false } = {}) => {
      const res = await apiClient.patch(`/monthly-theme-plans/${id}/complete`, {
        confirmIncompleteFields,
      });
      return res.data.data;
    },
    onSuccess: () => {
      toast.success('Kế hoạch đã được chuyển thành chính thức.');
      setIncompleteFieldWarning(null);
      queryClient.invalidateQueries({ queryKey: ['monthly-theme-plan', id] });
      queryClient.invalidateQueries({ queryKey: ['monthly-theme-plan-bank', id] });
      queryClient.invalidateQueries({ queryKey: ['monthly-theme-plans'] });
    },
    onError: (error) => {
      const details = error?.response?.data?.details;
      if (details?.requiresConfirmation) {
        setIncompleteFieldWarning(details);
        return;
      }
      toast.error(getErrorMessage(error, 'Không thể hoàn tất kế hoạch.'));
    },
  });

  const revertMut = useMutation({
    mutationFn: async () => {
      const res = await apiClient.patch(`/monthly-theme-plans/${id}/revert-draft`);
      return res.data.data;
    },
    onSuccess: () => {
      toast.success('Kế hoạch đã được đưa về bản nháp.');
      queryClient.invalidateQueries({ queryKey: ['monthly-theme-plan', id] });
      queryClient.invalidateQueries({ queryKey: ['monthly-theme-plan-bank', id] });
      queryClient.invalidateQueries({ queryKey: ['monthly-theme-plans'] });
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Không thể đưa kế hoạch về bản nháp.')),
  });
  const updateInfoMut = useMutation({
    mutationFn: async (payload) => {
      const res = await apiClient.put(`/monthly-theme-plans/${id}`, payload);
      return res.data.data;
    },
    onSuccess: () => {
      toast.success('Cập nhật kế hoạch thành công.');
      setEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ['monthly-theme-plan', id] });
      queryClient.invalidateQueries({ queryKey: ['monthly-theme-plan-bank', id] });
      queryClient.invalidateQueries({ queryKey: ['monthly-theme-plans'] });
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Không thể cập nhật kế hoạch.')),
  });

  const openCompleteConfirm = () => {
    if (selectedIds.size === 0) {
      toast.error('Kế hoạch cần có ít nhất một tiêu chí trước khi hoàn tất.');
      return;
    }
    completeMut.mutate();
  };

  const toggleCriterion = (criterionId, checked) => {
    if (isReadOnly) return;
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(criterionId);
      else next.delete(criterionId);
      return next;
    });
  };

  const setTopicCriteria = (criteria, checked) => {
    if (isReadOnly) return;
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const criterion of criteria) {
        if (checked) next.add(criterion.criterionId);
        else next.delete(criterion.criterionId);
      }
      return next;
    });
  };

  if (detailQuery.error || bankQuery.error) {
    return (
      <div className="rounded-md border bg-card p-6 text-center text-sm text-muted-foreground">
        {getErrorMessage(detailQuery.error || bankQuery.error, 'Không thể tải kế hoạch.')}
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={plan?.name ?? 'Chi tiết kế hoạch'}
        description="Chọn tiêu chí từ ngân hàng đánh giá để dùng cho kế hoạch tuần sau này."
      />
      {plan && (
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border bg-card px-3 py-2 text-sm">
          <span>
            <span className="text-muted-foreground">Tháng: </span>
            <span className="font-medium">{formatPlanningMonth(plan)}</span>
          </span>
          <span className="hidden text-muted-foreground sm:inline">·</span>
          <span>
            <span className="text-muted-foreground">Tuần áp dụng: </span>
            <span className="font-medium">{formatApplicableWeeks(plan.weeks)}</span>
          </span>
          <span className="hidden text-muted-foreground sm:inline">·</span>
          <span>
            <span className="text-muted-foreground">Thời gian: </span>
            <span className="font-medium">
              {fmtDate(plan.expected_start_date)} - {fmtDate(plan.expected_end_date)}
            </span>
          </span>
          <span className="hidden text-muted-foreground sm:inline">·</span>
          <span>
            <span className="text-muted-foreground">Lớp: </span>
            <span className="font-medium">{plan.class?.class_name || '-'}</span>
          </span>
          <span className="hidden text-muted-foreground sm:inline">·</span>
          <span>
            <span className="text-muted-foreground">Năm học: </span>
            <span className="font-medium">{plan.school_year?.name || '-'}</span>
          </span>
          <MonthlyPlanStatusBadge status={plan.status} />
          {plan.status === 'DRAFT' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="mr-1.5 h-4 w-4" />
              Sửa thông tin
            </Button>
          )}
        </div>
      )}
      <PlanInfoDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        plan={plan}
        selectedYearId={selectedYearId}
        loading={updateInfoMut.isPending}
        onSubmit={(payload) => updateInfoMut.mutate(payload)}
      />
      <CriteriaBankToolbar
        keyword={keyword}
        onKeywordChange={setKeyword}
        fieldFilter={fieldFilter}
        onFieldFilterChange={(value) => {
          setFieldFilter(value);
          setSubjectFilter('ALL');
          setThemeFilter('ALL');
        }}
        subjectFilter={subjectFilter}
        onSubjectFilterChange={(value) => {
          setSubjectFilter(value);
          setThemeFilter('ALL');
        }}
        themeFilter={themeFilter}
        onThemeFilterChange={setThemeFilter}
        filterOptions={filterOptions}
        selectedOnly={selectedOnly}
        onSelectedOnlyChange={setSelectedOnly}
        selectedIds={selectedIds}
        selectedTopicCount={selectedTopicCount}
        selectedFieldCount={selectedFieldCount}
        fieldCoverage={fieldCoverage}
        expandMode={expandMode}
        onToggleExpand={() =>
          setExpandMode((current) =>
            current.startsWith('all') ? `none-${Date.now()}` : `all-${Date.now()}`,
          )
        }
        status={plan?.status}
        onSave={() => saveMut.mutate()}
        saving={saveMut.isPending}
        onComplete={openCompleteConfirm}
        completing={completeMut.isPending}
        onRevertToDraft={() => revertMut.mutate()}
        reverting={revertMut.isPending}
      />
      <section className="rounded-md border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-base font-semibold">Ngân hàng tiêu chí</h2>
        </div>
        {bankQuery.isLoading ? (
          <div className="m-4 h-40 animate-pulse rounded-md bg-muted/40" />
        ) : tree.length === 0 ? (
          <p className="m-4 rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            {noResultText}
          </p>
        ) : (
          <div className="divide-y">
            {tree.map((field, fieldIndex) => (
              <FieldGroup
                key={`${expandMode}-${field.developmentFieldId}`}
                field={field}
                selectedIds={selectedIds}
                defaultOpen={
                  expandMode.startsWith('all') ||
                  (!expandMode.startsWith('none') &&
                    (fieldIndex === 0 || countField(field, selectedIds) > 0))
                }
                expandMode={expandMode}
                onToggleCriterion={toggleCriterion}
                onSetTopicCriteria={setTopicCriteria}
                readOnly={isReadOnly}
              />
            ))}
          </div>
        )}
      </section>
      <Dialog
        open={!!incompleteFieldWarning}
        onOpenChange={(open) => !open && setIncompleteFieldWarning(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Kế hoạch chưa đủ 5 lĩnh vực</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Kế hoạch này vẫn còn thiếu {incompleteFieldWarning?.missingFieldCount}/
              {incompleteFieldWarning?.totalFieldCount} lĩnh vực phát triển.
            </p>
            {incompleteFieldWarning?.missingFields?.length > 0 && (
              <p>
                Các lĩnh vực còn thiếu:{' '}
                <span className="font-medium text-foreground">
                  {incompleteFieldWarning.missingFields.map((field) => field.name).join(', ')}
                </span>
              </p>
            )}
            <p>Bạn có muốn hoàn tất kế hoạch không?</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIncompleteFieldWarning(null)}>
              Quay lại bổ sung
            </Button>
            <Button
              type="button"
              disabled={completeMut.isPending}
              onClick={() => completeMut.mutate({ confirmIncompleteFields: true })}
            >
              Vẫn hoàn tất
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CriteriaBankToolbar({
  keyword,
  onKeywordChange,
  fieldFilter,
  onFieldFilterChange,
  subjectFilter,
  onSubjectFilterChange,
  themeFilter,
  onThemeFilterChange,
  filterOptions,
  selectedOnly,
  onSelectedOnlyChange,
  selectedIds,
  selectedTopicCount,
  selectedFieldCount,
  fieldCoverage,
  expandMode,
  onToggleExpand,
  status,
  onSave,
  saving,
  onComplete,
  completing,
  onRevertToDraft,
  reverting,
}) {
  const isExpandedAll = expandMode.startsWith('all');
  const isDraft = status === 'DRAFT';
  const isReady = status === 'READY';
  const isUsed = status === 'USED';
  const coverage = fieldCoverage ?? {
    selectedFieldCount,
    totalFieldCount: 5,
    missingFields: [],
  };
  const missingFieldNames = coverage.missingFields?.map((field) => field.name).join(', ');

  return (
    <div className="sticky top-0 z-20 mb-3 rounded-md border bg-background/95 px-3 py-2 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" className="h-10 shrink-0 justify-start">
          <Link to="/monthly-theme-plans">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Quay lại
          </Link>
        </Button>
        <div className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(event) => onKeywordChange(event.target.value)}
            placeholder="Tìm tiêu chí..."
            className="h-10 bg-card pl-9"
          />
        </div>
        <FilterSelect
          value={fieldFilter}
          onValueChange={onFieldFilterChange}
          allLabel="Tất cả lĩnh vực"
          items={filterOptions.fields}
          className="h-10 w-44"
        />
        <FilterSelect
          value={subjectFilter}
          onValueChange={onSubjectFilterChange}
          allLabel="Tất cả môn học"
          items={filterOptions.subjects}
          className="h-10 w-44"
        />
        <FilterSelect
          value={themeFilter}
          onValueChange={onThemeFilterChange}
          allLabel="Tất cả chủ đề"
          items={filterOptions.themes}
          className="h-10 w-44"
        />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Button type="button" variant="outline" className="h-10" onClick={onToggleExpand}>
            {isExpandedAll ? 'Thu gọn tất cả' : 'Mở tất cả'}
          </Button>
          {isDraft && (
            <>
              <Button className="h-10" onClick={onSave} disabled={saving}>
                <Save className="mr-1.5 h-4 w-4" />
                Lưu thay đổi
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="h-10"
                onClick={onComplete}
                disabled={completing}
              >
                <Check className="mr-1.5 h-4 w-4" />
                Hoàn tất kế hoạch
              </Button>
            </>
          )}
          {isReady && (
            <Button
              type="button"
              variant="outline"
              className="h-10"
              onClick={onRevertToDraft}
              disabled={reverting}
            >
              Đưa về bản nháp
            </Button>
          )}
          {isUsed && (
            <Badge variant="outline" className="h-10 rounded-md px-3">
              Chỉ xem
            </Badge>
          )}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-sm">
        <label className="flex items-center gap-2">
          <Checkbox
            checked={selectedOnly}
            onCheckedChange={(value) => onSelectedOnlyChange(Boolean(value))}
          />
          Chỉ hiển thị đã chọn
        </label>
        <div className="text-right font-medium text-muted-foreground">
          <div>
            Đã chọn: {selectedIds.size} tiêu chí · {selectedTopicCount} đề tài · Bao phủ lĩnh vực:{' '}
            {coverage.selectedFieldCount}/{coverage.totalFieldCount}
          </div>
          {missingFieldNames && (
            <div className="mt-0.5 text-xs font-normal">Còn thiếu: {missingFieldNames}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterSelect({ value, onValueChange, allLabel, items, className }) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={allLabel} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ALL">{allLabel}</SelectItem>
        {items.map((item) => (
          <SelectItem key={item.id} value={item.id}>
            {item.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function FieldGroup({
  field,
  selectedIds,
  defaultOpen,
  expandMode,
  onToggleCriterion,
  onSetTopicCriteria,
  readOnly,
}) {
  const forceOpen = expandMode.startsWith('all');

  return (
    <details open={defaultOpen} className="group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold hover:bg-muted/30">
        <span className="flex items-center gap-2">
          <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90" />
          {field.developmentFieldName}
        </span>
        <CountBadge selected={countField(field, selectedIds)} total={field.totalCount} />
      </summary>
      <div className="space-y-1 px-4 pb-3">
        {field.subjects.map((subject) => (
          <SubjectGroup
            key={`${expandMode}-${subject.subjectId}`}
            fieldName={field.developmentFieldName}
            subject={subject}
            selectedIds={selectedIds}
            defaultOpen={forceOpen || countSubject(subject, selectedIds) > 0}
            expandMode={expandMode}
            onToggleCriterion={onToggleCriterion}
            onSetTopicCriteria={onSetTopicCriteria}
            readOnly={readOnly}
          />
        ))}
      </div>
    </details>
  );
}

function SubjectGroup({
  fieldName,
  subject,
  selectedIds,
  defaultOpen,
  expandMode,
  onToggleCriterion,
  onSetTopicCriteria,
  readOnly,
}) {
  const forceOpen = expandMode.startsWith('all');

  return (
    <details open={defaultOpen} className="group/subject rounded-md">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted/30">
        <span className="flex items-center gap-2">
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open/subject:rotate-90" />
          {subject.subjectName}
        </span>
        <CountBadge selected={countSubject(subject, selectedIds)} total={subject.totalCount} />
      </summary>
      <div className="space-y-2 pl-5 pr-1">
        {subject.themes.map((theme) => (
          <ThemeGroup
            key={`${expandMode}-${theme.themeId}`}
            fieldName={fieldName}
            subjectName={subject.subjectName}
            theme={theme}
            selectedIds={selectedIds}
            defaultOpen={forceOpen || countTheme(theme, selectedIds) > 0}
            expandMode={expandMode}
            onToggleCriterion={onToggleCriterion}
            onSetTopicCriteria={onSetTopicCriteria}
            readOnly={readOnly}
          />
        ))}
      </div>
    </details>
  );
}

function ThemeGroup({
  fieldName,
  subjectName,
  theme,
  selectedIds,
  defaultOpen,
  expandMode,
  onToggleCriterion,
  onSetTopicCriteria,
  readOnly,
}) {
  const forceOpen = expandMode.startsWith('all');

  return (
    <details open={defaultOpen} className="group/theme rounded-md">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted/30">
        <span className="flex items-center gap-2 font-medium text-foreground">
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open/theme:rotate-90" />
          {theme.themeName}
        </span>
        <CountBadge selected={countTheme(theme, selectedIds)} total={theme.totalCount} />
      </summary>
      <div className="space-y-3 pb-2 pl-5 pr-1">
        {theme.topics.map((topic) => (
          <TopicCard
            key={`${expandMode}-${topic.topicId}`}
            context={`${fieldName} › ${subjectName} › ${theme.themeName}`}
            topic={topic}
            selectedIds={selectedIds}
            defaultOpen={forceOpen || countTopic(topic, selectedIds) > 0}
            onToggleCriterion={onToggleCriterion}
            onSetTopicCriteria={onSetTopicCriteria}
            readOnly={readOnly}
          />
        ))}
      </div>
    </details>
  );
}

function TopicCard({
  context,
  topic,
  selectedIds,
  defaultOpen,
  onToggleCriterion,
  onSetTopicCriteria,
  readOnly,
}) {
  const selectedCount = countTopic(topic, selectedIds);
  const allSelected = topic.criteria.length > 0 && selectedCount === topic.criteria.length;

  return (
    <details open={defaultOpen} className="group/topic rounded-md border bg-background">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2.5">
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open/topic:rotate-90" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{topic.topicName}</span>
            <CountBadge selected={selectedCount} total={topic.totalCount} />
          </div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">{context}</div>
        </div>
        <div
          className="flex shrink-0 items-center gap-2"
          onClick={(event) => event.preventDefault()}
        >
          {!readOnly && selectedCount > 0 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onSetTopicCriteria(topic.criteria, false)}
            >
              Bỏ chọn
            </Button>
          )}
          {!readOnly && (
            <Button
              type="button"
              size="sm"
              variant={allSelected ? 'secondary' : 'outline'}
              onClick={() => onSetTopicCriteria(topic.criteria, true)}
            >
              <Check className="mr-1.5 h-4 w-4" />
              Chọn tất cả
            </Button>
          )}
        </div>
      </summary>
      {topic.criteria.length === 0 ? (
        <p className="border-t px-3 py-3 text-sm text-muted-foreground">
          Không có tiêu chí phù hợp
        </p>
      ) : (
        <div className="divide-y border-t">
          {topic.criteria.map((criterion) => (
            <CriterionRow
              key={criterion.criterionId}
              criterion={criterion}
              checked={selectedIds.has(criterion.criterionId)}
              onCheckedChange={(checked) =>
                onToggleCriterion(criterion.criterionId, Boolean(checked))
              }
              disabled={readOnly}
            />
          ))}
        </div>
      )}
    </details>
  );
}

function CriterionRow({ criterion, checked, onCheckedChange, disabled }) {
  return (
    <label
      className={`flex gap-3 px-3 py-2 text-sm ${
        disabled ? 'cursor-default' : 'cursor-pointer hover:bg-muted/30'
      } ${checked ? 'bg-primary/5' : ''}`}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="mt-0.5"
      />
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-foreground">
          {criterion.criterionCode}
        </span>
        <span className="block leading-5 text-muted-foreground">
          {criterion.criterionDescription}
        </span>
      </span>
    </label>
  );
}

function CountBadge({ selected, total }) {
  return (
    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
      {selected}/{total} tiêu chí
    </span>
  );
}
