import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus,
  Pencil,
  Trash2,
  Upload,
  Download,
  Search,
  Archive,
  ArchiveRestore,
  MoreHorizontal,
  FileDown,
  FileSpreadsheet,
} from 'lucide-react';
import { useTableSort } from '@/shared/hooks/use-table-sort.jsx';
import { ColumnToggle } from '@/shared/components/column-toggle';
import { ImportPreviewDialog } from '@/shared/components/import-preview-dialog';
import { fmtDate } from '@/shared/utils/date';
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
import { useCreate, useDelete, useList, useUpdate } from '@/shared/hooks/use-crud';
import { useColumnSettings } from '@/shared/hooks/use-column-settings';
import { apiClient } from '@/shared/api/client';
import { useAuthStore } from '@/shared/stores/auth.store';
import { useYearStore } from '@/shared/stores/year.store';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const WORK_STATUS_OPTIONS = [
  'Đang làm việc',
  'Chuyển đến',
  'Đã chuyển đi',
  'Đã điều động',
  'Chờ nghỉ hưu',
  'Đã nghỉ hưu',
  'Đã biệt phái',
  'Thôi việc',
];

const createSchema = z.object({
  full_name: z.string().min(1),
  email: z.string().email(),
  position: z.string().min(1, 'Bắt buộc'),
  phone: z.string().optional(),
  date_of_birth: z.string().optional(),
  gender: z.enum(['Nam', 'Nữ', 'Khác']).optional(),
  address: z.string().optional(),
  work_start_date: z.string().optional(),
  qualification: z.string().optional(),
  work_status: z.string().optional(),
});

const updateSchema = z.object({
  full_name: z.string().min(1),
  email: z.string().email(),
  position: z.string().min(1, 'Bắt buộc'),
  phone: z.string().optional(),
  date_of_birth: z.string().optional(),
  gender: z.enum(['Nam', 'Nữ', 'Khác']).optional(),
  address: z.string().optional(),
  work_start_date: z.string().optional(),
  qualification: z.string().optional(),
  work_status: z.string().optional(),
});

function unwrap(d) {
  const r = d;
  if (r?.data && typeof r.data === 'object' && 'data' in r.data) return r.data.data;
  return r?.data ?? d;
}

