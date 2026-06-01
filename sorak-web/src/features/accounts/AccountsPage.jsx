import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Search, MoreHorizontal, ShieldCheck, Power, KeyRound } from 'lucide-react';
import { useTableSort } from '@/shared/hooks/use-table-sort.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageHeader } from '@/shared/components/page-header';
import { DataPagination } from '@/shared/components/data-pagination';
import { ColumnToggle } from '@/shared/components/column-toggle';
import { useColumnSettings } from '@/shared/hooks/use-column-settings';
import { useList } from '@/shared/hooks/use-crud';
import { apiClient } from '@/shared/api/client';
import { useAuthStore } from '@/shared/stores/auth.store';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const STUDENT_STATUS_LABELS = {
  'đang học': 'Đang học',
  'thôi học': 'Thôi học',
  'chuyển trường': 'Chuyển trường',
  active: 'Đang học',
  inactive: 'Thôi học',
};

const assignSchema = z.object({
  role: z.enum(['BGH', 'GV']),
  password: z.union([z.string().min(6, 'Tối thiểu 6 ký tự'), z.literal('')]).optional(),
});

const resetPwSchema = z.object({
  password: z.string().min(6, 'Tối thiểu 6 ký tự'),
});

const WORK_STATUS_VALUES = ['Đang làm việc', 'Chuyển đến', 'Đã chuyển đi', 'Đã điều động', 'Chờ nghỉ hưu', 'Đã nghỉ hưu', 'Đã biệt phái', 'Thôi việc'];

const STAFF_COLS = [
  { key: 'role', label: 'Vai trò' },
  { key: 'full_name', label: 'Họ tên' },
  { key: 'position', label: 'Chức vụ' },
  { key: 'work_status', label: 'Trạng thái CB' },
  { key: 'email', label: 'Email' },
  { key: 'is_active', label: 'Trạng thái TK' },
];

