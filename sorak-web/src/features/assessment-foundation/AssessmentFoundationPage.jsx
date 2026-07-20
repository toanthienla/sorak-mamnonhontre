import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  Edit,
  Eye,
  MoreHorizontal,
  Plus,
  Power,
  PowerOff,
  Search,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/shared/components/page-header';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { DetailSection, InfoRow } from '@/shared/components/detail-sheet';
import { apiClient } from '@/shared/api/client';
import { useList, useCreate, useUpdate } from '@/shared/hooks/use-crud';
import { useAuthStore } from '@/shared/stores/auth.store';
import { cn } from '@/shared/lib/utils';
import { fmtDate } from '@/shared/utils/date';

const emptyText = 'Không có dữ liệu';

function sortByDisplayOrder(rows) {
  return [...rows].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
}

function sortByName(rows) {
  return [...rows].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}

function sortByCriterionCode(rows) {
  return [...rows].sort((a, b) => a.criterion_code.localeCompare(b.criterion_code, 'vi'));
}

function formatThemeCounts(theme) {
  const activeCriterionCount = theme.activeCriterionCount ?? 0;
  const totalCriterionCount = theme.totalCriterionCount ?? 0;
  const activeTopicCount = theme.activeTopicCount ?? 0;
  const totalTopicCount = theme.totalTopicCount ?? 0;
  return `TC: ${activeCriterionCount}/${totalCriterionCount}  ·  ĐT: ${activeTopicCount}/${totalTopicCount}`;
}

