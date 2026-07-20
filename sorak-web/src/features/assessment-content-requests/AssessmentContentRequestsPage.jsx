import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  Eye,
  MoreHorizontal,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/shared/components/page-header';
import { DataPagination } from '@/shared/components/data-pagination';
import { useList } from '@/shared/hooks/use-crud';
import { apiClient } from '@/shared/api/client';
import { fmtDate } from '@/shared/utils/date';
import { useAuthStore } from '@/shared/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DetailSection, InfoRow } from '@/shared/components/detail-sheet';

const REQUEST_TYPES = {
  SUBJECT: 'Môn học',
  THEME: 'Chủ đề',
  TOPIC: 'Đề tài',
  CRITERION: 'Tiêu chí',
  TOPIC_WITH_CRITERIA: 'Đề tài kèm tiêu chí',
};

const STATUS_LABELS = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
  CANCELLED: 'Đã hủy',
};

const STATUS_CLASS = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
  CANCELLED: 'bg-slate-50 text-slate-700 border-slate-200',
};

const EMPTY_FORM = {
  request_type: 'TOPIC',
  proposed_name: '',
  proposed_description: '',
  proposed_reason: '',
  age_group_id: '',
  development_field_id: '',
  subject_id: '',
  theme_id: '',
  topic_id: '',
  proposed_criteria: [{ description: '' }],
};

function toId(value) {
  return value ? Number(value) : undefined;
}

function optionValue(value) {
  return value == null ? '' : String(value);
}

function getTypeContent(row) {
  if (row.request_type === 'CRITERION') return row.proposed_name;
  if (row.request_type === 'TOPIC_WITH_CRITERIA') {
    return `${row.proposed_name} (${row.proposed_criteria?.length ?? 0} tiêu chí)`;
  }
  return row.proposed_name;
}

