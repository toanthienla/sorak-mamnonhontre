// Shared WHO growth chart pieces — used by full GrowthPage and the nutrition preview modal
import { useMemo } from 'react';
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
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/client';
import { fmtDate } from '../health/health-shared';

function unwrap(d) {
  const r = d;
  if (r?.data && typeof r.data === 'object' && 'data' in r.data) return r.data.data;
  return r?.data ?? d;
}

export const ZONE = {
  above: '#bfe6f5',
  normal: '#dff1fb',
  mild: '#f6b9c4',
  severe: '#e9899a',
  cap: '#fdf6d8',
};
export const CURVE = { sd: '#6b7280', median: '#16a34a' };
const STUDENT = '#1d4ed8';
const X_TICKS = [0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72];

export function genderTheme(gender) {
  return gender === 'Nam'
    ? { header: '#1786c4', page: '#eaf6fc', label: 'Bé trai' }
    : { header: '#d6489a', page: '#fdeef6', label: 'Bé gái' };
}

function endLabel(text, color, lastIdx) {
  return ({ x, y, index }) => {
    if (index !== lastIdx) return null;
    return (
      <text x={x + 4} y={y} dy={4} fontSize={11} fontWeight={700} fill={color}>
        {text}
      </text>
    );
  };
}

const ageMonthsExact = (dob, d) =>
  dob ? (new Date(d) - new Date(dob)) / (30.4375 * 86400000) : null;

// ─── Student growth history hook ──────────────────────────────────────────────
export function useStudentGrowth(studentId, schoolYearId, enabled = true) {
  return useQuery({
    queryKey: ['growth-history', studentId, schoolYearId],
    queryFn: async () => {
      const res = await apiClient.get('/health-assessments/history', {
        params: { student_id: Number(studentId), school_year_id: schoolYearId ?? undefined },
      });
      return unwrap(res.data);
    },
    enabled: enabled && !!studentId,
  });
}

