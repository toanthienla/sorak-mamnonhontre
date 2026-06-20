import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/client';
import { useAuthStore } from '@/shared/stores/auth.store';
import { useYearStore } from '@/shared/stores/year.store';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export const FINAL_NUTRITION_STATUSES = ['Bình thường', 'Suy dinh dưỡng', 'Thừa cân', 'Béo phì'];

// Colored plain-text for growth/nutrition classifications
export function GrowthStatus({ value }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const cls =
    value === 'Bình thường'
      ? 'text-green-700'
      : value === 'Thừa cân'
        ? 'text-amber-600'
        : value === 'Béo phì'
          ? 'text-red-600'
          : value.startsWith('Cao') || value.startsWith('Cân nặng cao')
            ? 'text-blue-600'
            : 'text-red-600'; // SDD / thấp còi / gầy còm
  return <span className={cls}>{value}</span>;
}

export function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('vi-VN');
}

export function fmtNum(n, digits = 1) {
  if (n == null) return '—';
  return Number(n).toFixed(digits);
}

// Classes of the selected year (falls back to the ACTIVE year when none picked);
// teachers see only their assigned classes
export function useHealthClasses() {
  const storeYearId = useYearStore((s) => s.selectedYearId);
  const user = useAuthStore((s) => s.user);
  const isBGH = user?.role === 'PRINCIPAL';

  const { data: years } = useQuery({
    queryKey: ['academic-years'],
    queryFn: async () => {
      const res = await apiClient.get('/academic-years');
      const body = res.data;
      return body?.data ?? [];
    },
  });
  const activeYearId = (years ?? []).find((y) => y.status === 'active')?.school_year_id;
  const selectedYearId = storeYearId ?? activeYearId ?? null;

  const { data: classes } = useQuery({
    queryKey: ['health-classes', selectedYearId],
    queryFn: async () => {
      const res = await apiClient.get('/classes', {
        params: { pageSize: 100, school_year_id: selectedYearId },
      });
      return res.data?.data ?? [];
    },
    enabled: !!selectedYearId,
  });

  const GRADE_RANK = { 'Nhà trẻ': 0, Mầm: 1, Chồi: 2, Lá: 3 };
  const visible = (classes ?? [])
    .filter(
      (c) => isBGH || c.teacher_classes?.some((tc) => tc.teacher?.teacher_id === user?.teacher_id),
    )
    .sort((a, b) => {
      const ga = GRADE_RANK[a.age_group] ?? 99,
        gb = GRADE_RANK[b.age_group] ?? 99;
      if (ga !== gb) return ga - gb;
      return (a.class_name ?? '').localeCompare(b.class_name ?? '', 'vi');
    });
  return { classes: visible, selectedYearId, isBGH };
}

export function ClassSelect({
  classes,
  value,
  onChange,
  placeholder = 'Chọn lớp',
  className = 'w-44',
  allowAll = false,
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowAll && <SelectItem value="all">Tất cả lớp</SelectItem>}
        {classes.map((c) => (
          <SelectItem key={c.class_id} value={String(c.class_id)}>
            {c.class_name}
            {c.age_group ? ` — ${c.age_group}` : ''}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Students of a class (active enrollment)
export function useClassStudents(classId, enabled = true) {
  return useQuery({
    queryKey: ['health-students', classId],
    queryFn: async () => {
      const res = await apiClient.get('/students', {
        params: { pageSize: 200, class_id: Number(classId) },
      });
      return res.data?.data ?? [];
    },
    enabled: enabled && !!classId,
  });
}
