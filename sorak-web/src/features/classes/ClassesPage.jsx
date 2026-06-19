import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus,
  Pencil,
  Trash2,
  Upload,
  Download,
  MoreHorizontal,
  Search,
  Archive,
  RotateCcw,
  X,
  FileDown,
  FileSpreadsheet,
} from 'lucide-react';
import { useTableSort } from '@/shared/hooks/use-table-sort.jsx';
import { ColumnToggle } from '@/shared/components/column-toggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { PageHeader } from '@/shared/components/page-header';
import { DataPagination } from '@/shared/components/data-pagination';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { ImportPreviewDialog } from '@/shared/components/import-preview-dialog';
import { useCreate, useDelete, useList, useUpdate } from '@/shared/hooks/use-crud';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useColumnSettings } from '@/shared/hooks/use-column-settings';
import { apiClient } from '@/shared/api/client';
import { useAuthStore } from '@/shared/stores/auth.store';
import { useYearStore } from '@/shared/stores/year.store';
import { toast } from 'sonner';

const schema = z.object({
  class_name: z.string().min(1, 'Bắt buộc'),
  school_year_id: z.number().int().positive(),
  age_group: z.string().optional(),
  room: z.string().optional(),
});

function unwrap(d) {
  const r = d;
  if (r?.data && typeof r.data === 'object' && 'data' in r.data) return r.data.data;
  return r?.data ?? d;
}