// ─── WHO zone chart (height or weight) ────────────────────────────────────────
export function WhoZoneChart({
  indicator,
  records,
  gender,
  dob,
  studentName,
  chartHeight = 440,
  compact = false,
}) {
  const heightChart = indicator === 'height';
  const unitLabel = heightChart ? 'cm' : 'kg';
  const theme = genderTheme(gender);

  const { data: curves } = useQuery({
    queryKey: ['who-curves', indicator, gender],
    queryFn: async () => {
      const res = await apiClient.get('/health-assessments/who-curves', {
        params: { indicator, gender },
      });
      return unwrap(res.data);
    },
    enabled: !!gender,
  });

  const yMax = useMemo(() => {
    if (!curves?.length) return 100;
    return Math.ceil(Math.max(...curves.map((c) => c.sd3)) + (heightChart ? 4 : 2));
  }, [curves, heightChart]);

  const { rows, lastCurveIdx } = useMemo(() => {
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
    for (const r of records ?? []) {
      const value = heightChart ? r.height_cm : r.weight_kg;
      const x = ageMonthsExact(dob, r.assessment_date);
      if (value == null || x == null || x < 0 || x > 72) continue;
      studentRows.push({ x: Math.round(x * 100) / 100, student: value, date: r.assessment_date });
    }
    studentRows.sort((a, b) => a.x - b.x);
    return { rows: [...curveRows, ...studentRows], lastCurveIdx: curveRows.length - 1 };
  }, [curves, records, heightChart, dob, yMax]);

  const studentPoints = useMemo(() => rows.filter((r) => r.student != null), [rows]);
  const yFloor = heightChart ? 40 : 0;

  const Tip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    let nearest = null;
    for (const p of studentPoints) {
      if (
        Math.abs(p.x - label) <= 1 &&
        (!nearest || Math.abs(p.x - label) < Math.abs(nearest.x - label))
      )
        nearest = p;
    }
    const curveRow = payload.find((p) => p.payload?.median != null)?.payload;
    return (
      <div className="rounded-md border bg-white px-3 py-2 text-xs shadow-md space-y-0.5">
        <p className="font-semibold">{Number(label).toFixed(1)} tháng tuổi</p>
        {nearest && (
          <p className="font-semibold" style={{ color: STUDENT }}>
            {studentName}: {nearest.student} {unitLabel} ({fmtDate(nearest.date)})
          </p>
        )}
        {curveRow && <p style={{ color: CURVE.median }}>Trung vị WHO: {curveRow.median}</p>}
      </div>
    );
  };

  const zoneLegend = heightChart
    ? [
        ['Cao hơn so với tuổi', ZONE.above],
        ['Bình thường', ZONE.normal],
        ['Thấp còi độ 1', ZONE.mild],
        ['Thấp còi độ 2', ZONE.severe],
      ]
    : [
        ['Cân nặng cao hơn', ZONE.above],
        ['Bình thường', ZONE.normal],
        ['SDD vừa', ZONE.mild],
        ['SDD nặng', ZONE.severe],
      ];

  return (
    <div className="rounded-md border overflow-hidden" style={{ background: theme.page }}>
      <div
        className="px-3 py-2 flex items-center justify-between"
        style={{ background: theme.header }}
      >
        <span className="text-white font-bold text-sm">
          {heightChart ? 'Chiều cao theo tuổi' : 'Cân nặng theo tuổi'} — {theme.label}
        </span>
        {!compact && <span className="text-white/80 text-xs">WHO · {studentName}</span>}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 px-3 py-1.5 text-[11px]">
        {zoneLegend.map(([lab, color]) => (
          <span key={lab} className="inline-flex items-center gap-1">
            <span
              className="inline-block w-3 h-3 rounded-sm border"
              style={{ background: color }}
            />
            {lab}
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-4 border-t-2" style={{ borderColor: CURVE.median }} />
          Trung vị
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-4 border-t-2" style={{ borderColor: STUDENT }} />
          {studentName}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <ComposedChart data={rows} margin={{ top: 6, right: 28, bottom: 14, left: 0 }}>
          <CartesianGrid strokeDasharray="2 2" stroke="rgba(0,0,0,0.06)" />
          <XAxis
            dataKey="x"
            type="number"
            domain={[0, 72]}
            ticks={X_TICKS}
            fontSize={10}
            label={{ value: 'Tháng tuổi', position: 'insideBottom', offset: -6, fontSize: 11 }}
          />
          <YAxis
            fontSize={10}
            domain={[yFloor, yMax]}
            allowDecimals={false}
            width={36}
            label={{ value: unitLabel, angle: -90, position: 'insideLeft', fontSize: 11 }}
          />
          <Tooltip content={<Tip />} />
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
          <Line
            dataKey="sd3"
            stroke={CURVE.sd}
            strokeWidth={1}
            dot={false}
            isAnimationActive={false}
            connectNulls
            label={endLabel('3', CURVE.sd, lastCurveIdx)}
          />
          <Line
            dataKey="sd2"
            stroke={CURVE.sd}
            strokeWidth={1}
            dot={false}
            isAnimationActive={false}
            connectNulls
            label={endLabel('2', CURVE.sd, lastCurveIdx)}
          />
          <Line
            dataKey="median"
            stroke={CURVE.median}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
            connectNulls
            label={endLabel('0', CURVE.median, lastCurveIdx)}
          />
          <Line
            dataKey="sd2neg"
            stroke={CURVE.sd}
            strokeWidth={1}
            dot={false}
            isAnimationActive={false}
            connectNulls
            label={endLabel('-2', CURVE.sd, lastCurveIdx)}
          />
          <Line
            dataKey="sd3neg"
            stroke={CURVE.sd}
            strokeWidth={1}
            dot={false}
            isAnimationActive={false}
            connectNulls
            label={endLabel('-3', CURVE.sd, lastCurveIdx)}
          />
          <Line
            dataKey="student"
            stroke={STUDENT}
            strokeWidth={compact ? 2 : 2.5}
            dot={{ r: compact ? 1.6 : 3.5, fill: STUDENT, strokeWidth: 0 }}
            activeDot={{ r: compact ? 3.5 : 5 }}
            isAnimationActive={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── BMI history mini line ────────────────────────────────────────────────────
export function BmiMiniChart({ records, height = 220 }) {
  const data = (records ?? [])
    .filter((r) => r.bmi != null)
    .map((r) => ({ date: fmtDate(r.assessment_date), bmi: r.bmi }));
  if (data.length === 0)
    return <p className="py-8 text-center text-muted-foreground text-sm">Chưa có dữ liệu BMI</p>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 6, right: 16, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis dataKey="date" fontSize={10} />
        <YAxis fontSize={10} width={32} domain={['dataMin - 1', 'dataMax + 1']} />
        <Tooltip />
        <Line
          type="monotone"
          dataKey="bmi"
          name="BMI"
          stroke="#1a2845"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
