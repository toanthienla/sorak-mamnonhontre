// Đánh giá nuôi dưỡng — class roster grid per period (UC-74..79 adapted)
// Standalone classification; latest BMI shown as reference, chart icon → growth page
import { useState, useEffect, useMemo, useRef } from 'react';
import { Save, Search, FileSpreadsheet, Download, FileDown, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ColumnToggle } from '@/shared/components/column-toggle';
import { useColumnSettings } from '@/shared/hooks/use-column-settings';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ImportPreviewDialog } from '@/shared/components/import-preview-dialog';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/client';
import { toast } from 'sonner';
import { fmtDate, useHealthClasses, ClassSelect } from './health-shared';
import { GrowthPreview } from '../growth/GrowthPreview';
import { useHealthFilterStore } from '@/shared/stores/health-filter.store';

function unwrap(d) {
  const r = d;
  if (r?.data && typeof r.data === 'object' && 'data' in r.data) return r.data.data;
  return r?.data ?? d;
}

const PERIODS = [
  { code: 'dau_nam', label: 'Học kỳ 1 (đầu năm)' },
  { code: 'giua_ky_1', label: 'Học kỳ 1 (giữa kỳ)' },
  { code: 'cuoi_ky_1', label: 'Học kỳ 1 (cuối kỳ)' },
  { code: 'dau_ky_2', label: 'Học kỳ 2 (đầu kỳ)' },
  { code: 'giua_ky_2', label: 'Học kỳ 2 (giữa kỳ)' },
  { code: 'cuoi_nam', label: 'Học kỳ 2 (cuối năm)' },
];

const CHANNELS = [
  { value: 'none', label: '-- Chọn --' },
  { value: 'Suy dinh dưỡng thể nhẹ cân', label: 'Kênh suy DD thể nhẹ cân' },
  { value: 'Cân nặng cao hơn tuổi', label: 'Kênh cân nặng cao hơn tuổi' },
];