export function ClassesPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  const isBGH = role === 'PRINCIPAL';
  const isGV = role === 'TEACHER';
  const selectedYearId = useYearStore((s) => s.selectedYearId);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [ageFilter, setAgeFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [classTeachers, setClassTeachers] = useState([]); // teachers in current dialog
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [teachersDirty, setTeachersDirty] = useState(false);
  const queryClient = useQueryClient();
  const importInputRef = useRef();

  const { data: allTeachers } = useQuery({
    queryKey: ['teachers-all'],
    queryFn: async () => {
      const res = await apiClient.get('/teachers', {
        params: { pageSize: 200, work_status: 'Đang làm việc' },
      });
      return res.data?.data ?? [];
    },
    enabled: dialogOpen,
    staleTime: 0,
  });

  const COLS = [
    { key: 'name', label: 'Tên lớp' },
    { key: 'grade', label: 'Khối' },
    { key: 'room', label: 'Phòng' },
    { key: 'capacity', label: 'Sĩ số' },
    { key: 'teachers', label: 'Giáo viên' },
  ];
  const COL_KEYS = COLS.map((c) => c.key);
  const {
    hidden: hiddenCols,
    setHidden: setHiddenCols,
    order: colOrder,
    setOrder: setColOrder,
  } = useColumnSettings('col:classes', COL_KEYS);
  const orderedCols = colOrder.map((k) => COLS.find((c) => c.key === k)).filter(Boolean);
  const show = (key) => !hiddenCols.has(key);

  const { data: years } = useQuery({
    queryKey: ['academic-years'],
    queryFn: async () => {
      const res = await apiClient.get('/academic-years');
      return unwrap(res.data);
    },
  });

  const { data, isLoading } = useList('classes', '/classes', {
    page,
    pageSize: 20,
    school_year_id: selectedYearId ?? undefined,
    search: search || undefined,
    age_group: ageFilter !== 'all' ? ageFilter : undefined,
  });

  const CLASS_SORT_FIELD = {
    name: 'class_name',
    grade: 'age_group',
    room: 'room',
    capacity: null,
    teachers: null,
  };
  const {
    sortedRows: sortedClasses,
    toggleSort: toggleClassSort,
    SortIcon: ClassSortIcon,
  } = useTableSort(data?.data, CLASS_SORT_FIELD);

  const create = useCreate('classes', '/classes');
  const update = useUpdate('classes', '/classes');
  const del = useDelete('classes', '/classes');

  const { data: archivedData, isLoading: archivedLoading } = useQuery({
    queryKey: ['classes-archived'],
    queryFn: async () => {
      const res = await apiClient.get('/classes/archived', { params: { pageSize: 200 } });
      return res.data?.data ?? [];
    },
    enabled: archiveOpen,
  });

  const handleRestore = async (id) => {
    try {
      await apiClient.patch(`/classes/${id}/restore`);
      toast.success('Khôi phục lớp thành công');
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['classes-archived'] });
    } catch {
      /* toast handled */
    }
  };

  const form = useForm({
    resolver: zodResolver(schema),
  });

  const onOpenCreate = () => {
    setEditing(null);
    setClassTeachers([]);
    setSelectedTeacherId('');
    setTeachersDirty(false);
    form.reset({
      class_name: '',
      school_year_id:
        selectedYearId ?? years?.find((y) => y.status === 'active')?.school_year_id ?? 0,
      age_group: '',
      room: '',
    });
    setDialogOpen(true);
  };

  const onOpenEdit = (c) => {
    setEditing(c);
    setClassTeachers(c.teacher_classes.map((tc) => tc.teacher));
    setSelectedTeacherId('');
    setTeachersDirty(false);
    form.reset({
      class_name: c.class_name,
      school_year_id: c.school_year_id,
      age_group: c.age_group ?? '',
      room: c.room ?? '',
    });
    setDialogOpen(true);
  };

  // Local-only — applied on submit (Cập nhật)
  const handleAddTeacher = () => {
    if (!selectedTeacherId) return;
    const teacher = (allTeachers ?? []).find((t) => String(t.account_id) === selectedTeacherId);
    if (!teacher) return;
    if (classTeachers.some((t) => t.teacher_id === teacher.teacher_id)) {
      toast.error('Giáo viên đã có trong lớp');
      return;
    }
    setClassTeachers((arr) => [...arr, teacher]);
    setSelectedTeacherId('');
    setTeachersDirty(true);
  };

  const handleRemoveTeacher = (teacher) => {
    setClassTeachers((arr) => arr.filter((t) => t.teacher_id !== teacher.teacher_id));
    setTeachersDirty(true);
  };

  const syncTeachers = async (classId, originalTeachers) => {
    const origIds = new Set(originalTeachers.map((t) => t.teacher_id));
    const currIds = new Set(classTeachers.map((t) => t.teacher_id));
    // add new
    for (const t of classTeachers) {
      if (!origIds.has(t.teacher_id)) {
        await apiClient
          .post(`/classes/${classId}/teachers`, { account_id: t.account_id })
          .catch(() => {});
      }
    }
    // remove dropped
    for (const t of originalTeachers) {
      if (!currIds.has(t.teacher_id)) {
        await apiClient.delete(`/classes/${classId}/teachers/${t.teacher_id}`).catch(() => {});
      }
    }
  };

  const onSubmit = async (v) => {
    if (editing) {
      await update.mutateAsync({ id: editing.class_id, data: v });
      await syncTeachers(
        editing.class_id,
        editing.teacher_classes.map((tc) => tc.teacher),
      );
      queryClient.invalidateQueries({ queryKey: ['classes'] });
    } else {
      const res = await create.mutateAsync(v);
      const newId = res?.data?.class_id ?? res?.class_id;
      if (newId && classTeachers.length > 0) {
        for (const t of classTeachers) {
          await apiClient
            .post(`/classes/${newId}/teachers`, { account_id: t.account_id })
            .catch(() => {});
        }
        queryClient.invalidateQueries({ queryKey: ['classes'] });
      }
    }
    setDialogOpen(false);
  };

  const handleExport = async () => {
    const params = selectedYearId ? { school_year_id: selectedYearId } : {};
    const res = await apiClient.get('/classes/export/excel', { params, responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `classes_${Date.now()}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadTemplate = async () => {
    const res = await apiClient.get('/classes/import/template', { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mau_nhap_lop.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handleFileSelect = async (file) => {
    setImportFile(file);
    setImportPreview(null);
    setPreviewOpen(true);
    setPreviewLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiClient.post('/classes/import/preview', fd);
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
      const res = await apiClient.post('/classes/import', fd);
      const r = unwrap(res.data);
      toast.success(`Nhập xong: ${r.success_count} thành công, ${r.error_count} lỗi`);
      queryClient.invalidateQueries({ queryKey: ['classes'] });
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
      <PageHeader title="Lớp học" description="Danh sách lớp" />

      <div className="flex gap-2 mb-4 flex-wrap">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setSearch(searchInput);
          }}
          className="flex gap-2 flex-1 max-w-sm"
        >
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Tìm tên lớp..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <Button type="submit" variant="secondary">
            Tìm
          </Button>
        </form>
        <Select
          value={ageFilter}
          onValueChange={(v) => {
            setAgeFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Khối" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả khối</SelectItem>
            <SelectItem value="Nhà trẻ">Nhà trẻ</SelectItem>
            <SelectItem value="Mầm">Mầm</SelectItem>
            <SelectItem value="Chồi">Chồi</SelectItem>
            <SelectItem value="Lá">Lá</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <ColumnToggle
          columns={COLS}
          hidden={hiddenCols}
          onHiddenChange={setHiddenCols}
          order={colOrder}
          onOrderChange={setColOrder}
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
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" /> Xuất danh sách
            </DropdownMenuItem>
            {isBGH && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleDownloadTemplate}>
                  <FileDown className="h-4 w-4 mr-2" /> Tải form mẫu
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => importInputRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" /> Nhập từ Excel
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        {isBGH && (
          <Button
            variant="outline"
            size="icon"
            title="Lớp đã lưu trữ"
            onClick={() => {
              setArchiveOpen(true);
              queryClient.invalidateQueries({ queryKey: ['classes-archived'] });
            }}
          >
            <Archive className="h-4 w-4" />
          </Button>
        )}
        {isBGH && (
          <Button size="sm" onClick={onOpenCreate}>
            <Plus className="h-4 w-4 mr-1.5" /> Tạo lớp
          </Button>
        )}
      </div>

      <div className="bg-card rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {orderedCols
                .filter((col) => show(col.key))
                .map((col) => (
                  <TableHead
                    key={col.key}
                    className={
                      CLASS_SORT_FIELD[col.key]
                        ? 'cursor-pointer select-none hover:bg-muted/50'
                        : ''
                    }
                    onClick={() => toggleClassSort(col.key)}
                  >
                    {col.label}
                    <ClassSortIcon colKey={col.key} />
                  </TableHead>
                ))}
              {isBGH && <TableHead className="text-right">Thao tác</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell
                  colSpan={orderedCols.filter((col) => show(col.key)).length + 1}
                  className="text-center py-8 text-muted-foreground"
                >
                  Đang tải...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && !data?.data?.length && (
              <TableRow>
                <TableCell
                  colSpan={orderedCols.filter((col) => show(col.key)).length + 1}
                  className="text-center py-10 text-muted-foreground"
                >
                  Chưa có lớp
                </TableCell>
              </TableRow>
            )}
            {sortedClasses.map((c) => {
              const renderClassCell = (key) => {
                switch (key) {
                  case 'name':
                    return (
                      <TableCell key={key} className="font-medium">
                        {c.class_name}
                      </TableCell>
                    );
                  case 'grade':
                    return <TableCell key={key}>{c.age_group ?? '—'}</TableCell>;
                  case 'room':
                    return <TableCell key={key}>{c.room ?? '—'}</TableCell>;
                  case 'capacity':
                    return <TableCell key={key}>{c._count.enrollments}</TableCell>;
                  case 'teachers':
                    return (
                      <TableCell key={key}>
                        {c.teacher_classes.map((t) => t.teacher.full_name).join(', ') || '—'}
                      </TableCell>
                    );
                  default:
                    return null;
                }
              };
              return (
                <TableRow
                  key={c.class_id}
                  className="cursor-pointer hover:bg-accent"
                  onClick={() => navigate(`/students?class_id=${c.class_id}`)}
                  title="Xem học sinh lớp này"
                >
                  {orderedCols
                    .filter((col) => show(col.key))
                    .map((col) => renderClassCell(col.key))}
                  {isBGH && (
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => onOpenEdit(c)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Chỉnh sửa
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleting(c)}
                          >
                            <Archive className="h-4 w-4 mr-2" />
                            Lưu trữ
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {data && data.meta.total > 0 && (
        <DataPagination
          page={data.meta.page}
          pageSize={data.meta.pageSize}
          total={data.meta.total}
          totalPages={data.meta.totalPages}
          onPageChange={setPage}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Cập nhật lớp' : 'Tạo lớp'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <div>
              <Label>
                Tên lớp <span className="text-destructive">*</span>
              </Label>
              <Input
                {...form.register('class_name')}
                disabled={!!editing}
                className={editing ? 'bg-muted text-muted-foreground cursor-not-allowed' : ''}
              />
            </div>
            <div>
              <Label>
                Năm học <span className="text-destructive">*</span>
              </Label>
              <Select
                value={String(form.watch('school_year_id') || '')}
                onValueChange={(v) =>
                  form.setValue('school_year_id', Number(v), { shouldDirty: true })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn năm" />
                </SelectTrigger>
                <SelectContent>
                  {years?.map((y) => (
                    <SelectItem key={y.school_year_id} value={String(y.school_year_id)}>
                      {y.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Khối</Label>
                <Select
                  value={form.watch('age_group') || 'none'}
                  onValueChange={(v) =>
                    form.setValue('age_group', v === 'none' ? '' : v, { shouldDirty: true })
                  }
                  disabled={!!editing}
                >
                  <SelectTrigger
                    className={editing ? 'bg-muted text-muted-foreground cursor-not-allowed' : ''}
                  >
                    <SelectValue placeholder="Chọn khối" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Chưa phân khối —</SelectItem>
                    <SelectItem value="Nhà trẻ">Nhà trẻ</SelectItem>
                    <SelectItem value="Mầm">Mầm</SelectItem>
                    <SelectItem value="Chồi">Chồi</SelectItem>
                    <SelectItem value="Lá">Lá</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Phòng</Label>
                <Input {...form.register('room')} />
              </div>
            </div>
            {editing ? (
              <div className="border-t pt-3 space-y-2">
                <Label>Giáo viên</Label>
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">
                          Họ tên
                        </th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">
                          Chức vụ
                        </th>
                        {isBGH && <th className="w-8" />}
                      </tr>
                    </thead>
                    <tbody>
                      {classTeachers.length === 0 ? (
                        <tr>
                          <td
                            colSpan={isBGH ? 3 : 2}
                            className="px-3 py-3 text-xs text-muted-foreground text-center"
                          >
                            Chưa có giáo viên
                          </td>
                        </tr>
                      ) : (
                        classTeachers.map((t, i) => (
                          <tr
                            key={t.teacher_id}
                            className={i < classTeachers.length - 1 ? 'border-b' : ''}
                          >
                            <td className="px-3 py-2 font-medium">{t.full_name}</td>
                            <td className="px-3 py-2 text-muted-foreground">{t.position ?? '—'}</td>
                            {isBGH && (
                              <td className="px-2 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTeacher(t)}
                                  className="text-muted-foreground hover:text-destructive transition-colors"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {isBGH && (
                  <div className="flex gap-2">
                    <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Thêm giáo viên vào lớp..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(allTeachers ?? [])
                          .filter(
                            (t) =>
                              !t.deleted_at &&
                              t.work_status === 'Đang làm việc' &&
                              !classTeachers.some((ct) => ct.teacher_id === t.teacher_id),
                          )
                          .map((t) => (
                            <SelectItem key={t.teacher_id} value={String(t.account_id)}>
                              {t.full_name}
                              {t.position ? ` — ${t.position}` : ''}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleAddTeacher}
                      disabled={!selectedTeacherId}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="border-t pt-3">
                <p className="text-xs text-muted-foreground">
                  Phân công giáo viên sau khi tạo lớp xong.
                </p>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Hủy
              </Button>
              <Button
                type="submit"
                disabled={
                  create.isPending ||
                  update.isPending ||
                  (!!editing && !form.formState.isDirty && !teachersDirty)
                }
              >
                {editing ? 'Cập nhật' : 'Tạo'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        title="Lưu trữ lớp?"
        description="Lớp sẽ bị ẩn khỏi danh sách. Chỉ lưu trữ được khi không còn học sinh."
        variant="destructive"
        confirmLabel="Lưu trữ"
        loading={del.isPending}
        onConfirm={async () => {
          if (deleting) {
            await del.mutateAsync(deleting.class_id);
            setDeleting(null);
          }
        }}
      />

      {/* Archive dialog */}
      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Lớp đã lưu trữ</DialogTitle>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto space-y-2">
            {archivedLoading && (
              <p className="text-sm text-muted-foreground text-center py-4">Đang tải...</p>
            )}
            {!archivedLoading && (!archivedData || archivedData.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Không có lớp nào đã lưu trữ
              </p>
            )}
            {archivedData?.map((c) => (
              <div
                key={c.class_id}
                className="flex items-center justify-between px-3 py-2 rounded-md border bg-muted/30"
              >
                <div>
                  <p className="text-sm font-medium">{c.class_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.age_group ?? ''} · {c.school_year?.name ?? ''}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => handleRestore(c.class_id)}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Khôi phục
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <ImportPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title="Xem trước nhập lớp"
        columns={[
          { key: 'class_name', label: 'Tên lớp' },
          { key: 'year_name', label: 'Năm học' },
          { key: 'age_group', label: 'Khối' },
          { key: 'room', label: 'Phòng' },
        ]}
        preview={importPreview}
        loading={previewLoading}
        confirming={confirming}
        onConfirm={handleConfirmImport}
      />
    </>
  );
}