function StaffTab({ isBGH, hidden, order }) {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [workStatusFilter, setWorkStatusFilter] = useState('Đang làm việc');
  const [assigning, setAssigning] = useState(null);
  const [resetting, setResetting] = useState(null);

  const visibleCols = useMemo(() => order.map((k) => STAFF_COLS.find((c) => c.key === k)).filter((c) => c && !hidden.has(c.key)), [order, hidden]);

  const STAFF_SORT = { role: null, full_name: 'full_name', position: 'position', work_status: 'work_status', email: 'email', is_active: null };

  const { data, isLoading } = useList('staff', '/teachers', {
    page,
    pageSize: 20,
    search: search || undefined,
    is_active: activeFilter || undefined,
    work_status: workStatusFilter || undefined,
  });

  const { sortedRows: sortedStaff, toggleSort: toggleStaffSort, SortIcon: StaffSortIcon } =
    useTableSort(data?.data, STAFF_SORT);

  const setActive = useMutation({
    mutationFn: ({ id, isActive }) => apiClient.patch(`/accounts/${id}/active`, { is_active: isActive }),
    onSuccess: () => {
      toast.success('Cập nhật trạng thái tài khoản');
      qc.invalidateQueries({ queryKey: ['staff'] });
    },
  });

  const assignRole = useMutation({
    mutationFn: ({ id, role, password }) =>
      apiClient.post(`/accounts/${id}/assign-role`, { role, password: password || undefined }),
    onSuccess: () => {
      toast.success('Đã lưu phân quyền');
      qc.invalidateQueries({ queryKey: ['staff'] });
      setAssigning(null);
    },
  });

  const resetPw = useMutation({
    mutationFn: ({ id, password }) =>
      apiClient.post(`/accounts/${id}/assign-role`, {
        role: resetting?.account?.role,
        password,
      }),
    onSuccess: () => {
      toast.success('Đã đặt lại mật khẩu');
      setResetting(null);
    },
  });

  const assignForm = useForm({ resolver: zodResolver(assignSchema), defaultValues: { role: 'GV', password: '' } });
  const resetForm = useForm({ resolver: zodResolver(resetPwSchema), defaultValues: { password: '' } });

  const openAssign = (item) => {
    setAssigning(item);
    const defaultPw = item.account?.role
      ? ''
      : `${item.full_name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/\s+/g, '')}@123`;
    assignForm.reset({ role: item.account?.role ?? 'GV', password: defaultPw });
  };

  const openReset = (item) => {
    setResetting(item);
    resetForm.reset({ password: '' });
  };

  const alreadyHasRole = !!assigning?.account?.role;

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-4">
        <form
          onSubmit={(e) => { e.preventDefault(); setPage(1); setSearch(searchInput); }}
          className="flex gap-2 flex-1 min-w-48 max-w-sm"
        >
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Tìm tên / email"
              value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          </div>
          <Button type="submit" variant="secondary">Tìm</Button>
        </form>

        <Select value={workStatusFilter} onValueChange={(v) => { setWorkStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Trạng thái cán bộ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả trạng thái</SelectItem>
            {WORK_STATUS_VALUES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={activeFilter} onValueChange={(v) => { setActiveFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Trạng thái TK" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả TK</SelectItem>
            <SelectItem value="true">Active</SelectItem>
            <SelectItem value="false">Inactive</SelectItem>
          </SelectContent>
        </Select>

      </div>

      <div className="bg-card rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {visibleCols.map((c) => (
                <TableHead
                  key={c.key}
                  className={STAFF_SORT[c.key] ? 'cursor-pointer select-none hover:bg-muted/50' : ''}
                  onClick={() => toggleStaffSort(c.key)}
                >
                  {c.label}<StaffSortIcon colKey={c.key} />
                </TableHead>
              ))}
              {isBGH && <TableHead className="text-right">Thao tác</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={visibleCols.length + (isBGH ? 1 : 0)} className="text-center py-8 text-muted-foreground">Đang tải...</TableCell>
              </TableRow>
            )}
            {sortedStaff.map((t) => {
              const isArchived = !!t.deleted_at;
              const hasRole = !!t.account?.role;
              return (
                <TableRow key={t.teacher_id} className={isArchived ? 'opacity-40' : ''}>
                  {visibleCols.map((c) => {
                    if (c.key === 'role') return (
                      <TableCell key="role">
                        {hasRole
                          ? <span className="text-sm font-semibold">{t.account.role}</span>
                          : <span className="text-sm text-muted-foreground italic">Chưa cấp</span>}
                      </TableCell>
                    );
                    if (c.key === 'full_name') return (
                      <TableCell key="full_name" className="font-medium">
                        {t.full_name}
                        {isArchived && <span className="ml-2 text-xs text-muted-foreground">(đã lưu trữ)</span>}
                      </TableCell>
                    );
                    if (c.key === 'position') return <TableCell key="position">{t.position ?? '—'}</TableCell>;
                    if (c.key === 'work_status') return (
                      <TableCell key="work_status">
                        <span className={`text-sm ${t.work_status === 'Đang làm việc' ? 'text-green-700' : 'text-muted-foreground'}`}>
                          {t.work_status ?? '—'}
                        </span>
                      </TableCell>
                    );
                    if (c.key === 'email') return <TableCell key="email" className="text-sm text-muted-foreground">{t.email}</TableCell>;
                    if (c.key === 'is_active') return (
                      <TableCell key="is_active">
                        {t.account?.is_active
                          ? <span className="text-sm text-green-700 font-medium">Active</span>
                          : <span className="text-sm text-muted-foreground">Inactive</span>}
                      </TableCell>
                    );
                    return null;
                  })}
                  {isBGH && !isArchived && (
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onClick={() => openAssign(t)}>
                            <ShieldCheck className="h-4 w-4 mr-2 text-primary" />
                            {hasRole ? 'Đổi vai trò' : 'Cấp tài khoản'}
                          </DropdownMenuItem>
                          {hasRole && (
                            <DropdownMenuItem onClick={() => openReset(t)}>
                              <KeyRound className="h-4 w-4 mr-2 text-amber-600" />
                              Đặt lại mật khẩu
                            </DropdownMenuItem>
                          )}
                          {hasRole && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setActive.mutate({ id: t.account_id, isActive: !t.account?.is_active })}
                              >
                                <Power className={`h-4 w-4 mr-2 ${t.account?.is_active ? 'text-amber-600' : 'text-green-600'}`} />
                                {t.account?.is_active ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                  {isBGH && isArchived && <TableCell />}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {data && (
        <DataPagination
          page={data.meta.page} pageSize={data.meta.pageSize}
          total={data.meta.total} totalPages={data.meta.totalPages}
          onPageChange={setPage}
        />
      )}

      {/* Assign role dialog */}
      <Dialog open={!!assigning} onOpenChange={(v) => !v && setAssigning(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{alreadyHasRole ? 'Đổi vai trò' : 'Cấp tài khoản'}</DialogTitle>
          </DialogHeader>
          <p className="text-sm font-medium">{assigning?.full_name}</p>
          <p className="text-xs text-muted-foreground">{assigning?.email} · {assigning?.position ?? '—'}</p>
          <form onSubmit={assignForm.handleSubmit((v) => assignRole.mutate({ id: assigning.teacher_id, role: v.role, password: v.password }))} className="space-y-4 pt-2">
            <div>
              <Label>Vai trò <span className="text-destructive">*</span></Label>
              <Select value={assignForm.watch('role')} onValueChange={(v) => assignForm.setValue('role', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BGH">BGH — Ban Giám Hiệu</SelectItem>
                  <SelectItem value="GV">GV — Giáo viên</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!alreadyHasRole && (
              <div>
                <Label>Mật khẩu khởi tạo</Label>
                <Input
                  type="text"
                  placeholder="Mật khẩu"
                  {...assignForm.register('password')}
                />
                {assignForm.formState.errors.password && (
                  <p className="text-xs text-destructive mt-1">{assignForm.formState.errors.password.message}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">Mặc định: tên giáo viên + @123</p>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAssigning(null)}>Hủy</Button>
              <Button type="submit" disabled={assignRole.isPending}>Lưu</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog open={!!resetting} onOpenChange={(v) => !v && setResetting(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Đặt lại mật khẩu</DialogTitle>
          </DialogHeader>
          <p className="text-sm font-medium">{resetting?.full_name}</p>
          <p className="text-xs text-muted-foreground">{resetting?.email}</p>
          <form onSubmit={resetForm.handleSubmit((v) => resetPw.mutate({ id: resetting.teacher_id, password: v.password }))} className="space-y-4 pt-2">
            <div>
              <Label>Mật khẩu mới <span className="text-destructive">*</span></Label>
              <Input type="text" {...resetForm.register('password')} />
              {resetForm.formState.errors.password && (
                <p className="text-xs text-destructive mt-1">{resetForm.formState.errors.password.message}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setResetting(null)}>Hủy</Button>
              <Button type="submit" disabled={resetPw.isPending}>Đặt lại</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

const STUDENT_ACC_COLS = [
  { key: 'student_id_card_number', label: 'Mã thẻ' },
  { key: 'full_name', label: 'Họ tên' },
  { key: 'student_status', label: 'Trạng thái HS' },
  { key: 'is_active', label: 'Trạng thái TK' },
];

function StudentTab({ isBGH, hidden: sHidden, order: sOrder }) {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('Đang học');

  const visibleStudentCols = useMemo(() => sOrder.map((k) => STUDENT_ACC_COLS.find((c) => c.key === k)).filter((c) => c && !sHidden.has(c.key)), [sOrder, sHidden]);

  const STU_SORT = { student_id_card_number: 'student_id_card_number', full_name: 'full_name', student_status: 'student_status', is_active: null };

  const { data, isLoading } = useList('students-acc', '/students', {
    page, pageSize: 20, search: search || undefined,
    is_active: activeFilter || undefined,
    student_status: statusFilter || undefined,
  });

  const { sortedRows: sortedStudents, toggleSort: toggleStuSort, SortIcon: StuSortIcon } =
    useTableSort(data?.data, STU_SORT);

  const setActive = useMutation({
    mutationFn: ({ id, isActive }) => apiClient.patch(`/students/${id}/active`, { is_active: isActive }),
    onSuccess: () => {
      toast.success('Cập nhật trạng thái TK học sinh');
      qc.invalidateQueries({ queryKey: ['students-acc'] });
    },
  });

  const resetPw = useMutation({
    mutationFn: (id) => apiClient.post(`/students/${id}/reset-password`),
    onSuccess: (res) => {
      const d = res.data?.data ?? res.data;
      toast.success(`Mật khẩu PH đặt lại: ${d.default_password}`, { duration: 10000 });
    },
  });

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-4">
        <form
          onSubmit={(e) => { e.preventDefault(); setPage(1); setSearch(searchInput); }}
          className="flex gap-2 flex-1 min-w-48 max-w-sm"
        >
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Tìm tên / mã thẻ"
              value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          </div>
          <Button type="submit" variant="secondary">Tìm</Button>
        </form>

        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Trạng thái HS" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả trạng thái</SelectItem>
            <SelectItem value="Đang học">Đang học</SelectItem>
            <SelectItem value="Hoàn thành chương trình">Hoàn thành chương trình</SelectItem>
            <SelectItem value="Thôi học kỳ 1">Thôi học kỳ 1</SelectItem>
            <SelectItem value="Thôi học kỳ 2">Thôi học kỳ 2</SelectItem>
            <SelectItem value="Chuyển đi kỳ 1">Chuyển đi kỳ 1</SelectItem>
            <SelectItem value="Chuyển đi kỳ 2">Chuyển đi kỳ 2</SelectItem>
          </SelectContent>
        </Select>

        <Select value={activeFilter} onValueChange={(v) => { setActiveFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Trạng thái TK" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả TK</SelectItem>
            <SelectItem value="true">Active</SelectItem>
            <SelectItem value="false">Inactive</SelectItem>
          </SelectContent>
        </Select>

      </div>

      <div className="bg-card rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {visibleStudentCols.map((c) => (
                <TableHead
                  key={c.key}
                  className={STU_SORT[c.key] ? 'cursor-pointer select-none hover:bg-muted/50' : ''}
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
                <TableCell colSpan={visibleStudentCols.length + (isBGH ? 1 : 0)} className="text-center py-8 text-muted-foreground">Đang tải...</TableCell>
              </TableRow>
            )}
            {sortedStudents.map((s) => {
              const sc = s.student_classes?.[0];
              const statusLabel = STUDENT_STATUS_LABELS[s.student_status] ?? s.student_status ?? 'Đang học';
              return (
                <TableRow key={s.student_id}>
                  {visibleStudentCols.map((c) => {
                    if (c.key === 'student_id_card_number') return <TableCell key="card" className="font-mono text-sm">{s.student_id_card_number}</TableCell>;
                    if (c.key === 'full_name') return <TableCell key="name" className="font-medium">{s.full_name}</TableCell>;
                    if (c.key === 'class') return <TableCell key="class">{sc?.class.class_name ?? '—'}</TableCell>;
                    if (c.key === 'student_status') return (
                      <TableCell key="status">
                        <span className={`text-sm ${statusLabel === 'Đang học' ? 'text-green-700' : statusLabel === 'Chuyển trường' ? 'text-amber-700' : 'text-muted-foreground'}`}>
                          {statusLabel}
                        </span>
                      </TableCell>
                    );
                    if (c.key === 'is_active') return (
                      <TableCell key="active">
                        {s.account?.is_active
                          ? <span className="text-sm text-green-700 font-medium">Active</span>
                          : <span className="text-sm text-muted-foreground">Inactive</span>}
                      </TableCell>
                    );
                    return null;
                  })}
                  {isBGH && (
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem
                            onClick={() => {
                              if (confirm(`Đặt lại mật khẩu PH của ${s.full_name}?`)) {
                                resetPw.mutate(s.student_id);
                              }
                            }}
                          >
                            <KeyRound className="h-4 w-4 mr-2 text-amber-600" />
                            Đặt lại mật khẩu PH
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setActive.mutate({ id: s.student_id, isActive: !s.account?.is_active })}
                          >
                            <Power className={`h-4 w-4 mr-2 ${s.account?.is_active ? 'text-amber-600' : 'text-green-600'}`} />
                            {s.account?.is_active ? 'Khóa tài khoản PH' : 'Mở khóa tài khoản PH'}
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

      {data && (
        <DataPagination
          page={data.meta.page} pageSize={data.meta.pageSize}
          total={data.meta.total} totalPages={data.meta.totalPages}
          onPageChange={setPage}
        />
      )}
    </>
  );
}

export function AccountsPage() {
  const userRole = useAuthStore((s) => s.user?.role);
  const isBGH = userRole === 'BGH';
  const [tab, setTab] = useState('staff');

  // Column settings lifted up so PageHeader can access them
  const { hidden: staffHidden, setHidden: setStaffHidden, order: staffOrder, setOrder: setStaffOrder } =
    useColumnSettings('accounts-staff', STAFF_COLS.map((c) => c.key));
  const { hidden: stuHidden, setHidden: setStuHidden, order: stuOrder, setOrder: setStuOrder } =
    useColumnSettings('accounts-student', STUDENT_ACC_COLS.map((c) => c.key));

  return (
    <>
      <PageHeader
        title="Tài khoản"
        description="Phân quyền, cấp mật khẩu, khóa/mở khóa tài khoản. Chỉnh sửa hồ sơ ở trang Cán bộ / Học sinh."
        actions={
          tab === 'staff'
            ? <ColumnToggle columns={STAFF_COLS} hidden={staffHidden} onHiddenChange={setStaffHidden} order={staffOrder} onOrderChange={setStaffOrder} />
            : <ColumnToggle columns={STUDENT_ACC_COLS} hidden={stuHidden} onHiddenChange={setStuHidden} order={stuOrder} onOrderChange={setStuOrder} />
        }
      />
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="staff">Tài khoản cán bộ</TabsTrigger>
          <TabsTrigger value="student">Tài khoản học sinh</TabsTrigger>
        </TabsList>
        <TabsContent value="staff">
          <StaffTab isBGH={isBGH} hidden={staffHidden} order={staffOrder} />
        </TabsContent>
        <TabsContent value="student">
          <StudentTab isBGH={isBGH} hidden={stuHidden} order={stuOrder} />
        </TabsContent>
      </Tabs>
    </>
  );
}