export function NutritionTab() {
  const { classes, selectedYearId } = useHealthClasses();
  const queryClient = useQueryClient();

  const setStore = useHealthFilterStore((s) => s.set);
  const [classId, setClassIdState] = useState(
    useHealthFilterStore.getState().nutritionClassId || '',
  );
  const setClassId = (v) => {
    setClassIdState(v);
    setStore({ nutritionClassId: v });
  };
  const [period, setPeriodState] = useState(
    useHealthFilterStore.getState().nutritionPeriod || 'dau_nam',
  );
  const setPeriod = (v) => {
    setPeriodState(v);
    setStore({ nutritionPeriod: v });
  };
  const [searchInput, setSearchInput] = useState('');
  const [values, setValues] = useState({}); // student_id -> { weight_channel, is_stunting, is_severe_stunting, is_obese }
  const [preview, setPreview] = useState(null); // { student_id, class_id } for growth preview

  // Toggleable info columns (domain columns always shown)
  const INFO_COLS = [
    { key: 'card', label: 'Mã thẻ' },
    { key: 'dob', label: 'Ngày sinh' },
    { key: 'gender', label: 'Giới tính' },
  ];
  const { hidden, setHidden, order, setOrder } = useColumnSettings('col:nutrition', [
    'card',
    'dob',
    'gender',
  ]);
  const show = (k) => !hidden.has(k);

  // Default to first class (Nhà trẻ); reset if remembered class not in current list
  useEffect(() => {
    if (!classes.length) return;
    const exists = classes.some((c) => String(c.class_id) === classId);
    if (!classId || !exists) setClassId(String(classes[0].class_id));
  }, [classes, classId]);

  const { data: rows, isLoading } = useQuery({
    queryKey: ['nutrition-grid', classId, selectedYearId, period],
    queryFn: async () => {
      const res = await apiClient.get('/nutrition-assessments/grid', {
        params: { class_id: Number(classId), school_year_id: selectedYearId, period },
      });
      return unwrap(res.data) ?? [];
    },
    enabled: !!classId && !!selectedYearId && !!period,
  });

  // Reset/prefill editable state from server rows
  useEffect(() => {
    const next = {};
    for (const r of rows ?? []) {
      next[r.student_id] = {
        weight_channel: r.weight_channel ?? 'none',
        is_stunting: r.is_stunting,
        is_severe_stunting: r.is_severe_stunting,
        is_obese: r.is_obese,
      };
    }
    setValues(next);
    setDirtyKeys(new Set());
  }, [rows]);

  const [dirtyKeys, setDirtyKeys] = useState(new Set());
  const setVal = (sid, field, v) => {
    setValues((prev) => ({ ...prev, [sid]: { ...prev[sid], [field]: v } }));
    setDirtyKeys((prev) => new Set(prev).add(sid));
  };

  const visibleRows = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    if (!q) return rows ?? [];
    return (rows ?? []).filter(
      (r) =>
        r.full_name.toLowerCase().includes(q) ||
        r.student_id_card_number?.toLowerCase().includes(q),
    );
  }, [rows, searchInput]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const dirty = (rows ?? []).filter((r) => !r.transferred_out && dirtyKeys.has(r.student_id));
      const toRow = (r) => {
        const v = values[r.student_id];
        return {
          student_id: r.student_id,
          weight_channel: v.weight_channel === 'none' ? null : v.weight_channel,
          is_stunting: !!v.is_stunting,
          is_severe_stunting: !!v.is_severe_stunting,
          is_obese: !!v.is_obese,
        };
      };
      // Group by class (all-classes mode spans many classes) — one bulk call each
      const byClass = new Map();
      for (const r of dirty) {
        const cid = Number(classId);
        if (!byClass.has(cid)) byClass.set(cid, []);
        byClass.get(cid).push(toRow(r));
      }
      let saved = 0,
        cleared = 0;
      for (const [cid, payload] of byClass) {
        const res = await apiClient.post('/nutrition-assessments/bulk', {
          class_id: cid,
          school_year_id: selectedYearId,
          period,
          rows: payload,
        });
        const d = unwrap(res.data);
        saved += d.saved;
        cleared += d.cleared;
      }
      return { saved, cleared };
    },
    onSuccess: (r) => {
      toast.success(`Đã lưu ${r.saved} bản ghi${r.cleared ? `, xóa ${r.cleared}` : ''}`);
      queryClient.invalidateQueries({ queryKey: ['nutrition-grid'] });
    },
  });

  const handleExport = async () => {
    if (!classId) {
      toast.error('Chọn lớp trước');
      return;
    }
    const res = await apiClient.get('/nutrition-assessments/export/excel', {
      params: { class_id: Number(classId), school_year_id: selectedYearId, period },
      responseType: 'blob',
    });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nutrition_${period}_${Date.now()}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleTemplate = async () => {
    const res = await apiClient.get('/nutrition-assessments/import/template', {
      responseType: 'blob',
    });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mau_nhap_dinh_duong.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Import ──
  const importInputRef = useRef();
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handleFileSelect = async (file) => {
    if (!classId) {
      toast.error('Chọn lớp trước khi nhập Excel');
      return;
    }
    setImportFile(file);
    setImportPreview(null);
    setPreviewOpen(true);
    setPreviewLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiClient.post('/nutrition-assessments/import/preview', fd, {
        params: { class_id: Number(classId), school_year_id: selectedYearId },
      });
      setImportPreview(unwrap(res.data));
    } catch (e) {
      setImportPreview({ fatal: e?.response?.data?.message ?? 'Lỗi đọc file', rows: [] });
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!importFile) return;
    setConfirming(true);
    try {
      const fd = new FormData();
      fd.append('file', importFile);
      const res = await apiClient.post('/nutrition-assessments/import', fd, {
        params: { class_id: Number(classId), school_year_id: selectedYearId, period },
      });
      const r = unwrap(res.data);
      toast.success(`Nhập xong: ${r.saved} bản ghi, ${r.error_count} lỗi`);
      queryClient.invalidateQueries({ queryKey: ['nutrition-grid'] });
      setPreviewOpen(false);
      setImportFile(null);
    } catch (e) {
      toast.error(e?.response?.data?.message ?? 'Nhập thất bại');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <>
      <div className="flex gap-2 mb-4 flex-wrap items-end">
        <div>
          <Label className="text-xs">
            Lớp <span className="text-destructive">*</span>
          </Label>
          <ClassSelect classes={classes} value={classId} onChange={setClassId} />
        </div>
        <div>
          <Label className="text-xs">
            Giai đoạn <span className="text-destructive">*</span>
          </Label>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p.code} value={p.code}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8 w-48"
            placeholder="Lọc theo tên / mã..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <div className="flex-1" />
        <ColumnToggle
          columns={INFO_COLS}
          hidden={hidden}
          onHiddenChange={setHidden}
          order={order}
          onOrderChange={setOrder}
        />
        <input
          ref={importInputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFileSelect(f);
            e.target.value = '';
          }}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={!classId}>
              <FileSpreadsheet className="h-4 w-4 mr-1.5" /> Excel
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" /> Xuất danh sách
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleTemplate}>
              <FileDown className="h-4 w-4 mr-2" /> Tải form mẫu
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => importInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" /> Nhập từ Excel (theo lớp + giai đoạn)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          size="sm"
          onClick={() => saveMut.mutate()}
          disabled={!classId || dirtyKeys.size === 0 || saveMut.isPending}
        >
          <Save className="h-4 w-4 mr-1.5" />
          {saveMut.isPending ? 'Đang lưu...' : `Cập nhật (${dirtyKeys.size})`}
        </Button>
      </div>

      {!classId ? (
        <div className="bg-card rounded-md border py-16 text-center text-muted-foreground">
          Chọn lớp và giai đoạn để nhập đánh giá nuôi dưỡng cho cả lớp
        </div>
      ) : (
        <div className="bg-card rounded-md border overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-muted/90 backdrop-blur z-10">
              <tr className="border-b">
                <th className="px-3 py-2.5 text-left text-xs font-medium w-12">STT</th>
                {show('card') && (
                  <th className="px-3 py-2.5 text-left text-xs font-medium">Mã thẻ</th>
                )}
                <th className="px-3 py-2.5 text-left text-xs font-medium">Họ tên</th>
                {show('dob') && (
                  <th className="px-3 py-2.5 text-left text-xs font-medium">Ngày sinh</th>
                )}
                {show('gender') && (
                  <th className="px-3 py-2.5 text-left text-xs font-medium">Giới tính</th>
                )}
                <th className="px-3 py-2.5 text-left text-xs font-medium w-64">
                  Kênh tăng trưởng cân nặng
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-medium w-24">SDD thấp còi</th>
                <th className="px-3 py-2.5 text-center text-xs font-medium w-24">SDD còi cọc</th>
                <th className="px-3 py-2.5 text-center text-xs font-medium w-20">Béo phì</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                    Đang tải...
                  </td>
                </tr>
              )}
              {!isLoading && visibleRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                    Không có học sinh
                  </td>
                </tr>
              )}
              {!isLoading &&
                visibleRows.map((r, i) => {
                  const v = values[r.student_id] ?? {
                    weight_channel: 'none',
                    is_stunting: false,
                    is_severe_stunting: false,
                    is_obese: false,
                  };
                  const out = r.transferred_out;
                  const openPreview = () =>
                    setPreview({ student_id: r.student_id, class_id: Number(classId) });
                  const stop = (e) => e.stopPropagation();
                  return (
                    <tr
                      key={r.student_id}
                      className={`border-t cursor-pointer hover:bg-accent ${out ? 'opacity-60' : ''} ${dirtyKeys.has(r.student_id) ? 'bg-blue-50/60' : ''}`}
                      onClick={openPreview}
                      title="Xem tăng trưởng WHO"
                    >
                      <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                      {show('card') && (
                        <td className="px-3 py-1.5 font-mono text-xs">
                          {r.student_id_card_number}
                        </td>
                      )}
                      <td className="px-3 py-1.5 font-medium">{r.full_name}</td>
                      {show('dob') && <td className="px-3 py-1.5">{fmtDate(r.date_of_birth)}</td>}
                      {show('gender') && <td className="px-3 py-1.5">{r.gender}</td>}
                      <td className="px-3 py-1" onClick={stop}>
                        <Select
                          value={v.weight_channel}
                          onValueChange={(val) => setVal(r.student_id, 'weight_channel', val)}
                          disabled={out}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CHANNELS.map((c) => (
                              <SelectItem key={c.value} value={c.value}>
                                {c.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-1.5 text-center" onClick={stop}>
                        <Checkbox
                          checked={v.is_stunting}
                          disabled={out}
                          onCheckedChange={(c) => setVal(r.student_id, 'is_stunting', !!c)}
                        />
                      </td>
                      <td className="px-3 py-1.5 text-center" onClick={stop}>
                        <Checkbox
                          checked={v.is_severe_stunting}
                          disabled={out}
                          onCheckedChange={(c) => setVal(r.student_id, 'is_severe_stunting', !!c)}
                        />
                      </td>
                      <td className="px-3 py-1.5 text-center" onClick={stop}>
                        <Checkbox
                          checked={v.is_obese}
                          disabled={out}
                          onCheckedChange={(c) => setVal(r.student_id, 'is_obese', !!c)}
                        />
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted-foreground mt-2">
        Tích trực tiếp theo từng giai đoạn. Bấm vào dòng học sinh để xem biểu đồ tăng trưởng WHO khi
        đánh giá.
      </p>

      <GrowthPreview
        open={!!preview}
        onOpenChange={(o) => !o && setPreview(null)}
        studentId={preview?.student_id}
        classId={preview?.class_id}
        schoolYearId={selectedYearId}
        showZoneCharts={false}
      >
        {preview &&
          (() => {
            const sid = preview.student_id;
            const v = values[sid] ?? {
              weight_channel: 'none',
              is_stunting: false,
              is_severe_stunting: false,
              is_obese: false,
            };
            return (
              <div className="rounded-lg border p-4 space-y-3">
                <p className="text-sm font-semibold">
                  Đánh giá nuôi dưỡng — {PERIODS.find((p) => p.code === period)?.label}
                </p>
                <div>
                  <Label>Kênh tăng trưởng cân nặng</Label>
                  <Select
                    value={v.weight_channel}
                    onValueChange={(val) => setVal(sid, 'weight_channel', val)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CHANNELS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap gap-5">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={v.is_stunting}
                      onCheckedChange={(c) => setVal(sid, 'is_stunting', !!c)}
                    />{' '}
                    SDD thấp còi
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={v.is_severe_stunting}
                      onCheckedChange={(c) => setVal(sid, 'is_severe_stunting', !!c)}
                    />{' '}
                    SDD còi cọc
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={v.is_obese}
                      onCheckedChange={(c) => setVal(sid, 'is_obese', !!c)}
                    />{' '}
                    Béo phì
                  </label>
                </div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    disabled={saveMut.isPending}
                    onClick={async () => {
                      await saveMut.mutateAsync();
                      setPreview(null);
                    }}
                  >
                    <Save className="h-4 w-4 mr-1.5" /> Lưu đánh giá
                  </Button>
                </div>
              </div>
            );
          })()}
      </GrowthPreview>

      <ImportPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title="Xem trước nhập đánh giá nuôi dưỡng"
        columns={[
          { key: 'card', label: 'Mã thẻ' },
          { key: 'name', label: 'Họ tên' },
          { key: 'channel', label: 'Kênh tăng trưởng' },
          { key: 'stunting', label: 'Thấp còi' },
          { key: 'severe', label: 'Còi cọc' },
          { key: 'obese', label: 'Béo phì' },
        ]}
        preview={importPreview}
        loading={previewLoading}
        confirming={confirming}
        onConfirm={handleConfirmImport}
      />
    </>
  );
}