function statusBadge(status) {
  return (
    <Badge variant="outline" className={STATUS_CLASS[status]}>
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

function RequiredMark() {
  return <span className="text-destructive">*</span>;
}

function ClassificationContext({ items }) {
  if (!items.length) return null;

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Phân loại đang chọn
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

function proposedNamePlaceholder(requestType) {
  if (requestType === 'SUBJECT') return 'Ví dụ: Khám phá';
  if (requestType === 'THEME') return 'Ví dụ: Động vật';
  if (requestType === 'CRITERION') return 'Ví dụ: Trẻ nhận biết và gọi đúng tên con trâu.';
  return 'Ví dụ: Làm quen với trâu nước';
}

function proposedDescriptionPlaceholder(requestType) {
  if (requestType === 'SUBJECT') {
    return 'Ví dụ: Các hoạt động giúp trẻ tìm hiểu môi trường tự nhiên và xã hội xung quanh.';
  }
  if (requestType === 'THEME') {
    return 'Ví dụ: Chủ đề giúp trẻ làm quen với các loài động vật gần gũi.';
  }
  if (requestType === 'CRITERION') {
    return 'Ví dụ: Trẻ có thể chỉ, gọi tên và mô tả một số đặc điểm nổi bật của con trâu.';
  }
  return 'Ví dụ: Trẻ nhận biết đặc điểm, môi trường sống và ích lợi của con trâu.';
}

function FieldSelect({
  label,
  value,
  onChange,
  items,
  valueKey,
  labelKey,
  placeholder,
  disabled,
  required = false,
  emptyMessage = 'Không có dữ liệu',
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label} {required && <RequiredMark />}
      </Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder ?? 'Chọn'} />
        </SelectTrigger>
        <SelectContent>
          {items.length === 0 ? (
            <SelectItem value="__empty" disabled>
              {emptyMessage}
            </SelectItem>
          ) : (
            items.map((item) => (
              <SelectItem key={item[valueKey]} value={String(item[valueKey])}>
                {typeof labelKey === 'function' ? labelKey(item) : item[labelKey]}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  allLabel,
  items,
  valueKey,
  labelKey,
  placeholder,
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value || 'ALL'} onValueChange={(next) => onChange(next === 'ALL' ? '' : next)}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder ?? label} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">{allLabel}</SelectItem>
          {items.map((item) => (
            <SelectItem key={item[valueKey]} value={String(item[valueKey])}>
              {typeof labelKey === 'function' ? labelKey(item) : item[labelKey]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function buildPayload(form) {
  const payload = {
    request_type: form.request_type,
    proposed_name: form.proposed_name,
    proposed_description: form.proposed_description,
    proposed_reason: form.proposed_reason,
  };

  if (['THEME', 'TOPIC', 'CRITERION', 'TOPIC_WITH_CRITERIA'].includes(form.request_type)) {
    payload.subject_id = toId(form.subject_id);
  }
  if (
    ['SUBJECT', 'THEME', 'TOPIC', 'CRITERION', 'TOPIC_WITH_CRITERIA'].includes(form.request_type)
  ) {
    payload.age_group_id = toId(form.age_group_id);
  }
  if (['TOPIC', 'CRITERION', 'TOPIC_WITH_CRITERIA'].includes(form.request_type)) {
    payload.theme_id = toId(form.theme_id);
  }
  if (
    ['SUBJECT', 'THEME', 'TOPIC', 'CRITERION', 'TOPIC_WITH_CRITERIA'].includes(form.request_type)
  ) {
    payload.development_field_id = toId(form.development_field_id);
  }
  if (form.request_type === 'CRITERION') payload.topic_id = toId(form.topic_id);
  if (form.request_type === 'TOPIC_WITH_CRITERIA') {
    payload.proposed_criteria = form.proposed_criteria
      .map((item) => ({ description: item.description.trim() }))
      .filter((item) => item.description);
  }
  return payload;
}

function getApiErrorMessage(error, fallback) {
  const details = error?.response?.data?.details;
  if (Array.isArray(details) && details.length > 0) {
    const detailMessage = details
      .map((item) => (typeof item === 'string' ? item : item?.message))
      .filter(Boolean)
      .join(', ');
    if (detailMessage) return detailMessage;
  }
  return error?.response?.data?.message || fallback;
}

function unwrapApiData(response) {
  return response?.data?.data ?? response?.data ?? response;
}

function getCreateFormError(form) {
  const needsAgeGroup = ['SUBJECT', 'THEME', 'TOPIC', 'CRITERION', 'TOPIC_WITH_CRITERIA'].includes(
    form.request_type,
  );
  const needsField = ['SUBJECT', 'THEME', 'TOPIC', 'CRITERION', 'TOPIC_WITH_CRITERIA'].includes(
    form.request_type,
  );
  const needsSubject = ['THEME', 'TOPIC', 'CRITERION', 'TOPIC_WITH_CRITERIA'].includes(
    form.request_type,
  );
  const needsTheme = ['TOPIC', 'CRITERION', 'TOPIC_WITH_CRITERIA'].includes(form.request_type);

  if (!form.request_type) return 'Vui lòng chọn loại yêu cầu.';
  if (needsAgeGroup && !form.age_group_id) return 'Vui lòng chọn nhóm tuổi.';
  if (needsField && !form.development_field_id) return 'Vui lòng chọn lĩnh vực phát triển.';
  if (needsSubject && !form.subject_id) return 'Vui lòng chọn môn học.';
  if (needsTheme && !form.theme_id) return 'Vui lòng chọn chủ đề.';
  if (form.request_type === 'CRITERION' && !form.topic_id) return 'Vui lòng chọn đề tài.';
  if (!form.proposed_name.trim()) {
    return form.request_type === 'CRITERION'
      ? 'Vui lòng nhập nội dung tiêu chí.'
      : 'Vui lòng nhập tên nội dung đề xuất.';
  }
  if (
    form.request_type === 'TOPIC_WITH_CRITERIA' &&
    !form.proposed_criteria.some((item) => item.description.trim())
  ) {
    return 'Vui lòng nhập ít nhất một nội dung tiêu chí.';
  }
  if (!form.proposed_reason.trim()) return 'Vui lòng nhập lý do đề xuất.';
  return '';
}

export function AssessmentContentRequestsPage() {
  const user = useAuthStore((s) => s.user);
  const isBGH = user?.role === 'PRINCIPAL';
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    search: '',
    request_type: '',
    status: '',
    requester_teacher_id: '',
    age_group_id: '',
    development_field_id: '',
    subject_id: '',
    theme_id: '',
    topic_id: '',
    created_from: '',
    created_to: '',
  });
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewAction, setReviewAction] = useState('approve');
  const [reviewNote, setReviewNote] = useState('');
  const [cancelTarget, setCancelTarget] = useState(null);

  const requestParams = useMemo(
    () => ({
      page,
      pageSize: 10,
      ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)),
    }),
    [filters, page],
  );

  const { data: requestsData, isFetching } = useList(
    'assessment-content-requests',
    '/assessment-content-requests',
    requestParams,
  );
  const { data: ageGroupsData } = useList('assessment-age-groups', '/assessment-age-groups', {
    pageSize: 100,
  });
  const { data: fieldsData } = useList('development-fields', '/development-fields', {
    pageSize: 100,
  });
  const formSubjectParams = {
    pageSize: 100,
    is_active: 'true',
    ...(form.age_group_id ? { assessment_age_group_id: Number(form.age_group_id) } : {}),
    ...(form.development_field_id
      ? { development_field_id: Number(form.development_field_id) }
      : {}),
  };
  const { data: formSubjectsData, isFetching: formSubjectsFetching } = useList(
    'assessment-subjects',
    '/assessment-subjects',
    formSubjectParams,
    { enabled: Boolean(form.age_group_id && form.development_field_id) },
  );
  const filterSubjectParams = {
    pageSize: 100,
    is_active: 'true',
    ...(filters.age_group_id ? { assessment_age_group_id: Number(filters.age_group_id) } : {}),
    ...(filters.development_field_id
      ? { development_field_id: Number(filters.development_field_id) }
      : {}),
  };
  const { data: filterSubjectsData } = useList(
    'assessment-subjects',
    '/assessment-subjects',
    filterSubjectParams,
  );
  const formThemeParams = {
    pageSize: 100,
    is_active: 'true',
    ...(form.subject_id ? { assessment_subject_id: Number(form.subject_id) } : {}),
  };
  const { data: formThemesData } = useList(
    'assessment-themes',
    '/assessment-themes',
    formThemeParams,
    { enabled: Boolean(form.subject_id) },
  );
  const filterThemeParams = {
    pageSize: 100,
    is_active: 'true',
    ...(filters.subject_id ? { assessment_subject_id: Number(filters.subject_id) } : {}),
  };
  const { data: filterThemesData } = useList(
    'assessment-themes',
    '/assessment-themes',
    filterThemeParams,
    { enabled: Boolean(filters.subject_id) },
  );
  const topicLookupParams = {
    pageSize: 100,
    is_active: 'true',
    ...(form.age_group_id ? { assessment_age_group_id: Number(form.age_group_id) } : {}),
    ...(form.subject_id ? { assessment_subject_id: Number(form.subject_id) } : {}),
    ...(form.theme_id ? { assessment_theme_id: Number(form.theme_id) } : {}),
  };
  const { data: formTopicsData } = useList(
    'assessment-topics',
    '/assessment-topics',
    topicLookupParams,
  );
  const filterTopicParams = {
    pageSize: 100,
    is_active: 'true',
    ...(filters.age_group_id ? { assessment_age_group_id: Number(filters.age_group_id) } : {}),
    ...(filters.subject_id ? { assessment_subject_id: Number(filters.subject_id) } : {}),
    ...(filters.theme_id ? { assessment_theme_id: Number(filters.theme_id) } : {}),
  };
  const { data: filterTopicsData } = useList(
    'assessment-topics',
    '/assessment-topics',
    filterTopicParams,
  );
  const { data: teachersData } = useList('teachers', '/teachers', { pageSize: 200 });

  const rows = requestsData?.data ?? [];
  const meta = requestsData?.meta ?? { page, pageSize: 10, total: 0, totalPages: 1 };
  const ageGroups = ageGroupsData?.data ?? [];
  const fields = fieldsData?.data ?? [];
  const formSubjects = formSubjectsData?.data ?? [];
  const filterSubjects = filterSubjectsData?.data ?? [];
  const formThemes = formThemesData?.data ?? [];
  const filterThemes = filterThemesData?.data ?? [];
  const formTopics = formTopicsData?.data ?? [];
  const filterTopics = filterTopicsData?.data ?? [];
  const teachers = teachersData?.data ?? [];
  const hasActiveFilters = Object.values(filters).some(Boolean);

  const selectedAgeGroup = ageGroups.find(
    (item) => optionValue(item.assessment_age_group_id) === form.age_group_id,
  );
  const selectedField = fields.find(
    (item) => optionValue(item.development_field_id) === form.development_field_id,
  );
  const selectedSubject = formSubjects.find(
    (item) => optionValue(item.assessment_subject_id) === form.subject_id,
  );
  const selectedTheme = formThemes.find(
    (item) => optionValue(item.assessment_theme_id) === form.theme_id,
  );
  const selectedTopic = formTopics.find(
    (item) => optionValue(item.assessment_topic_id) === form.topic_id,
  );
  const scopeItems = [
    selectedAgeGroup && { label: 'Nhóm tuổi', value: selectedAgeGroup.name_vi },
    selectedField && { label: 'Lĩnh vực phát triển', value: selectedField.name_vi },
    selectedSubject && { label: 'Môn học', value: selectedSubject.name },
    selectedTheme && { label: 'Chủ đề', value: selectedTheme.name },
    selectedTopic && { label: 'Đề tài', value: selectedTopic.name },
  ].filter(Boolean);

  const refreshRequests = async () => {
    await queryClient.invalidateQueries({ queryKey: ['assessment-content-requests'] });
    await queryClient.refetchQueries({
      queryKey: ['assessment-content-requests'],
      type: 'active',
    });
  };

  const updateCachedRequest = (request) => {
    if (!request?.request_id) return;
    queryClient.setQueriesData({ queryKey: ['assessment-content-requests'] }, (current) => {
      if (!current?.data) return current;
      return {
        ...current,
        data: current.data.map((row) =>
          row.request_id === request.request_id ? { ...row, ...request } : row,
        ),
      };
    });
  };

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiClient.post('/assessment-content-requests', payload);
      return unwrapApiData(response);
    },
    onSuccess: async () => {
      toast.success('Tạo yêu cầu bổ sung thành công.');
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      setFormError('');
      setPage(1);
      await refreshRequests();
    },
    onError: (error) => {
      const message = getApiErrorMessage(error, 'Không thể tạo yêu cầu bổ sung.');
      setFormError(message);
      toast.error(message);
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, action, note }) => {
      const response = await apiClient.patch(`/assessment-content-requests/${id}/review`, {
        action,
        review_note: note,
      });
      return unwrapApiData(response);
    },
    onSuccess: async (request, vars) => {
      toast.success(
        vars.action === 'approve'
          ? 'Duyệt yêu cầu thành công. Dữ liệu chính thức đã được tạo.'
          : 'Từ chối yêu cầu thành công.',
      );
      updateCachedRequest(request);
      setReviewTarget(null);
      setReviewNote('');
      await refreshRequests();
      queryClient.invalidateQueries({ queryKey: ['assessment-subjects'] });
      queryClient.invalidateQueries({ queryKey: ['assessment-themes'] });
      queryClient.invalidateQueries({ queryKey: ['assessment-topics'] });
      queryClient.invalidateQueries({ queryKey: ['assessment-criteria'] });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Không thể xử lý yêu cầu.'));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id) => {
      const response = await apiClient.patch(`/assessment-content-requests/${id}/cancel`);
      return unwrapApiData(response);
    },
    onSuccess: async (request) => {
      toast.success('Hủy yêu cầu thành công.');
      updateCachedRequest(request);
      setCancelTarget(null);
      await refreshRequests();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Không thể hủy yêu cầu.'));
    },
  });

  const updateFilter = (key, value) => {
    setFilters((current) => {
      const next = { ...current, [key]: value };
      if (key === 'development_field_id') {
        next.subject_id = '';
        next.topic_id = '';
      }
      if (key === 'subject_id') next.topic_id = '';
      return next;
    });
    setPage(1);
  };

  const updateForm = (key, value) => {
    setFormError('');
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === 'request_type') return { ...EMPTY_FORM, request_type: value };
      if (key === 'development_field_id') {
        next.subject_id = '';
        next.theme_id = '';
        next.topic_id = '';
      }
      if (key === 'subject_id') {
        const nextSubject = formSubjects.find(
          (item) => optionValue(item.assessment_subject_id) === value,
        );
        if (nextSubject?.development_field_id) {
          next.development_field_id = optionValue(nextSubject.development_field_id);
        }
      }
      if (key === 'age_group_id') {
        next.subject_id = '';
        next.theme_id = '';
        next.topic_id = '';
      }
      if (key === 'subject_id') {
        next.theme_id = '';
        next.topic_id = '';
      }
      if (key === 'theme_id') next.topic_id = '';
      return next;
    });
  };

  const addCriterionRow = () => {
    setFormError('');
    setForm((current) => ({
      ...current,
      proposed_criteria: [...current.proposed_criteria, { description: '' }],
    }));
  };

  const updateCriterionRow = (index, value) => {
    setFormError('');
    setForm((current) => ({
      ...current,
      proposed_criteria: current.proposed_criteria.map((item, itemIndex) =>
        itemIndex === index ? { ...item, description: value } : item,
      ),
    }));
  };

  const removeCriterionRow = (index) => {
    setFormError('');
    setForm((current) => ({
      ...current,
      proposed_criteria:
        current.proposed_criteria.length === 1
          ? current.proposed_criteria
          : current.proposed_criteria.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const submitCreate = (event) => {
    event.preventDefault();
    const message = getCreateFormError(form);
    if (message) {
      setFormError(message);
      toast.error(message);
      return;
    }
    createMutation.mutate(buildPayload(form));
  };

  const openReview = (row, action) => {
    setReviewTarget(row);
    setReviewAction(action);
    setReviewNote('');
  };

  return (
    <div>
      <PageHeader
        title="Yêu cầu bổ sung nội dung đánh giá"
        description={
          isBGH
            ? 'Theo dõi và duyệt dữ liệu đề xuất từ giáo viên.'
            : 'Tạo và theo dõi yêu cầu bổ sung danh mục đánh giá.'
        }
      />

      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
          }}
          className="flex gap-2 flex-1 min-w-[240px] max-w-sm"
        >
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Tìm mã, nội dung..."
              value={filters.search}
              onChange={(event) => updateFilter('search', event.target.value)}
            />
          </div>
          <Button type="submit" variant="secondary">
            Tìm
          </Button>
        </form>
        <div className="flex-1" />
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={filters.request_type || 'ALL'}
            onValueChange={(value) => updateFilter('request_type', value === 'ALL' ? '' : value)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Loại yêu cầu" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tất cả loại</SelectItem>
              {Object.entries(REQUEST_TYPES).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.status || 'ALL'}
            onValueChange={(value) => updateFilter('status', value === 'ALL' ? '' : value)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tất cả trạng thái</SelectItem>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isBGH && (
            <Select
              value={filters.requester_teacher_id || 'ALL'}
              onValueChange={(value) =>
                updateFilter('requester_teacher_id', value === 'ALL' ? '' : value)
              }
            >
              <SelectTrigger className="w-[190px]">
                <SelectValue placeholder="Giáo viên" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tất cả giáo viên</SelectItem>
                {teachers.map((teacher) => (
                  <SelectItem key={teacher.teacher_id} value={String(teacher.teacher_id)}>
                    {teacher.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAdvancedFiltersOpen((open) => !open)}
          >
            <SlidersHorizontal className="h-4 w-4 mr-1.5" />
            Bộ lọc nâng cao
          </Button>
          {!isBGH && (
            <Button
              size="sm"
              className="shrink-0"
              onClick={() => {
                setForm(EMPTY_FORM);
                setFormError('');
                setCreateOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Tạo Yêu Cầu
            </Button>
          )}
        </div>
      </div>

      {advancedFiltersOpen && (
        <div className="bg-card rounded-md border p-3 mb-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,360px)]">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <FilterSelect
                label="Nhóm tuổi"
                value={filters.age_group_id}
                onChange={(value) => updateFilter('age_group_id', value)}
                allLabel="Tất cả nhóm tuổi"
                items={ageGroups}
                valueKey="assessment_age_group_id"
                labelKey="name_vi"
              />
              <FilterSelect
                label="Lĩnh vực phát triển"
                value={filters.development_field_id}
                onChange={(value) => updateFilter('development_field_id', value)}
                allLabel="Tất cả lĩnh vực"
                items={fields}
                valueKey="development_field_id"
                labelKey="name_vi"
              />
              <FilterSelect
                label="Môn học"
                value={filters.subject_id}
                onChange={(value) => updateFilter('subject_id', value)}
                allLabel="Tất cả môn học"
                items={filterSubjects}
                valueKey="assessment_subject_id"
                labelKey="name"
              />
              <FilterSelect
                label="Chủ đề"
                value={filters.theme_id}
                onChange={(value) => updateFilter('theme_id', value)}
                allLabel="Tất cả chủ đề"
                items={filterThemes}
                valueKey="assessment_theme_id"
                labelKey="name"
              />
              <FilterSelect
                label="Đề tài"
                value={filters.topic_id}
                onChange={(value) => updateFilter('topic_id', value)}
                allLabel="Tất cả đề tài"
                items={filterTopics}
                valueKey="assessment_topic_id"
                labelKey="name"
              />
            </div>
            {isBGH && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Ngày tạo từ</Label>
                  <Input
                    type="date"
                    value={filters.created_from}
                    onChange={(event) => updateFilter('created_from', event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Ngày tạo đến</Label>
                  <Input
                    type="date"
                    value={filters.created_to}
                    onChange={(event) => updateFilter('created_to', event.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-card rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mã yêu cầu</TableHead>
              <TableHead>Loại</TableHead>
              <TableHead>Nội dung đề xuất</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Ngày tạo</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  {isFetching
                    ? 'Đang tải...'
                    : hasActiveFilters
                      ? 'Không tìm thấy yêu cầu phù hợp với bộ lọc hiện tại.'
                      : isBGH
                        ? 'Chưa có yêu cầu bổ sung nào cần theo dõi hoặc duyệt.'
                        : 'Bạn chưa tạo yêu cầu bổ sung nào.'}
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => (
              <TableRow key={row.request_id}>
                <TableCell className="font-medium">{row.request_code}</TableCell>
                <TableCell>{REQUEST_TYPES[row.request_type]}</TableCell>
                <TableCell className="max-w-[260px] truncate">{getTypeContent(row)}</TableCell>
                <TableCell>{statusBadge(row.status)}</TableCell>
                <TableCell>{fmtDate(row.created_at)}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={() => setDetail(row)}>
                        <Eye className="mr-2 h-4 w-4" />
                        Xem chi tiết
                      </DropdownMenuItem>
                      {isBGH && row.status === 'PENDING' && (
                        <>
                          <DropdownMenuItem onClick={() => openReview(row, 'approve')}>
                            <Check className="mr-2 h-4 w-4 text-emerald-600" />
                            Duyệt
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openReview(row, 'reject')}>
                            <X className="mr-2 h-4 w-4 text-destructive" />
                            Từ chối
                          </DropdownMenuItem>
                        </>
                      )}
                      {!isBGH && row.status === 'PENDING' && (
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setCancelTarget(row)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Hủy
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <DataPagination
        page={meta.page}
        pageSize={meta.pageSize}
        total={meta.total}
        totalPages={meta.totalPages}
        onPageChange={setPage}
        showSummary={meta.total > 0}
      />

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setFormError('');
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Tạo yêu cầu bổ sung</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitCreate} className="space-y-3 max-h-[75vh] overflow-y-auto pr-2">
            {formError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {formError}
              </div>
            )}
            <div className="space-y-3 rounded-md border bg-muted/20 p-3">
              <p className="text-sm font-semibold text-foreground">Chọn phạm vi phân loại</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <FieldSelect
                  label="Loại yêu cầu"
                  value={form.request_type}
                  onChange={(value) => updateForm('request_type', value)}
                  items={Object.entries(REQUEST_TYPES).map(([value, label]) => ({ value, label }))}
                  valueKey="value"
                  labelKey="label"
                  required
                />
                {['SUBJECT', 'THEME', 'TOPIC', 'CRITERION', 'TOPIC_WITH_CRITERIA'].includes(
                  form.request_type,
                ) && (
                  <FieldSelect
                    label="Nhóm tuổi"
                    value={form.age_group_id}
                    onChange={(value) => updateForm('age_group_id', value)}
                    items={ageGroups}
                    valueKey="assessment_age_group_id"
                    labelKey="name_vi"
                    required
                  />
                )}
                {['SUBJECT', 'THEME', 'TOPIC', 'CRITERION', 'TOPIC_WITH_CRITERIA'].includes(
                  form.request_type,
                ) && (
                  <FieldSelect
                    label="Lĩnh vực phát triển"
                    value={form.development_field_id}
                    onChange={(value) => updateForm('development_field_id', value)}
                    items={fields}
                    valueKey="development_field_id"
                    labelKey="name_vi"
                    required
                  />
                )}
                {['THEME', 'TOPIC', 'CRITERION', 'TOPIC_WITH_CRITERIA'].includes(
                  form.request_type,
                ) && (
                  <div className="space-y-1.5">
                    <FieldSelect
                      label="Môn học"
                      value={form.subject_id}
                      onChange={(value) => updateForm('subject_id', value)}
                      items={formSubjects}
                      valueKey="assessment_subject_id"
                      labelKey="name"
                      placeholder={
                        form.development_field_id ? 'Chọn môn học' : 'Chọn lĩnh vực trước'
                      }
                      disabled={!form.development_field_id}
                      emptyMessage="Không có môn học phù hợp với lĩnh vực đã chọn."
                      required
                    />
                    {form.development_field_id &&
                      !formSubjectsFetching &&
                      formSubjects.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          Không có môn học phù hợp với lĩnh vực đã chọn.
                        </p>
                      )}
                  </div>
                )}
                {['TOPIC', 'CRITERION', 'TOPIC_WITH_CRITERIA'].includes(form.request_type) && (
                  <FieldSelect
                    label="Chủ đề"
                    value={form.theme_id}
                    onChange={(value) => updateForm('theme_id', value)}
                    items={formThemes}
                    valueKey="assessment_theme_id"
                    labelKey="name"
                    required
                  />
                )}
                {form.request_type === 'CRITERION' && (
                  <FieldSelect
                    label="Đề tài"
                    value={form.topic_id}
                    onChange={(value) => updateForm('topic_id', value)}
                    items={formTopics}
                    valueKey="assessment_topic_id"
                    labelKey="name"
                    placeholder="Chọn đề tài hợp lệ"
                    required
                  />
                )}
              </div>
            </div>

            <ClassificationContext items={scopeItems} />

            <div className="space-y-1.5">
              <Label>
                {form.request_type === 'CRITERION' ? 'Nội dung tiêu chí' : 'Tên nội dung đề xuất'}
                <span> </span>
                <RequiredMark />
              </Label>
              <Input
                value={form.proposed_name}
                onChange={(event) => updateForm('proposed_name', event.target.value)}
                placeholder={proposedNamePlaceholder(form.request_type)}
                required
              />
              <p className="text-xs text-muted-foreground">
                {form.request_type === 'CRITERION'
                  ? 'Mô tả một kết quả hoặc hành vi cụ thể có thể quan sát ở trẻ.'
                  : 'Nội dung đề xuất sẽ được tạo trong phạm vi phân loại đã chọn.'}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Mô tả</Label>
              <Textarea
                value={form.proposed_description}
                onChange={(event) => updateForm('proposed_description', event.target.value)}
                placeholder={proposedDescriptionPlaceholder(form.request_type)}
              />
            </div>
            {form.request_type === 'TOPIC_WITH_CRITERIA' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>
                    Nội dung tiêu chí <RequiredMark />
                  </Label>
                  <Button type="button" variant="outline" size="sm" onClick={addCriterionRow}>
                    <Plus className="h-4 w-4 mr-2" />
                    Thêm dòng
                  </Button>
                </div>
                {form.proposed_criteria.map((item, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <Textarea
                      value={item.description}
                      onChange={(event) => updateCriterionRow(index, event.target.value)}
                      placeholder={`Nội dung tiêu chí ${index + 1}`}
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCriterionRow(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-1.5">
              <Label>
                Lý do đề xuất <RequiredMark />
              </Label>
              <Textarea
                value={form.proposed_reason}
                onChange={(event) => updateForm('proposed_reason', event.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Hủy
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || Boolean(getCreateFormError(form))}
              >
                Tạo yêu cầu
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Sheet open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)}>
        <SheetContent side="right" className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Chi tiết yêu cầu</SheetTitle>
          </SheetHeader>
          {detail && (
            <div className="space-y-4 mt-5">
              <div className="rounded-lg border bg-muted/30 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{getTypeContent(detail)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{detail.request_code}</p>
                  </div>
                  <div className="shrink-0">{statusBadge(detail.status)}</div>
                </div>
              </div>

              <DetailSection title="Thông tin yêu cầu">
                <InfoRow label="Loại yêu cầu" value={REQUEST_TYPES[detail.request_type]} />
                <InfoRow label="Nội dung đề xuất" value={getTypeContent(detail)} />
                <InfoRow label="Lý do" value={detail.proposed_reason} />
                <InfoRow label="Mô tả" value={detail.proposed_description} />
              </DetailSection>

              <DetailSection title="Ngữ cảnh đánh giá">
                <InfoRow label="Nhóm tuổi" value={detail.age_group?.name_vi} />
                <InfoRow label="Lĩnh vực" value={detail.development_field?.name_vi} />
                <InfoRow label="Môn học" value={detail.subject?.name} />
                <InfoRow label="Chủ đề" value={detail.theme?.name} />
                <InfoRow label="Đề tài" value={detail.topic?.name} />
              </DetailSection>

              <DetailSection title="Người gửi">
                <InfoRow label="Giáo viên" value={detail.requester_teacher?.full_name} />
                <InfoRow label="Lớp lúc tạo" value={detail.requester_class?.class_name} />
                <InfoRow label="Ngày tạo" value={fmtDate(detail.created_at)} />
              </DetailSection>

              {(detail.reviewer?.teacher?.full_name ||
                detail.reviewed_at ||
                detail.canceller?.teacher?.full_name ||
                detail.cancelled_at ||
                detail.review_note) && (
                <DetailSection title="Xử lý">
                  <InfoRow label="Người duyệt" value={detail.reviewer?.teacher?.full_name} />
                  <InfoRow label="Ngày duyệt" value={fmtDate(detail.reviewed_at)} />
                  <InfoRow label="Người hủy" value={detail.canceller?.teacher?.full_name} />
                  <InfoRow label="Ngày hủy" value={fmtDate(detail.cancelled_at)} />
                  <InfoRow label="Ghi chú duyệt" value={detail.review_note} />
                </DetailSection>
              )}

              {detail.proposed_criteria?.length > 0 && (
                <DetailSection title="Tiêu chí đề xuất">
                  {detail.proposed_criteria.map((item, index) => (
                    <InfoRow
                      key={index}
                      label={`Tiêu chí ${index + 1}`}
                      value={item.description ?? item.content}
                    />
                  ))}
                </DetailSection>
              )}

              {detail.createdRecords?.length > 0 && (
                <DetailSection title="Dữ liệu chính thức đã tạo">
                  {detail.createdRecords.map((item) => (
                    <InfoRow
                      key={item.id}
                      label={REQUEST_TYPES[item.recordType]}
                      value={item.displayName}
                    />
                  ))}
                </DetailSection>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={Boolean(reviewTarget)} onOpenChange={(open) => !open && setReviewTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'approve' ? 'Duyệt yêu cầu' : 'Từ chối yêu cầu'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {reviewAction === 'approve'
                ? 'Duyệt yêu cầu này sẽ tạo dữ liệu chính thức vào danh mục/ngân hàng tiêu chí. Bạn có chắc muốn tiếp tục?'
                : 'Bạn có chắc muốn từ chối yêu cầu này?'}
            </p>
            <div className="space-y-1.5">
              <Label>
                {reviewAction === 'reject' ? 'Lý do từ chối' : 'Ghi chú'}{' '}
                {reviewAction === 'reject' && <RequiredMark />}
              </Label>
              <Textarea
                value={reviewNote}
                onChange={(event) => setReviewNote(event.target.value)}
                required={reviewAction === 'reject'}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewTarget(null)}>
              Hủy
            </Button>
            <Button
              onClick={() =>
                reviewMutation.mutate({
                  id: reviewTarget.request_id,
                  action: reviewAction,
                  note: reviewNote,
                })
              }
              disabled={
                reviewMutation.isPending || (reviewAction === 'reject' && !reviewNote.trim())
              }
            >
              Xác nhận
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(cancelTarget)} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Hủy yêu cầu</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Bạn có chắc muốn hủy yêu cầu này? Yêu cầu đã hủy sẽ không được BGH duyệt.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>
              Không
            </Button>
            <Button
              variant="destructive"
              disabled={cancelMutation.isPending}
              onClick={() => cancelMutation.mutate(cancelTarget.request_id)}
            >
              Hủy yêu cầu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