function EmptyState({ children = emptyText }) {
  return (
    <div className="bg-card rounded-md border p-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function BreadcrumbLabel({ children }) {
  return (
    <span className="block max-w-40 truncate sm:max-w-56" title={children}>
      {children}
    </span>
  );
}

function BreadcrumbPath({ items, onRoot, onClick }) {
  return (
    <div className="bg-card rounded-md border px-3 py-2 mb-4">
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        <span className="mr-1 text-muted-foreground">Đang ở</span>
        {items.length === 0 ? (
          <button
            type="button"
            onClick={onRoot}
            className="rounded-md border bg-background px-2.5 py-1 font-medium text-foreground hover:bg-accent"
          >
            Danh mục đánh giá
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={onRoot}
              className="rounded-md px-2.5 py-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Danh mục đánh giá
            </button>
            {items.map((item, index) => (
              <div key={item.key} className="flex min-w-0 items-center gap-1.5">
                <span className="text-muted-foreground">/</span>
                <button
                  type="button"
                  onClick={() => onClick(item.level)}
                  className={cn(
                    'min-w-0 rounded-md px-2.5 py-1 hover:bg-accent',
                    index === items.length - 1
                      ? 'bg-primary/10 font-semibold text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <BreadcrumbLabel>{item.label}</BreadcrumbLabel>
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function ToolbarAction({ children }) {
  if (!children) return null;
  return <div className="flex shrink-0 justify-end">{children}</div>;
}

function PanelHeader({
  title,
  description,
  canSearch,
  search,
  onSearchChange,
  canToggleInactive,
  showInactive,
  onToggleInactive,
  action,
  onBack,
}) {
  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>

      {(onBack || canSearch || canToggleInactive || action) && (
        <div className="flex gap-2 flex-wrap items-center">
          <div className="flex min-w-0 flex-1 gap-2">
            {onBack && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-auto shrink-0"
                onClick={onBack}
              >
                <ChevronLeft className="mr-1.5 h-4 w-4" />
                Quay lại cấp trước
              </Button>
            )}
            {canSearch && (
              <form
                onSubmit={(event) => event.preventDefault()}
                className="flex min-w-[240px] max-w-sm flex-1 gap-2"
              >
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => onSearchChange(event.target.value)}
                    placeholder="Tìm kiếm..."
                    className="pl-8"
                  />
                </div>
                <Button type="submit" variant="secondary">
                  Tìm
                </Button>
              </form>
            )}
          </div>
          <div className="flex gap-2">
            {canToggleInactive && (
              <Button type="button" variant="outline" size="sm" onClick={onToggleInactive}>
                {showInactive ? 'Ẩn đã ngừng kích hoạt' : 'Hiển thị đã ngừng kích hoạt'}
              </Button>
            )}
            <ToolbarAction>{action}</ToolbarAction>
          </div>
        </div>
      )}
    </div>
  );
}

function SelectCard({ title, subtitle, inactive, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'bg-card rounded-md border min-h-20 p-3 text-left transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        selected && 'border-primary bg-primary/10',
        inactive && 'opacity-60',
      )}
    >
      <div className="text-sm font-semibold text-foreground">{title || '—'}</div>
      {subtitle && <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>}
      {inactive && (
        <div className="mt-2 text-xs font-medium text-muted-foreground">Ngừng kích hoạt</div>
      )}
    </button>
  );
}

function ManagedCard({ item, selected, onSelect, onEdit, onToggle, onDelete, canManage, meta }) {
  return (
    <div
      className={cn(
        'bg-card rounded-md border p-3 transition hover:bg-accent/50',
        selected && 'border-primary bg-primary/10',
        !item.is_active && 'opacity-60',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
          <div className="truncate text-sm font-semibold text-foreground" title={item.name}>
            {item.name}
          </div>
          {item.description && (
            <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {item.description}
            </div>
          )}
          {meta && <div className="mt-1 text-xs text-muted-foreground">{meta}</div>}
          {item.scopeWarning && (
            <div className="mt-2 text-xs font-medium text-destructive">{item.scopeWarning}</div>
          )}
          {!item.is_active && (
            <div className="mt-2 text-xs font-medium text-muted-foreground">Ngừng kích hoạt</div>
          )}
        </button>
        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8 shrink-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="mr-2 h-4 w-4" />
                Sửa
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onToggle}>
                {item.is_active ? (
                  <PowerOff className="mr-2 h-4 w-4" />
                ) : (
                  <Power className="mr-2 h-4 w-4" />
                )}
                {item.is_active ? 'Ngừng kích hoạt' : 'Kích hoạt'}
              </DropdownMenuItem>
              {onDelete &&
                (item.is_active ? (
                  <DropdownMenuItem disabled>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Ngừng kích hoạt trước khi xóa
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Xóa vĩnh viễn
                  </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

function CardGrid({ children }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {children}
    </div>
  );
}

function ClassificationContext({ items }) {
  return (
    <div className="space-y-2 rounded-md border bg-muted/30 px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Phân loại
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className="min-w-0">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="truncate text-sm font-medium text-foreground" title={item.value}>
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CatalogDialog({
  open,
  title,
  nameLabel,
  namePlaceholder,
  nameHelper,
  descriptionPlaceholder,
  contextItems,
  initialValue,
  onOpenChange,
  onSubmit,
  loading,
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    setName(initialValue?.name ?? '');
    setDescription(initialValue?.description ?? '');
  }, [initialValue, open]);

  async function handleSubmit(event) {
    event.preventDefault();
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
    };

    await onSubmit(payload);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <ClassificationContext items={contextItems} />
          <div className="space-y-2">
            <Label htmlFor="catalog-name">{nameLabel}</Label>
            <Input
              id="catalog-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={namePlaceholder}
              required
            />
            <p className="text-xs text-muted-foreground">{nameHelper}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="catalog-description">Mô tả</Label>
            <Textarea
              id="catalog-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder={descriptionPlaceholder}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              Lưu
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CriterionDialog({ open, initialValue, contextItems, onOpenChange, onSubmit, loading }) {
  const [content, setContent] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    setContent(initialValue?.content ?? '');
    setDescription(initialValue?.description ?? '');
  }, [initialValue, open]);

  async function handleSubmit(event) {
    event.preventDefault();
    await onSubmit({
      content: content.trim(),
      description: description.trim() || null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialValue ? 'Sửa tiêu chí' : 'Thêm tiêu chí'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <ClassificationContext items={contextItems} />
          {initialValue?.criterion_code && (
            <div className="space-y-2">
              <Label>Mã tiêu chí</Label>
              <div className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
                {initialValue.criterion_code}
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="criterion-content">Nội dung tiêu chí</Label>
            <Textarea
              id="criterion-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="Ví dụ: Trẻ nhận biết và gọi đúng tên con trâu."
              required
            />
            <p className="text-xs text-muted-foreground">
              Mô tả một kết quả hoặc hành vi cụ thể có thể quan sát ở trẻ.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="criterion-description">Mô tả</Label>
            <Textarea
              id="criterion-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Ví dụ: Trẻ có thể chỉ, gọi tên và mô tả một số đặc điểm nổi bật của con trâu."
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={loading || !content.trim()}>
              Lưu
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CriteriaTable({ criteria, canManage, onView, onEdit, onToggle, onDelete }) {
  if (criteria.length === 0) return <EmptyState />;

  return (
    <div className="bg-card rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Mã tiêu chí</TableHead>
            <TableHead>Nội dung tiêu chí</TableHead>
            <TableHead>Mô tả</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead className="text-right">Thao tác</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {criteria.map((criterion) => (
            <TableRow key={criterion.assessment_criterion_id}>
              <TableCell className="font-medium text-foreground">
                {criterion.criterion_code}
              </TableCell>
              <TableCell className="max-w-md text-foreground">{criterion.content}</TableCell>
              <TableCell className="max-w-xs text-muted-foreground">
                {criterion.description || '—'}
              </TableCell>
              <TableCell>{criterion.is_active ? 'Đang hoạt động' : 'Ngừng kích hoạt'}</TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onView(criterion)}>
                      <Eye className="mr-2 h-4 w-4" />
                      Xem chi tiết
                    </DropdownMenuItem>
                    {canManage && (
                      <>
                        <DropdownMenuItem onClick={() => onEdit(criterion)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Sửa
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onToggle(criterion)}>
                          {criterion.is_active ? (
                            <PowerOff className="mr-2 h-4 w-4" />
                          ) : (
                            <Power className="mr-2 h-4 w-4" />
                          )}
                          {criterion.is_active ? 'Ngừng kích hoạt' : 'Kích hoạt'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => onDelete(criterion)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Xóa vĩnh viễn
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function useStatusMutation(key, path) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, is_active }) => apiClient.patch(`${path}/${id}/status`, { is_active }),
    onSuccess: () => {
      toast.success('Cập nhật thành công');
      queryClient.invalidateQueries({ queryKey: [key] });
      queryClient.refetchQueries({ queryKey: [key], type: 'all' });
    },
  });
}

function usageStatusMeta(status) {
  if (status === 'READY')
    return { label: 'Chính thức', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
  if (status === 'USED')
    return { label: 'Đã sử dụng', className: 'border-blue-200 bg-blue-50 text-blue-700' };
  if (status === 'DRAFT')
    return { label: 'Bản nháp', className: 'border-amber-200 bg-amber-50 text-amber-700' };
  return { label: status || 'Không xác định', className: 'border-border text-muted-foreground' };
}

function UsageStatusBadge({ status }) {
  const meta = usageStatusMeta(status);
  return (
    <Badge variant="outline" className={cn('shrink-0 text-xs font-medium', meta.className)}>
      {meta.label}
    </Badge>
  );
}

function UsageGroup({ title, count, children }) {
  if (!count) return null;

  return (
    <details open className="rounded-md border bg-background">
      <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-3">
          {title}
          <Badge variant="outline" className="text-xs font-medium text-muted-foreground">
            {count}
          </Badge>
        </span>
      </summary>
      <div className="border-t divide-y">{children}</div>
    </details>
  );
}

function UsageRow({ title, status, children }) {
  return (
    <div className="space-y-1.5 px-3 py-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium text-foreground">{title}</p>
        {status && <UsageStatusBadge status={status} />}
      </div>
      <div className="space-y-0.5 text-xs leading-5 text-muted-foreground">{children}</div>
    </div>
  );
}

export function AssessmentFoundationPage() {
  const role = useAuthStore((state) => state.user?.role);
  const canManage = role === 'PRINCIPAL';
  const queryClient = useQueryClient();

  const [selectedAgeGroupId, setSelectedAgeGroupId] = useState(null);
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState(null);
  const [selectedThemeId, setSelectedThemeId] = useState(null);
  const [selectedTopicId, setSelectedTopicId] = useState(null);
  const [catalogDialog, setCatalogDialog] = useState(null);
  const [criterionDialog, setCriterionDialog] = useState(null);
  const [viewingCriterion, setViewingCriterion] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [criterionUsage, setCriterionUsage] = useState(null);
  const [usageDetailsUnavailable, setUsageDetailsUnavailable] = useState(false);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const activeLevel = selectedTopicId
    ? 'criteria'
    : selectedThemeId
      ? 'topics'
      : selectedSubjectId
        ? 'themes'
        : selectedFieldId
          ? 'subjects'
          : selectedAgeGroupId
            ? 'fields'
            : 'ageGroups';

  const inactiveFilter = canManage && showInactive ? undefined : 'true';

  const subjectParams = useMemo(
    () => ({
      assessment_age_group_id: selectedAgeGroupId,
      development_field_id: selectedFieldId,
      is_active: inactiveFilter,
      search: activeLevel === 'subjects' ? search : undefined,
      pageSize: 100,
    }),
    [activeLevel, inactiveFilter, search, selectedAgeGroupId, selectedFieldId],
  );
  const themeParams = useMemo(
    () => ({
      assessment_age_group_id: selectedAgeGroupId,
      development_field_id: selectedFieldId,
      assessment_subject_id: selectedSubjectId,
      is_active: inactiveFilter,
      search: activeLevel === 'themes' ? search : undefined,
      pageSize: 100,
    }),
    [activeLevel, inactiveFilter, search, selectedAgeGroupId, selectedFieldId, selectedSubjectId],
  );
  const topicParams = useMemo(
    () => ({
      assessment_theme_id: selectedThemeId,
      assessment_age_group_id: selectedAgeGroupId,
      assessment_subject_id: selectedSubjectId,
      is_active: inactiveFilter,
      search: activeLevel === 'topics' ? search : undefined,
      pageSize: 100,
    }),
    [activeLevel, inactiveFilter, search, selectedAgeGroupId, selectedSubjectId, selectedThemeId],
  );
  const criteriaParams = useMemo(
    () => ({
      assessment_age_group_id: selectedAgeGroupId,
      development_field_id: selectedFieldId,
      assessment_subject_id: selectedSubjectId,
      assessment_theme_id: selectedThemeId,
      assessment_topic_id: selectedTopicId,
      is_active: inactiveFilter,
      search: activeLevel === 'criteria' ? search : undefined,
      pageSize: 100,
    }),
    [
      activeLevel,
      inactiveFilter,
      search,
      selectedAgeGroupId,
      selectedFieldId,
      selectedSubjectId,
      selectedThemeId,
      selectedTopicId,
    ],
  );

  const { data: ageGroupsData } = useList('assessment-age-groups', '/assessment-age-groups', {});
  const { data: developmentFieldsData } = useList('development-fields', '/development-fields', {});
  const { data: subjectsData } = useList(
    'assessment-subjects',
    '/assessment-subjects',
    subjectParams,
    { enabled: Boolean(selectedFieldId) },
  );
  const { data: themesData } = useList('assessment-themes', '/assessment-themes', themeParams, {
    enabled: Boolean(selectedSubjectId),
  });
  const { data: topicsData } = useList('assessment-topics', '/assessment-topics', topicParams, {
    enabled: Boolean(selectedAgeGroupId && selectedSubjectId && selectedThemeId),
  });
  const { data: criteriaData } = useList(
    'assessment-criteria',
    '/assessment-criteria',
    criteriaParams,
    { enabled: Boolean(selectedTopicId) },
  );
  const { data: teachersData } = useList('teachers', '/teachers', {
    pageSize: 300,
  });

  const createSubject = useCreate('assessment-subjects', '/assessment-subjects', 'Tạo thành công');
  const updateSubject = useUpdate(
    'assessment-subjects',
    '/assessment-subjects',
    'Cập nhật thành công',
  );
  const statusSubject = useStatusMutation('assessment-subjects', '/assessment-subjects');

  const createTheme = useCreate('assessment-themes', '/assessment-themes', 'Tạo thành công');
  const updateTheme = useUpdate('assessment-themes', '/assessment-themes', 'Cập nhật thành công');
  const statusTheme = useStatusMutation('assessment-themes', '/assessment-themes');

  const createTopic = useCreate('assessment-topics', '/assessment-topics', 'Tạo thành công');
  const updateTopic = useUpdate('assessment-topics', '/assessment-topics', 'Cập nhật thành công');
  const statusTopic = useStatusMutation('assessment-topics', '/assessment-topics');

  const createCriterion = useCreate(
    'assessment-criteria',
    '/assessment-criteria',
    'Tạo thành công',
  );
  const updateCriterion = useUpdate(
    'assessment-criteria',
    '/assessment-criteria',
    'Cập nhật thành công',
  );
  const statusCriterion = useStatusMutation('assessment-criteria', '/assessment-criteria');

  const criterionUsageLookup = useMutation({
    mutationFn: async (id) => {
      const response = await apiClient.get(`/assessment-criteria/${id}/usages`);
      return response.data.data;
    },
  });

  const hardDelete = useMutation({
    mutationFn: async ({ type, id }) => {
      const path =
        type === 'theme'
          ? `/assessment-themes/${id}`
          : type === 'topic'
            ? `/assessment-topics/${id}`
            : `/assessment-criteria/${id}`;
      const res = await apiClient.delete(path);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Đã xóa dữ liệu');
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['assessment-themes'] });
      queryClient.invalidateQueries({ queryKey: ['assessment-topics'] });
      queryClient.invalidateQueries({ queryKey: ['assessment-criteria'] });
    },
    onError: (error, variables) => {
      if (variables.type === 'criterion' && error?.response?.data?.code === 'CRITERION_IN_USE') {
        setDeleteTarget(null);
        criterionUsageLookup.mutate(variables.id, {
          onSuccess: (usage) => {
            setUsageDetailsUnavailable(false);
            setCriterionUsage(usage);
          },
          onError: () => {
            const summary = error?.response?.data?.details?.usageSummary ?? { totalUsages: 1 };
            setUsageDetailsUnavailable(true);
            setCriterionUsage({
              criterion: variables.item,
              summary: {
                totalUsages: summary.totalUsages ?? 1,
                monthlyPlanCount: 0,
                weeklyPlanCount: 0,
                dailyAssessmentGroupCount: 0,
                reportCount: 0,
                historicalReferenceCount: 0,
              },
              groups: {
                monthlyPlans: [],
                weeklyPlans: [],
                dailyAssessments: [],
                reports: [],
                historicalRequests: [],
              },
            });
          },
        });
        return;
      }
      const message = error?.response?.data?.message || 'Không thể xóa dữ liệu';
      const details = error?.response?.data?.details;
      const detailText = Array.isArray(details)
        ? details.map((item) => `${item.reason}: ${item.count}`).join(', ')
        : '';
      toast.error(detailText ? `${message} ${detailText}` : message);
    },
  });

  const ageGroups = useMemo(
    () => sortByDisplayOrder(ageGroupsData?.data ?? []),
    [ageGroupsData?.data],
  );
  const developmentFields = useMemo(
    () => sortByDisplayOrder(developmentFieldsData?.data ?? []),
    [developmentFieldsData?.data],
  );
  const subjects = useMemo(() => sortByName(subjectsData?.data ?? []), [subjectsData?.data]);
  const themes = useMemo(() => sortByName(themesData?.data ?? []), [themesData?.data]);
  const topics = useMemo(() => sortByName(topicsData?.data ?? []), [topicsData?.data]);
  const criteria = useMemo(
    () => sortByCriterionCode(criteriaData?.data ?? []),
    [criteriaData?.data],
  );
  const teacherByAccountId = useMemo(() => {
    const map = new Map();
    for (const teacher of teachersData?.data ?? []) {
      if (teacher.account_id) map.set(teacher.account_id, teacher);
    }
    return map;
  }, [teachersData?.data]);

  function getAccountTeacherName(accountId) {
    if (!accountId) return null;
    return teacherByAccountId.get(accountId)?.full_name ?? `Tài khoản #${accountId}`;
  }

  function getCriterionCreatorName(criterion) {
    return (
      criterion?.source_request?.requester_teacher?.full_name ??
      getAccountTeacherName(criterion?.created_by)
    );
  }

  function getCriterionCreatedAt(criterion) {
    return criterion?.source_request?.created_at ?? criterion?.created_at;
  }

  function openCriterionEdit(criterion) {
    setViewingCriterion(null);
    openCriterionDialog(criterion);
  }

  function openCriterionDelete(criterion) {
    setViewingCriterion(null);
    criterionUsageLookup.mutate(criterion.assessment_criterion_id, {
      onSuccess: (usage) => {
        setUsageDetailsUnavailable(false);
        if (!usage.canDelete) {
          setCriterionUsage(usage);
          return;
        }
        if (criterion.is_active) {
          toast.error('Vui lòng ngừng kích hoạt tiêu chí trước khi xóa vĩnh viễn.');
          return;
        }
        setDeleteTarget({ type: 'criterion', item: criterion });
      },
      onError: (error) => {
        toast.error(error?.response?.data?.message || 'Không thể tải thông tin sử dụng tiêu chí.');
      },
    });
  }

  function deactivateCriterionFromUsage() {
    if (!criterionUsage?.criterion) return;
    const criterion = criterionUsage.criterion;
    statusCriterion.mutate(
      { id: criterion.assessment_criterion_id, is_active: false },
      {
        onSuccess: () => {
          setCriterionUsage(null);
          setViewingCriterion((current) =>
            current?.assessment_criterion_id === criterion.assessment_criterion_id
              ? { ...current, is_active: false }
              : current,
          );
        },
      },
    );
  }

  function toggleCriterionStatus(criterion) {
    const nextIsActive = !criterion.is_active;
    statusCriterion.mutate(
      {
        id: criterion.assessment_criterion_id,
        is_active: nextIsActive,
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['assessment-themes'] });
          setViewingCriterion((current) =>
            current?.assessment_criterion_id === criterion.assessment_criterion_id
              ? { ...current, is_active: nextIsActive }
              : current,
          );
        },
      },
    );
  }

  const selectedAgeGroup =
    ageGroups.find((item) => item.assessment_age_group_id === selectedAgeGroupId) ?? null;
  const selectedField =
    developmentFields.find((item) => item.development_field_id === selectedFieldId) ?? null;
  const selectedSubject =
    subjects.find((item) => item.assessment_subject_id === selectedSubjectId) ?? null;
  const selectedTheme = themes.find((item) => item.assessment_theme_id === selectedThemeId) ?? null;
  const selectedTopic = topics.find((item) => item.assessment_topic_id === selectedTopicId) ?? null;

  const classificationItems = [
    selectedAgeGroup && {
      label: 'Nhóm tuổi',
      value: `${selectedAgeGroup.class_group_label} / ${selectedAgeGroup.name_vi}`,
    },
    selectedField && { label: 'Lĩnh vực phát triển', value: selectedField.name_vi },
    selectedSubject && { label: 'Môn học', value: selectedSubject.name },
    selectedTheme && { label: 'Chủ đề', value: selectedTheme.name },
    selectedTopic && { label: 'Đề tài', value: selectedTopic.name },
  ].filter(Boolean);

  function openCatalogDialog(type, item = null) {
    const requiredContextCount = { subject: 2, theme: 3, topic: 4 }[type];
    if (!item && classificationItems.length < requiredContextCount) {
      toast.error('Không xác định được phạm vi phân loại hiện tại. Vui lòng tải lại trang.');
      return;
    }
    setCatalogDialog({ type, item });
  }

  function openCriterionDialog(item = null) {
    if (!item && classificationItems.length < 5) {
      toast.error('Không xác định được phạm vi phân loại hiện tại. Vui lòng tải lại trang.');
      return;
    }
    setCriterionDialog({ item });
  }

  const breadcrumbItems = [
    selectedAgeGroup && {
      key: 'age',
      level: 'age',
      label: selectedAgeGroup.class_group_label,
    },
    selectedField && {
      key: 'field',
      level: 'field',
      label: selectedField.name_vi,
    },
    selectedSubject && {
      key: 'subject',
      level: 'subject',
      label: selectedSubject.name,
    },
    selectedTheme && {
      key: 'theme',
      level: 'theme',
      label: selectedTheme.name,
    },
    selectedTopic && {
      key: 'topic',
      level: 'topic',
      label: selectedTopic.name,
    },
  ].filter(Boolean);

  function resetSearch() {
    setSearch('');
  }

  function selectAgeGroup(id) {
    setSelectedAgeGroupId(id);
    setSelectedFieldId(null);
    setSelectedSubjectId(null);
    setSelectedThemeId(null);
    setSelectedTopicId(null);
    resetSearch();
  }

  function selectField(id) {
    setSelectedFieldId(id);
    setSelectedSubjectId(null);
    setSelectedThemeId(null);
    setSelectedTopicId(null);
    resetSearch();
  }

  function selectSubject(id) {
    setSelectedSubjectId(id);
    setSelectedThemeId(null);
    setSelectedTopicId(null);
    resetSearch();
  }

  function selectTheme(id) {
    setSelectedThemeId(id);
    setSelectedTopicId(null);
    resetSearch();
  }

  function selectTopic(id) {
    setSelectedTopicId(id);
    resetSearch();
  }

  function goRoot() {
    setSelectedAgeGroupId(null);
    setSelectedFieldId(null);
    setSelectedSubjectId(null);
    setSelectedThemeId(null);
    setSelectedTopicId(null);
    resetSearch();
  }

  function goBreadcrumb(level) {
    if (level === 'age') {
      setSelectedFieldId(null);
      setSelectedSubjectId(null);
      setSelectedThemeId(null);
      setSelectedTopicId(null);
    }
    if (level === 'field') {
      setSelectedSubjectId(null);
      setSelectedThemeId(null);
      setSelectedTopicId(null);
    }
    if (level === 'subject') {
      setSelectedThemeId(null);
      setSelectedTopicId(null);
    }
    if (level === 'theme') {
      setSelectedTopicId(null);
    }
    resetSearch();
  }

  function goBack() {
    if (selectedTopicId) {
      setSelectedTopicId(null);
    } else if (selectedThemeId) {
      setSelectedThemeId(null);
    } else if (selectedSubjectId) {
      setSelectedSubjectId(null);
    } else if (selectedFieldId) {
      setSelectedFieldId(null);
    } else if (selectedAgeGroupId) {
      setSelectedAgeGroupId(null);
    }
    resetSearch();
  }

  function getDeleteId(target) {
    if (target?.type === 'theme') return target.item.assessment_theme_id;
    if (target?.type === 'topic') return target.item.assessment_topic_id;
    return target?.item.assessment_criterion_id;
  }

  function getDeleteName(target) {
    if (!target) return '';
    return target.item.name || target.item.criterion_code || '';
  }

  async function handleSubmitCatalog(payload) {
    try {
      if (catalogDialog.type === 'subject') {
        const data = catalogDialog.item
          ? payload
          : {
              ...payload,
              assessment_age_group_id: selectedAgeGroupId,
              development_field_id: selectedFieldId,
            };
        if (catalogDialog.item) {
          await updateSubject.mutateAsync({
            id: catalogDialog.item.assessment_subject_id,
            data,
          });
        } else {
          await createSubject.mutateAsync(data);
        }
      }

      if (catalogDialog.type === 'theme') {
        const data = catalogDialog.item
          ? payload
          : { ...payload, assessment_subject_id: selectedSubjectId };
        if (catalogDialog.item) {
          await updateTheme.mutateAsync({
            id: catalogDialog.item.assessment_theme_id,
            data,
          });
        } else {
          await createTheme.mutateAsync(data);
        }
      }

      if (catalogDialog.type === 'topic') {
        const data = catalogDialog.item
          ? payload
          : {
              ...payload,
              assessment_theme_id: selectedThemeId,
              assessment_age_group_id: selectedAgeGroupId,
              assessment_subject_id: selectedSubjectId,
            };
        if (catalogDialog.item) {
          await updateTopic.mutateAsync({
            id: catalogDialog.item.assessment_topic_id,
            data,
          });
        } else {
          await createTopic.mutateAsync(data);
        }
        queryClient.invalidateQueries({ queryKey: ['assessment-themes'] });
      }

      setCatalogDialog(null);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Không thể lưu dữ liệu');
    }
  }

  async function handleSubmitCriterion(payload) {
    try {
      const data = criterionDialog?.item
        ? payload
        : {
            ...payload,
            assessment_age_group_id: selectedAgeGroupId,
            development_field_id: selectedFieldId,
            assessment_subject_id: selectedSubjectId,
            assessment_theme_id: selectedThemeId,
            assessment_topic_id: selectedTopicId,
          };

      if (criterionDialog?.item) {
        await updateCriterion.mutateAsync({
          id: criterionDialog.item.assessment_criterion_id,
          data,
        });
      } else {
        await createCriterion.mutateAsync(data);
      }
      queryClient.invalidateQueries({ queryKey: ['assessment-themes'] });

      setCriterionDialog(null);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Không thể lưu dữ liệu');
    }
  }

  const catalogDialogTitle = catalogDialog
    ? catalogDialog.type === 'subject'
      ? catalogDialog.item
        ? 'Sửa môn học'
        : 'Thêm môn học'
      : catalogDialog.type === 'theme'
        ? catalogDialog.item
          ? 'Sửa chủ đề'
          : 'Thêm chủ đề'
        : catalogDialog.item
          ? 'Sửa đề tài'
          : 'Thêm đề tài'
    : '';

  const catalogDialogNameLabel =
    catalogDialog?.type === 'subject'
      ? 'Tên môn học'
      : catalogDialog?.type === 'theme'
        ? 'Tên chủ đề'
        : 'Tên đề tài';

  const catalogDialogFieldConfig =
    catalogDialog?.type === 'subject'
      ? {
          placeholder: 'Ví dụ: Khám phá',
          helper: 'Nhập tên môn học trong phạm vi hiện tại.',
          descriptionPlaceholder:
            'Ví dụ: Các hoạt động giúp trẻ tìm hiểu môi trường tự nhiên và xã hội xung quanh.',
        }
      : catalogDialog?.type === 'theme'
        ? {
            placeholder: 'Ví dụ: Động vật',
            helper: 'Chủ đề này chỉ thuộc môn học đang chọn.',
            descriptionPlaceholder:
              'Ví dụ: Chủ đề giúp trẻ làm quen với các loài động vật gần gũi.',
          }
        : {
            placeholder: 'Ví dụ: Làm quen với trâu nước',
            helper: 'Đề tài này chỉ thuộc chủ đề và môn học hiện tại.',
            descriptionPlaceholder:
              'Ví dụ: Trẻ nhận biết đặc điểm, môi trường sống và ích lợi của con trâu.',
          };

  const panelConfig = {
    ageGroups: {
      title: 'Nhóm tuổi',
      description: 'Chọn nhóm tuổi để bắt đầu phân loại tiêu chí đánh giá.',
      canSearch: false,
      action: null,
    },
    fields: {
      title: 'Lĩnh vực phát triển',
      description: `Chọn lĩnh vực phát triển cho nhóm tuổi ${selectedAgeGroup?.name_vi || ''}.`,
      canSearch: false,
      action: null,
    },
    subjects: {
      title: 'Môn học',
      description: `Quản lý các môn học thuộc nhóm tuổi ${selectedAgeGroup?.name_vi || ''} và lĩnh vực ${selectedField?.name_vi || ''}.`,
      canSearch: true,
      action: canManage && (
        <Button size="sm" type="button" onClick={() => openCatalogDialog('subject')}>
          <Plus className="mr-1.5 h-4 w-4" />
          Thêm môn học
        </Button>
      ),
    },
    themes: {
      title: 'Chủ đề',
      description: `Quản lý các chủ đề thuộc môn học ${selectedSubject?.name || ''}. Mỗi môn học có danh sách chủ đề riêng.`,
      canSearch: true,
      action: canManage && (
        <Button size="sm" type="button" onClick={() => openCatalogDialog('theme')}>
          <Plus className="mr-1.5 h-4 w-4" />
          Thêm chủ đề
        </Button>
      ),
    },
    topics: {
      title: 'Đề tài',
      description: `Các đề tài thuộc chủ đề ${selectedTheme?.name || ''}.`,
      canSearch: true,
      action: canManage && (
        <Button size="sm" type="button" onClick={() => openCatalogDialog('topic')}>
          <Plus className="mr-1.5 h-4 w-4" />
          Thêm đề tài
        </Button>
      ),
    },
    criteria: {
      title: 'Tiêu chí',
      description: `Các tiêu chí thuộc đề tài ${selectedTopic?.name || ''}.`,
      canSearch: true,
      action: canManage && (
        <Button size="sm" type="button" onClick={() => openCriterionDialog()}>
          <Plus className="mr-1.5 h-4 w-4" />
          Thêm tiêu chí
        </Button>
      ),
    },
  }[activeLevel];

  const canToggleInactive = canManage && !['ageGroups', 'fields'].includes(activeLevel);

  return (
    <>
      <PageHeader
        title="Danh mục đánh giá"
        description="Quản lý cấu trúc phân loại và ngân hàng tiêu chí đánh giá phát triển trẻ."
      />

      <BreadcrumbPath items={breadcrumbItems} onRoot={goRoot} onClick={goBreadcrumb} />

      <section className="bg-card rounded-md border p-4">
        <PanelHeader
          title={panelConfig.title}
          description={panelConfig.description}
          canSearch={panelConfig.canSearch}
          search={search}
          onSearchChange={setSearch}
          canToggleInactive={canToggleInactive}
          showInactive={showInactive}
          onToggleInactive={() => setShowInactive((value) => !value)}
          action={panelConfig.action}
          onBack={activeLevel !== 'ageGroups' ? goBack : null}
        />

        {activeLevel === 'ageGroups' && (
          <CardGrid>
            {ageGroups.map((ageGroup) => (
              <SelectCard
                key={ageGroup.assessment_age_group_id}
                title={ageGroup.class_group_label}
                subtitle={ageGroup.name_vi}
                onSelect={() => selectAgeGroup(ageGroup.assessment_age_group_id)}
              />
            ))}
          </CardGrid>
        )}

        {activeLevel === 'fields' && (
          <CardGrid>
            {developmentFields.map((field) => (
              <SelectCard
                key={field.development_field_id}
                title={field.name_vi}
                selected={field.development_field_id === selectedFieldId}
                onSelect={() => selectField(field.development_field_id)}
              />
            ))}
          </CardGrid>
        )}

        {activeLevel === 'subjects' &&
          (subjects.length === 0 ? (
            <EmptyState />
          ) : (
            <CardGrid>
              {subjects.map((subject) => (
                <ManagedCard
                  key={subject.assessment_subject_id}
                  item={subject}
                  selected={subject.assessment_subject_id === selectedSubjectId}
                  onSelect={() => selectSubject(subject.assessment_subject_id)}
                  onEdit={() => openCatalogDialog('subject', subject)}
                  onToggle={() =>
                    statusSubject.mutate({
                      id: subject.assessment_subject_id,
                      is_active: !subject.is_active,
                    })
                  }
                  canManage={canManage}
                />
              ))}
            </CardGrid>
          ))}

        {activeLevel === 'themes' &&
          (themes.length === 0 ? (
            <EmptyState />
          ) : (
            <CardGrid>
              {themes.map((theme) => (
                <ManagedCard
                  key={theme.assessment_theme_id}
                  item={theme}
                  selected={theme.assessment_theme_id === selectedThemeId}
                  onSelect={() => selectTheme(theme.assessment_theme_id)}
                  onEdit={() => openCatalogDialog('theme', theme)}
                  meta={formatThemeCounts(theme)}
                  onToggle={() =>
                    statusTheme.mutate({
                      id: theme.assessment_theme_id,
                      is_active: !theme.is_active,
                    })
                  }
                  onDelete={() => setDeleteTarget({ type: 'theme', item: theme })}
                  canManage={canManage}
                />
              ))}
            </CardGrid>
          ))}

        {activeLevel === 'topics' &&
          (topics.length === 0 ? (
            <EmptyState />
          ) : (
            <CardGrid>
              {topics.map((topic) => (
                <ManagedCard
                  key={topic.assessment_topic_id}
                  item={{
                    ...topic,
                    scopeWarning:
                      !topic.assessment_age_group_id || !topic.assessment_subject_id
                        ? 'Đề tài này chưa được phân loại theo độ tuổi.'
                        : null,
                  }}
                  selected={topic.assessment_topic_id === selectedTopicId}
                  onSelect={() => selectTopic(topic.assessment_topic_id)}
                  onEdit={() => openCatalogDialog('topic', topic)}
                  meta={
                    topic.assessment_age_group && topic.assessment_subject
                      ? `${topic.assessment_age_group.class_group_label} / ${topic.assessment_subject.name}`
                      : null
                  }
                  onToggle={() =>
                    statusTopic.mutate(
                      {
                        id: topic.assessment_topic_id,
                        is_active: !topic.is_active,
                      },
                      {
                        onSuccess: () =>
                          queryClient.invalidateQueries({
                            queryKey: ['assessment-themes'],
                          }),
                      },
                    )
                  }
                  onDelete={() => setDeleteTarget({ type: 'topic', item: topic })}
                  canManage={canManage}
                />
              ))}
            </CardGrid>
          ))}

        {activeLevel === 'criteria' && (
          <CriteriaTable
            criteria={criteria}
            canManage={canManage}
            onView={setViewingCriterion}
            onEdit={openCriterionEdit}
            onToggle={toggleCriterionStatus}
            onDelete={openCriterionDelete}
          />
        )}
      </section>

      <CatalogDialog
        open={Boolean(catalogDialog)}
        title={catalogDialogTitle}
        nameLabel={catalogDialogNameLabel}
        namePlaceholder={catalogDialogFieldConfig.placeholder}
        nameHelper={catalogDialogFieldConfig.helper}
        descriptionPlaceholder={catalogDialogFieldConfig.descriptionPlaceholder}
        contextItems={
          catalogDialog?.type === 'subject'
            ? classificationItems.slice(0, 2)
            : catalogDialog?.type === 'theme'
              ? classificationItems.slice(0, 3)
              : classificationItems.slice(0, 4)
        }
        initialValue={catalogDialog?.item}
        onOpenChange={(open) => !open && setCatalogDialog(null)}
        onSubmit={handleSubmitCatalog}
        loading={
          createSubject.isPending ||
          updateSubject.isPending ||
          createTheme.isPending ||
          updateTheme.isPending ||
          createTopic.isPending ||
          updateTopic.isPending
        }
      />

      <CriterionDialog
        open={Boolean(criterionDialog)}
        initialValue={criterionDialog?.item}
        contextItems={classificationItems}
        onOpenChange={(open) => !open && setCriterionDialog(null)}
        onSubmit={handleSubmitCriterion}
        loading={createCriterion.isPending || updateCriterion.isPending}
      />

      <Sheet
        open={Boolean(viewingCriterion)}
        onOpenChange={(open) => !open && setViewingCriterion(null)}
      >
        <SheetContent side="right" className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Chi tiết tiêu chí</SheetTitle>
          </SheetHeader>
          {viewingCriterion && (
            <div className="space-y-4 mt-5">
              <div className="rounded-lg border bg-muted/30 px-4 py-3">
                <p className="font-semibold">{viewingCriterion.criterion_code}</p>
                <p className="mt-1 text-sm text-muted-foreground">{viewingCriterion.content}</p>
              </div>

              <DetailSection title="Thông tin tiêu chí">
                <InfoRow label="Mã tiêu chí" value={viewingCriterion.criterion_code} />
                <InfoRow label="Nội dung" value={viewingCriterion.content} />
                <InfoRow label="Mô tả" value={viewingCriterion.description} />
                <InfoRow
                  label="Trạng thái"
                  value={viewingCriterion.is_active ? 'Đang hoạt động' : 'Ngừng kích hoạt'}
                />
              </DetailSection>

              <DetailSection title="Phân loại">
                <InfoRow
                  label="Nhóm tuổi"
                  value={
                    viewingCriterion.assessment_age_group?.class_group_label ||
                    viewingCriterion.assessment_age_group?.name_vi
                  }
                />
                <InfoRow label="Lĩnh vực" value={viewingCriterion.development_field?.name_vi} />
                <InfoRow label="Môn học" value={viewingCriterion.assessment_subject?.name} />
                <InfoRow label="Chủ đề" value={viewingCriterion.assessment_theme?.name} />
                <InfoRow label="Đề tài" value={viewingCriterion.assessment_topic?.name} />
              </DetailSection>

              <DetailSection title="Hệ thống">
                <InfoRow
                  label="Nguồn tạo"
                  value={
                    viewingCriterion.source_request
                      ? `Yêu cầu ${viewingCriterion.source_request.request_code}`
                      : 'Tạo trực tiếp'
                  }
                />
                <InfoRow label="Người tạo" value={getCriterionCreatorName(viewingCriterion)} />
                <InfoRow
                  label="Ngày tạo"
                  value={fmtDate(getCriterionCreatedAt(viewingCriterion))}
                />
                <InfoRow
                  label="Người cập nhật"
                  value={getAccountTeacherName(viewingCriterion.updated_by)}
                />
                <InfoRow label="Ngày cập nhật" value={fmtDate(viewingCriterion.updated_at)} />
              </DetailSection>

              {canManage && (
                <div className="border-t pt-4">
                  {viewingCriterion.is_active && (
                    <p className="mb-2 text-right text-xs text-muted-foreground">
                      Ngừng kích hoạt tiêu chí trước khi xóa vĩnh viễn.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 justify-end">
                    <Button
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() => openCriterionDelete(viewingCriterion)}
                      disabled={criterionUsageLookup.isPending}
                    >
                      <Trash2 className="mr-1.5 h-4 w-4" />
                      Xóa vĩnh viễn
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => toggleCriterionStatus(viewingCriterion)}
                      disabled={statusCriterion.isPending}
                    >
                      {viewingCriterion.is_active ? (
                        <PowerOff className="mr-1.5 h-4 w-4" />
                      ) : (
                        <Power className="mr-1.5 h-4 w-4" />
                      )}
                      {viewingCriterion.is_active ? 'Ngừng kích hoạt' : 'Kích hoạt'}
                    </Button>
                    <Button onClick={() => openCriterionEdit(viewingCriterion)}>
                      <Edit className="mr-1.5 h-4 w-4" />
                      Sửa
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog
        open={Boolean(criterionUsage)}
        onOpenChange={(open) => !open && setCriterionUsage(null)}
      >
        <DialogContent className="flex max-h-[80vh] max-w-2xl flex-col gap-0 p-0">
          {criterionUsage && (
            <>
              <DialogHeader className="border-b px-5 py-4">
                <DialogTitle>Không thể xóa tiêu chí</DialogTitle>
                <p className="pt-1 text-sm leading-6 text-muted-foreground">
                  Tiêu chí{' '}
                  <span className="font-medium text-foreground">
                    {criterionUsage.criterion.criterion_code}
                  </span>{' '}
                  đang được sử dụng trong {criterionUsage.summary.totalUsages} dữ liệu kế hoạch hoặc
                  đánh giá.
                </p>
                <p className="text-xs leading-5 text-muted-foreground">
                  {criterionUsage.criterion.content}
                </p>
              </DialogHeader>

              <div className="min-h-0 space-y-3 overflow-y-auto px-5 py-4">
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                  Bạn có thể ngừng kích hoạt tiêu chí để không cho sử dụng trong các kế hoạch mới,
                  nhưng không thể xóa dữ liệu đã được sử dụng.
                </p>
                {usageDetailsUnavailable && (
                  <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs leading-5 text-muted-foreground">
                    Tiêu chí đang được sử dụng trong dữ liệu lịch sử nên không thể xóa. Không thể
                    tải chi tiết sử dụng vào lúc này.
                  </p>
                )}

                <UsageGroup
                  title="Kế hoạch tháng/chủ đề"
                  count={criterionUsage.summary.monthlyPlanCount}
                >
                  {criterionUsage.groups.monthlyPlans.map((item) => (
                    <UsageRow key={item.id} title={item.planName} status={item.status}>
                      <p>Giáo viên lập: {item.teacherName || 'Không có dữ liệu'}</p>
                      <p>
                        Lớp: {item.className} · Tháng triển khai: {item.planningMonth}
                      </p>
                      <p>Tuần áp dụng: {item.weekRange}</p>
                    </UsageRow>
                  ))}
                </UsageGroup>

                <UsageGroup title="Kế hoạch tuần" count={criterionUsage.summary.weeklyPlanCount}>
                  {criterionUsage.groups.weeklyPlans.map((item) => (
                    <UsageRow
                      key={item.id}
                      title={`Kế hoạch tuần · Tuần ${item.weekNumber}`}
                      status={item.status}
                    >
                      <p>Nguồn: {item.sourcePlanName}</p>
                      <p>Giáo viên lập: {item.teacherName || 'Không có dữ liệu'}</p>
                      <p>
                        Lớp: {item.className} · Thời gian: {item.displayRange}
                      </p>
                      <p>Hoạt động: {item.activityName}</p>
                    </UsageRow>
                  ))}
                </UsageGroup>

                <UsageGroup
                  title="Đánh giá hằng ngày"
                  count={criterionUsage.summary.dailyAssessmentGroupCount}
                >
                  {criterionUsage.groups.dailyAssessments.map((item) => (
                    <UsageRow
                      key={`${item.activityDate}-${item.activityName}-${item.className}`}
                      title={`${fmtDate(item.activityDate)} · ${item.activityName}`}
                    >
                      <p>Giáo viên đánh giá: {item.teacherName || 'Không có dữ liệu'}</p>
                      <p>Lớp: {item.className}</p>
                      <p>Đã đánh giá: {item.assessedStudentCount} trẻ</p>
                    </UsageRow>
                  ))}
                </UsageGroup>

                <UsageGroup title="Báo cáo" count={criterionUsage.summary.reportCount}>
                  {criterionUsage.groups.reports.map((item, index) => (
                    <UsageRow
                      key={`${item.type}-${item.period}-${item.className}-${index}`}
                      title={
                        item.type === 'MONTHLY'
                          ? 'Báo cáo phát triển tháng'
                          : 'Báo cáo phát triển năm học'
                      }
                      status={item.status}
                    >
                      <p>
                        Lớp: {item.className} · Kỳ báo cáo: {item.period}
                      </p>
                      <p>{item.reportCount} báo cáo học sinh</p>
                    </UsageRow>
                  ))}
                </UsageGroup>

                <UsageGroup
                  title="Dữ liệu lịch sử khác"
                  count={criterionUsage.summary.historicalReferenceCount}
                >
                  {criterionUsage.groups.historicalRequests.map((item) => (
                    <UsageRow
                      key={item.id}
                      title={`Yêu cầu bổ sung ${item.requestCode}`}
                      status={item.status}
                    >
                      <p>Ngày tạo: {fmtDate(item.createdAt)}</p>
                    </UsageRow>
                  ))}
                </UsageGroup>
              </div>

              <DialogFooter className="border-t px-5 py-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setCriterionUsage(null);
                    setUsageDetailsUnavailable(false);
                  }}
                >
                  Đóng
                </Button>
                {criterionUsage.criterion.is_active && (
                  <Button
                    variant="secondary"
                    onClick={deactivateCriterionFromUsage}
                    disabled={statusCriterion.isPending}
                  >
                    <PowerOff className="mr-1.5 h-4 w-4" />
                    Ngừng kích hoạt thay vì xóa
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={deleteTarget?.type === 'criterion' ? 'Xóa tiêu chí?' : 'Xóa vĩnh viễn mục này?'}
        description={
          deleteTarget?.type === 'criterion'
            ? `Tiêu chí "${deleteTarget.item.criterion_code} - ${deleteTarget.item.content}" sẽ bị xóa khỏi ngân hàng tiêu chí. Bạn có chắc muốn tiếp tục?`
            : 'Bạn có chắc muốn xóa vĩnh viễn mục này? Hành động này không thể hoàn tác.'
        }
        confirmLabel={deleteTarget?.type === 'criterion' ? 'Xóa tiêu chí' : 'Xóa vĩnh viễn'}
        variant="destructive"
        loading={hardDelete.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          hardDelete.mutate({
            type: deleteTarget.type,
            id: getDeleteId(deleteTarget),
            item: deleteTarget.item,
          });
        }}
      >
        {deleteTarget && (
          <div className="text-muted-foreground">Mục sẽ xóa: {getDeleteName(deleteTarget)}</div>
        )}
      </ConfirmDialog>
    </>
  );
}
