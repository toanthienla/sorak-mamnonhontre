import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Lock,
  MoreHorizontal,
  Pencil,
  Save,
  Unlock,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
import { DetailSection, InfoRow } from '@/shared/components/detail-sheet';
import { apiClient } from '@/shared/api/client';
import { useList } from '@/shared/hooks/use-crud';
import { fmtDate } from '@/shared/utils/date';
import { useAuthStore } from '@/shared/stores/auth.store';
import { useYearStore } from '@/shared/stores/year.store';

const DAYS = [
  ['MONDAY', 'Thứ 2'],
  ['TUESDAY', 'Thứ 3'],
  ['WEDNESDAY', 'Thứ 4'],
  ['THURSDAY', 'Thứ 5'],
  ['FRIDAY', 'Thứ 6'],
];
const DAY_LABELS = Object.fromEntries(DAYS);
const SESSIONS = [
  ['MORNING', 'Sáng'],
  ['AFTERNOON', 'Chiều'],
];
const SESSION_LABELS = Object.fromEntries(SESSIONS);
const WEEK_PATTERNS = [
  ['ALL', 'Hoạt động chung'],
  ['ODD', 'Tuần lẻ'],
  ['EVEN', 'Tuần chẵn'],
];
const ACTIVITY_TYPES = {
  SUBJECT: 'Môn học',
  THEME_ACTIVITY: 'Hoạt động',
};
const ACTIVITY_TYPE_STYLES = {
  SUBJECT: {
    label: 'Môn học',
    dot: 'bg-blue-600',
    card: 'border-blue-200 bg-blue-50/70 text-blue-950',
    accent: 'border-l-blue-600',
    chip: 'border-blue-200 bg-blue-100 text-blue-800',
  },
  THEME_ACTIVITY: {
    label: 'Hoạt động',
    dot: 'bg-amber-500',
    card: 'border-amber-200 bg-amber-50/70 text-amber-950',
    accent: 'border-l-amber-500',
    chip: 'border-amber-200 bg-amber-100 text-amber-800',
  },
};
const THEME_ACTIVITY_OPTIONS = [
  'Hoạt động góc',
  'Vui chơi ngoài trời',
  'Hoạt động chiều',
  'Hoạt động trải nghiệm',
];
const EMPTY_FORM = {
  academicYearId: '',
  ageGroupId: '',
  name: '',
  description: '',
  changeReason: '',
  items: [],
};
let timetableItemUid = 0;

function createItemUid() {
  timetableItemUid += 1;
  return `timetable-item-${Date.now()}-${timetableItemUid}`;
}
const EMPTY_ITEM = {
  weekPattern: 'ALL',
  dayOfWeek: 'MONDAY',
  session: 'MORNING',
  displayOrder: 1,
  activityType: 'SUBJECT',
  subjectId: '',
  activityName: '',
  isThemeBased: true,
  isAssessable: true,
  requiresWeeklyMapping: true,
  note: '',
};

function statusBadge(status) {
  return (
    <Badge
      variant="outline"
      className={
        status === 'LOCKED'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-amber-200 bg-amber-50 text-amber-700'
      }
    >
      {status === 'LOCKED' ? 'Đã khóa' : 'Bản nháp'}
    </Badge>
  );
}

function getErrorMessage(error, fallback) {
  return error?.response?.data?.message || fallback;
}

function toItemForm(item) {
  return {
    uid: item.uid ?? createItemUid(),
    timetableItemId: item.timetable_item_id ?? item.timetableItemId ?? null,
    weekPattern: item.week_pattern ?? item.weekPattern,
    dayOfWeek: item.day_of_week ?? item.dayOfWeek,
    session: item.session ?? item.session,
    displayOrder: item.display_order ?? item.displayOrder,
    activityType: item.activity_type ?? item.activityType,
    subjectId: item.subject_id
      ? String(item.subject_id)
      : item.subjectId
        ? String(item.subjectId)
        : '',
    subject: item.subject ?? null,
    activityName: item.activity_name ?? item.activityName ?? '',
    isThemeBased: item.is_theme_based ?? item.isThemeBased ?? false,
    isAssessable: item.is_assessable ?? item.isAssessable ?? false,
    requiresWeeklyMapping: item.requires_weekly_mapping ?? item.requiresWeeklyMapping ?? false,
    note: item.note ?? '',
  };
}

function itemPayload(item) {
  return {
    weekPattern: item.weekPattern,
    dayOfWeek: item.dayOfWeek,
    session: item.session,
    displayOrder: Number(item.displayOrder),
    activityType: item.activityType,
    subjectId: item.subjectId ? Number(item.subjectId) : null,
    activityName: item.activityName,
    isThemeBased: true,
    isAssessable: true,
    requiresWeeklyMapping: true,
    note: item.note,
  };
}

function buildTimetablePayload(form, initialValue, changeReason) {
  const orderedItems = reindexItems(form.items);
  return {
    academicYearId: Number(form.academicYearId),
    ageGroupId: Number(form.ageGroupId),
    name: form.name,
    description: form.description,
    ...(initialValue ? { changeReason } : {}),
    items: orderedItems.map(itemPayload),
  };
}

function comparableTimetablePayload(payload) {
  return {
    academicYearId: payload.academicYearId,
    ageGroupId: payload.ageGroupId,
    name: payload.name ?? '',
    description: payload.description ?? '',
    items: payload.items.map((item) => ({
      weekPattern: item.weekPattern,
      dayOfWeek: item.dayOfWeek,
      session: item.session,
      displayOrder: Number(item.displayOrder),
      activityType: item.activityType,
      subjectId: item.subjectId ?? null,
      activityName: item.activityName ?? '',
      note: item.note ?? '',
    })),
  };
}

function hasTimetableChanges(form, initialValue) {
  if (!initialValue) return true;
  const current = comparableTimetablePayload(buildTimetablePayload(form, initialValue, ''));
  const original = comparableTimetablePayload(
    buildTimetablePayload(
      {
        academicYearId: String(initialValue.school_year_id),
        ageGroupId: String(initialValue.age_group_id),
        name: initialValue.name ?? '',
        description: initialValue.description ?? '',
        items: reindexItems(normalizeItems(initialValue.items)),
      },
      initialValue,
      '',
    ),
  );
  return JSON.stringify(current) !== JSON.stringify(original);
}

function reindexItems(items) {
  const groups = new Map();
  for (const [index, item] of items.entries()) {
    const key = `${item.dayOfWeek}|${item.session}`;
    groups.set(key, [...(groups.get(key) ?? []), { item, index }]);
  }

  const displayOrderByUid = new Map();
  for (const group of groups.values()) {
    const byPattern = Object.fromEntries(
      ['ALL', 'ODD', 'EVEN'].map((pattern) => [
        pattern,
        group
          .filter(({ item }) => item.weekPattern === pattern)
          .sort(
            (a, b) =>
              Number(a.item.displayOrder) - Number(b.item.displayOrder) || a.index - b.index,
          ),
      ]),
    );
    byPattern.ALL.forEach(({ item }, index) => displayOrderByUid.set(item.uid, index + 1));
    for (const pattern of ['ODD', 'EVEN']) {
      byPattern[pattern].forEach(({ item }, index) =>
        displayOrderByUid.set(item.uid, byPattern.ALL.length + index + 1),
      );
    }
  }

  return items.map((item) => ({
    ...item,
    displayOrder: displayOrderByUid.get(item.uid) ?? item.displayOrder,
  }));
}