export function TeachersPage() {
  const role = useAuthStore((s) => s.user?.role);
  const isBGH = role === 'PRINCIPAL';
  const selectedYearId = useYearStore((s) => s.selectedYearId);
  const qc = useQueryClient();
  const importInputRef = useRef();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const SORT_FIELD = {
    name: 'full_name',
    position: 'position',
    work_status: 'work_status',
    email: 'email',
    phone: 'phone',
    gender: 'gender',
    dob: 'date_of_birth',
    qualification: 'qualification',
    work_start: 'work_start_date',
  };

  const COLS = [
    { key: 'name', label: 'Họ tên' },
    { key: 'position', label: 'Chức vụ' },
    { key: 'work_status', label: 'Trạng thái' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'SĐT' },
    { key: 'gender', label: 'Giới tính' },
    { key: 'dob', label: 'Ngày sinh' },
    { key: 'qualification', label: 'Trình độ' },
    { key: 'work_start', label: 'Ngày vào làm' },
  ];
  const COL_KEYS = COLS.map((c) => c.key);
  const {
    hidden: hiddenCols,
    setHidden: setHiddenCols,
    order: colOrder,
    setOrder: setColOrder,
  } = useColumnSettings('col:staff-hr', COL_KEYS);
  const orderedCols = colOrder.map((k) => COLS.find((c) => c.key === k)).filter(Boolean);
  const show = (k) => !hiddenCols.has(k);

  const COL_HEADER = {
    name: 'Họ tên',
    position: 'Chức vụ',
    work_status: 'Trạng thái',
    email: 'Email',
    phone: 'SĐT',
    gender: 'Giới tính',
    dob: 'Ngày sinh',
    qualification: 'Trình độ',
    work_start: 'Ngày vào làm',
  };
  const renderCell = (key, t) => {
    switch (key) {
      case 'name':
        return (
          <TableCell key={key} className="font-medium">
            {t.full_name}
          </TableCell>
        );
      case 'position':
        return <TableCell key={key}>{t.position ?? '—'}</TableCell>;
      case 'work_status':
        return (
          <TableCell key={key}>
            <span
              className={
                (t.work_status ?? 'Đang làm việc') === 'Đang làm việc'
                  ? 'text-green-700'
                  : 'text-muted-foreground'
              }
            >
              {t.work_status ?? 'Đang làm việc'}
            </span>
          </TableCell>
        );
      case 'email':
        return <TableCell key={key}>{t.email}</TableCell>;
      case 'phone':
        return <TableCell key={key}>{t.phone ?? '—'}</TableCell>;
      case 'gender':
        return <TableCell key={key}>{t.gender ?? '—'}</TableCell>;
      case 'dob':
        return <TableCell key={key}>{fmtDate(t.date_of_birth)}</TableCell>;
      case 'qualification':
        return <TableCell key={key}>{t.qualification ?? '—'}</TableCell>;
      case 'work_start':
        return <TableCell key={key}>{fmtDate(t.work_start_date)}</TableCell>;
      default:
        return null;
    }
  };

  const { data, isLoading } = useList('teachers', '/teachers', {
    page,
    pageSize: 20,
    search: search || undefined,
    school_year_id: selectedYearId ?? undefined,
  });

  const { sortedRows, toggleSort, SortIcon } = useTableSort(data?.data, SORT_FIELD);

  const { data: archivedData, isLoading: archivedLoading } = useQuery({
    queryKey: ['teachers-archived'],
    queryFn: async () => {
      const res = await apiClient.get('/teachers/archived', { params: { pageSize: 200 } });
      return res.data?.data ?? [];
    },
    enabled: archiveOpen,
  });

  const create = useCreate('teachers', '/teachers');
  const update = useUpdate('teachers', '/teachers');
  const del = useDelete('teachers', '/teachers');

  const restore = useMutation({
    mutationFn: (id) => apiClient.patch(`/teachers/${id}/restore`),
    onSuccess: () => {
      toast.success('Đã khôi phục cán bộ');
      qc.invalidateQueries({ queryKey: ['teachers'] });
      qc.invalidateQueries({ queryKey: ['teachers-archived'] });
    },
  });

  const createForm = useForm({ resolver: zodResolver(createSchema) });
  const updateForm = useForm({ resolver: zodResolver(updateSchema) });

  const onOpenCreate = () => {
    createForm.reset({
      full_name: '',
      email: '',
      position: '',
      phone: '',
      date_of_birth: '',
      gender: undefined,
      address: '',
      work_start_date: '',
      qualification: '',
      work_status: 'Đang làm việc',
    });
    setCreateOpen(true);
  };

  const onOpenEdit = (t) => {
    setEditing(t);
    updateForm.reset({
      full_name: t.full_name,
      email: t.email,
      position: t.position ?? 'Giáo viên',
      phone: t.phone ?? '',
      date_of_birth: t.date_of_birth ? t.date_of_birth.slice(0, 10) : '',
      gender: t.gender ?? undefined,
      address: t.address ?? '',
      work_start_date: t.work_start_date ? t.work_start_date.slice(0, 10) : '',
      qualification: t.qualification ?? '',
      work_status: t.work_status ?? 'Đang làm việc',
    });
    setEditOpen(true);
  };

  const onCreateSubmit = async (v) => {
    await create.mutateAsync(v);
    setCreateOpen(false);
    toast.info('Tạo cán bộ xong. Sang trang Tài khoản để cấp role + mật khẩu.');
  };

  const onUpdateSubmit = async (v) => {
    if (editing) {
      await update.mutateAsync({ id: editing.teacher_id, data: v });
      setEditOpen(false);
    }
  };

  const handleExport = async () => {
    const res = await apiClient.get('/teachers/export/excel', { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `can_bo_${Date.now()}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadTemplate = async () => {
    const res = await apiClient.get('/teachers/import/template', { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mau_nhap_can_bo.xlsx';
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
      const res = await apiClient.post('/teachers/import/preview', fd);
      setImportPreview(res.data?.data ?? res.data);
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
      const res = await apiClient.post('/teachers/import', fd);
      const r = res.data?.data ?? res.data;
      toast.success(`Nhập xong: ${r.success_count} thành công, ${r.error_count} lỗi`);
      qc.invalidateQueries({ queryKey: ['teachers'] });
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
      <PageHeader
        title="Cán bộ"
        description="Hồ sơ cán bộ giáo viên. Cấp tài khoản ở trang Tài khoản."
      />

      <div className="flex gap-2 mb-4 flex-wrap items-center">
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
              placeholder="Tìm tên / email / SĐT"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <Button type="submit" variant="secondary">
            Tìm
          </Button>
        </form>
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
            title="Cán bộ đã lưu trữ"
            onClick={() => {
              setArchiveOpen(true);
              qc.invalidateQueries({ queryKey: ['teachers-archived'] });
            }}
          >
            <Archive className="h-4 w-4" />
          </Button>
        )}
        {isBGH && (
          <Button size="sm" onClick={onOpenCreate}>
            <Plus className="h-4 w-4 mr-1.5" /> Tạo cán bộ
          </Button>
        )}
      </div>

      <div className="bg-card rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {orderedCols
                .filter((c) => show(c.key))
                .map((c) => (
                  <TableHead
                    key={c.key}
                    className={
                      SORT_FIELD[c.key] ? 'cursor-pointer select-none hover:bg-muted/50' : ''
                    }
                    onClick={() => toggleSort(c.key)}
                  >
                    <span className="inline-flex items-center">
                      {COL_HEADER[c.key]}
                      {SORT_FIELD[c.key] && <SortIcon colKey={c.key} />}
                    </span>
                  </TableHead>
                ))}
              {isBGH && <TableHead className="text-right">Thao tác</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell
                  colSpan={orderedCols.filter((c) => show(c.key)).length + 1}
                  className="text-center py-8 text-muted-foreground"
                >
                  Đang tải...
                </TableCell>
              </TableRow>
            )}
            {sortedRows.map((t) => (
              <TableRow key={t.teacher_id} className={t.deleted_at ? 'opacity-50' : ''}>
                {orderedCols.filter((c) => show(c.key)).map((c) => renderCell(c.key, t))}
                {isBGH && (
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        {t.deleted_at ? (
                          <DropdownMenuItem onClick={() => restore.mutate(t.teacher_id)}>
                            <ArchiveRestore className="h-4 w-4 mr-2 text-primary" />
                            Khôi phục
                          </DropdownMenuItem>
                        ) : (
                          <>
                            <DropdownMenuItem onClick={() => onOpenEdit(t)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Chỉnh sửa
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleting(t)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Lưu trữ
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {data && (
        <DataPagination
          page={data.meta.page}
          pageSize={data.meta.pageSize}
          total={data.meta.total}
          totalPages={data.meta.totalPages}
          onPageChange={setPage}
        />
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tạo cán bộ mới</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={createForm.handleSubmit(onCreateSubmit)}
            className="space-y-4 max-h-[75vh] overflow-y-auto pr-1"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>
                  Họ tên <span className="text-destructive">*</span>
                </Label>
                <Input {...createForm.register('full_name')} />
              </div>
              <div>
                <Label>
                  Chức vụ <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="Giáo viên, Hiệu trưởng..."
                  {...createForm.register('position')}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>
                  Email <span className="text-destructive">*</span>
                </Label>
                <Input type="email" {...createForm.register('email')} />
              </div>
              <div>
                <Label>SĐT</Label>
                <Input {...createForm.register('phone')} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Ngày sinh</Label>
                <Input type="date" {...createForm.register('date_of_birth')} />
              </div>
              <div>
                <Label>Giới tính</Label>
                <Select
                  value={createForm.watch('gender') ?? ''}
                  onValueChange={(v) => createForm.setValue('gender', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Nam">Nam</SelectItem>
                    <SelectItem value="Nữ">Nữ</SelectItem>
                    <SelectItem value="Khác">Khác</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Trình độ</Label>
                <Input {...createForm.register('qualification')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Ngày vào làm</Label>
                <Input type="date" {...createForm.register('work_start_date')} />
              </div>
              <div>
                <Label>Địa chỉ</Label>
                <Input {...createForm.register('address')} />
              </div>
            </div>
            <div>
              <Label>Trạng thái công tác</Label>
              <Select
                value={createForm.watch('work_status') || 'Đang làm việc'}
                onValueChange={(v) => createForm.setValue('work_status', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORK_STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" disabled={create.isPending}>
                Tạo cán bộ
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Cập nhật cán bộ</DialogTitle>
          </DialogHeader>
          {editing && (
            <form
              onSubmit={updateForm.handleSubmit(onUpdateSubmit)}
              className="space-y-4 max-h-[75vh] overflow-y-auto pr-1"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>
                    Họ tên <span className="text-destructive">*</span>
                  </Label>
                  <Input {...updateForm.register('full_name')} />
                </div>
                <div>
                  <Label>
                    Chức vụ <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder="Giáo viên, Hiệu trưởng..."
                    {...updateForm.register('position')}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>
                    Email <span className="text-destructive">*</span>
                  </Label>
                  <Input type="email" {...updateForm.register('email')} />
                </div>
                <div>
                  <Label>SĐT</Label>
                  <Input {...updateForm.register('phone')} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Ngày sinh</Label>
                  <Input type="date" {...updateForm.register('date_of_birth')} />
                </div>
                <div>
                  <Label>Giới tính</Label>
                  <Select
                    value={updateForm.watch('gender') ?? ''}
                    onValueChange={(v) => updateForm.setValue('gender', v, { shouldDirty: true })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Nam">Nam</SelectItem>
                      <SelectItem value="Nữ">Nữ</SelectItem>
                      <SelectItem value="Khác">Khác</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Trình độ</Label>
                  <Input {...updateForm.register('qualification')} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Ngày vào làm</Label>
                  <Input type="date" {...updateForm.register('work_start_date')} />
                </div>
                <div>
                  <Label>Địa chỉ</Label>
                  <Input {...updateForm.register('address')} />
                </div>
              </div>
              <div>
                <Label>Trạng thái công tác</Label>
                <Select
                  value={updateForm.watch('work_status') || 'Đang làm việc'}
                  onValueChange={(v) =>
                    updateForm.setValue('work_status', v, { shouldDirty: true })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WORK_STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                  Hủy
                </Button>
                <Button type="submit" disabled={update.isPending || !updateForm.formState.isDirty}>
                  Cập nhật
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        title="Xóa cán bộ?"
        description="Hồ sơ + tài khoản bị xóa mềm. Lớp được unassign."
        variant="destructive"
        confirmLabel="Xóa"
        loading={del.isPending}
        onConfirm={async () => {
          if (deleting) {
            await del.mutateAsync(deleting.teacher_id);
            setDeleting(null);
          }
        }}
      />

      {/* Archive modal */}
      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Cán bộ đã lưu trữ</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Họ tên</TableHead>
                  <TableHead>Chức vụ</TableHead>
                  <TableHead>Email</TableHead>
                  {isBGH && <TableHead className="text-right">Thao tác</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {archivedLoading && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                      Đang tải...
                    </TableCell>
                  </TableRow>
                )}
                {!archivedLoading && (!archivedData || archivedData.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                      Không có cán bộ nào được lưu trữ
                    </TableCell>
                  </TableRow>
                )}
                {archivedData?.map((t) => (
                  <TableRow key={t.teacher_id}>
                    <TableCell className="font-medium">{t.full_name}</TableCell>
                    <TableCell>{t.position ?? '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{t.email}</TableCell>
                    {isBGH && (
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => restore.mutate(t.teacher_id)}
                          disabled={restore.isPending}
                        >
                          <ArchiveRestore className="h-4 w-4 mr-2" /> Khôi phục
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <ImportPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title="Xem trước nhập cán bộ"
        columns={[
          { key: 'full_name', label: 'Họ tên' },
          { key: 'email', label: 'Email' },
          { key: 'position', label: 'Chức vụ' },
          { key: 'phone', label: 'SĐT' },
          { key: 'gender', label: 'Giới tính' },
          { key: 'qualification', label: 'Trình độ' },
        ]}
        preview={importPreview}
        loading={previewLoading}
        confirming={confirming}
        onConfirm={handleConfirmImport}
      />
    </>
  );
}
