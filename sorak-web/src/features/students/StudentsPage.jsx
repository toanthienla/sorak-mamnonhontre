import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, Upload, Download, Search, Archive, ArchiveRestore, MoreHorizontal, X } from 'lucide-react';
import { ColumnToggle } from '@/shared/components/column-toggle';
import { fmtDate } from '@/shared/utils/date';
import { cloudinaryThumb } from '@/shared/utils/image';
import { useTableSort } from '@/shared/hooks/use-table-sort.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ImageCropDialog } from '@/shared/components/image-crop-dialog';
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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageHeader } from '@/shared/components/page-header';
import { DataPagination } from '@/shared/components/data-pagination';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { useCreate, useDelete, useList, useUpdate } from '@/shared/hooks/use-crud';
import { useColumnSettings } from '@/shared/hooks/use-column-settings';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/client';
import { useAuthStore } from '@/shared/stores/auth.store';
import { useYearStore } from '@/shared/stores/year.store';
import { toast } from 'sonner';

const createSchema = z.object({
  full_name: z.string().min(1),
  date_of_birth: z.string().min(1),
  gender: z.enum(['Nam', 'Nữ']),
  grade_level: z.string().optional(),
  enrollment_date: z.string().optional(),
  ethnicity: z.string().optional(),
  nationality: z.string().optional(),
  religion: z.string().optional(),
  blood_type: z.string().optional(),
  birth_place: z.string().optional(),
  permanent_province: z.string().optional(),
  permanent_ward: z.string().optional(),
  permanent_address_detail: z.string().optional(),
  current_address: z.string().optional(),
  hometown_province: z.string().optional(),
  hometown_ward: z.string().optional(),
  photo_url: z.string().optional(),
  class_id: z.number().int().optional(),
  parent_name: z.string().optional(),
  parent_relationship: z.string().optional(),
  parent_phone: z.string().optional(),
});

const STUDENT_STATUS_OPTIONS = [
  'Đang học',
  'Chuyển đến kỳ 1', 'Nghỉ học xin học lại kỳ 1', 'Chuyển đi kỳ 1', 'Thôi học kỳ 1',
  'Chuyển đến kỳ 2', 'Nghỉ học xin học lại kỳ 2', 'Chuyển đi kỳ 2', 'Thôi học kỳ 2',
  'Chuyển đến trong hè', 'Chuyển đi trong hè', 'Thôi học trong hè',
];

const updateSchema = z.object({
  full_name: z.string().min(1),
  date_of_birth: z.string().min(1),
  gender: z.enum(['Nam', 'Nữ']),
  grade_level: z.string().optional(),
  student_status: z.string().optional(),
  enrollment_date: z.string().optional(),
  ethnicity: z.string().optional(),
  nationality: z.string().optional(),
  religion: z.string().optional(),
  blood_type: z.string().optional(),
  birth_place: z.string().optional(),
  permanent_province: z.string().optional(),
  permanent_ward: z.string().optional(),
  permanent_address_detail: z.string().optional(),
  current_address: z.string().optional(),
  hometown_province: z.string().optional(),
  hometown_ward: z.string().optional(),
  photo_url: z.string().optional(),
});

function unwrap(d) {
  const r = d;
  if (r?.data && typeof r.data === 'object' && 'data' in r.data) return r.data.data;
  return r?.data ?? d;
}