function createItemFromPalette(paletteItem, target) {
  const base = {
    uid: createItemUid(),
    weekPattern: target.weekPattern,
    dayOfWeek: target.dayOfWeek,
    session: target.session,
    displayOrder: 1,
    activityType: paletteItem.activityType,
    note: '',
  };

  if (paletteItem.activityType === 'SUBJECT') {
    return {
      ...base,
      subjectId: paletteItem.subjectId,
      activityName: paletteItem.label,
      isThemeBased: true,
      isAssessable: true,
      requiresWeeklyMapping: true,
    };
  }
  return {
    ...base,
    subjectId: '',
    activityName: paletteItem.label,
    isThemeBased: true,
    isAssessable: true,
    requiresWeeklyMapping: true,
  };
}

function insertItemAt(items, item, target) {
  const next = items.filter((row) => row.uid !== item.uid);
  const moved = {
    ...item,
    weekPattern: target.weekPattern,
    dayOfWeek: target.dayOfWeek,
    session: target.session,
  };
  if (!target.targetUid) return reindexItems([...next, moved]);
  const targetIndex = next.findIndex((row) => row.uid === target.targetUid);
  if (targetIndex < 0) return reindexItems([...next, moved]);
  return reindexItems([...next.slice(0, targetIndex), moved, ...next.slice(targetIndex)]);
}

function findSubject(item, subjects = []) {
  const subjectId = item.subject_id ?? item.subjectId;
  if (!subjectId) return item.subject ?? null;
  return (
    item.subject ??
    subjects.find((subject) => String(subject.assessment_subject_id) === String(subjectId)) ??
    null
  );
}

function itemTitle(item, subjects = []) {
  const activityType = item.activityType ?? item.activity_type;
  const subject = findSubject(item, subjects);
  if (activityType === 'SUBJECT' && subject?.name) return subject.name;
  return subject?.name || item.activityName || item.activity_name || 'Chưa đặt tên hoạt động';
}

function itemDevelopmentFieldName(item, subjects = []) {
  const subject = findSubject(item, subjects);
  return subject?.development_field?.name_vi ?? subject?.developmentField?.name ?? null;
}

function itemTypeStyle(item) {
  return (
    ACTIVITY_TYPE_STYLES[item.activityType ?? item.activity_type] ??
    ACTIVITY_TYPE_STYLES.THEME_ACTIVITY
  );
}

function normalizeItems(items) {
  return (items ?? []).map(toItemForm).filter((item) => item.activityType !== 'ROUTINE');
}

function duplicateSlotMessage(items) {
  const seen = new Set();
  for (const item of items) {
    const effectivePatterns = item.weekPattern === 'ALL' ? ['ODD', 'EVEN'] : [item.weekPattern];
    for (const pattern of effectivePatterns) {
      const key = `${pattern}|${item.dayOfWeek}|${item.session}|${item.displayOrder}`;
      if (seen.has(key)) {
        return 'Trong cùng một tuần, một buổi học không được có hai hoạt động cùng thứ tự hiển thị.';
      }
      seen.add(key);
    }
  }
  return '';
}

function buildGridItems(items, weekPattern, day, session) {
  return items
    .filter(
      (item) =>
        item.weekPattern === weekPattern && item.dayOfWeek === day && item.session === session,
    )
    .sort((a, b) => Number(a.displayOrder) - Number(b.displayOrder));
}

function findWeeklyPlanForWeek(weeklyPlans, planningYear, planningMonth, weekNumber) {
  return (weeklyPlans ?? []).find(
    (plan) =>
      Number(plan.planning_year) === Number(planningYear) &&
      Number(plan.planning_month) === Number(planningMonth) &&
      Number(plan.week_number) === Number(weekNumber),
  );
}

function weeklyActivityKey(activity) {
  return `${activity.source_timetable_item_id || ''}|${activity.day_of_week}|${activity.session}|${activity.display_order}`;
}

function timetableActivityKey(item) {
  return `${item.timetableItemId || ''}|${item.dayOfWeek}|${item.session}|${item.displayOrder}`;
}

