import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Search, MoreHorizontal, ShieldCheck, Power, KeyRound } from 'lucide-react';
import { useTableSort } from '@/shared/hooks/use-table-sort.jsx';
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
import { DataPagination } from '@/shared/components/data-pagination';
import { ColumnToggle } from '@/shared/components/column-toggle';
import { useList } from '@/shared/hooks/use-crud';
import { apiClient } from '@/shared/api/client';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ROLE_LABELS,
  assignSchema,
  resetPwSchema,
  WORK_STATUS_VALUES,
  STAFF_COLS,
} from './accounts-shared';

export function StaffTab({ isBGH, hidden, order, setHidden, setOrder }) {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [workStatusFilter, setWorkStatusFilter] = useState('Đang làm việc');
  const [assigning, setAssigning] = useState(null);
  const [resetting, setResetting] = useState(null);

  const visibleCols = useMemo(
    () =>
      order.map((k) => STAFF_COLS.find((c) => c.key === k)).filter((c) => c && !hidden.has(c.key)),
    [order, hidden],
  );

  const STAFF_SORT = {
    role: null,
    full_name: 'full_name',
    position: 'position',
    work_status: 'work_status',
    email: 'email',
    is_active: null,
  };

  // Teacher-centric: lists ALL staff incl. teachers without an account yet
  const { data, isLoading } = useList('staff', '/accounts', {
    page,
    pageSize: 20,
    type: 'staff',
    search: search || undefined,
    is_active: activeFilter || undefined,
    work_status: workStatusFilter || undefined,
  });

  const {
    sortedRows: sortedStaff,
    toggleSort: toggleStaffSort,
    SortIcon: StaffSortIcon,
  } = useTableSort(data?.data, STAFF_SORT);

  const setActive = useMutation({
    mutationFn: ({ id, isActive }) =>
      apiClient.patch(`/accounts/${id}/active`, { is_active: isActive }),
    onSuccess: () => {
      toast.success('Cập nhật trạng thái tài khoản');
      qc.invalidateQueries({ queryKey: ['staff'] });
    },
  });

  // First-time grant: create account + set password (id = teacher_id)
  const assignRole = useMutation({
    mutationFn: ({ id, role, password }) =>
      apiClient.post(`/accounts/${id}/assign-role`, { role, password: password || undefined }),
    onSuccess: () => {
      toast.success('Đã cấp tài khoản');
      qc.invalidateQueries({ queryKey: ['staff'] });
      setAssigning(null);
    },
  });

  // Change role of an EXISTING account (id = account_id, no password)
  const changeRole = useMutation({
    mutationFn: ({ id, role }) => apiClient.patch(`/accounts/${id}/role`, { role }),
    onSuccess: () => {
      toast.success('Đã đổi vai trò');
      qc.invalidateQueries({ queryKey: ['staff'] });
      setAssigning(null);
    },
  });

  // Change password (id = account_id) — same endpoint as student
  const resetPw = useMutation({
    mutationFn: ({ id, password }) => apiClient.patch(`/accounts/${id}/password`, { password }),
    onSuccess: () => {
      toast.success('Đã đổi mật khẩu');
      setResetting(null);
    },
  });

  const assignForm = useForm({
    resolver: zodResolver(assignSchema),
    defaultValues: { role: 'TEACHER', password: '' },
  });
  const resetForm = useForm({
    resolver: zodResolver(resetPwSchema),
    defaultValues: { password: '' },
  });

  const openAssign = (item) => {
    setAssigning(item);
    const defaultPw = item.account?.role
      ? ''
      : `${item.full_name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/\s+/g, '')}@123`;
    assignForm.reset({ role: item.account?.role ?? 'TEACHER', password: defaultPw });
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
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setSearch(searchInput);
          }}
          className="flex gap-2 flex-1 min-w-48 max-w-sm"
        >
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Tìm tên / email"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <Button type="submit" variant="secondary">
            Tìm
          </Button>
        </form>

        <Select
          value={workStatusFilter}
          onValueChange={(v) => {
            setWorkStatusFilter(v === 'all' ? '' : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Trạng thái cán bộ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả trạng thái</SelectItem>
            {WORK_STATUS_VALUES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={activeFilter}
          onValueChange={(v) => {
            setActiveFilter(v === 'all' ? '' : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Trạng thái TK" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả TK</SelectItem>
            <SelectItem value="true">Active</SelectItem>
            <SelectItem value="false">Inactive</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex-1" />
        <ColumnToggle
          columns={STAFF_COLS}
          hidden={hidden}
          onHiddenChange={setHidden}
          order={order}
          onOrderChange={setOrder}
        />
      </div>

      <div className="bg-card rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {visibleCols.map((c) => (
                <TableHead
                  key={c.key}
                  className={
                    STAFF_SORT[c.key] ? 'cursor-pointer select-none hover:bg-muted/50' : ''
                  }
                  onClick={() => toggleStaffSort(c.key)}
                >
                  {c.label}
                  <StaffSortIcon colKey={c.key} />
                </TableHead>
              ))}
              {isBGH && <TableHead className="text-right">Thao tác</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell
                  colSpan={visibleCols.length + (isBGH ? 1 : 0)}
                  className="text-center py-8 text-muted-foreground"
                >
                  Đang tải...
                </TableCell>
              </TableRow>
            )}
            {sortedStaff.map((t) => {
              const isArchived = !!t.deleted_at;
              const hasRole = !!t.account?.role;
              return (
                <TableRow key={t.teacher_id} className={isArchived ? 'opacity-40' : ''}>
                  {visibleCols.map((c) => {
                    if (c.key === 'role')
                      return (
                        <TableCell key="role">
                          {hasRole ? (
                            <span className="text-sm font-semibold">
                              {ROLE_LABELS[t.account.role] ?? t.account.role}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground italic">Chưa cấp</span>
                          )}
                        </TableCell>
                      );
                    if (c.key === 'full_name')
                      return (
                        <TableCell key="full_name" className="font-medium">
                          {t.full_name}
                          {isArchived && (
                            <span className="ml-2 text-xs text-muted-foreground">(đã lưu trữ)</span>
                          )}
                        </TableCell>
                      );
                    if (c.key === 'position')
                      return <TableCell key="position">{t.position ?? '—'}</TableCell>;
                    if (c.key === 'work_status')
                      return (
                        <TableCell key="work_status">
                          <span
                            className={`text-sm ${t.work_status === 'Đang làm việc' ? 'text-green-700' : 'text-muted-foreground'}`}
                          >
                            {t.work_status ?? '—'}
                          </span>
                        </TableCell>
                      );
                    if (c.key === 'email')
                      return (
                        <TableCell key="email" className="text-sm text-muted-foreground">
                          {t.email}
                        </TableCell>
                      );
                    if (c.key === 'is_active')
                      return (
                        <TableCell key="is_active">
                          {t.account?.is_active ? (
                            <span className="text-sm text-green-700 font-medium">Active</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">Inactive</span>
                          )}
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
                                onClick={() =>
                                  setActive.mutate({
                                    id: t.account_id,
                                    isActive: !t.account?.is_active,
                                  })
                                }
                              >
                                <Power
                                  className={`h-4 w-4 mr-2 ${t.account?.is_active ? 'text-amber-600' : 'text-green-600'}`}
                                />
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
          page={data.meta.page}
          pageSize={data.meta.pageSize}
          total={data.meta.total}
          totalPages={data.meta.totalPages}
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
          <p className="text-xs text-muted-foreground">
            {assigning?.email} · {assigning?.position ?? '—'}
          </p>
          <form
            onSubmit={assignForm.handleSubmit((v) =>
              alreadyHasRole
                ? changeRole.mutate({ id: assigning.teacher_id, role: v.role })
                : assignRole.mutate({
                    id: assigning.teacher_id,
                    role: v.role,
                    password: v.password,
                  }),
            )}
            className="space-y-4 pt-2"
          >
            <div>
              <Label>
                Vai trò <span className="text-destructive">*</span>
              </Label>
              <Select
                value={assignForm.watch('role')}
                onValueChange={(v) => assignForm.setValue('role', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRINCIPAL">BGH — Ban Giám Hiệu</SelectItem>
                  <SelectItem value="TEACHER">GV — Giáo viên</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!alreadyHasRole && (
              <div>
                <Label>Mật khẩu khởi tạo</Label>
                <Input type="text" placeholder="Mật khẩu" {...assignForm.register('password')} />
                {assignForm.formState.errors.password && (
                  <p className="text-xs text-destructive mt-1">
                    {assignForm.formState.errors.password.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">Mặc định: tên giáo viên + @123</p>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAssigning(null)}>
                Hủy
              </Button>
              <Button type="submit" disabled={assignRole.isPending || changeRole.isPending}>
                Lưu
              </Button>
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
          <form
            onSubmit={resetForm.handleSubmit((v) =>
              resetPw.mutate({ id: resetting.account.account_id, password: v.password }),
            )}
            className="space-y-4 pt-2"
          >
            <div>
              <Label>
                Mật khẩu mới <span className="text-destructive">*</span>
              </Label>
              <Input type="text" {...resetForm.register('password')} />
              {resetForm.formState.errors.password && (
                <p className="text-xs text-destructive mt-1">
                  {resetForm.formState.errors.password.message}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setResetting(null)}>
                Hủy
              </Button>
              <Button type="submit" disabled={resetPw.isPending}>
                Đặt lại
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
