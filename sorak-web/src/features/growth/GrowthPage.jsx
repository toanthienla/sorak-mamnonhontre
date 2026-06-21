// Growth Monitoring & WHO Analysis — UC-69..73
import { useState, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ImageDown, Search } from 'lucide-react';
import { toPng } from 'html-to-image';
import {
  LineChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/shared/components/page-header';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/client';
import { toast } from 'sonner';
import {
  GrowthStatus,
  fmtDate,
  fmtNum,
  useHealthClasses,
  ClassSelect,
  useClassStudents,
} from '../health/health-shared';
import { useHealthFilterStore } from '@/shared/stores/health-filter.store';

function unwrap(d) {
  const r = d;
  if (r?.data && typeof r.data === 'object' && 'data' in r.data) return r.data.data;
  return r?.data ?? d;
}

const CHART_TITLES = {
  bmi: 'Lịch sử BMI',
  height: 'Biểu đồ chiều cao theo tuổi (WHO)',
  weight: 'Biểu đồ cân nặng theo tuổi (WHO)',
  history: 'Lịch sử đánh giá tăng trưởng',
};

// Official VDD growth-chart palette (zones + theme by gender)
const ZONE = {
  above: '#bfe6f5', // cao hơn so với tuổi (cyan)
  normal: '#dff1fb', // bình thường (light blue)
  mild: '#f6b9c4', // SDD vừa / thấp còi độ 1 (pink)
  severe: '#e9899a', // SDD nặng / thấp còi độ 2 (red)
  cap: '#fdf6d8', // trên +3SD (nền vàng nhạt)
};
const CURVE = { sd: '#6b7280', median: '#16a34a' };

function genderTheme(gender) {
  return gender === 'Nam'
    ? { header: '#1786c4', page: '#eaf6fc', label: 'Bé trai' }
    : { header: '#d6489a', page: '#fdeef6', label: 'Bé gái' };
}

// Right-edge curve label — renders only at the given index (last curve row)
function endLabel(text, color, lastIdx) {
  return ({ x, y, index }) => {
    if (index !== lastIdx) return null;
    return (
      <text x={x + 4} y={y} dy={4} fontSize={12} fontWeight={700} fill={color}>
        {text}
      </text>
    );
  };
}

export function GrowthPage() {
  const { classes, selectedYearId, isBGH } = useHealthClasses();
  const allowedClassIds = useMemo(() => new Set(classes.map((c) => c.class_id)), [classes]);
  const [searchParams] = useSearchParams();
  const fstore = useHealthFilterStore();
  const [classId, setClassIdState] = useState(
    searchParams.get('class_id') ?? fstore.growthClassId ?? '',
  );
  const [studentId, setStudentIdState] = useState(
    searchParams.get('student_id') ?? fstore.growthStudentId ?? '',
  );
  const setClassId = (v) => {
    setClassIdState(v);
    fstore.set({ growthClassId: v });
  };
  const setStudentId = (v) => {
    setStudentIdState(v);
    fstore.set({ growthStudentId: v });
  };
  const [studentSearch, setStudentSearch] = useState('');
  const [chartType, setChartType] = useState('bmi');
  const cardRefs = useRef({}); // { bmi, height, weight } — capture only the diagram

  const { data: students } = useClassStudents(classId, !!classId);
  const student = (students ?? []).find((s) => String(s.student_id) === studentId);

  // Cross-class student search (whole year) — picking a result fills class + student
  const [searchOpen, setSearchOpen] = useState(false);
  const { data: allYearStudentsRaw } = useQuery({
    queryKey: ['growth-search-students', selectedYearId, studentSearch],
    queryFn: async () => {
      const res = await apiClient.get('/students', {
        params: { pageSize: 50, school_year_id: selectedYearId, search: studentSearch.trim() },
      });
      return res.data?.data ?? [];
    },
    enabled: !!selectedYearId && studentSearch.trim().length >= 1,
  });
  // Teachers: only students in their assigned classes
  const allYearStudents = useMemo(
    () =>
      isBGH
        ? (allYearStudentsRaw ?? [])
        : (allYearStudentsRaw ?? []).filter((s) =>
            allowedClassIds.has(s.enrollments?.[0]?.class?.class_id),
          ),
    [allYearStudentsRaw, isBGH, allowedClassIds],
  );
  const pickSearched = (s) => {
    const cid = s.enrollments?.[0]?.class?.class_id;
    if (cid) setClassId(String(cid));
    setStudentId(String(s.student_id));
    setStudentSearch('');
    setSearchOpen(false);
  };

  // Student history (all assessments in selected year)
  const { data: historyData } = useQuery({
    queryKey: ['growth-history', studentId, selectedYearId],
    queryFn: async () => {
      const res = await apiClient.get('/health-assessments/history', {
        params: { student_id: Number(studentId), school_year_id: selectedYearId ?? undefined },
      });
      return unwrap(res.data);
    },
    enabled: !!studentId,
  });
  const records = historyData?.records ?? [];
  const gender = historyData?.student?.gender;
  const dob = historyData?.student?.date_of_birth;

  // WHO reference curves
  const { data: curves } = useQuery({
    queryKey: ['who-curves', chartType, gender],
    queryFn: async () => {
      const res = await apiClient.get('/health-assessments/who-curves', {
        params: { indicator: chartType, gender },
      });
      return unwrap(res.data);
    },
    enabled: !!gender && (chartType === 'height' || chartType === 'weight'),
  });

  const ageMonths = (d) => {
    if (!dob) return null;
    const a = new Date(d),
      b = new Date(dob);
    let m = (a.getFullYear() - b.getFullYear()) * 12 + (a.getMonth() - b.getMonth());
    if (a.getDate() < b.getDate()) m -= 1;
    return m;
  };

  // Exact age in months (fractional) — keeps multiple measurements in the same month distinct
  const ageMonthsExact = (d) => {
    if (!dob) return null;
    return (new Date(d) - new Date(dob)) / (30.4375 * 86400000);
  };

  // Y cap = top of chart (a bit above +3SD) — fills "above +3SD" zone yellow
  const yMax = useMemo(() => {
    if (!curves?.length) return 100;
    return Math.ceil(Math.max(...curves.map((c) => c.sd3)) + (chartType === 'height' ? 4 : 2));
  }, [curves, chartType]);

  // Curve rows (full 0-72) FIRST, then student rows — stable index for end labels.
  // Areas painted largest→smallest create the colored zones (each fills curve→0).
  const whoChartData = useMemo(() => {
    if (!curves) return { rows: [], lastCurveIdx: -1 };
    const curveRows = curves.map((c) => ({
      ...c,
      x: c.month,
      student: null,
      zCap: yMax,
      zAbove: c.sd3,
      zNormal: c.sd2,
      zMild: c.sd2neg,
      zSevere: c.sd3neg,
    }));
    const studentRows = [];
    for (const r of records) {
      const value = chartType === 'height' ? r.height_cm : r.weight_kg;
      const x = ageMonthsExact(r.assessment_date);
      if (value == null || x == null || x < 0 || x > 72) continue;
      studentRows.push({ x: Math.round(x * 100) / 100, student: value, date: r.assessment_date });
    }
    studentRows.sort((a, b) => a.x - b.x);
    return { rows: [...curveRows, ...studentRows], lastCurveIdx: curveRows.length - 1 };
  }, [curves, records, chartType, dob, yMax]);

  const studentPoints = useMemo(
    () => whoChartData.rows.filter((r) => r.student != null),
    [whoChartData],
  );

  const xTicks = [0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72];
  const yFloor = chartType === 'height' ? 40 : 0;

  // Custom tooltip: always shows the nearest student measurement (within ±1 month)
  const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    let nearest = null;
    for (const p of studentPoints) {
      if (
        Math.abs(p.x - label) <= 1 &&
        (!nearest || Math.abs(p.x - label) < Math.abs(nearest.x - label))
      ) {
        nearest = p;
      }
    }
    const curveRow = payload.find((p) => p.payload?.median != null)?.payload;
    return (
      <div className="rounded-md border bg-white px-3 py-2 text-xs shadow-md space-y-0.5">
        <p className="font-semibold">{Number(label).toFixed(1)} tháng tuổi</p>
        {nearest && (
          <p className="font-semibold" style={{ color: '#1d4ed8' }}>
            {student?.full_name}: {nearest.student} {unitLabel} ({fmtDate(nearest.date)})
          </p>
        )}
        {curveRow && (
          <>
            <p style={{ color: '#16a34a' }}>Trung vị WHO: {curveRow.median}</p>
            <p style={{ color: '#f59e0b' }}>
              +2SD: {curveRow.sd2} · -2SD: {curveRow.sd2neg}
            </p>
            <p style={{ color: '#ef4444' }}>
              +3SD: {curveRow.sd3} · -3SD: {curveRow.sd3neg}
            </p>
          </>
        )}
      </div>
    );
  };

  const theme = genderTheme(gender);
  const bmiChartData = records
    .filter((r) => r.bmi != null)
    .map((r) => ({ date: fmtDate(r.assessment_date), bmi: r.bmi }));

  const handleExportPng = async () => {
    const el = cardRefs.current[chartType];
    if (!el) return;
    if (chartType === 'bmi' && bmiChartData.length === 0) {
      toast.error('Chưa có dữ liệu biểu đồ');
      return;
    }
    if ((chartType === 'height' || chartType === 'weight') && records.length === 0) {
      toast.error('Chưa có dữ liệu biểu đồ');
      return;
    }

    // Force a fixed render width so the PNG is identical on every device/screen
    const FIXED_W = 1280;
    const prev = {
      width: el.style.width,
      minWidth: el.style.minWidth,
      maxWidth: el.style.maxWidth,
    };
    el.style.width = `${FIXED_W}px`;
    el.style.minWidth = `${FIXED_W}px`;
    el.style.maxWidth = `${FIXED_W}px`;

    // Pause briefly to let the browser re-layout at 1280px
    await new Promise((r) => setTimeout(r, 150));

    try {
      const rawDataUrl = await toPng(el, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        width: FIXED_W,
      });
      const a = document.createElement('a');
      a.href = rawDataUrl;
      a.download = `${chartType}_${student?.full_name ?? 'chart'}_${Date.now()}.png`;
      a.click();
    } catch {
      toast.error('Xuất PNG thất bại');
    } finally {
      // Reset the element back to its responsive size
      el.style.width = prev.width;
      el.style.minWidth = prev.minWidth;
      el.style.maxWidth = prev.maxWidth;
    }
  };

  const unitLabel = chartType === 'height' ? 'cm' : 'kg';

  return (
    <>
      <PageHeader
        title="Tăng trưởng & WHO"
        description="Theo dõi BMI, chiều cao, cân nặng theo chuẩn tăng trưởng WHO"
      />

      <div className="flex gap-2 mb-4 flex-wrap items-center">
        {/* Cross-class search — pick a result to auto-fill class + student */}
        <div className="relative w-64">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Tìm nhanh học sinh (toàn trường)..."
            value={studentSearch}
            onChange={(e) => {
              setStudentSearch(e.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
          />
          {searchOpen && studentSearch.trim() && (
            <div className="absolute z-30 mt-1 min-w-full w-max max-w-md max-h-72 overflow-auto rounded-md border bg-popover shadow-md">
              {(allYearStudents ?? []).length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  Không tìm thấy học sinh
                </div>
              ) : (
                (allYearStudents ?? []).map((s) => (
                  <button
                    key={s.student_id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pickSearched(s);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center justify-between gap-3"
                  >
                    <span className="font-medium whitespace-nowrap">{s.full_name}</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                      {s.enrollments?.[0]?.class?.class_name ?? '—'} · {s.student_id_card_number}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <ClassSelect
          classes={classes}
          value={classId}
          onChange={(v) => {
            setClassId(v);
            setStudentId('');
          }}
          placeholder="Chọn lớp"
        />
        <Select value={studentId} onValueChange={setStudentId} disabled={!classId}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder={classId ? 'Chọn học sinh' : 'Chọn lớp trước'}>
              {student ? student.full_name : null}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(students ?? []).map((s) => (
              <SelectItem key={s.student_id} value={String(s.student_id)}>
                {s.full_name}
                {s.student_id_card_number ? ` — ${s.student_id_card_number}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        {chartType !== 'history' && (
          <Button variant="outline" size="sm" onClick={handleExportPng} disabled={!studentId}>
            <ImageDown className="h-4 w-4 mr-1.5" /> Xuất PNG
          </Button>
        )}
      </div>

      {!studentId ? (
        <div className="bg-card rounded-md border py-16 text-center text-muted-foreground">
          Chọn lớp và học sinh để xem biểu đồ tăng trưởng
        </div>
      ) : (
        <Tabs value={chartType} onValueChange={setChartType} className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="bmi">Lịch sử BMI</TabsTrigger>
            <TabsTrigger value="height">Chiều cao</TabsTrigger>
            <TabsTrigger value="weight">Cân nặng</TabsTrigger>
            <TabsTrigger value="history">Lịch sử đánh giá</TabsTrigger>
          </TabsList>

          <div className="bg-card rounded-md border p-4">
            <p className="text-sm font-semibold mb-1">
              {CHART_TITLES[chartType]} — {student?.full_name}
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              {historyData?.student?.gender} · sinh {fmtDate(dob)}
            </p>

            <TabsContent
              value="bmi"
              forceMount={chartType === 'bmi' ? true : undefined}
              hidden={chartType !== 'bmi'}
            >
              {bmiChartData.length === 0 ? (
                <p className="py-12 text-center text-muted-foreground text-sm">
                  Chưa có dữ liệu BMI trong năm học
                </p>
              ) : (
                <div
                  ref={(el) => {
                    cardRefs.current.bmi = el;
                  }}
                  className="bg-white p-3"
                >
                  <p className="text-sm font-semibold mb-2">Lịch sử BMI — {student?.full_name}</p>
                  <ResponsiveContainer width="100%" height={380}>
                    <LineChart
                      data={bmiChartData}
                      margin={{ top: 8, right: 24, bottom: 8, left: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                      <XAxis dataKey="date" fontSize={12} />
                      <YAxis fontSize={12} domain={['dataMin - 1', 'dataMax + 1']} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="bmi"
                        name="BMI"
                        stroke="#1a2845"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              {/* BMI table */}
              {bmiChartData.length > 0 && (
                <Table className="mt-4">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ngày</TableHead>
                      <TableHead>Cao (cm)</TableHead>
                      <TableHead>Nặng (kg)</TableHead>
                      <TableHead>BMI</TableHead>
                      <TableHead>Phân loại</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records
                      .filter((r) => r.bmi != null)
                      .map((r) => (
                        <TableRow key={r.assessment_id}>
                          <TableCell>{fmtDate(r.assessment_date)}</TableCell>
                          <TableCell>{fmtNum(r.height_cm)}</TableCell>
                          <TableCell>{fmtNum(r.weight_kg)}</TableCell>
                          <TableCell className="font-medium">{fmtNum(r.bmi, 2)}</TableCell>
                          <TableCell>
                            <GrowthStatus value={r.bmi_status} />
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {['height', 'weight'].map((t) => {
              const heightChart = t === 'height';
              const zoneLegend = heightChart
                ? [
                    ['Cao hơn so với tuổi', ZONE.above],
                    ['Chiều cao bình thường', ZONE.normal],
                    ['Thấp còi độ 1', ZONE.mild],
                    ['Thấp còi độ 2', ZONE.severe],
                  ]
                : [
                    ['Cân nặng cao hơn so với tuổi', ZONE.above],
                    ['Cân nặng bình thường', ZONE.normal],
                    ['Suy dinh dưỡng vừa', ZONE.mild],
                    ['Suy dinh dưỡng nặng', ZONE.severe],
                  ];
              return (
                <TabsContent key={t} value={t} hidden={chartType !== t}>
                  {chartType === t &&
                    (whoChartData.rows.length === 0 ? (
                      <p className="py-12 text-center text-muted-foreground text-sm">
                        Đang tải đường chuẩn WHO...
                      </p>
                    ) : (
                      <div
                        ref={(el) => {
                          cardRefs.current[t] = el;
                        }}
                        className="rounded-md border overflow-hidden"
                        style={{ background: theme.page }}
                      >
                        {/* Title band */}
                        <div
                          className="px-4 py-2.5 flex items-center justify-between"
                          style={{ background: theme.header }}
                        >
                          <span className="text-white font-bold">
                            {heightChart ? 'Chiều cao theo tuổi' : 'Cân nặng theo tuổi'} —{' '}
                            {theme.label}
                          </span>
                          <span className="text-white/80 text-xs">
                            Đường chuẩn tăng trưởng WHO · {student?.full_name}
                          </span>
                        </div>
                        {/* Zone legend */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2 text-xs">
                          {zoneLegend.map(([label, color]) => (
                            <span key={label} className="inline-flex items-center gap-1.5">
                              <span
                                className="inline-block w-3.5 h-3.5 rounded-sm border"
                                style={{ background: color }}
                              />
                              {label}
                            </span>
                          ))}
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className="inline-block w-5 border-t-2"
                              style={{ borderColor: CURVE.median }}
                            />{' '}
                            Trung vị (0)
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className="inline-block w-5 border-t-2"
                              style={{ borderColor: '#1d4ed8' }}
                            />{' '}
                            {student?.full_name}
                          </span>
                        </div>
                        <ResponsiveContainer width="100%" height={440}>
                          <ComposedChart
                            data={whoChartData.rows}
                            margin={{ top: 8, right: 34, bottom: 18, left: 0 }}
                          >
                            <CartesianGrid strokeDasharray="2 2" stroke="rgba(0,0,0,0.06)" />
                            <XAxis
                              dataKey="x"
                              type="number"
                              domain={[0, 72]}
                              ticks={xTicks}
                              fontSize={11}
                              label={{
                                value: 'Tháng tuổi',
                                position: 'insideBottom',
                                offset: -8,
                                fontSize: 12,
                              }}
                            />
                            <YAxis
                              fontSize={11}
                              domain={[yFloor, yMax]}
                              allowDecimals={false}
                              label={{
                                value: unitLabel,
                                angle: -90,
                                position: 'insideLeft',
                                fontSize: 12,
                              }}
                            />
                            <Tooltip content={<ChartTooltip />} />
                            {/* Colored zones — painted largest→smallest, each fills curve→baseline */}
                            <Area
                              dataKey="zCap"
                              stroke="none"
                              fill={ZONE.cap}
                              fillOpacity={1}
                              isAnimationActive={false}
                              connectNulls
                            />
                            <Area
                              dataKey="zAbove"
                              stroke="none"
                              fill={ZONE.above}
                              fillOpacity={1}
                              isAnimationActive={false}
                              connectNulls
                            />
                            <Area
                              dataKey="zNormal"
                              stroke="none"
                              fill={ZONE.normal}
                              fillOpacity={1}
                              isAnimationActive={false}
                              connectNulls
                            />
                            <Area
                              dataKey="zMild"
                              stroke="none"
                              fill={ZONE.mild}
                              fillOpacity={1}
                              isAnimationActive={false}
                              connectNulls
                            />
                            <Area
                              dataKey="zSevere"
                              stroke="none"
                              fill={ZONE.severe}
                              fillOpacity={1}
                              isAnimationActive={false}
                              connectNulls
                            />
                            {/* Reference curves */}
                            <Line
                              dataKey="sd3"
                              stroke={CURVE.sd}
                              strokeWidth={1}
                              dot={false}
                              isAnimationActive={false}
                              connectNulls
                              label={endLabel('3', CURVE.sd, whoChartData.lastCurveIdx)}
                            />
                            <Line
                              dataKey="sd2"
                              stroke={CURVE.sd}
                              strokeWidth={1}
                              dot={false}
                              isAnimationActive={false}
                              connectNulls
                              label={endLabel('2', CURVE.sd, whoChartData.lastCurveIdx)}
                            />
                            <Line
                              dataKey="median"
                              stroke={CURVE.median}
                              strokeWidth={1.5}
                              dot={false}
                              isAnimationActive={false}
                              connectNulls
                              label={endLabel('0', CURVE.median, whoChartData.lastCurveIdx)}
                            />
                            <Line
                              dataKey="sd2neg"
                              stroke={CURVE.sd}
                              strokeWidth={1}
                              dot={false}
                              isAnimationActive={false}
                              connectNulls
                              label={endLabel('-2', CURVE.sd, whoChartData.lastCurveIdx)}
                            />
                            <Line
                              dataKey="sd3neg"
                              stroke={CURVE.sd}
                              strokeWidth={1}
                              dot={false}
                              isAnimationActive={false}
                              connectNulls
                              label={endLabel('-3', CURVE.sd, whoChartData.lastCurveIdx)}
                            />
                            {/* Student */}
                            <Line
                              dataKey="student"
                              stroke="#1d4ed8"
                              strokeWidth={3}
                              dot={{ r: 4, fill: '#1d4ed8', strokeWidth: 0 }}
                              activeDot={{ r: 6 }}
                              isAnimationActive={false}
                              connectNulls
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    ))}
                </TabsContent>
              );
            })}

            <TabsContent value="history" hidden={chartType !== 'history'}>
              {records.length === 0 ? (
                <p className="py-12 text-center text-muted-foreground text-sm">
                  Chưa có đánh giá trong năm học
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ngày</TableHead>
                      <TableHead>Tuổi (tháng)</TableHead>
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
                        <TableCell>{ageMonths(r.assessment_date) ?? '—'}</TableCell>
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
            </TabsContent>
          </div>
        </Tabs>
      )}
    </>
  );
}