function groupActivityCriteria(criteria = []) {
  const groups = [];
  const map = new Map();
  for (const row of criteria) {
    const topic = row.criterion?.assessment_topic;
    const topicId = topic?.assessment_topic_id ?? row.topic_id ?? row.criterion_id;
    if (!map.has(topicId)) {
      const group = {
        topicId,
        topicName: topic?.name ?? 'Chưa có đề tài',
        topicDescription: topic?.description,
        themeName: topic?.assessment_theme?.name,
        criteria: [],
      };
      map.set(topicId, group);
      groups.push(group);
    }
    map.get(topicId).criteria.push({
      criterionId: row.criterion_id,
      criterionCode: row.criterion?.criterion_code,
      criterionDescription: row.criterion?.content,
    });
  }
  return groups;
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function parseIsoDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function mondayOf(date) {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = next.getUTCDay() || 7;
  next.setUTCDate(next.getUTCDate() - day + 1);
  return next;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatDayMonth(date) {
  return `${String(date.getUTCDate()).padStart(2, '0')}/${date.getUTCMonth() + 1}`;
}

function monthKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function formatPlanningMonthLabel(value) {
  const monthNames = [
    'Tháng Một',
    'Tháng Hai',
    'Tháng Ba',
    'Tháng Tư',
    'Tháng Năm',
    'Tháng Sáu',
    'Tháng Bảy',
    'Tháng Tám',
    'Tháng Chín',
    'Tháng Mười',
    'Tháng Mười Một',
    'Tháng Mười Hai',
  ];
  const [year, month] = value.split('-').map(Number);
  return `${monthNames[month - 1]} ${year}`;
}

function getPlanningMonthBounds(schoolYear) {
  if (!schoolYear?.start_date || !schoolYear?.end_date) return null;
  return {
    start: monthKey(parseIsoDate(schoolYear.start_date.slice(0, 10))),
    end: monthKey(parseIsoDate(schoolYear.end_date.slice(0, 10))),
  };
}

function isMonthBetween(value, bounds) {
  return Boolean(value && bounds && value >= bounds.start && value <= bounds.end);
}

function generatePlanningMonthOptions(schoolYear, selectedMonth) {
  const start = schoolYear?.start_date ? parseIsoDate(schoolYear.start_date.slice(0, 10)) : null;
  const end = schoolYear?.end_date ? parseIsoDate(schoolYear.end_date.slice(0, 10)) : null;
  const fallback = selectedMonth ? parseIsoDate(`${selectedMonth}-01`) : new Date();
  const hasSchoolYearRange = Boolean(start && end);
  const cursor =
    start ?? new Date(Date.UTC(fallback.getUTCFullYear(), fallback.getUTCMonth() - 6, 1));
  const last = end ?? new Date(Date.UTC(fallback.getUTCFullYear(), fallback.getUTCMonth() + 6, 1));
  const options = [];

  cursor.setUTCDate(1);
  last.setUTCDate(1);
  while (cursor <= last) {
    const value = monthKey(cursor);
    options.push({ value, label: formatPlanningMonthLabel(value) });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  if (
    !hasSchoolYearRange &&
    selectedMonth &&
    !options.some((option) => option.value === selectedMonth)
  ) {
    options.push({ value: selectedMonth, label: formatPlanningMonthLabel(selectedMonth) });
    options.sort((a, b) => a.value.localeCompare(b.value));
  }

  return options;
}

function planningMonthOfWeek(monday) {
  const counts = new Map();
  for (let offset = 0; offset < 5; offset += 1) {
    const date = addDays(monday, offset);
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function generatePlanningWeeks(year, month) {
  const planningMonth = `${year}-${String(month).padStart(2, '0')}`;
  const firstDate = new Date(Date.UTC(year, month - 1, 1));
  const cursor = mondayOf(firstDate);
  const weeks = [];

  while (weeks.length < 6) {
    const weekMonth = planningMonthOfWeek(cursor);
    if (weekMonth === planningMonth) {
      const weekNumber = weeks.length + 1;
      weeks.push({
        weekNumber,
        startDate: toIsoDate(cursor),
        endDate: toIsoDate(addDays(cursor, 6)),
        label: `Tuần ${weekNumber}`,
        displayRange: `${formatDayMonth(cursor)} - ${formatDayMonth(addDays(cursor, 6))}`,
        parity: weekNumber % 2 === 0 ? 'EVEN' : 'ODD',
        dates: DAYS.map(([, label], index) => ({
          dayOfWeek: DAYS[index][0],
          label,
          date: toIsoDate(addDays(cursor, index)),
          displayDate: formatDayMonth(addDays(cursor, index)),
        })),
      });
    } else if (weeks.length > 0 && weekMonth !== planningMonth) {
      break;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }

  return weeks;
}

function ActivityCard({
  item,
  subjects,
  onEdit,
  onRemove,
  onView,
  onDragStart,
  onDropBefore,
  readOnly = false,
}) {
  const style = itemTypeStyle(item);
  const developmentFieldName = itemDevelopmentFieldName(item, subjects);
  const hasNote = Boolean(item.note?.trim?.() ?? item.note);
  const title = itemTitle(item, subjects);
  const hasOfficialWeeklyPlan = ['READY', 'USED'].includes(item.weeklyPlan?.status);
  const mappedCriteriaCount = item.weeklyActivity?.criteria?.length ?? 0;
  const readOnlyMeta = hasOfficialWeeklyPlan
    ? mappedCriteriaCount > 0
      ? `${mappedCriteriaCount} tiêu chí`
      : 'Chưa gán tiêu chí'
    : item.weeklyPlan?.status === 'DRAFT'
      ? 'Kế hoạch tuần bản nháp'
      : 'Chưa có kế hoạch tuần';

  return (
    <div
      draggable={!readOnly}
      onDragStart={onDragStart}
      onDragOver={(event) => {
        if (!readOnly) event.preventDefault();
      }}
      onDrop={onDropBefore}
      title={title}
      onClick={() => readOnly && onView?.(item)}
      className={`h-[72px] w-full overflow-hidden rounded-md border border-l-4 px-3 py-2 text-sm shadow-sm transition-colors ${style.card} ${style.accent} ${readOnly && onView ? 'cursor-pointer hover:border-primary/40 hover:bg-card' : readOnly ? '' : 'cursor-grab active:cursor-grabbing'}`}
    >
      <div className="grid h-full grid-cols-[minmax(0,1fr)_auto] grid-rows-[1fr_auto] gap-x-2">
        <div className="min-h-0 min-w-0">
          <div className="flex min-w-0 items-start gap-1.5">
            <span className="shrink-0 font-semibold">
              #{item.displayOrder ?? item.display_order}
            </span>
            <p className="line-clamp-2 min-w-0 font-semibold leading-4">{title}</p>
          </div>
        </div>
        <div className="row-span-2">
          {!readOnly && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>Sửa</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={onRemove}>
                  Xóa
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <div className="flex min-w-0 items-center gap-1.5 self-end">
          <p className="line-clamp-1 min-w-0 flex-1 text-xs leading-4 text-muted-foreground">
            {readOnly ? readOnlyMeta : developmentFieldName || ' '}
          </p>
          {hasNote && (
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border bg-card text-xs text-muted-foreground">
              i
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ActivityTypeLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 px-1 text-xs text-muted-foreground">
      {Object.entries(ACTIVITY_TYPE_STYLES).map(([type, style]) => (
        <span key={type} className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />
          {style.label}
        </span>
      ))}
    </div>
  );
}

function setDragData(event, data) {
  event.dataTransfer.effectAllowed = 'copyMove';
  event.dataTransfer.setData('application/json', JSON.stringify(data));
}

function getDragData(event) {
  const raw = event.dataTransfer.getData('application/json');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function ActivityPalette({ subjects, search, onSearchChange }) {
  const normalizedSearch = search.trim().toLowerCase();
  const subjectItems = subjects
    .filter((subject) =>
      [subject.name, subject.development_field?.name_vi]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch),
    )
    .map((subject) => ({
      key: `subject-${subject.assessment_subject_id}`,
      label: subject.name,
      meta: subject.development_field?.name_vi,
      activityType: 'SUBJECT',
      subjectId: String(subject.assessment_subject_id),
    }));
  const themeItems = THEME_ACTIVITY_OPTIONS.filter((name) =>
    name.toLowerCase().includes(normalizedSearch),
  ).map((name) => ({
    key: `theme-${name}`,
    label: name,
    activityType: 'THEME_ACTIVITY',
  }));
  const groups = [
    ['Môn học', subjectItems],
    ['Hoạt động', themeItems],
  ];

  return (
    <aside className="space-y-3 rounded-md border bg-card p-3">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Kho hoạt động</h3>
        <ActivityTypeLegend />
      </div>
      <Input
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Tìm môn học, hoạt động..."
      />
      <div className="max-h-[16rem] space-y-4 overflow-y-auto pr-1">
        {groups.map(([label, items]) => (
          <section key={label} className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </div>
            {items.length === 0 ? (
              <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                Không có mục phù hợp.
              </p>
            ) : (
              <div className="space-y-2">
                {items.map((item) => {
                  const style = ACTIVITY_TYPE_STYLES[item.activityType];
                  return (
                    <div
                      key={item.key}
                      draggable
                      onDragStart={(event) => setDragData(event, { source: 'palette', item })}
                      title={item.label}
                      className={`h-16 cursor-grab rounded-md border border-l-4 px-3 py-2 text-sm active:cursor-grabbing ${style.card} ${style.accent}`}
                    >
                      <div className="line-clamp-1 min-h-5 font-medium">{item.label}</div>
                      <div className="mt-0.5 line-clamp-1 min-h-4 text-xs text-muted-foreground">
                        {item.meta || ' '}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ))}
      </div>
    </aside>
  );
}

function WeeklyGrid({
  items,
  subjects,
  weekPattern,
  dayDates,
  onEdit,
  onRemove,
  onDropItem,
  onViewItem,
  onViewDay,
  readOnly = false,
}) {
  return (
    <div className="overflow-x-auto rounded-md border bg-card">
      <Table className="min-w-[760px] table-fixed">
        <TableHeader className="bg-muted/30">
          <TableRow>
            <TableHead className="w-20 text-foreground">Buổi</TableHead>
            {DAYS.map(([day, label]) => (
              <TableHead
                key={day}
                className={
                  onViewDay
                    ? 'w-[18%] min-w-40 cursor-pointer py-2 text-foreground hover:text-primary'
                    : 'w-[18%] min-w-40 py-2 text-foreground'
                }
                onClick={() => onViewDay?.(day)}
              >
                <span className="block leading-5">{label}</span>
                <span className="block whitespace-nowrap text-xs font-normal leading-4 text-muted-foreground">
                  {dayDates?.[day]?.displayDate ?? ''}
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {SESSIONS.map(([session, sessionLabel]) => (
            <TableRow key={session}>
              <TableCell className="w-20 bg-muted/20 text-center font-semibold text-foreground">
                {sessionLabel}
              </TableCell>
              {DAYS.map(([day]) => {
                const slotItems = buildGridItems(items, weekPattern, day, session);
                return (
                  <TableCell key={day} className="w-[18%] min-w-40 bg-muted/10 align-top">
                    <div
                      className="min-h-[166px] rounded-md border border-dashed border-transparent bg-card/40 p-1.5 transition-colors hover:border-muted-foreground/30 hover:bg-card"
                      onDragOver={(event) => {
                        if (!readOnly) event.preventDefault();
                      }}
                      onDrop={(event) => {
                        if (readOnly) return;
                        event.preventDefault();
                        onDropItem?.(getDragData(event), {
                          weekPattern,
                          dayOfWeek: day,
                          session,
                          targetUid: null,
                        });
                      }}
                    >
                      {slotItems.length === 0 && !readOnly ? (
                        <div className="flex h-full items-center justify-center px-3 text-center text-xs text-muted-foreground">
                          Thả hoạt động từ kho vào đây
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {slotItems.map((item, index) => (
                            <ActivityCard
                              key={
                                item.uid ??
                                `${item.weekPattern}-${item.dayOfWeek}-${item.session}-${item.displayOrder}-${index}`
                              }
                              item={item}
                              subjects={subjects}
                              readOnly={readOnly}
                              onView={onViewItem}
                              onDragStart={(event) =>
                                setDragData(event, { source: 'grid', uid: item.uid })
                              }
                              onDropBefore={(event) => {
                                if (readOnly) return;
                                event.preventDefault();
                                event.stopPropagation();
                                onDropItem?.(getDragData(event), {
                                  weekPattern,
                                  dayOfWeek: day,
                                  session,
                                  targetUid: item.uid,
                                });
                              }}
                              onEdit={() => onEdit?.(item, index)}
                              onRemove={() => onRemove?.(item)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function TimetableBuilder({
  onBack,
  initialValue,
  subjects,
  onSubmit,
  onLock,
  onUnlock,
  loading,
  actionLoading,
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [mode, setMode] = useState('ALL');
  const [activePattern, setActivePattern] = useState('ALL');
  const [editingItem, setEditingItem] = useState(null);
  const [paletteSearch, setPaletteSearch] = useState('');
  const [saveReasonOpen, setSaveReasonOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState('save');

  useEffect(() => {
    if (!initialValue) return;
    setForm(
      initialValue
        ? {
            academicYearId: String(initialValue.school_year_id),
            ageGroupId: String(initialValue.age_group_id),
            name: initialValue.name ?? '',
            description: initialValue.description ?? '',
            changeReason: '',
            items: reindexItems(normalizeItems(initialValue.items)),
          }
        : EMPTY_FORM,
    );
    const hasAlternating = initialValue?.items?.some((item) =>
      ['ODD', 'EVEN'].includes(item.week_pattern),
    );
    setMode(hasAlternating ? 'ALTERNATING' : 'ALL');
    setActivePattern('ALL');
  }, [initialValue]);

  const visiblePatterns = mode === 'ALL' ? [['ALL', 'Tất cả tuần']] : WEEK_PATTERNS;
  const validationMessage = duplicateSlotMessage(form.items);
  const assessableValid = form.items.every((item) =>
    item.activityType === 'SUBJECT' ? item.subjectId : item.activityName.trim(),
  );
  const canSave = form.academicYearId && form.ageGroupId && form.name.trim() && !validationMessage;

  const saveItem = (item) => {
    setForm((current) => ({
      ...current,
      items: reindexItems(
        editingItem.index >= 0
          ? current.items.map((row, index) => (index === editingItem.index ? item : row))
          : [...current.items, item],
      ),
    }));
    setEditingItem(null);
  };

  const removeItem = (target) => {
    setForm((current) => ({
      ...current,
      items: reindexItems(current.items.filter((item) => item.uid !== target.uid)),
    }));
  };

  const dropItem = (dragData, target) => {
    if (!dragData) return;
    setForm((current) => {
      if (dragData.source === 'palette') {
        return {
          ...current,
          items: insertItemAt(current.items, createItemFromPalette(dragData.item, target), target),
        };
      }
      if (dragData.source === 'grid') {
        const existing = current.items.find((item) => item.uid === dragData.uid);
        if (!existing || existing.uid === target.targetUid) return current;
        return { ...current, items: insertItemAt(current.items, existing, target) };
      }
      return current;
    });
  };

  const submit = (event) => {
    event.preventDefault();
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }
    setPendingAction('save');
    setSaveReasonOpen(true);
  };

  const submitWithReason = () => {
    if (!form.changeReason.trim()) {
      toast.error('Vui lòng nhập lý do thay đổi.');
      return;
    }
    const orderedItems = reindexItems(form.items);
    onSubmit({
      academicYearId: Number(form.academicYearId),
      ageGroupId: Number(form.ageGroupId),
      name: form.name,
      description: form.description,
      ...(initialValue ? { changeReason: form.changeReason } : {}),
      items: orderedItems.map(itemPayload),
    });
    setSaveReasonOpen(false);
  };

  const submitWithReasonAndMaybeLock = async () => {
    if (!form.changeReason.trim()) {
      toast.error('Vui lòng nhập lý do thay đổi.');
      return;
    }
    try {
      const saved = await onSubmit(buildTimetablePayload(form, initialValue, form.changeReason));
      setSaveReasonOpen(false);
      if (pendingAction === 'lock') {
        await onLock(saved ?? initialValue);
      }
    } catch {
      // Error toast is handled by the mutation callback.
    }
  };

  const switchToStandardMode = () => {
    if (mode !== 'ALTERNATING') {
      setMode('ALL');
      setActivePattern('ALL');
      return;
    }
    const hasAlternatingItems = form.items.some((item) =>
      ['ODD', 'EVEN'].includes(item.weekPattern),
    );
    if (
      hasAlternatingItems &&
      !window.confirm(
        'Chuyển sang lịch tất cả tuần sẽ xóa các hoạt động riêng của tuần lẻ/tuần chẵn. Bạn có chắc muốn tiếp tục?',
      )
    ) {
      return;
    }
    setForm((current) => ({
      ...current,
      items: reindexItems(current.items.filter((item) => item.weekPattern === 'ALL')),
    }));
    setMode('ALL');
    setActivePattern('ALL');
  };

  const requestLock = () => {
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }
    if (!assessableValid) {
      toast.error('Vui lòng kiểm tra lại các hoạt động trước khi khóa.');
      return;
    }
    if (hasTimetableChanges(form, initialValue)) {
      setPendingAction('lock');
      setSaveReasonOpen(true);
      return;
    }
    onLock(initialValue);
  };

  return (
    <>
      <div className="space-y-4">
        <PageHeader
          title={`Thời khóa biểu ${initialValue?.age_group?.name_vi ?? ''}`}
          description={`Năm học ${initialValue?.school_year?.name ?? ''}`}
        />
        <div className="sticky top-0 z-30 mb-3 flex shrink-0 flex-wrap items-center gap-2 rounded-md border bg-background p-2 shadow-sm">
          <Button type="button" variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Quay lại
          </Button>
          <div className="ml-auto flex flex-wrap gap-2">
            {initialValue?.status === 'LOCKED' ? (
              <Button type="button" onClick={() => onUnlock(initialValue)} disabled={actionLoading}>
                <Unlock className="mr-1.5 h-4 w-4" />
                Mở khóa
              </Button>
            ) : (
              <>
                <Button type="submit" form="timetable-builder-form" disabled={loading || !canSave}>
                  <Save className="mr-1.5 h-4 w-4" />
                  Lưu thay đổi
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={
                    actionLoading ||
                    loading ||
                    form.items.length === 0 ||
                    Boolean(validationMessage) ||
                    !assessableValid
                  }
                  onClick={requestLock}
                >
                  <Lock className="mr-1.5 h-4 w-4" />
                  Khóa
                </Button>
              </>
            )}
          </div>
        </div>
        <form id="timetable-builder-form" onSubmit={submit} className="space-y-4">
          <section className="grid gap-3 rounded-md border bg-card p-3 sm:grid-cols-3">
            <InfoRow
              label="Trạng thái"
              value={
                initialValue?.status === 'LOCKED'
                  ? 'Đã khóa'
                  : form.items.length
                    ? 'Bản nháp'
                    : 'Chưa thiết lập'
              }
            />
            <InfoRow label="Số hoạt động" value={form.items.length} />
            <InfoRow
              label="Cập nhật gần nhất"
              value={fmtDate(initialValue?.last_updated_at ?? initialValue?.created_at)}
            />
          </section>

          <section className="flex flex-wrap items-center gap-3 rounded-md border bg-card px-3 py-2">
            <h3 className="text-sm font-semibold">Kiểu lịch</h3>
            <div className="inline-flex rounded-md border bg-muted/30 p-1">
              <Button
                type="button"
                size="sm"
                variant={mode === 'ALL' ? 'default' : 'outline'}
                className="border-0 shadow-none"
                onClick={switchToStandardMode}
              >
                Tất cả tuần
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === 'ALTERNATING' ? 'default' : 'outline'}
                className="border-0 shadow-none"
                onClick={() => setMode('ALTERNATING')}
              >
                Luân phiên tuần lẻ / tuần chẵn
              </Button>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-sm font-semibold">Lịch tuần</h3>
              {mode === 'ALTERNATING' && (
                <div className="inline-flex rounded-md border bg-muted/30 p-1">
                  {visiblePatterns.map(([value, label]) => (
                    <Button
                      key={value}
                      type="button"
                      size="sm"
                      variant={activePattern === value ? 'default' : 'outline'}
                      className="border-0 shadow-none"
                      onClick={() => setActivePattern(value)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              )}
            </div>
            {validationMessage && <p className="text-sm text-destructive">{validationMessage}</p>}
            <div
              className={
                initialValue?.status === 'LOCKED'
                  ? 'grid gap-4'
                  : 'grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)]'
              }
            >
              {initialValue?.status !== 'LOCKED' && (
                <ActivityPalette
                  subjects={subjects}
                  search={paletteSearch}
                  onSearchChange={setPaletteSearch}
                />
              )}
              <WeeklyGrid
                items={form.items}
                subjects={subjects}
                weekPattern={activePattern}
                onEdit={(item) =>
                  setEditingItem({
                    index: form.items.findIndex((row) => row.uid === item.uid),
                    value: item,
                  })
                }
                onRemove={removeItem}
                onDropItem={dropItem}
                readOnly={initialValue?.status === 'LOCKED'}
              />
            </div>
          </section>
        </form>
      </div>
      <Dialog open={saveReasonOpen} onOpenChange={setSaveReasonOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Lý do thay đổi</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>
              Lý do thay đổi <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={form.changeReason}
              onChange={(event) => setForm((cur) => ({ ...cur, changeReason: event.target.value }))}
              placeholder="Vui lòng nhập lý do thay đổi trước khi lưu."
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSaveReasonOpen(false)}>
              Hủy
            </Button>
            <Button
              type="button"
              disabled={loading || !form.changeReason.trim()}
              onClick={submitWithReasonAndMaybeLock}
            >
              Lưu thay đổi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ActivityDialog
        open={Boolean(editingItem)}
        value={editingItem?.value}
        subjects={subjects.filter(
          (subject) => subject.assessment_age_group_id === initialValue?.age_group_id,
        )}
        onOpenChange={(next) => !next && setEditingItem(null)}
        onSubmit={saveItem}
      />
    </>
  );
}

function ActivityDialog({ open, value, subjects, onOpenChange, onSubmit }) {
  const [item, setItem] = useState(EMPTY_ITEM);
  useEffect(() => {
    if (open) setItem(value ?? EMPTY_ITEM);
  }, [open, value]);

  const setType = (activityType) => {
    setItem((cur) => ({
      ...cur,
      activityType,
      subjectId: activityType === 'SUBJECT' ? cur.subjectId : '',
      activityName: activityType === 'SUBJECT' ? '' : cur.activityName,
      isThemeBased: true,
      isAssessable: true,
      requiresWeeklyMapping: true,
    }));
  };

  const canSave = item.activityType === 'SUBJECT' ? item.subjectId : item.activityName.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Hoạt động</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Loại hoạt động</Label>
            <Select value={item.activityType} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ACTIVITY_TYPES).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {item.activityType === 'SUBJECT' ? (
            <div className="space-y-1.5">
              <Label>Môn học</Label>
              <Select
                value={item.subjectId}
                onValueChange={(value) => setItem((cur) => ({ ...cur, subjectId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn môn học" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((subject) => (
                    <SelectItem
                      key={subject.assessment_subject_id}
                      value={String(subject.assessment_subject_id)}
                    >
                      {subject.name} · {subject.development_field?.name_vi}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Tên hoạt động</Label>
              <Input
                value={item.activityName}
                onChange={(event) =>
                  setItem((cur) => ({ ...cur, activityName: event.target.value }))
                }
              />
            </div>
          )}
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Ghi chú</Label>
            <Textarea
              value={item.note}
              onChange={(event) => setItem((cur) => ({ ...cur, note: event.target.value }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button type="button" disabled={!canSave} onClick={() => onSubmit(item)}>
            Lưu hoạt động
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AcademicYearTimetablesPage() {
  const role = useAuthStore((state) => state.user?.role);
  return role === 'TEACHER' ? <TeacherTimetableView /> : <PrincipalTimetableView />;
}

export function AcademicYearTimetableBuilderPage({ timetableId }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [unlockTarget, setUnlockTarget] = useState(null);
  const [unlockReason, setUnlockReason] = useState('');
  const detailQuery = useQuery({
    queryKey: ['academic-year-timetable', timetableId],
    queryFn: async () => {
      const response = await apiClient.get(`/academic-year-timetables/${timetableId}`);
      return response.data?.data;
    },
    enabled: Boolean(timetableId),
  });
  const { data: subjectsData } = useList('assessment-subjects', '/assessment-subjects', {
    pageSize: 200,
    is_active: 'true',
  });
  const subjects = subjectsData?.data ?? [];

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['academic-year-timetable', timetableId] }),
      queryClient.invalidateQueries({ queryKey: ['academic-year-timetables'] }),
    ]);
    await queryClient.refetchQueries({ queryKey: ['academic-year-timetable', timetableId] });
  };
  const updateMut = useMutation({
    mutationFn: async (payload) => {
      const response = await apiClient.put(`/academic-year-timetables/${timetableId}`, payload);
      return response.data?.data;
    },
    onSuccess: async () => {
      toast.success('Cập nhật thời khóa biểu thành công.');
      await refresh();
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Không thể lưu thời khóa biểu.')),
  });
  const lockMut = useMutation({
    mutationFn: async (id) => apiClient.patch(`/academic-year-timetables/${id}/lock`),
    onSuccess: async () => {
      toast.success('Khóa thời khóa biểu thành công.');
      await refresh();
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Không thể khóa thời khóa biểu.')),
  });
  const unlockMut = useMutation({
    mutationFn: async ({ id, unlockReason: reason }) =>
      apiClient.patch(`/academic-year-timetables/${id}/unlock`, { unlockReason: reason }),
    onSuccess: async () => {
      toast.success('Mở khóa thời khóa biểu thành công.');
      setUnlockTarget(null);
      setUnlockReason('');
      await refresh();
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Không thể mở khóa thời khóa biểu.')),
  });

  if (detailQuery.isLoading) {
    return <div className="h-64 animate-pulse rounded-md border bg-muted/40" />;
  }
  if (detailQuery.error || !detailQuery.data) {
    return (
      <div className="space-y-4">
        <PageHeader title="Thời khóa biểu năm học" />
        <div className="rounded-md border bg-card p-6 text-center text-sm text-muted-foreground">
          {getErrorMessage(detailQuery.error, 'Không thể tải thời khóa biểu.')}
        </div>
        <Button variant="outline" onClick={() => navigate('/academic-year-timetables')}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Quay lại danh sách
        </Button>
      </div>
    );
  }

  const timetable = detailQuery.data;
  return (
    <>
      <TimetableBuilder
        initialValue={timetable}
        subjects={subjects.filter(
          (subject) => subject.assessment_age_group_id === timetable.age_group_id,
        )}
        onBack={() => navigate('/academic-year-timetables')}
        onSubmit={(payload) => updateMut.mutateAsync(payload)}
        onLock={(row) => lockMut.mutateAsync(row.timetable_id)}
        onUnlock={setUnlockTarget}
        loading={updateMut.isPending}
        actionLoading={lockMut.isPending || unlockMut.isPending}
      />
      <Dialog open={Boolean(unlockTarget)} onOpenChange={(open) => !open && setUnlockTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mở khóa thời khóa biểu</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Mở khóa có thể ảnh hưởng đến kế hoạch tuần hoặc đánh giá nếu dữ liệu đã được sử dụng.
          </p>
          <div className="space-y-1.5">
            <Label>
              Lý do mở khóa <span className="text-destructive">*</span>
            </Label>
            <Textarea
              placeholder="Nhập lý do cần chỉnh sửa thời khóa biểu..."
              value={unlockReason}
              onChange={(event) => setUnlockReason(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnlockTarget(null)}>
              Hủy
            </Button>
            <Button
              disabled={!unlockReason.trim() || unlockMut.isPending}
              onClick={() => unlockMut.mutate({ id: unlockTarget.timetable_id, unlockReason })}
            >
              Mở khóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PrincipalTimetableView() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const globalYearId = useYearStore((state) => state.selectedYearId);
  const [viewing, setViewing] = useState(null);
  const [unlockTarget, setUnlockTarget] = useState(null);
  const [unlockReason, setUnlockReason] = useState('');

  const { data: yearsData } = useList('academic-years', '/academic-years', { pageSize: 100 });
  const years = yearsData?.data ?? [];
  const activeYear = years.find((year) => year.status === 'active');
  const selectedYearId = globalYearId ?? activeYear?.school_year_id ?? null;

  const params = useMemo(
    () => ({
      ...(selectedYearId ? { academicYearId: selectedYearId } : {}),
      page: 1,
      pageSize: 100,
    }),
    [selectedYearId],
  );
  const {
    data,
    isLoading,
    error: listError,
  } = useList('academic-year-timetables', '/academic-year-timetables', params);
  const { data: subjectsData } = useList('assessment-subjects', '/assessment-subjects', {
    pageSize: 200,
    is_active: 'true',
  });

  const rows = data?.data ?? [];
  const subjects = subjectsData?.data ?? [];
  const selectedYear =
    years.find((year) => String(year.school_year_id) === String(selectedYearId)) ??
    rows[0]?.school_year ??
    null;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['academic-year-timetables'] });
    queryClient.refetchQueries({ queryKey: ['academic-year-timetables'], type: 'active' });
  };
  const lockMut = useMutation({
    mutationFn: (id) => apiClient.patch('/academic-year-timetables/' + id + '/lock'),
    onSuccess: () => {
      toast.success('Khóa thời khóa biểu thành công.');
      setViewing(null);
      refresh();
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Không thể khóa thời khóa biểu.')),
  });
  const unlockMut = useMutation({
    mutationFn: ({ id, unlockReason }) =>
      apiClient.patch('/academic-year-timetables/' + id + '/unlock', { unlockReason }),
    onSuccess: () => {
      toast.success('Mở khóa thời khóa biểu thành công.');
      setUnlockTarget(null);
      setUnlockReason('');
      setViewing(null);
      refresh();
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Không thể mở khóa thời khóa biểu.')),
  });

  const openCard = (row) => {
    if (row.status === 'LOCKED') setViewing(row);
    else navigate(`/academic-year-timetables/${row.timetable_id}`);
  };

  return (
    <div>
      <PageHeader
        title="Thời khóa biểu năm học"
        description="Cấu hình thời khóa biểu mẫu theo nhóm tuổi cho năm học đang chọn."
        actions={
          <Button variant="outline" size="sm" onClick={refresh}>
            <CalendarDays className="mr-1.5 h-4 w-4" />
            Làm mới
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="bg-card px-3 py-1.5 text-sm">
          Năm học: {selectedYear?.name ?? 'Đang dùng năm học hoạt động'}
        </Badge>
        {selectedYear?.start_date && selectedYear?.end_date && (
          <span className="text-sm text-muted-foreground">
            {fmtDate(selectedYear.start_date)} - {fmtDate(selectedYear.end_date)}
          </span>
        )}
      </div>

      {listError ? (
        <div className="rounded-md border bg-card p-6 text-center text-sm text-muted-foreground">
          {getErrorMessage(listError, 'Không thể tải cấu hình thời khóa biểu.')}
        </div>
      ) : isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-44 animate-pulse rounded-md border bg-muted/40" />
          ))}
        </div>
      ) : years.length === 0 && rows.length === 0 ? (
        <div className="rounded-md border bg-card p-6 text-center text-sm text-muted-foreground">
          Chưa có năm học để thiết lập thời khóa biểu.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {rows.map((row) => {
            const hasItems = (row.itemCount ?? 0) > 0;
            const displayStatus = row.status === 'LOCKED' ? 'LOCKED' : hasItems ? 'DRAFT' : 'EMPTY';
            return (
              <div
                key={row.timetable_id}
                className="flex min-h-44 flex-col justify-between rounded-md border bg-card p-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">{row.age_group?.name_vi}</h3>
                      <p className="text-xs text-muted-foreground">
                        {row.age_group?.class_group_label}
                      </p>
                    </div>
                    {displayStatus === 'EMPTY' ? (
                      <Badge
                        variant="outline"
                        className="border-slate-200 bg-slate-50 text-slate-700"
                      >
                        Chưa thiết lập
                      </Badge>
                    ) : (
                      statusBadge(row.status)
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {row.itemCount ?? 0} hoạt động · {row.assessableItemCount ?? 0} hoạt động đánh
                    giá · {row.themeBasedItemCount ?? 0} hoạt động theo chủ đề
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Cập nhật: {fmtDate(row.last_updated_at ?? row.created_at) || 'Chưa cập nhật'}
                  </p>
                </div>
                <Button
                  className="mt-4 w-full"
                  variant={row.status === 'LOCKED' ? 'outline' : 'default'}
                  onClick={() => openCard(row)}
                >
                  {row.status === 'LOCKED'
                    ? 'Xem chi tiết'
                    : hasItems
                      ? 'Cấu hình'
                      : 'Thiết lập thời khóa biểu'}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <TimetableDetailSheet
        timetable={viewing}
        subjects={subjects}
        onOpenChange={(open) => !open && setViewing(null)}
        onEdit={(row) => navigate(`/academic-year-timetables/${row.timetable_id}`)}
        onLock={(row) => lockMut.mutateAsync(row.timetable_id)}
        onUnlock={setUnlockTarget}
      />
      <Dialog open={Boolean(unlockTarget)} onOpenChange={(open) => !open && setUnlockTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mở khóa thời khóa biểu</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Mở khóa có thể ảnh hưởng đến kế hoạch tuần hoặc đánh giá nếu dữ liệu đã được sử dụng.
          </p>
          <div className="space-y-1.5">
            <Label>
              Lý do mở khóa <span className="text-destructive">*</span>
            </Label>
            <Textarea
              placeholder="Nhập lý do cần chỉnh sửa thời khóa biểu..."
              value={unlockReason}
              onChange={(e) => setUnlockReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnlockTarget(null)}>
              Hủy
            </Button>
            <Button
              disabled={!unlockReason.trim() || unlockMut.isPending}
              onClick={() => unlockMut.mutate({ id: unlockTarget.timetable_id, unlockReason })}
            >
              Mở khóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TimetableDetailSheet({ timetable, subjects, onOpenChange, onEdit, onLock, onUnlock }) {
  const [pattern, setPattern] = useState('ALL');
  return (
    <Sheet open={Boolean(timetable)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-5xl">
        <SheetHeader>
          <SheetTitle>Chi tiết thời khóa biểu</SheetTitle>
        </SheetHeader>
        {timetable && (
          <div className="mt-5 space-y-4">
            <div className="rounded-md border bg-card px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{timetable.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {timetable.school_year?.name} · {timetable.age_group?.name_vi}
                  </p>
                </div>
                {statusBadge(timetable.status)}
              </div>
            </div>
            <DetailSection title="Thông tin">
              <InfoRow label="Năm học" value={timetable.school_year?.name} />
              <InfoRow label="Nhóm tuổi" value={timetable.age_group?.name_vi} />
              <InfoRow
                label="Trạng thái"
                value={timetable.status === 'LOCKED' ? 'Đã khóa' : 'Bản nháp'}
              />
              <InfoRow label="Người tạo" value={timetable.creator?.teacher?.full_name} />
              <InfoRow
                label="Cập nhật lần cuối"
                value={fmtDate(timetable.last_updated_at ?? timetable.created_at)}
              />
              <InfoRow label="Lý do thay đổi gần nhất" value={timetable.change_reason} />
              <InfoRow label="Người khóa" value={timetable.locker?.teacher?.full_name} />
              <InfoRow label="Thời gian khóa" value={fmtDate(timetable.locked_at)} />
              <InfoRow
                label="Người mở khóa gần nhất"
                value={timetable.unlocker?.teacher?.full_name}
              />
              <InfoRow label="Lý do mở khóa gần nhất" value={timetable.unlock_reason} />
            </DetailSection>
            <div className="flex flex-wrap gap-2">
              {WEEK_PATTERNS.map(([value, label]) => (
                <Button
                  key={value}
                  size="sm"
                  variant={pattern === value ? 'default' : 'outline'}
                  onClick={() => setPattern(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
            <WeeklyGrid
              items={normalizeItems(timetable.items)}
              subjects={subjects}
              weekPattern={pattern}
              readOnly
            />
            <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
              {timetable.status === 'DRAFT' && (
                <Button variant="outline" onClick={() => onEdit(timetable)}>
                  <Pencil className="mr-1.5 h-4 w-4" />
                  Sửa
                </Button>
              )}
              {timetable.status === 'DRAFT' && (
                <Button onClick={() => onLock(timetable)}>
                  <Lock className="mr-1.5 h-4 w-4" />
                  Khóa
                </Button>
              )}
              {timetable.status === 'LOCKED' && (
                <Button onClick={() => onUnlock(timetable)}>
                  <Unlock className="mr-1.5 h-4 w-4" />
                  Mở khóa
                </Button>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function TeacherTimetableView() {
  const globalYearId = useYearStore((state) => state.selectedYearId);
  const now = new Date();
  const [planningMonth, setPlanningMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
  );
  const [selectedWeekNumber, setSelectedWeekNumber] = useState(1);
  const [viewingItem, setViewingItem] = useState(null);
  const [viewingDay, setViewingDay] = useState(null);
  const weeklyQuery = useMemo(
    () => ({
      ...(globalYearId ? { academicYearId: globalYearId } : {}),
    }),
    [globalYearId],
  );
  const { data, error } = useList(
    'assigned-weekly-timetable',
    '/academic-year-timetables/assigned/weekly',
    weeklyQuery,
    { retry: false },
  );
  const payload = data?.data;
  const timetable = payload?.timetable;
  const weeklyPlans = payload?.weeklyPlans ?? [];
  const planningMonthBounds = useMemo(
    () => getPlanningMonthBounds(timetable?.school_year),
    [timetable?.school_year],
  );
  const planningMonthOptions = useMemo(
    () => generatePlanningMonthOptions(timetable?.school_year, planningMonth),
    [timetable?.school_year, planningMonth],
  );
  const [planningYear, planningMonthNumber] = planningMonth.split('-').map(Number);
  const planningWeeks = useMemo(
    () => generatePlanningWeeks(planningYear, planningMonthNumber),
    [planningYear, planningMonthNumber],
  );
  const selectedWeek =
    planningWeeks.find((week) => week.weekNumber === selectedWeekNumber) ?? planningWeeks[0];
  const selectedWeeklyPlan = findWeeklyPlanForWeek(
    weeklyPlans,
    planningYear,
    planningMonthNumber,
    selectedWeek?.weekNumber,
  );
  const weeklyActivityMap = new Map(
    (selectedWeeklyPlan?.activities ?? []).map((activity) => [
      weeklyActivityKey(activity),
      activity,
    ]),
  );
  const dayDates = Object.fromEntries(
    (selectedWeek?.dates ?? []).map((day) => [day.dayOfWeek, day]),
  );
  const items = normalizeItems(timetable?.items ?? [])
    .filter((item) => selectedWeek && ['ALL', selectedWeek.parity].includes(item.weekPattern))
    .map((item) => ({
      ...item,
      originalWeekPattern: item.weekPattern,
      weekPattern: 'ALL',
      actualDate: dayDates[item.dayOfWeek]?.date,
      actualDateLabel: dayDates[item.dayOfWeek]?.displayDate,
      weeklyPlan: selectedWeeklyPlan ?? null,
      weeklyActivity: weeklyActivityMap.get(timetableActivityKey(item)) ?? null,
    }));
  const groupedByDay = Object.fromEntries(
    DAYS.map(([day]) => [
      day,
      {
        MORNING: buildGridItems(items, 'ALL', day, 'MORNING'),
        AFTERNOON: buildGridItems(items, 'ALL', day, 'AFTERNOON'),
      },
    ]),
  );

  useEffect(() => {
    if (selectedWeek && selectedWeek.weekNumber !== selectedWeekNumber) {
      setSelectedWeekNumber(selectedWeek.weekNumber);
    }
  }, [selectedWeek, selectedWeekNumber]);

  useEffect(() => {
    if (!planningMonthBounds || isMonthBetween(planningMonth, planningMonthBounds)) return;

    const currentMonth = monthKey(new Date());
    setPlanningMonth(
      isMonthBetween(currentMonth, planningMonthBounds) ? currentMonth : planningMonthBounds.start,
    );
    setSelectedWeekNumber(1);
  }, [planningMonth, planningMonthBounds]);

  useEffect(() => {
    setSelectedWeekNumber(1);
    setViewingItem(null);
    setViewingDay(null);
  }, [globalYearId]);

  return (
    <div>
      <PageHeader
        title="Thời khóa biểu lớp tôi"
        description="Xem thời khóa biểu chính thức theo nhóm tuổi của lớp được phân công."
      />
      {error ? (
        <div className="rounded-md border bg-card p-6 text-center text-sm text-muted-foreground">
          {getErrorMessage(error, 'Chưa có thời khóa biểu chính thức cho nhóm tuổi của lớp này.')}
        </div>
      ) : timetable ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Lớp: {payload?.class?.class_name}</span>
            <span> · Nhóm tuổi: {payload?.ageGroup?.name_vi}</span>
            <span> · Năm học: {timetable.school_year?.name}</span>
            <span> · </span>
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
              Đã khóa
            </Badge>
          </div>
          <div className="rounded-md border bg-card p-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Label>Tháng kế hoạch</Label>
                <Select
                  value={planningMonth}
                  onValueChange={(value) => {
                    setPlanningMonth(value);
                    setSelectedWeekNumber(1);
                  }}
                >
                  <SelectTrigger className="h-9 w-44">
                    <SelectValue placeholder="Chọn tháng" />
                  </SelectTrigger>
                  <SelectContent>
                    {planningMonthOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-1 flex-wrap gap-2">
                {planningWeeks.map((week) => (
                  <Button
                    key={week.weekNumber}
                    type="button"
                    size="sm"
                    className="h-9"
                    variant={selectedWeek?.weekNumber === week.weekNumber ? 'default' : 'outline'}
                    onClick={() => setSelectedWeekNumber(week.weekNumber)}
                  >
                    {week.label} · {week.displayRange}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <WeeklyGrid
            items={items}
            subjects={[]}
            weekPattern="ALL"
            dayDates={dayDates}
            onViewItem={setViewingItem}
            onViewDay={(day) => setViewingDay({ dayOfWeek: day, date: dayDates[day]?.date })}
            readOnly
          />
          {items.length === 0 && (
            <p className="rounded-md border bg-card p-4 text-center text-sm text-muted-foreground">
              Chưa có hoạt động trong tuần đã chọn.
            </p>
          )}
          <ActivityDetailSheet
            item={viewingItem}
            onOpenChange={(open) => !open && setViewingItem(null)}
          />
          <DailyActivitiesSheet
            day={viewingDay}
            groupedActivities={viewingDay ? groupedByDay[viewingDay.dayOfWeek] : null}
            onOpenChange={(open) => !open && setViewingDay(null)}
            onSelectItem={setViewingItem}
          />
        </div>
      ) : (
        <div className="rounded-md border bg-card p-6 text-center text-sm text-muted-foreground">
          Đang tải thời khóa biểu...
        </div>
      )}
    </div>
  );
}

function ActivityDetailSheet({ item, onOpenChange }) {
  const navigate = useNavigate();
  const title = item ? itemTitle(item) : '';
  const weeklyPlan = item?.weeklyPlan;
  const weeklyActivity = item?.weeklyActivity;
  const isOfficialWeeklyPlan = ['READY', 'USED'].includes(weeklyPlan?.status);
  const criteria = isOfficialWeeklyPlan ? (weeklyActivity?.criteria ?? []) : [];
  const criteriaGroups = groupActivityCriteria(criteria);
  const canAssess = Boolean(
    isOfficialWeeklyPlan &&
    weeklyActivity?.weekly_development_plan_activity_id &&
    criteria.length > 0,
  );
  let disabledReason = 'Chưa có kế hoạch tuần chính thức cho tuần này.';
  let statusMessage = 'Chưa có kế hoạch tuần chính thức cho tuần này.';
  if (weeklyPlan?.status === 'DRAFT') {
    disabledReason = 'Kế hoạch tuần đang ở bản nháp nên chưa thể đánh giá.';
    statusMessage = 'Kế hoạch tuần đang ở bản nháp nên tiêu chí chưa được sử dụng chính thức.';
  } else if (isOfficialWeeklyPlan && criteria.length === 0) {
    disabledReason = 'Hoạt động này chưa được gán tiêu chí đánh giá.';
    statusMessage = 'Hoạt động này chưa được gán tiêu chí đánh giá trong kế hoạch tuần.';
  } else if (isOfficialWeeklyPlan && criteria.length > 0) {
    disabledReason = '';
    statusMessage = `Hoạt động này có ${criteria.length} tiêu chí cần đánh giá hôm nay.`;
  }
  return (
    <Sheet open={Boolean(item)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {item?.actualDate ? fmtDate(item.actualDate) : ''} · {SESSION_LABELS[item?.session]}
          </SheetDescription>
        </SheetHeader>
        {item && (
          <div className="mt-5 space-y-4">
            <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground">
              {statusMessage}
            </div>
            <section className="rounded-md border bg-card">
              <div className="border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Thông tin hoạt động
              </div>
              <div className="divide-y">
                <CompactInfoRow
                  label="Loại"
                  value={ACTIVITY_TYPES[item.activityType ?? item.activity_type]}
                />
                <CompactInfoRow
                  label="Ngày trong tuần"
                  value={DAY_LABELS[item.dayOfWeek ?? item.day_of_week]}
                />
                <CompactInfoRow
                  label="Ngày thực tế"
                  value={item.actualDate ? fmtDate(item.actualDate) : null}
                />
                <CompactInfoRow label="Buổi" value={SESSION_LABELS[item.session]} />
                <CompactInfoRow
                  label="Thứ tự hoạt động"
                  value={item.displayOrder ?? item.display_order}
                />
                <CompactInfoRow label="Môn học" value={findSubject(item)?.name} />
                <CompactInfoRow
                  label="Lĩnh vực phát triển"
                  value={itemDevelopmentFieldName(item)}
                />
                <CompactInfoRow label="Ghi chú" value={item.note} />
              </div>
            </section>
            <section className="rounded-md border bg-card">
              <div className="border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tiêu chí cần đánh giá
              </div>
              {criteriaGroups.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">{statusMessage}</p>
              ) : (
                <div className="space-y-3 p-3">
                  {criteriaGroups.map((topic) => (
                    <div key={topic.topicId} className="rounded-md border bg-muted/10">
                      <div className="border-b px-3 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold">{topic.topicName}</p>
                            {topic.themeName && (
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {topic.themeName}
                              </p>
                            )}
                          </div>
                          <Badge variant="outline" className="shrink-0">
                            {topic.criteria.length} tiêu chí
                          </Badge>
                        </div>
                        {topic.topicDescription && (
                          <ClampedTopicDescription description={topic.topicDescription} />
                        )}
                      </div>
                      <div className="divide-y">
                        {topic.criteria.map((criterion) => (
                          <div key={criterion.criterionId} className="px-3 py-2 text-sm">
                            <span className="font-medium">{criterion.criterionCode}</span>
                            <span className="text-muted-foreground">
                              {' '}
                              - {criterion.criterionDescription}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
            {isOfficialWeeklyPlan && (
              <div className="px-1 py-1 text-[11px] leading-relaxed text-muted-foreground/80">
                <p>Nguồn: Kế hoạch tuần · Tuần {weeklyPlan.week_number}</p>
                <p>Kế hoạch tháng/chủ đề: {weeklyPlan.monthly_theme_plan?.name}</p>
              </div>
            )}
            <div className="space-y-2 border-t pt-4">
              <Button
                type="button"
                className="w-full"
                disabled={!canAssess}
                onClick={() => {
                  navigate(
                    `/daily-development-assessments/activity/${weeklyActivity.weekly_development_plan_activity_id}`,
                  );
                  onOpenChange?.(false);
                }}
              >
                Đánh giá hoạt động này
              </Button>
              {!canAssess && disabledReason && (
                <p className="text-center text-xs text-muted-foreground">{disabledReason}</p>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ClampedTopicDescription({ description }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="mt-2 text-sm text-muted-foreground">
      <p className={expanded ? '' : 'line-clamp-3'}>{description}</p>
      <button
        type="button"
        className="mt-1 text-xs font-medium text-primary hover:underline"
        onClick={() => setExpanded((current) => !current)}
      >
        {expanded ? 'Thu gọn' : 'Xem thêm'}
      </button>
    </div>
  );
}

function CompactInfoRow({ label, value }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="grid grid-cols-[150px_minmax(0,1fr)] gap-3 px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

function DailyActivitiesSheet({ day, groupedActivities, onOpenChange, onSelectItem }) {
  return (
    <Sheet open={Boolean(day)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Hoạt động ngày {day?.date ? fmtDate(day.date) : ''}</SheetTitle>
          <SheetDescription>{day?.dayOfWeek ? DAY_LABELS[day.dayOfWeek] : ''}</SheetDescription>
        </SheetHeader>
        <div className="mt-5 space-y-4">
          {SESSIONS.map(([session, label]) => {
            const activities = groupedActivities?.[session] ?? [];
            return (
              <DetailSection key={session} title={label}>
                {activities.length === 0 ? (
                  <InfoRow label="Hoạt động" value="Không có hoạt động nào trong ngày đã chọn." />
                ) : (
                  <div className="space-y-2">
                    {activities.map((item) => (
                      <button
                        key={item.uid}
                        type="button"
                        className="flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm hover:bg-muted"
                        onClick={() => onSelectItem(item)}
                      >
                        <span className="font-semibold">{item.displayOrder}.</span>
                        <span>{itemTitle(item)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </DetailSection>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
