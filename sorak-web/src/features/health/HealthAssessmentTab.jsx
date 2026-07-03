// Health assessment entry grid — pick class + date, type results inline, save all (UC-62/63/65/66/67/68)
// Clearing both height+weight of an existing record deletes that day's record on save.
import { useState, useEffect, useMemo, useRef } from 'react';
import { HealthHistoryModal } from './HealthHistoryModal';
import { Save, Search, FileSpreadsheet, Download, FileDown, Upload } from 'lucide-react';
import { ColumnToggle } from '@/shared/components/column-toggle';
import { useColumnSettings } from '@/shared/hooks/use-column-settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { fmtDate, useHealthClasses, ClassSelect, useClassStudents } from './health-shared';
import { useHealthFilterStore } from '@/shared/stores/health-filter.store';

function unwrap(d) {
  const r = d;
  if (r?.data && typeof r.data === 'object' && 'data' in r.data) return r.data.data;
  return r?.data ?? d;
}

export function HealthAssessmentTab() {
  const { classes, selectedYearId } = useHealthClasses();
  const queryClient = useQueryClient();
  const importInputRef = useRef();
  const [history, setHistory] = useState(null); // { student_id, class_id } detail modal
  const goToGrowth = (clsId, studentId) => setHistory({ student_id: studentId, class_id: clsId });

  const storedClassId = useHealthFilterStore((s) => s.healthClassId);
  const setStore = useHealthFilterStore((s) => s.set);
  const [classId, setClassIdState] = useState(storedClassId || '');
  const setClassId = (v) => {
    setClassIdState(v);
    setStore({ healthClassId: v });
  };
  const INFO_COLS = [
    { key: 'card', label: 'Mã thẻ' },
    { key: 'dob', label: 'Ngày sinh' },
    { key: 'gender', label: 'Giới tính' },
  ];
  const { hidden, setHidden, order, setOrder } = useColumnSettings('col:health', [
    'card',
    'dob',
    'gender',
  ]);
  const show = (k) => !hidden.has(k);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [searchInput, setSearchInput] = useState('');
  const [values, setValues] = useState({}); // { student_id: { weight, height } }
  const [dirty, setDirty] = useState(false);

  // Default to first class (Nhà trẻ); reset if remembered class not in current list
  useEffect(() => {
    if (!classes.length) return;
    const exists = classes.some((c) => String(c.class_id) === classId);
    if (!classId || !exists) setClassId(String(classes[0].class_id));
  }, [classes, classId]);

  const { data: students } = useClassStudents(classId, !!classId);

  // Existing records for class + date — prefill + computed columns
  const { data: existing, refetch: refetchExisting } = useQuery({
    queryKey: ['health-by-class-date', classId, date],
    queryFn: async () => {
      const res = await apiClient.get('/health-assessments/by-class-date', {
        params: { class_id: Number(classId), assessment_date: date },
      });
      return unwrap(res.data) ?? [];
    },
    enabled: !!classId && !!date,
  });
  const existingByStudent = useMemo(
    () => new Map((existing ?? []).map((r) => [r.student_id, r])),
    [existing],
  );

  // Reset + prefill inputs when class/date/records change
  useEffect(() => {
    const next = {};
    for (const r of existing ?? []) {
      next[r.student_id] = {
        weight: r.weight_kg != null ? String(r.weight_kg) : '',
        height: r.height_cm != null ? String(r.height_cm) : '',
      };
    }
    setValues(next);
    setDirty(false);
  }, [existing, classId, date]);

  const setVal = (sid, field, v) => {
    setValues((prev) => ({
      ...prev,
      [sid]: { ...(prev[sid] ?? { weight: '', height: '' }), [field]: v },
    }));
    setDirty(true);
  };

  const activeStudents = useMemo(() => {
    let list = (students ?? []).filter((s) => s.student_status !== 'Đã chuyển trường');
    const q = searchInput.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (s) =>
          s.full_name.toLowerCase().includes(q) ||
          s.student_id_card_number?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [students, searchInput]);

  const filledCount = useMemo(
    () =>
      (students ?? []).filter((s) => {
        const v = values[s.student_id];
        return v && Number(v.weight) > 0 && Number(v.height) > 0;
      }).length,
    [students, values],
  );

  // Records to delete: had an existing record but inputs now cleared (both empty)
  const toDelete = useMemo(
    () =>
      (students ?? [])
        .map((s) => {
          const rec = existingByStudent.get(s.student_id);
          const v = values[s.student_id];
          if (rec && (!v || (!v.weight && !v.height))) return rec.assessment_id;
          return null;
        })
        .filter(Boolean),
    [students, existingByStudent, values],
  );

  const refresh = () => {
    refetchExisting();
    queryClient.invalidateQueries({ queryKey: ['health-assessments'] });
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      // Delete cleared records first
      for (const id of toDelete) {
        await apiClient.delete(`/health-assessments/${id}`).catch(() => {});
      }
      const rows = (students ?? [])
        .filter((s) => s.student_status !== 'Đã chuyển trường')
        .map((s) => {
          const v = values[s.student_id];
          if (!v || (!v.weight && !v.height)) return null;
          return {
            student_id: s.student_id,
            weight_kg: Number(v.weight) || null,
            height_cm: Number(v.height) || null,
          };
        })
        .filter(Boolean);
      let res = { created: 0, updated: 0, errors: [] };
      if (rows.length) {
        res = unwrap(
          (
            await apiClient.post('/health-assessments/bulk', {
              school_year_id: selectedYearId,
              class_id: Number(classId),
              assessment_date: date,
              rows,
            })
          ).data,
        );
      }
      return { ...res, deleted: toDelete.length };
    },
    onSuccess: (r) => {
      toast.success(
        `Đã lưu: ${r.created} mới, ${r.updated} cập nhật${r.deleted ? `, ${r.deleted} xóa` : ''}${r.errors?.length ? `, ${r.errors.length} lỗi` : ''}`,
      );
      refresh();
    },
  });

  // ── Import / export (per class) ──
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const importParams = { class_id: classId, school_year_id: selectedYearId };

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
      const res = await apiClient.post('/health-assessments/import/preview', fd, {
        params: importParams,
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
      const res = await apiClient.post('/health-assessments/import', fd, { params: importParams });
      const r = unwrap(res.data);
      toast.success(`Nhập xong: ${r.created} mới, ${r.updated} cập nhật, ${r.error_count} lỗi`);
      refresh();
      setPreviewOpen(false);
      setImportFile(null);
    } catch (e) {
      toast.error(e?.response?.data?.message ?? 'Nhập thất bại');
    } finally {
      setConfirming(false);
    }
  };

  const handleExport = async () => {
    const res = await apiClient.get('/health-assessments/export/excel', {
      params: { school_year_id: selectedYearId ?? undefined, class_id: classId || undefined },
      responseType: 'blob',
    });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `health_${Date.now()}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleTemplate = async () => {
    const res = await apiClient.get('/health-assessments/import/template', {
      responseType: 'blob',
    });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mau_nhap_suc_khoe.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveCount = filledCount + toDelete.length;

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
            Ngày đánh giá <span className="text-destructive">*</span>
          </Label>
          <Input
            type="date"
            className="w-40"
            max={new Date().toISOString().slice(0, 10)}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
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
            <Button variant="outline" size="sm">
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
              <Upload className="h-4 w-4 mr-2" /> Nhập từ Excel (theo lớp)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          size="sm"
          onClick={() => saveMut.mutate()}
          disabled={!classId || !date || !dirty || saveCount === 0 || saveMut.isPending}
        >
          <Save className="h-4 w-4 mr-1.5" />
          {saveMut.isPending ? 'Đang lưu...' : `Lưu (${saveCount})`}
        </Button>
      </div>

      {!classId ? (
        <div className="bg-card rounded-md border py-16 text-center text-muted-foreground">
          Chọn lớp và ngày đánh giá để nhập kết quả cho cả lớp
        </div>
      ) : (
        <>
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
                  <th className="px-3 py-2.5 text-left text-xs font-medium w-32">Cân nặng (kg)</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium w-32">Chiều cao (cm)</th>
                </tr>
              </thead>
              <tbody>
                {activeStudents.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                      Không có học sinh
                    </td>
                  </tr>
                )}
                {activeStudents.map((s, i) => {
                  const v = values[s.student_id] ?? { weight: '', height: '' };
                  const rec = existingByStudent.get(s.student_id);
                  const partial = (v.weight && !v.height) || (!v.weight && v.height);
                  const willDelete = rec && !v.weight && !v.height;
                  return (
                    <tr
                      key={s.student_id}
                      className={`border-t cursor-pointer hover:bg-accent ${willDelete ? 'bg-red-50' : partial ? 'bg-amber-50' : ''}`}
                      onClick={() => goToGrowth(Number(classId), s.student_id)}
                      title="Xem biểu đồ tăng trưởng"
                    >
                      <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                      {show('card') && (
                        <td className="px-3 py-1.5 font-mono text-xs">
                          {s.student_id_card_number}
                        </td>
                      )}
                      <td className="px-3 py-1.5 font-medium">{s.full_name}</td>
                      {show('dob') && <td className="px-3 py-1.5">{fmtDate(s.date_of_birth)}</td>}
                      {show('gender') && <td className="px-3 py-1.5">{s.gender}</td>}
                      <td className="px-3 py-1" onClick={(e) => e.stopPropagation()}>
                        <Input
                          type="number"
                          step="0.1"
                          min="1"
                          max="100"
                          className="h-8"
                          value={v.weight}
                          onChange={(e) => setVal(s.student_id, 'weight', e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-1" onClick={(e) => e.stopPropagation()}>
                        <Input
                          type="number"
                          step="0.1"
                          min="1"
                          max="200"
                          className="h-8"
                          value={v.height}
                          onChange={(e) => setVal(s.student_id, 'height', e.target.value)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Bỏ trống = chưa đo đợt này. Xóa cả cao + cân nặng của học sinh đã có bản ghi = xóa kết
            quả đo ngày đó khi lưu (dòng tô đỏ). BMI và phân loại WHO tự tính.
          </p>
        </>
      )}

      <HealthHistoryModal
        open={!!history}
        onOpenChange={(o) => !o && setHistory(null)}
        studentId={history?.student_id}
        classId={history?.class_id}
        schoolYearId={selectedYearId}
      />

      <ImportPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title="Xem trước nhập đánh giá sức khỏe"
        columns={[
          { key: 'card', label: 'Mã thẻ' },
          { key: 'name', label: 'Họ tên' },
          { key: 'date', label: 'Ngày' },
          { key: 'height_cm', label: 'Cao (cm)' },
          { key: 'weight_kg', label: 'Nặng (kg)' },
          { key: 'note', label: 'Ghi chú' },
        ]}
        preview={importPreview}
        loading={previewLoading}
        confirming={confirming}
        onConfirm={handleConfirmImport}
      />
    </>
  );
}
