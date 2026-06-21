// Mini WHO growth preview — opened from nutrition grid row; enough to decide nutrition status
import { ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { GrowthStatus, fmtDate, fmtNum } from '../health/health-shared';
import { useStudentGrowth, WhoZoneChart, BmiMiniChart } from './growth-charts';

export function GrowthPreview({
  open,
  onOpenChange,
  studentId,
  classId,
  schoolYearId,
  showZoneCharts = true,
  children,
}) {
  const { data, isLoading } = useStudentGrowth(studentId, schoolYearId, open && !!studentId);
  const student = data?.student;
  const records = data?.records ?? [];
  const latest = records.length ? records[records.length - 1] : null;

  const openFull = () => {
    const params = new URLSearchParams();
    if (classId) params.set('class_id', String(classId));
    params.set('student_id', String(studentId));
    window.open(`/growth?${params.toString()}`, '_blank', 'noopener');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3 pr-6">
            <span>Tăng trưởng WHO — {student?.full_name ?? '...'}</span>
            <Button variant="outline" size="sm" onClick={openFull} disabled={!studentId}>
              <ExternalLink className="h-4 w-4 mr-1.5" /> Xem chi tiết
            </Button>
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <p className="py-10 text-center text-muted-foreground text-sm">Đang tải...</p>
        ) : records.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground text-sm">
            Chưa có dữ liệu đo sức khỏe cho học sinh này trong năm học.
          </p>
        ) : (
          <div className="space-y-4">
            {/* Latest summary */}
            <div className="rounded-lg border bg-muted/30 overflow-hidden text-sm">
              <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/50">
                <span className="text-xs text-muted-foreground">Lần đo gần nhất</span>
                <span className="font-medium">{fmtDate(latest?.assessment_date)}</span>
              </div>
              {/* Measurements */}
              <div className="grid grid-cols-3 divide-x text-center">
                <div className="px-3 py-2.5">
                  <div className="text-xs text-muted-foreground">Chiều cao</div>
                  <div className="font-semibold">
                    {fmtNum(latest?.height_cm)}{' '}
                    <span className="text-xs font-normal text-muted-foreground">cm</span>
                  </div>
                </div>
                <div className="px-3 py-2.5">
                  <div className="text-xs text-muted-foreground">Cân nặng</div>
                  <div className="font-semibold">
                    {fmtNum(latest?.weight_kg)}{' '}
                    <span className="text-xs font-normal text-muted-foreground">kg</span>
                  </div>
                </div>
                <div className="px-3 py-2.5">
                  <div className="text-xs text-muted-foreground">BMI</div>
                  <div className="font-semibold">{fmtNum(latest?.bmi, 2)}</div>
                </div>
              </div>
              {/* WHO classifications */}
              <div className="grid grid-cols-3 divide-x border-t text-center">
                <div className="px-3 py-2">
                  <div className="text-xs text-muted-foreground mb-0.5">BMI / tuổi</div>
                  <GrowthStatus value={latest?.bmi_status} />
                </div>
                <div className="px-3 py-2">
                  <div className="text-xs text-muted-foreground mb-0.5">Cao / tuổi</div>
                  <GrowthStatus value={latest?.height_status} />
                </div>
                <div className="px-3 py-2">
                  <div className="text-xs text-muted-foreground mb-0.5">Nặng / tuổi</div>
                  <GrowthStatus value={latest?.weight_status} />
                </div>
              </div>
            </div>

            {/* Mini WHO charts */}
            {showZoneCharts && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <WhoZoneChart
                  indicator="height"
                  records={records}
                  gender={student?.gender}
                  dob={student?.date_of_birth}
                  studentName={student?.full_name}
                  chartHeight={240}
                  compact
                />
                <WhoZoneChart
                  indicator="weight"
                  records={records}
                  gender={student?.gender}
                  dob={student?.date_of_birth}
                  studentName={student?.full_name}
                  chartHeight={240}
                  compact
                />
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Lịch sử BMI</p>
              <div className="rounded-md border p-2">
                <BmiMiniChart records={records} height={200} />
              </div>
            </div>

            {children}
          </div>
        )}
        {/* children also render when no records (so the nutrition form is always usable) */}
        {!isLoading && records.length === 0 && children}
      </DialogContent>
    </Dialog>
  );
}
