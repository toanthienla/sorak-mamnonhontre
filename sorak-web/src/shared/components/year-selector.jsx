import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/shared/api/client';
import { cn } from '@/shared/lib/utils';
import { useYearStore } from '@/shared/stores/year.store';

function unwrap(d) {
  const r = d;
  if (r?.data && typeof r.data === 'object' && 'data' in r.data) return r.data.data;
  return r?.data ?? d;
}

export function YearSelector() {
  const { selectedYearId, setSelectedYearId } = useYearStore();

  const { data: years } = useQuery({
    queryKey: ['academic-years'],
    queryFn: async () => {
      const res = await apiClient.get('/academic-years');
      return unwrap(res.data);
    },
  });

  useEffect(() => {
    if (years && !selectedYearId) {
      const active = years.find((y) => y.status === 'active');
      if (active) setSelectedYearId(active.school_year_id);
    }
  }, [years, selectedYearId, setSelectedYearId]);

  const selected = years?.find((y) => y.school_year_id === selectedYearId);

  return (
    <Select
      value={selectedYearId ? String(selectedYearId) : ''}
      onValueChange={(v) => setSelectedYearId(Number(v))}
    >
      <SelectTrigger className="w-full h-9 text-sm gap-2">
        <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
        <SelectValue placeholder="Chọn năm học">
          {selected?.name ?? 'Chọn năm học'}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {years?.map((y) => (
          <SelectItem
            key={y.school_year_id}
            value={String(y.school_year_id)}
            className={cn(y.status === 'closed' && 'text-muted-foreground')}
          >
            <span className={cn('text-sm', y.status === 'active' && 'font-semibold')}>
              {y.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