export function StudentsPage() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  const isBGH = role === 'BGH';
  const isGV = role === 'GV';
  const isStaff = isBGH || isGV;
  const selectedYearId = useYearStore((s) => s.selectedYearId);
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [classFilter, setClassFilter] = useState(searchParams.get('class_id') ?? 'all');

  // sync class filter when arriving from Classes page link
  useEffect(() => {
    const cid = searchParams.get('class_id');
    if (cid) {
      setClassFilter(cid);
      setPage(1);
    }
  }, [searchParams]);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const COLS = [
    { key: 'photo', label: 'Ảnh' },
    { key: 'card', label: 'Mã thẻ' },
    { key: 'name', label: 'Họ tên' },
    { key: 'dob', label: 'Ngày sinh' },
    { key: 'gender', label: 'Giới tính' },
    { key: 'grade', label: 'Khối' },
    { key: 'class', label: 'Lớp' },
    { key: 'student_status', label: 'Học vụ' },
    { key: 'parent_phone', label: 'SĐT phụ huynh' },
    { key: 'enrollment_date', label: 'Ngày nhập học' },
    { key: 'birth_place', label: 'Nơi sinh' },
    { key: 'ethnicity', label: 'Dân tộc' },
    { key: 'nationality', label: 'Quốc tịch' },
    { key: 'religion', label: 'Tôn giáo' },
    { key: 'blood_type', label: 'Nhóm máu' },
    { key: 'current_address', label: 'Địa chỉ hiện tại' },
  ];
  const COL_KEYS = COLS.map((c) => c.key);
  const { hidden: hiddenCols, setHidden: setHiddenCols, order: colOrder, setOrder: setColOrder } =
    useColumnSettings('col:students', COL_KEYS);
  const orderedCols = colOrder.map((k) => COLS.find((c) => c.key === k)).filter(Boolean);
  const show = (key) => !hiddenCols.has(key);

  const { data: classes, isLoading: classesLoading } = useList('classes', '/classes', {
    page: 1,
    pageSize: 100,
    school_year_id: selectedYearId ?? undefined,
  });

  const { data: rawStudentData, isLoading } = useList('students', '/students', {
    page,
    pageSize: 20,
    search: search || undefined,
    school_year_id: selectedYearId ?? undefined,
    class_id: classFilter !== 'all' ? Number(classFilter) : undefined,
  });

  const data = rawStudentData;

  const STU_SORT_FIELD = {
    card: 'student_id_card_number', name: 'full_name', dob: 'date_of_birth',
    gender: 'gender', grade: 'grade_level', student_status: 'student_status',
    enrollment_date: 'enrollment_date', birth_place: 'birth_place',
    ethnicity: 'ethnicity', nationality: 'nationality',
    religion: 'religion', blood_type: 'blood_type',
  };
  const { sortedRows: sortedStudents, toggleSort: toggleStuSort, SortIcon: StuSortIcon } =
    useTableSort(data?.data, STU_SORT_FIELD);

  const { data: archivedData, isLoading: archivedLoading } = useQuery({
    queryKey: ['students-archived'],
    queryFn: async () => {
      const res = await apiClient.get('/students/archived', { params: { pageSize: 200 } });
      return res.data?.data ?? [];
    },
    enabled: archiveOpen,
  });

  const create = useCreate('students', '/students');
  const update = useUpdate('students', '/students');
  const del = useDelete('students', '/students');

  // Photo upload state
  const [editPhotoFile, setEditPhotoFile] = useState(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState(null);
  const [createPhotoFile, setCreatePhotoFile] = useState(null);
  const [createPhotoPreview, setCreatePhotoPreview] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const editPhotoRef = useRef();
  const createPhotoRef = useRef();

  const [editParents, setEditParents] = useState([]);
  const [createContacts, setCreateContacts] = useState([{ full_name: '', relationship: '', phone: '' }]);

  // Crop state
  const [cropSrc, setCropSrc] = useState(null);
  const [cropTarget, setCropTarget] = useState(null);

  // Compress image before crop: resize to max 1200px, JPEG 85% — avoids canvas lag on large files
  const compressImage = (file) =>
    new Promise((resolve) => {
      const img = new Image();
      const objUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objUrl);
        const MAX = 1200;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
          else { width = Math.round(width * MAX / height); height = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })),
          'image/jpeg', 0.85,
        );
      };
      img.src = objUrl;
    });

  const pickPhoto = async (file, mode) => {
    if (!file) return;
    const compressed = await compressImage(file);
    const url = URL.createObjectURL(compressed);
    setCropSrc(url);
    setCropTarget({ mode, fileName: compressed.name });
  };

  const onCropConfirm = (file, url) => {
    if (cropTarget?.mode === 'edit') {
      setEditPhotoFile(file);
      setEditPhotoPreview(url);
    } else {
      setCreatePhotoFile(file);
      setCreatePhotoPreview(url);
    }
    setCropSrc(null);
    setCropTarget(null);
  };

  const onCropCancel = () => {
    setCropSrc(null);
    setCropTarget(null);
  };

  const uploadPhoto = async (studentId, file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('photo', file);
    try {
      await apiClient.post(`/students/${studentId}/photo`, fd);
      queryClient.invalidateQueries({ queryKey: ['students'] });
    } catch (e) {
      console.error('Upload photo failed:', e?.response?.data?.message ?? e.message);
      toast.error('Tải ảnh thất bại');
    }
  };

  const restore = useMutation({
    mutationFn: (id) => apiClient.patch(`/students/${id}/restore`),
    onSuccess: () => {
      toast.success('Đã khôi phục học sinh');
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });

const createForm = useForm({ resolver: zodResolver(createSchema) });
  const updateForm = useForm({ resolver: zodResolver(updateSchema) });

  const onOpenCreate = () => {
    createForm.reset({
      full_name: '',
      date_of_birth: '',
      gender: 'Nam',
      grade_level: '',
      enrollment_date: '',
      ethnicity: '',
      nationality: '',
      religion: '',
      blood_type: '',
      birth_place: '',
      permanent_province: '',
      permanent_ward: '',
      permanent_address_detail: '',
      current_address: '',
      hometown_province: '',
      hometown_ward: '',
      photo_url: '',
      parent_name: '',
      parent_relationship: '',
      parent_phone: '',
    });
    setCreatePhotoFile(null);
    setCreatePhotoPreview(null);
    setCreateContacts([{ full_name: '', relationship: '', phone: '' }]);
    setCreateOpen(true);
  };

  const onOpenEdit = (s) => {
    setEditing(s);
    setEditPhotoFile(null);
    setEditPhotoPreview(s.photo_url ?? null);
    setEditParents(s.parents?.map((p) => ({ ...p })) ?? []);
    updateForm.reset({
      full_name: s.full_name,
      date_of_birth: s.date_of_birth?.slice(0, 10) ?? '',
      gender: s.gender,
      grade_level: s.grade_level ?? '',
      student_status: s.student_status ?? 'Đang học',
      enrollment_date: s.enrollment_date ? s.enrollment_date.slice(0, 10) : '',
      ethnicity: s.ethnicity ?? '',
      nationality: s.nationality ?? '',
      religion: s.religion ?? '',
      blood_type: s.blood_type ?? '',
      birth_place: s.birth_place ?? '',
      permanent_province: s.permanent_province ?? '',
      permanent_ward: s.permanent_ward ?? '',
      permanent_address_detail: s.permanent_address_detail ?? '',
      current_address: s.current_address ?? '',
      hometown_province: s.hometown_province ?? '',
      hometown_ward: s.hometown_ward ?? '',
      photo_url: s.photo_url ?? '',
    });
    setEditOpen(true);
  };

  const onCreateSubmit = async (v) => {
    const { parent_name, parent_relationship, parent_phone, ...rest } = v;
    // Validate: mọi row phụ huynh có full_name phải có SĐT
    const filledContacts = createContacts.filter((c) => c.full_name.trim() || c.phone.trim());
    const missingPhone = filledContacts.some((c) => !c.phone.trim());
    if (missingPhone) { toast.error('Vui lòng nhập số điện thoại cho tất cả phụ huynh'); return; }
    const payload = { ...rest };
    const validContacts = filledContacts.filter((c) => c.full_name.trim());
    if (validContacts.length > 0) {
      payload.parents = validContacts.map((c) => ({
        full_name: c.full_name,
        relationship: c.relationship || undefined,
        phone: c.phone.trim(),
      }));
    }
    const res = await create.mutateAsync(payload);
    const newId = res?.data?.student_id ?? res?.student_id;
    setCreateOpen(false);
    if (newId && createPhotoFile) uploadPhoto(newId, createPhotoFile); // background, toast on fail
  };

  const onUpdateSubmit = async (v) => {
    if (editing) {
      // Validate: mọi phụ huynh có tên phải có SĐT
      const missingPhone = editParents.some((p) => (p.full_name?.trim() || p._new) && !p.phone?.trim());
      if (missingPhone) { toast.error('Vui lòng nhập số điện thoại cho tất cả phụ huynh'); return; }

      const { photo_url, ...profileData } = v;
      // Run profile save + parent updates in parallel
      const parentUpdates = editParents.map((p) => {
        if (p._new && p.full_name?.trim()) {
          return apiClient.post(`/students/${editing.student_id}/parents`, {
            full_name: p.full_name, relationship: p.relationship || undefined,
            phone: p.phone.trim(),
          }).catch(() => {});
        } else if (p.parent_id) {
          return apiClient.patch(`/students/parents/${p.parent_id}`, {
            full_name: p.full_name, phone: p.phone, relationship: p.relationship,
          }).catch(() => {});
        }
        return null;
      }).filter(Boolean);

      await Promise.all([
        update.mutateAsync({ id: editing.student_id, data: profileData }),
        ...parentUpdates,
      ]);

      setEditOpen(false); // close modal immediately after data saved
      if (editPhotoFile) uploadPhoto(editing.student_id, editPhotoFile); // upload in background
    }
  };

  const handleExport = async () => {
    const params = {};
    if (selectedYearId) params.school_year_id = selectedYearId;
    if (classFilter !== 'all') params.class_id = classFilter;
    const res = await apiClient.get('/students/export/excel', { params, responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `students_${Date.now()}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await apiClient.post('/students/import', fd);
      const r = unwrap(res.data);
      toast.success(`${r.success_count} tạo, ${r.error_count} lỗi`);
    } catch {
      // toast handled
    }
  };

  return (
    <>
      <PageHeader
        title="Học sinh"
        description="Hồ sơ học sinh"
        actions={<>
          <ColumnToggle columns={COLS} hidden={hiddenCols} onHiddenChange={setHiddenCols} order={colOrder} onOrderChange={setColOrder} />
          <Button variant="outline" size="icon" title="Xuất Excel" onClick={handleExport}>
            <Download className="h-4 w-4" />
          </Button>
          {isBGH && (
            <label title="Nhập Excel">
              <input type="file" accept=".xlsx" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = ''; }} />
              <Button variant="outline" size="icon" asChild>
                <span><Upload className="h-4 w-4" /></span>
              </Button>
            </label>
          )}
          {isBGH && (
            <Button variant="outline" size="icon" title="Học sinh đã lưu trữ" onClick={() => setArchiveOpen(true)}>
              <Archive className="h-4 w-4" />
            </Button>
          )}
          {isBGH && (
            <Button size="sm" onClick={onOpenCreate}>
              <Plus className="h-4 w-4 mr-1.5" /> Tạo học sinh
            </Button>
          )}
        </>}
      />

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
              placeholder="Tìm tên / mã thẻ"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <Button type="submit" variant="secondary">Tìm</Button>
        </form>
        <Select
          value={classFilter}
          onValueChange={(v) => {
            setClassFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Lớp" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả lớp</SelectItem>
            {classes?.data.map((c) => (
              <SelectItem key={c.class_id} value={String(c.class_id)}>
                {c.class_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {orderedCols.filter((c) => show(c.key)).map((c) => (
                <TableHead
                  key={c.key}
                  className={STU_SORT_FIELD[c.key] ? 'cursor-pointer select-none hover:bg-muted/50' : ''}
                  onClick={() => toggleStuSort(c.key)}
                >
                  {c.label}<StuSortIcon colKey={c.key} />
                </TableHead>
              ))}
              {isBGH && <TableHead className="text-right">Thao tác</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={orderedCols.filter((c) => show(c.key)).length + 1} className="text-center py-8 text-muted-foreground">
                  Đang tải...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && !data?.data?.length && (
              <TableRow>
                <TableCell colSpan={orderedCols.filter((c) => show(c.key)).length + 1} className="text-center py-10 text-muted-foreground">
                  Chưa có học sinh
                </TableCell>
              </TableRow>
            )}
            {sortedStudents.map((s) => {
              const sc = s.student_classes[0];
              const renderStudentCell = (key) => {
                switch (key) {
                  case 'photo': return (
                    <TableCell key={key}>
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={cloudinaryThumb(s.photo_url, 80) ?? undefined} />
                        <AvatarFallback className="text-xs">{s.full_name.split(' ').slice(-1)[0]?.[0] ?? '?'}</AvatarFallback>
                      </Avatar>
                    </TableCell>
                  );
                  case 'card': return <TableCell key={key} className="font-medium">{s.student_id_card_number}</TableCell>;
                  case 'name': return <TableCell key={key}>{s.full_name}</TableCell>;
                  case 'dob': return <TableCell key={key}>{fmtDate(s.date_of_birth)}</TableCell>;
                  case 'gender': return <TableCell key={key}>{s.gender}</TableCell>;
                  case 'grade': return <TableCell key={key}>{s.grade_level ?? '—'}</TableCell>;
                  case 'class': return <TableCell key={key}>{sc?.class.class_name ?? '—'}</TableCell>;
                  case 'student_status': return <TableCell key={key}>{s.student_status ?? 'Đang học'}</TableCell>;
                  case 'parent_phone': return (
                    <TableCell key={key}>
                      <div className="space-y-0.5">
                        {s.parents?.filter((p) => p.phone).length > 0
                          ? s.parents.filter((p) => p.phone).map((p, i) => (
                              <div key={i} className="flex items-center gap-1.5">
                                <span className="text-xs text-muted-foreground w-12 shrink-0">{p.relationship ?? '—'}</span>
                                <span className="text-sm">{p.phone}</span>
                              </div>
                            ))
                          : <span className="text-muted-foreground">—</span>}
                      </div>
                    </TableCell>
                  );
                  case 'enrollment_date': return <TableCell key={key}>{fmtDate(s.enrollment_date)}</TableCell>;
                  case 'birth_place': return <TableCell key={key}>{s.birth_place ?? '—'}</TableCell>;
                  case 'ethnicity': return <TableCell key={key}>{s.ethnicity ?? '—'}</TableCell>;
                  case 'nationality': return <TableCell key={key}>{s.nationality ?? '—'}</TableCell>;
                  case 'religion': return <TableCell key={key}>{s.religion ?? '—'}</TableCell>;
                  case 'blood_type': return <TableCell key={key}>{s.blood_type ?? '—'}</TableCell>;
                  case 'current_address': return <TableCell key={key}>{s.current_address ?? '—'}</TableCell>;
                  default: return null;
                }
              };
              return (
                <TableRow key={s.student_id} className={s.deleted_at ? 'opacity-50' : ''}>
                  {orderedCols.filter((c) => show(c.key)).map((c) => renderStudentCell(c.key))}
                  {isStaff && (
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          {s.deleted_at ? (
                            isBGH && (
                              <DropdownMenuItem onClick={() => restore.mutate(s.student_id)} disabled={restore.isPending}>
                                <ArchiveRestore className="h-4 w-4 mr-2 text-primary" />
                                Khôi phục
                              </DropdownMenuItem>
                            )
                          ) : (
                            isBGH && (
                              <>
                                <DropdownMenuItem onClick={() => onOpenEdit(s)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Chỉnh sửa
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setDeleting(s)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Lưu trữ
                                </DropdownMenuItem>
                              </>
                            )
                          )}
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

      {data && (
        <DataPagination
          page={data.meta.page}
          pageSize={data.meta.pageSize}
          total={data.meta.total}
          totalPages={data.meta.totalPages}
          onPageChange={setPage}
        />
      )}

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Cập nhật hồ sơ học sinh</DialogTitle>
          </DialogHeader>
          {editing && (
            <form onSubmit={updateForm.handleSubmit(onUpdateSubmit)} className="space-y-3 max-h-[75vh] overflow-y-auto pr-2">
              <div>
                <Label>Mã thẻ HS</Label>
                <Input value={editing.student_id_card_number} disabled />
                <p className="text-xs text-muted-foreground mt-1">Không thể đổi mã thẻ</p>
              </div>
              <div>
                <Label>Họ tên <span className="text-destructive">*</span></Label>
                <Input {...updateForm.register('full_name')} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Ngày sinh <span className="text-destructive">*</span></Label>
                  <Input type="date" {...updateForm.register('date_of_birth')} />
                </div>
                <div>
                  <Label>Giới tính <span className="text-destructive">*</span></Label>
                  <Select
                    value={updateForm.watch('gender')}
                    onValueChange={(v) => updateForm.setValue('gender', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Nam">Nam</SelectItem>
                      <SelectItem value="Nữ">Nữ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Khối</Label>
                  <Select
                    value={updateForm.watch('grade_level') || 'none'}
                    onValueChange={(v) => updateForm.setValue('grade_level', v === 'none' ? '' : v)}
                  >
                    <SelectTrigger><SelectValue placeholder="Chọn khối" /></SelectTrigger>
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
                  <Label>Ngày nhập học</Label>
                  <Input type="date" {...updateForm.register('enrollment_date')} />
                </div>
              </div>
              <div>
                <Label>Tình trạng học vụ</Label>
                <Select
                  value={updateForm.watch('student_status') || 'Đang học'}
                  onValueChange={(v) => updateForm.setValue('student_status', v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STUDENT_STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Nơi sinh</Label>
                  <Input {...updateForm.register('birth_place')} />
                </div>
                <div>
                  <Label>Nhóm máu</Label>
                  <Input {...updateForm.register('blood_type')} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label>Dân tộc</Label>
                  <Input {...updateForm.register('ethnicity')} />
                </div>
                <div>
                  <Label>Quốc tịch</Label>
                  <Input {...updateForm.register('nationality')} />
                </div>
                <div>
                  <Label>Tôn giáo</Label>
                  <Input {...updateForm.register('religion')} />
                </div>
              </div>
              <div className="border-t pt-2 text-xs font-medium text-muted-foreground">Hộ khẩu thường trú</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Tỉnh/TP</Label>
                  <Input {...updateForm.register('permanent_province')} />
                </div>
                <div>
                  <Label>Phường/Xã</Label>
                  <Input {...updateForm.register('permanent_ward')} />
                </div>
              </div>
              <div>
                <Label>Địa chỉ chi tiết</Label>
                <Input {...updateForm.register('permanent_address_detail')} />
              </div>
              <div>
                <Label>Địa chỉ hiện tại</Label>
                <Input {...updateForm.register('current_address')} />
              </div>
              <div className="border-t pt-2 text-xs font-medium text-muted-foreground">Quê quán</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Tỉnh/TP</Label>
                  <Input {...updateForm.register('hometown_province')} />
                </div>
                <div>
                  <Label>Phường/Xã</Label>
                  <Input {...updateForm.register('hometown_ward')} />
                </div>
              </div>
              <div className="border-t pt-2 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Phụ huynh</span>
                <button type="button" className="text-xs text-primary hover:underline flex items-center gap-1"
                  onClick={() => setEditParents((arr) => [...arr, { full_name: '', relationship: '', phone: '', _new: true }])}>
                  <Plus className="h-3 w-3" /> Thêm
                </button>
              </div>
              {editParents.map((p, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
                  <div>
                    {i === 0 && <Label className="text-xs">Họ tên <span className="text-destructive">*</span></Label>}
                    <Input placeholder="Nguyễn Văn A" value={p.full_name ?? ''}
                      onChange={(e) => setEditParents((arr) => arr.map((x, j) => j === i ? { ...x, full_name: e.target.value } : x))} />
                  </div>
                  <div>
                    {i === 0 && <Label className="text-xs">Số điện thoại <span className="text-destructive">*</span></Label>}
                    <Input
                      placeholder="SĐT"
                      value={p.phone ?? ''}
                      onChange={(e) => setEditParents((arr) => arr.map((x, j) => j === i ? { ...x, phone: e.target.value } : x))}
                    />
                  </div>
                  <div>
                    {i === 0 && <Label className="text-xs">Quan hệ</Label>}
                    <Input placeholder="Cha / Mẹ" value={p.relationship ?? ''}
                      onChange={(e) => setEditParents((arr) => arr.map((x, j) => j === i ? { ...x, relationship: e.target.value } : x))} />
                  </div>
                  <button type="button" className="pb-1 text-muted-foreground hover:text-destructive transition-colors"
                    onClick={() => setEditParents((arr) => arr.filter((_, j) => j !== i))}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <div>
                <Label>Ảnh học sinh</Label>
                <button type="button" onClick={() => editPhotoRef.current?.click()}
                  className="mt-1 w-28 aspect-square border-2 border-dashed border-muted-foreground/25 rounded-xl overflow-hidden hover:border-primary/40 transition-colors group block">
                  {editPhotoPreview
                    ? <img src={editPhotoPreview} alt="" className="w-full h-full object-cover" />
                    : <div className="flex flex-col items-center justify-center w-full h-full gap-1 text-muted-foreground group-hover:text-foreground transition-colors">
                        <Upload className="h-4 w-4" />
                        <span className="text-[10px] text-center px-1">Chọn ảnh</span>
                      </div>
                  }
                </button>
                <input ref={editPhotoRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) pickPhoto(f, 'edit'); e.target.value = ''; }} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Hủy</Button>
                <Button type="submit" disabled={update.isPending}>Cập nhật</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Tạo hồ sơ học sinh mới</DialogTitle>
          </DialogHeader>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-3 max-h-[75vh] overflow-y-auto pr-2">
              <p className="text-xs text-muted-foreground">Mã thẻ HS sẽ tự động tạo sau khi lưu.</p>
              <div>
                <Label>Họ tên <span className="text-destructive">*</span></Label>
                <Input {...createForm.register('full_name')} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Ngày sinh <span className="text-destructive">*</span></Label>
                  <Input type="date" {...createForm.register('date_of_birth')} />
                </div>
                <div>
                  <Label>Giới tính <span className="text-destructive">*</span></Label>
                  <Select defaultValue="Nam" onValueChange={(v) => createForm.setValue('gender', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Nam">Nam</SelectItem>
                      <SelectItem value="Nữ">Nữ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Khối</Label>
                  <Select
                    value={createForm.watch('grade_level') || 'none'}
                    onValueChange={(v) => createForm.setValue('grade_level', v === 'none' ? '' : v)}
                  >
                    <SelectTrigger><SelectValue placeholder="Chọn khối" /></SelectTrigger>
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
                  <Label>Ngày nhập học</Label>
                  <Input type="date" {...createForm.register('enrollment_date')} />
                </div>
              </div>
              <div>
                <Label>Lớp (tùy chọn)</Label>
                <Select onValueChange={(v) => createForm.setValue('class_id', Number(v))}>
                  <SelectTrigger><SelectValue placeholder="Chọn lớp..." /></SelectTrigger>
                  <SelectContent>
                    {classes?.data.map((c) => (
                      <SelectItem key={c.class_id} value={String(c.class_id)}>
                        {c.class_name} ({c.school_year.name})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Nơi sinh</Label>
                  <Input {...createForm.register('birth_place')} />
                </div>
                <div>
                  <Label>Nhóm máu</Label>
                  <Input {...createForm.register('blood_type')} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label>Dân tộc</Label>
                  <Input {...createForm.register('ethnicity')} />
                </div>
                <div>
                  <Label>Quốc tịch</Label>
                  <Input {...createForm.register('nationality')} />
                </div>
                <div>
                  <Label>Tôn giáo</Label>
                  <Input {...createForm.register('religion')} />
                </div>
              </div>
              <div className="border-t pt-2 text-xs font-medium text-muted-foreground">Hộ khẩu thường trú</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Tỉnh/TP</Label>
                  <Input {...createForm.register('permanent_province')} />
                </div>
                <div>
                  <Label>Phường/Xã</Label>
                  <Input {...createForm.register('permanent_ward')} />
                </div>
              </div>
              <div>
                <Label>Địa chỉ chi tiết</Label>
                <Input {...createForm.register('permanent_address_detail')} />
              </div>
              <div>
                <Label>Địa chỉ hiện tại</Label>
                <Input {...createForm.register('current_address')} />
              </div>
              <div className="border-t pt-2 text-xs font-medium text-muted-foreground">Quê quán</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Tỉnh/TP</Label>
                  <Input {...createForm.register('hometown_province')} />
                </div>
                <div>
                  <Label>Phường/Xã</Label>
                  <Input {...createForm.register('hometown_ward')} />
                </div>
              </div>
              <div className="border-t pt-2 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Phụ huynh</span>
                <button type="button" className="text-xs text-primary hover:underline flex items-center gap-1"
                  onClick={() => setCreateContacts((c) => [...c, { full_name: '', relationship: '', phone: '' }])}>
                  <Plus className="h-3 w-3" /> Thêm
                </button>
              </div>
              {createContacts.map((c, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
                  <div>
                    {i === 0 && <Label className="text-xs">Họ tên <span className="text-destructive">*</span></Label>}
                    <Input placeholder="Nguyễn Văn A" value={c.full_name}
                      onChange={(e) => setCreateContacts((arr) => arr.map((x, j) => j === i ? { ...x, full_name: e.target.value } : x))} />
                  </div>
                  <div>
                    {i === 0 && <Label className="text-xs">Số điện thoại <span className="text-destructive">*</span></Label>}
                    <Input
                      placeholder="SĐT"
                      value={c.phone}
                      onChange={(e) => setCreateContacts((arr) => arr.map((x, j) => j === i ? { ...x, phone: e.target.value } : x))}
                    />
                  </div>
                  <div>
                    {i === 0 && <Label className="text-xs">Quan hệ</Label>}
                    <Input placeholder="Cha / Mẹ" value={c.relationship}
                      onChange={(e) => setCreateContacts((arr) => arr.map((x, j) => j === i ? { ...x, relationship: e.target.value } : x))} />
                  </div>
                  <button type="button" className="pb-1 text-muted-foreground hover:text-destructive transition-colors"
                    onClick={() => setCreateContacts((arr) => arr.filter((_, j) => j !== i))}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <div>
                <Label>Ảnh học sinh</Label>
                <button type="button" onClick={() => createPhotoRef.current?.click()}
                  className="mt-1 w-full border-2 border-dashed border-muted-foreground/25 rounded-xl overflow-hidden hover:border-primary/40 transition-colors group">
                  {createPhotoPreview
                    ? <img src={createPhotoPreview} alt="" className="w-full h-32 object-cover" />
                    : <div className="flex flex-col items-center justify-center h-24 gap-1.5 text-muted-foreground group-hover:text-foreground transition-colors">
                        <Upload className="h-5 w-5" />
                        <span className="text-xs">Chọn ảnh JPG, PNG, WEBP</span>
                      </div>
                  }
                </button>
                <input ref={createPhotoRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) pickPhoto(f, 'create'); e.target.value = ''; }} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Hủy</Button>
                <Button type="submit" disabled={create.isPending}>Tạo học sinh</Button>
              </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        title="Xóa hồ sơ HS?"
        description="HS sẽ soft-delete, dữ liệu lịch sử giữ lại."
        variant="destructive"
        confirmLabel="Xóa"
        loading={del.isPending}
        onConfirm={async () => {
          if (deleting) {
            await del.mutateAsync(deleting.student_id);
            setDeleting(null);
          }
        }}
      />

      {/* Archive modal */}
      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Học sinh đã lưu trữ</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã thẻ</TableHead>
                  <TableHead>Họ tên</TableHead>
                  <TableHead>Lớp</TableHead>
                  {isBGH && <TableHead className="text-right">Thao tác</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {archivedLoading && (
                  <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Đang tải...</TableCell></TableRow>
                )}
                {!archivedLoading && (!archivedData || archivedData.length === 0) && (
                  <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Không có học sinh nào được lưu trữ</TableCell></TableRow>
                )}
                {archivedData?.map((s) => {
                  const sc = s.student_classes?.[0];
                  return (
                    <TableRow key={s.student_id}>
                      <TableCell className="font-mono text-sm">{s.student_id_card_number}</TableCell>
                      <TableCell className="font-medium">{s.full_name}</TableCell>
                      <TableCell>{sc?.class?.class_name ?? '—'}</TableCell>
                      {isBGH && (
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => restore.mutate(s.student_id)}
                            disabled={restore.isPending}
                          >
                            <ArchiveRestore className="h-4 w-4 mr-2" /> Khôi phục
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <ImageCropDialog
        open={!!cropSrc}
        imageSrc={cropSrc}
        fileName={cropTarget?.fileName}
        onConfirm={onCropConfirm}
        onCancel={onCropCancel}
        aspect={1}
      />
    </>
  );
}
