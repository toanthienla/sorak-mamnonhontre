import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarPlus, Check, Eye, Save, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { PageHeader } from '@/shared/components/page-header';
import { apiClient } from '@/shared/api/client';
import { fmtDate } from '@/shared/utils/date';
import { useYearStore } from '@/shared/stores/year.store';

const DAYS = [
  { key: 'MONDAY', label: 'Thứ 2' },
  { key: 'TUESDAY', label: 'Thứ 3' },
  { key: 'WEDNESDAY', label: 'Thứ 4' },
  { key: 'THURSDAY', label: 'Thứ 5' },
  { key: 'FRIDAY', label: 'Thứ 6' },
];
const SESSIONS = [
  { key: 'MORNING', label: 'Sáng' },
  { key: 'AFTERNOON', label: 'Chiều' },
];

function getErrorMessage(error, fallback) {
  return error?.response?.data?.message || fallback;
}

function statusMeta(status) {
  if (status === 'READY')
    return { label: 'Chính thức', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
  if (status === 'USED')
    return { label: 'Đã sử dụng', className: 'border-blue-200 bg-blue-50 text-blue-700' };
  return { label: 'Bản nháp', className: '' };
}

function StatusBadge({ status }) {
  const meta = statusMeta(status);
  return (
    <Badge variant="outline" className={`shrink-0 ${meta.className}`}>
      {meta.label}
    </Badge>
  );
}

function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function parseMonthValue(value) {
  const [year, month] = value.split('-').map(Number);
  return { year, month };
}

function formatPlanningMonth(year, month) {
  if (!year || !month) return '-';
  return `${String(month).padStart(2, '0')}/${year}`;
}

function contextText(context) {
  if (!context) return '';
  return `Lớp: ${context.class?.class_name ?? ''} · Nhóm tuổi: ${
    context.ageGroup?.name_vi ?? ''
  } · Năm học: ${context.academicYear?.name ?? ''}`;
}

function activityTitle(activity) {
  return (
    activity.subject_name_snapshot || activity.activity_name_snapshot || 'Chưa đặt tên hoạt động'
  );
}

function selectedCriteriaForActivity(mapping, activityId) {
  return mapping[activityId] ?? [];
}

function dayLabel(dayKey) {
  return DAYS.find((day) => day.key === dayKey)?.label ?? dayKey;
}

function sessionLabel(sessionKey) {
  return SESSIONS.find((session) => session.key === sessionKey)?.label ?? sessionKey;
}

function buildCriterionUsageMap(plan, mapping) {
  const activitiesById = new Map(
    (plan?.activities ?? []).map((activity) => [
      activity.weekly_development_plan_activity_id,
      activity,
    ]),
  );
  const usage = new Map();
  for (const [activityIdText, criterionIds] of Object.entries(mapping ?? {})) {
    const activity = activitiesById.get(Number(activityIdText));
    if (!activity) continue;
    for (const criterionId of criterionIds ?? []) {
      if (!usage.has(criterionId)) usage.set(criterionId, []);
      usage.get(criterionId).push(activity);
    }
  }
  return usage;
}

function buildFilterOptions(criteria = []) {
  const fields = new Map();
  const subjects = new Map();
  const themes = new Map();
  const topics = new Map();
  for (const criterion of criteria) {
    fields.set(String(criterion.developmentFieldId), criterion.developmentFieldName);
    subjects.set(String(criterion.subjectId), criterion.subjectName);
    themes.set(String(criterion.themeId), criterion.themeName);
    topics.set(String(criterion.topicId), criterion.topicName);
  }
  const toItems = (map) => [...map].map(([id, name]) => ({ id, name }));
  return {
    fields: toItems(fields),
    subjects: toItems(subjects),
    themes: toItems(themes),
    topics: toItems(topics),
  };
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

export function WeeklyDevelopmentPlansTab() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const selectedYearId = useYearStore((state) => state.selectedYearId);
  const [planningMonth, setPlanningMonth] = useState(currentMonthValue());
  const [status, setStatus] = useState('ALL');
  const [keyword, setKeyword] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const { year, month } = parseMonthValue(planningMonth);
  const params = useMemo(
    () => ({
      page: 1,
      pageSize: 100,
      planningYear: year,
      planningMonth: month,
      ...(selectedYearId ? { academicYearId: selectedYearId } : {}),
      ...(status !== 'ALL' ? { status } : {}),
      ...(keyword.trim() ? { keyword: keyword.trim() } : {}),
    }),
    [keyword, month, selectedYearId, status, year],
  );
  const listQuery = useQuery({
    queryKey: ['weekly-development-plans', params],
    queryFn: async () => {
      const res = await apiClient.get('/weekly-development-plans', { params });
      return res.data;
    },
    retry: false,
  });
  const plans = listQuery.data?.data ?? [];
  const context = listQuery.data?.meta?.context;

  const deleteMut = useMutation({
    mutationFn: async (planId) => {
      const res = await apiClient.delete(`/weekly-development-plans/${planId}`);
      return res.data.data;
    },
    onSuccess: () => {
      toast.success('Đã xóa kế hoạch tuần.');
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: ['weekly-development-plans'] });
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Không thể xóa kế hoạch tuần.')),
  });

  return (
    <div className="space-y-4">
      {context && (
        <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm font-medium">
          {contextText(context)}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 rounded-md border bg-card p-3">
        <Input
          type="month"
          value={planningMonth}
          onChange={(event) => setPlanningMonth(event.target.value || currentMonthValue())}
          className="w-48"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Tất cả trạng thái" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tất cả trạng thái</SelectItem>
            <SelectItem value="DRAFT">Bản nháp</SelectItem>
            <SelectItem value="READY">Chính thức</SelectItem>
            <SelectItem value="USED">Đã sử dụng</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex min-w-64 flex-1 items-center gap-2 rounded-md border bg-background px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Tìm kế hoạch tuần..."
            className="border-0 px-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <Button onClick={() => setCreateOpen(true)} className="ml-auto shrink-0">
          <CalendarPlus className="mr-1.5 h-4 w-4" />
          Tạo kế hoạch tuần
        </Button>
      </div>
      {listQuery.error ? (
        <div className="rounded-md border bg-card p-6 text-center text-sm text-muted-foreground">
          {getErrorMessage(listQuery.error, 'Không thể tải kế hoạch tuần.')}
        </div>
      ) : listQuery.isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-36 animate-pulse rounded-md border bg-muted/40" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <div className="rounded-md border bg-card p-6 text-center text-sm text-muted-foreground">
          Chưa có kế hoạch tuần nào.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.weekly_development_plan_id}
              className="flex min-h-40 flex-col justify-between rounded-md border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/10"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">
                    Tuần {plan.week_number} · {plan.display_range}
                  </h3>
                  <StatusBadge status={plan.status} />
                </div>
                <p className="line-clamp-1 text-sm text-muted-foreground">
                  {plan.monthly_theme_plan?.name || 'Chưa có kế hoạch tháng/chủ đề'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {plan.mappedActivityCount}/{plan.activityCount} hoạt động · {plan.criterionCount}{' '}
                  tiêu chí
                </p>
                <p className="text-xs text-muted-foreground">
                  Cập nhật: {fmtDate(plan.updated_at)}
                </p>
              </div>
              <div className="mt-4 flex gap-2">
                <Button asChild variant="outline" className="flex-1">
                  <Link to={`/weekly-development-plans/${plan.weekly_development_plan_id}`}>
                    <Eye className="mr-1.5 h-4 w-4" />
                    Xem chi tiết
                  </Link>
                </Button>
                {plan.status !== 'USED' && (
                  <Button type="button" variant="destructive" onClick={() => setDeleting(plan)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <CreateWeeklyPlanDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        selectedYearId={selectedYearId}
        initialMonth={planningMonth}
        onCreated={(plan) => {
          queryClient.invalidateQueries({ queryKey: ['weekly-development-plans'] });
          navigate(`/weekly-development-plans/${plan.weekly_development_plan_id}`);
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Xóa kế hoạch tuần?"
        description={
          deleting
            ? `Kế hoạch tuần ${deleting.week_number} · ${deleting.display_range} sẽ bị xóa. Bạn có chắc muốn xóa không?`
            : ''
        }
        confirmLabel="Xóa kế hoạch"
        variant="destructive"
        loading={deleteMut.isPending}
        onConfirm={() => deleting && deleteMut.mutate(deleting.weekly_development_plan_id)}
      />
    </div>
  );
}

function CreateWeeklyPlanDialog({ open, onOpenChange, selectedYearId, initialMonth, onCreated }) {
  const [planningMonth, setPlanningMonth] = useState(initialMonth || currentMonthValue());
  const { year, month } = parseMonthValue(planningMonth);
  useEffect(() => {
    if (open) setPlanningMonth(initialMonth || currentMonthValue());
  }, [initialMonth, open]);
  const optionsQuery = useQuery({
    queryKey: ['weekly-development-plan-create-options', selectedYearId, year, month],
    queryFn: async () => {
      const res = await apiClient.get('/weekly-development-plans/create-options', {
        params: {
          ...(selectedYearId ? { academicYearId: selectedYearId } : {}),
          planningYear: year,
          planningMonth: month,
        },
      });
      return res.data.data;
    },
    enabled: open && Boolean(year && month),
    retry: false,
  });
  const createMut = useMutation({
    mutationFn: async (weekNumber) => {
      const res = await apiClient.post('/weekly-development-plans', {
        ...(selectedYearId ? { academicYearId: selectedYearId } : {}),
        planningYear: year,
        planningMonth: month,
        weekNumber,
      });
      return res.data.data;
    },
    onSuccess: (plan) => {
      toast.success('Đã tạo kế hoạch tuần.');
      onOpenChange(false);
      onCreated(plan);
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Không thể tạo kế hoạch tuần.')),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Tạo kế hoạch tuần</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Tháng triển khai</Label>
            <Input
              type="month"
              value={planningMonth}
              onChange={(event) => setPlanningMonth(event.target.value)}
              className="w-56"
            />
          </div>
          {optionsQuery.error ? (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              {getErrorMessage(optionsQuery.error, 'Không thể tải danh sách tuần.')}
            </div>
          ) : optionsQuery.isLoading ? (
            <div className="h-48 animate-pulse rounded-md bg-muted/40" />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {(optionsQuery.data?.weeks ?? []).map((week) => (
                <div key={week.weekNumber} className="rounded-md border bg-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">
                        Tuần {week.weekNumber} · {week.displayRange}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {week.monthlyThemePlanName
                          ? `Kế hoạch tháng/chủ đề: ${week.monthlyThemePlanName}`
                          : 'Chưa có kế hoạch tháng/chủ đề'}
                      </p>
                    </div>
                    {week.monthlyThemePlanStatus && (
                      <StatusBadge status={week.monthlyThemePlanStatus} />
                    )}
                  </div>
                  {week.reason && (
                    <p className="mt-2 text-sm text-muted-foreground">{week.reason}</p>
                  )}
                  <div className="mt-3">
                    {week.existingWeeklyPlanId ? (
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/weekly-development-plans/${week.existingWeeklyPlanId}`}>
                          Xem kế hoạch
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        disabled={!week.canCreate || createMut.isPending}
                        onClick={() => createMut.mutate(week.weekNumber)}
                      >
                        Chọn
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function WeeklyDevelopmentPlanDetailPage({ id }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeActivity, setActiveActivity] = useState(null);
  const [mapping, setMapping] = useState({});
  const [filters, setFilters] = useState({
    fieldId: 'ALL',
    subjectId: 'ALL',
    themeId: 'ALL',
    topicId: 'ALL',
    keyword: '',
    showUsedCriteria: true,
  });
  const [incompleteWarning, setIncompleteWarning] = useState(null);
  const detailQuery = useQuery({
    queryKey: ['weekly-development-plan', id],
    queryFn: async () => {
      const res = await apiClient.get(`/weekly-development-plans/${id}`);
      return res.data.data;
    },
    retry: false,
  });
  const plan = detailQuery.data;
  const isDraft = plan?.status === 'DRAFT';
  const isReadOnly = Boolean(plan && !isDraft);
  const availableCriteria = plan?.availableCriteria ?? [];
  const filterOptions = useMemo(() => buildFilterOptions(availableCriteria), [availableCriteria]);
  const criterionUsage = useMemo(() => buildCriterionUsageMap(plan, mapping), [mapping, plan]);

  useEffect(() => {
    if (!plan?.activities) return;
    const next = {};
    for (const activity of plan.activities) {
      next[activity.weekly_development_plan_activity_id] = (activity.criteria ?? []).map(
        (criterion) => criterion.criterion_id,
      );
    }
    setMapping(next);
  }, [plan?.weekly_development_plan_id, plan?.activities]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const res = await apiClient.put(`/weekly-development-plans/${id}/mappings`, {
        activities: (plan?.activities ?? []).map((activity) => ({
          weeklyPlanActivityId: activity.weekly_development_plan_activity_id,
          selectedCriteriaIds: selectedCriteriaForActivity(
            mapping,
            activity.weekly_development_plan_activity_id,
          ),
        })),
      });
      return res.data.data;
    },
    onSuccess: () => {
      toast.success('Đã lưu kế hoạch tuần.');
      queryClient.invalidateQueries({ queryKey: ['weekly-development-plan', id] });
      queryClient.invalidateQueries({ queryKey: ['weekly-development-plans'] });
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Không thể lưu kế hoạch tuần.')),
  });

  const completeMut = useMutation({
    mutationFn: async ({ confirmIncompleteActivities = false } = {}) => {
      const res = await apiClient.patch(`/weekly-development-plans/${id}/complete`, {
        confirmIncompleteActivities,
      });
      return res.data.data;
    },
    onSuccess: () => {
      toast.success('Kế hoạch tuần đã được chuyển thành chính thức.');
      setIncompleteWarning(null);
      queryClient.invalidateQueries({ queryKey: ['weekly-development-plan', id] });
      queryClient.invalidateQueries({ queryKey: ['weekly-development-plans'] });
    },
    onError: (error) => {
      const details = error?.response?.data?.details;
      if (details?.requiresConfirmation) {
        setIncompleteWarning(details);
        return;
      }
      toast.error(getErrorMessage(error, 'Không thể hoàn tất kế hoạch tuần.'));
    },
  });

  const revertMut = useMutation({
    mutationFn: async () => {
      const res = await apiClient.patch(`/weekly-development-plans/${id}/revert-draft`);
      return res.data.data;
    },
    onSuccess: () => {
      toast.success('Kế hoạch tuần đã được đưa về bản nháp.');
      queryClient.invalidateQueries({ queryKey: ['weekly-development-plan', id] });
      queryClient.invalidateQueries({ queryKey: ['weekly-development-plans'] });
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'Không thể đưa kế hoạch tuần về bản nháp.')),
  });

  const openComplete = () => completeMut.mutate();

  const filteredCriteria = useMemo(() => {
    const keyword = filters.keyword.trim().toLowerCase();
    const activitySubjectId =
      activeActivity?.activity_type === 'SUBJECT' ? activeActivity.subject_id : null;
    const currentActivityId = activeActivity?.weekly_development_plan_activity_id;
    const currentSelectedIds = currentActivityId
      ? selectedCriteriaForActivity(mapping, currentActivityId)
      : [];
    if (isReadOnly) {
      return availableCriteria.filter((criterion) =>
        currentSelectedIds.includes(criterion.criterionId),
      );
    }
    return availableCriteria.filter((criterion) => {
      const usedInOtherActivity = (criterionUsage.get(criterion.criterionId) ?? []).some(
        (usedActivity) => usedActivity.weekly_development_plan_activity_id !== currentActivityId,
      );
      const selectedHere =
        currentActivityId &&
        selectedCriteriaForActivity(mapping, currentActivityId).includes(criterion.criterionId);
      if (usedInOtherActivity && !filters.showUsedCriteria && !selectedHere) return false;
      if (
        activitySubjectId &&
        filters.subjectId === 'ALL' &&
        criterion.subjectId !== activitySubjectId
      ) {
        return false;
      }
      if (filters.fieldId !== 'ALL' && String(criterion.developmentFieldId) !== filters.fieldId) {
        return false;
      }
      if (filters.subjectId !== 'ALL' && String(criterion.subjectId) !== filters.subjectId) {
        return false;
      }
      if (filters.themeId !== 'ALL' && String(criterion.themeId) !== filters.themeId) return false;
      if (filters.topicId !== 'ALL' && String(criterion.topicId) !== filters.topicId) return false;
      if (!keyword) return true;
      return (
        criterion.criterionCode.toLowerCase().includes(keyword) ||
        criterion.criterionDescription.toLowerCase().includes(keyword) ||
        criterion.topicName.toLowerCase().includes(keyword)
      );
    });
  }, [activeActivity, availableCriteria, criterionUsage, filters, isReadOnly, mapping]);

  const toggleCriterion = (activityId, criterionId, checked) => {
    if (isReadOnly) return;
    setMapping((current) => {
      const ids = new Set(current[activityId] ?? []);
      if (checked) ids.add(criterionId);
      else ids.delete(criterionId);
      return { ...current, [activityId]: [...ids] };
    });
  };

  if (detailQuery.error) {
    return (
      <div className="rounded-md border bg-card p-6 text-center text-sm text-muted-foreground">
        {getErrorMessage(detailQuery.error, 'Không thể tải kế hoạch tuần.')}
      </div>
    );
  }

  if (detailQuery.isLoading || !plan) {
    return <div className="h-56 animate-pulse rounded-md border bg-muted/40" />;
  }

  return (
    <div>
      <PageHeader
        title={`Kế hoạch tuần · Tuần ${plan.week_number}`}
        description="Gán tiêu chí từ kế hoạch tháng/chủ đề vào hoạt động thời khóa biểu của tuần."
      />
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border bg-card px-3 py-2 text-sm">
        <span>
          <span className="text-muted-foreground">Nguồn: </span>
          <span className="font-medium">{plan.monthly_theme_plan?.name}</span>
        </span>
        <span className="hidden text-muted-foreground sm:inline">·</span>
        <span>
          <span className="text-muted-foreground">Tháng: </span>
          <span className="font-medium">
            {formatPlanningMonth(plan.planning_year, plan.planning_month)}
          </span>
        </span>
        <span className="hidden text-muted-foreground sm:inline">·</span>
        <span>
          <span className="text-muted-foreground">Thời gian: </span>
          <span className="font-medium">
            {fmtDate(plan.start_date)} - {fmtDate(plan.end_date)}
          </span>
        </span>
        <span className="hidden text-muted-foreground sm:inline">·</span>
        <span>
          <span className="text-muted-foreground">Lớp: </span>
          <span className="font-medium">{plan.class?.class_name}</span>
        </span>
        <span className="hidden text-muted-foreground sm:inline">·</span>
        <span>
          <span className="text-muted-foreground">Đã gán: </span>
          <span className="font-medium">
            {plan.mappedActivityCount}/{plan.activityCount} hoạt động · {plan.criterionCount} tiêu
            chí
          </span>
        </span>
        <StatusBadge status={plan.status} />
      </div>
      <div className="sticky top-0 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-md border bg-background/95 p-2 shadow-sm backdrop-blur">
        <Button asChild variant="outline">
          <Link to="/monthly-theme-plans">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Quay lại
          </Link>
        </Button>
        <div className="ml-auto flex flex-wrap gap-2">
          {isDraft && (
            <>
              <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
                <Save className="mr-1.5 h-4 w-4" />
                Lưu thay đổi
              </Button>
              <Button variant="secondary" onClick={openComplete} disabled={completeMut.isPending}>
                <Check className="mr-1.5 h-4 w-4" />
                Hoàn tất kế hoạch tuần
              </Button>
            </>
          )}
          {plan.status === 'READY' && (
            <Button
              variant="outline"
              onClick={() => revertMut.mutate()}
              disabled={revertMut.isPending}
            >
              Đưa về bản nháp
            </Button>
          )}
        </div>
      </div>
      <WeeklyGrid plan={plan} mapping={mapping} onSelectActivity={setActiveActivity} />
      <MappingSheet
        activity={activeActivity}
        open={!!activeActivity}
        onOpenChange={(open) => !open && setActiveActivity(null)}
        criteria={filteredCriteria}
        filterOptions={filterOptions}
        filters={filters}
        onFiltersChange={setFilters}
        criterionUsage={criterionUsage}
        weekNumber={plan.week_number}
        selectedIds={
          activeActivity
            ? selectedCriteriaForActivity(
                mapping,
                activeActivity.weekly_development_plan_activity_id,
              )
            : []
        }
        onToggle={(criterionId, checked) =>
          activeActivity &&
          toggleCriterion(activeActivity.weekly_development_plan_activity_id, criterionId, checked)
        }
        readOnly={isReadOnly}
      />
      <Dialog
        open={!!incompleteWarning}
        onOpenChange={(open) => !open && setIncompleteWarning(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Kế hoạch tuần chưa gán đủ hoạt động</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Kế hoạch tuần còn {incompleteWarning?.unmappedCount}/{incompleteWarning?.activityCount}{' '}
            hoạt động chưa gán tiêu chí. Bạn có muốn hoàn tất không?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIncompleteWarning(null)}>
              Quay lại bổ sung
            </Button>
            <Button
              onClick={() => completeMut.mutate({ confirmIncompleteActivities: true })}
              disabled={completeMut.isPending}
            >
              Vẫn hoàn tất
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WeeklyGrid({ plan, mapping, onSelectActivity }) {
  return (
    <div className="overflow-x-auto rounded-md border bg-card">
      <div className="grid min-w-[980px] grid-cols-[100px_repeat(5,minmax(160px,1fr))]">
        <div className="border-b bg-muted/30 p-3 text-sm font-semibold">Buổi</div>
        {DAYS.map((day) => (
          <div key={day.key} className="border-b bg-muted/30 p-3 text-sm font-semibold">
            <div>{day.label}</div>
            <div className="text-xs font-normal text-muted-foreground">
              {fmtDate(
                (plan.activities ?? []).find((activity) => activity.day_of_week === day.key)
                  ?.activity_date,
              )}
            </div>
          </div>
        ))}
        {SESSIONS.map((session) => (
          <div key={session.key} className="contents">
            <div className="grid place-items-center border-b p-3 text-sm font-semibold">
              {session.label}
            </div>
            {DAYS.map((day) => {
              const items = plan.groupedActivities?.[day.key]?.[session.key] ?? [];
              return (
                <div key={`${day.key}-${session.key}`} className="min-h-40 border-b p-3">
                  <div className="space-y-2">
                    {items.map((activity) => {
                      const selectedCount = selectedCriteriaForActivity(
                        mapping,
                        activity.weekly_development_plan_activity_id,
                      ).length;
                      return (
                        <button
                          key={activity.weekly_development_plan_activity_id}
                          type="button"
                          onClick={() => onSelectActivity(activity)}
                          className={`h-24 w-full rounded-md border bg-background p-3 text-left text-sm shadow-sm transition hover:border-primary/50 ${
                            activity.activity_type === 'SUBJECT'
                              ? 'border-l-4 border-l-blue-600 bg-blue-50/40'
                              : 'border-l-4 border-l-amber-500 bg-amber-50/40'
                          }`}
                        >
                          <div className="line-clamp-2 font-semibold">
                            #{activity.display_order} {activityTitle(activity)}
                          </div>
                          <div className="mt-2 line-clamp-1 text-xs text-muted-foreground">
                            {activity.development_field_name_snapshot || ''}
                          </div>
                          <div className="mt-2 text-xs font-medium text-muted-foreground">
                            {selectedCount > 0 ? `${selectedCount} tiêu chí` : 'Chưa gán tiêu chí'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function MappingSheet({
  activity,
  open,
  onOpenChange,
  criteria,
  filterOptions,
  filters,
  onFiltersChange,
  selectedIds,
  onToggle,
  readOnly,
  criterionUsage,
  weekNumber,
}) {
  const selectedSet = new Set(selectedIds);
  const currentActivityId = activity?.weekly_development_plan_activity_id;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{activity ? activityTitle(activity) : 'Hoạt động'}</SheetTitle>
          <SheetDescription>
            {activity &&
              `${fmtDate(activity.activity_date)} · ${
                activity.session === 'MORNING' ? 'Sáng' : 'Chiều'
              }${activity.development_field_name_snapshot ? ` · ${activity.development_field_name_snapshot}` : ''}`}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-3 overflow-y-auto pr-1">
          <div className={readOnly ? 'hidden' : 'grid gap-2'}>
            <Input
              value={filters.keyword}
              onChange={(event) =>
                onFiltersChange((cur) => ({ ...cur, keyword: event.target.value }))
              }
              placeholder="Tìm tiêu chí..."
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <FilterSelect
                value={filters.fieldId}
                onValueChange={(value) => onFiltersChange((cur) => ({ ...cur, fieldId: value }))}
                allLabel="Tất cả lĩnh vực"
                items={filterOptions.fields}
              />
              <FilterSelect
                value={filters.subjectId}
                onValueChange={(value) => onFiltersChange((cur) => ({ ...cur, subjectId: value }))}
                allLabel="Tất cả môn học"
                items={filterOptions.subjects}
              />
              <FilterSelect
                value={filters.themeId}
                onValueChange={(value) => onFiltersChange((cur) => ({ ...cur, themeId: value }))}
                allLabel="Tất cả chủ đề"
                items={filterOptions.themes}
              />
              <FilterSelect
                value={filters.topicId}
                onValueChange={(value) => onFiltersChange((cur) => ({ ...cur, topicId: value }))}
                allLabel="Tất cả đề tài"
                items={filterOptions.topics}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={filters.showUsedCriteria}
                onCheckedChange={(value) =>
                  onFiltersChange((cur) => ({ ...cur, showUsedCriteria: Boolean(value) }))
                }
              />
              Hiển thị tiêu chí đã sử dụng
            </label>
          </div>
          <div className="text-sm font-medium">Đã chọn: {selectedIds.length} tiêu chí</div>
          {readOnly ? (
            <ReadOnlyMappedCriteria criteria={criteria} />
          ) : criteria.length === 0 ? (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Không có tiêu chí phù hợp từ kế hoạch tháng/chủ đề. Hãy quay lại kế hoạch tháng/chủ đề
              để bổ sung.
            </div>
          ) : (
            <div className="divide-y rounded-md border">
              {criteria.map((criterion) => (
                <CriterionMappingRow
                  key={criterion.criterionId}
                  criterion={criterion}
                  selected={selectedSet.has(criterion.criterionId)}
                  readOnly={readOnly}
                  usedActivity={(criterionUsage.get(criterion.criterionId) ?? []).find(
                    (item) => item.weekly_development_plan_activity_id !== currentActivityId,
                  )}
                  weekNumber={weekNumber}
                  onToggle={onToggle}
                />
              ))}
            </div>
          )}
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ReadOnlyMappedCriteria({ criteria }) {
  if (criteria.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        Hoạt động này chưa được gán tiêu chí.
      </div>
    );
  }

  const topicGroups = [];
  const topicMap = new Map();
  for (const criterion of criteria) {
    if (!topicMap.has(criterion.topicId)) {
      const group = {
        topicId: criterion.topicId,
        topicName: criterion.topicName,
        topicDescription: criterion.topicDescription,
        criteria: [],
      };
      topicMap.set(criterion.topicId, group);
      topicGroups.push(group);
    }
    topicMap.get(criterion.topicId).criteria.push(criterion);
  }

  return (
    <div className="space-y-3">
      {topicGroups.map((topic) => (
        <section key={topic.topicId} className="rounded-md border bg-card">
          <div className="border-b bg-muted/20 px-3 py-2">
            <div className="text-sm font-semibold text-foreground">{topic.topicName}</div>
            {topic.topicDescription && (
              <p className="mt-1 text-sm text-muted-foreground">{topic.topicDescription}</p>
            )}
          </div>
          <div className="divide-y">
            {topic.criteria.map((criterion) => (
              <div key={criterion.criterionId} className="flex gap-3 bg-amber-50/30 p-3 text-sm">
                <Checkbox checked disabled />
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-foreground">{criterion.criterionCode}</span>
                  <span className="ml-2 text-muted-foreground">
                    {criterion.criterionDescription}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function CriterionMappingRow({
  criterion,
  selected,
  readOnly,
  usedActivity,
  weekNumber,
  onToggle,
}) {
  const usedByOtherActivity = Boolean(usedActivity);
  const disabled = readOnly || usedByOtherActivity;
  const usedMessage = usedByOtherActivity
    ? buildUsedCriterionMessage(weekNumber, usedActivity)
    : undefined;

  return (
    <div
      title={usedMessage}
      className={`flex gap-3 p-3 text-sm ${
        selected ? 'bg-primary/5' : 'bg-background'
      } ${usedByOtherActivity ? 'text-muted-foreground opacity-70' : ''}`}
    >
      <Checkbox
        checked={selected}
        disabled={disabled}
        onCheckedChange={(value) => onToggle(criterion.criterionId, Boolean(value))}
      />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-start gap-2">
          <span className="font-medium text-foreground">{criterion.criterionCode}</span>
          <span className="min-w-0 flex-1 text-muted-foreground">
            {criterion.criterionDescription}
          </span>
          {usedByOtherActivity && <UsedCriterionBadge message={usedMessage} />}
        </span>
        <span className="mt-1 block text-xs text-muted-foreground">
          {criterion.developmentFieldName} · {criterion.subjectName} · {criterion.themeName} ·{' '}
          {criterion.topicName}
        </span>
      </span>
    </div>
  );
}

function buildUsedCriterionMessage(weekNumber, activity) {
  return `Đã dùng tại: Tuần ${weekNumber} · ${dayLabel(activity.day_of_week)} · ${sessionLabel(
    activity.session,
  )} · ${activityTitle(activity)}`;
}

function UsedCriterionBadge({ message }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="shrink-0"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setOpen((current) => !current);
          }}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          aria-label={message}
        >
          <Badge variant="outline" className="h-5 whitespace-nowrap px-1.5 text-[11px]">
            Đã sử dụng
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        className="w-64 p-2 text-xs leading-relaxed"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        {message}
      </PopoverContent>
    </Popover>
  );
}
