// Health detail — assessment history + quick-add a new measurement; "Xem chi tiết" → WHO growth page
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/client';
import { toast } from 'sonner';
import { GrowthStatus, fmtDate, fmtNum } from './health-shared';
import { useStudentGrowth } from '../growth/growth-charts';

export function HealthHistoryModal({ open, onOpenChange, studentId, classId, schoolYearId }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading } = useStudentGrowth(studentId, schoolYearId, open && !!studentId);
  const student = data?.student;
  const records = data?.records ?? [];

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');

  const h = Number(height),
    w = Number(weight);
  const previewBmi = h > 0 && w > 0 ? (w / (h / 100) ** 2).toFixed(2) : null;

  const addMut = useMutation({
    mutationFn: async () =>
      (
        await apiClient.post('/health-assessments', {
          student_id: Number(studentId),
          school_year_id: schoolYearId,
          assessment_date: date,
          height_cm: h,
          weight_kg: w,
        })
      ).data,
    onSuccess: () => {
      toast.success('Đã thêm kết quả đo');
      setHeight('');
      setWeight('');
      setDate(today);
      queryClient.invalidateQueries({ queryKey: ['growth-history', studentId] });
      queryClient.invalidateQueries({ queryKey: ['health-assessments'] });
      queryClient.invalidateQueries({ queryKey: ['health-by-class-date'] });
    },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Thêm thất bại'),
  });

  const goDetail = () => {
    const params = new URLSearchParams();
    if (classId) params.set('class_id', String(classId));
    params.set('student_id', String(studentId));
    navigate(`/growth?${params.toString()}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3 pr-6">
            <span>Lịch sử đánh giá — {student?.full_name ?? '...'}</span>
            <Button variant="outline" size="sm" onClick={goDetail} disabled={!studentId}>
              <ExternalLink className="h-4 w-4 mr-1.5" /> Xem chi tiết
            </Button>
          </DialogTitle>
        </DialogHeader>

        {/* Quick add */}
        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-muted-foreground">Thêm kết quả đo mới</p>
            {previewBmi && (
              <span className="text-xs text-muted-foreground">
                BMI dự tính: <b className="text-foreground">{previewBmi}</b>
              </span>
            )}
          </div>
          <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
            <div>
              <Label className="text-xs">
                Ngày <span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                className="h-9"
                max={today}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">
                Cao (cm) <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                step="0.1"
                min="1"
                max="200"
                className="h-9"
                placeholder="0.0"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">
                Nặng (kg) <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                step="0.1"
                min="1"
                max="100"
                className="h-9"
                placeholder="0.0"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
            <Button
              className="h-9"
              disabled={!date || !(h > 0) || !(w > 0) || addMut.isPending}
              onClick={() => addMut.mutate()}
            >
              <Plus className="h-4 w-4 mr-1.5" /> Thêm
            </Button>
          </div>
        </div>

        {isLoading ? (
          <p className="py-8 text-center text-muted-foreground text-sm">Đang tải...</p>
        ) : records.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground text-sm">
            Chưa có dữ liệu đánh giá sức khỏe.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ngày</TableHead>
                <TableHead>Cao (cm)</TableHead>
                <TableHead>Nặng (kg)</TableHead>
                <TableHead>BMI</TableHead>
                <TableHead>BMI/tuổi</TableHead>
                <TableHead>Cao/tuổi</TableHead>
                <TableHead>Nặng/tuổi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r) => (
                <TableRow key={r.assessment_id}>
                  <TableCell>{fmtDate(r.assessment_date)}</TableCell>
                  <TableCell>{fmtNum(r.height_cm)}</TableCell>
                  <TableCell>{fmtNum(r.weight_kg)}</TableCell>
                  <TableCell className="font-medium">{fmtNum(r.bmi, 2)}</TableCell>
                  <TableCell>
                    <GrowthStatus value={r.bmi_status} />
                  </TableCell>
                  <TableCell>
                    <GrowthStatus value={r.height_status} />
                  </TableCell>
                  <TableCell>
                    <GrowthStatus value={r.weight_status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
