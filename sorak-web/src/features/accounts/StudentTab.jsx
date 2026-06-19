import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Search, MoreHorizontal, Power, KeyRound } from 'lucide-react';
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
import { STUDENT_STATUS_LABELS, resetPwSchema, STUDENT_ACC_COLS } from './accounts-shared';

export function StudentTab({
  isBGH,
  hidden: sHidden,
  order: sOrder,
  setHidden: setSHidden,
  setOrder: setSOrder,
}) {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('Đang học');
  const [resetting, setResetting] = useState(null);

  const visibleStudentCols = useMemo(
    () =>
      sOrder
        .map((k) => STUDENT_ACC_COLS.find((c) => c.key === k))
        .filter((c) => c && !sHidden.has(c.key)),
    [sOrder, sHidden],
  );

  const STU_SORT = {
    student_id_card_number: 'student_id_card_number',
    full_name: 'full_name',
    student_status: 'student_status',
    is_active: null,
  };

  const { data, isLoading } = useList('students-acc', '/accounts', {
    page,
    pageSize: 20,
    type: 'parent',
    search: search || undefined,
    is_active: activeFilter || undefined,
    student_status: statusFilter || undefined,
  });

  // Student-centric rows: flatten nested account status onto the row
  const studentRows = useMemo(
    () =>
      (data?.data ?? []).map((s) => ({
        account_id: s.account?.account_id,
        is_active: s.account?.is_active,
        student_id: s.student_id,
        student_id_card_number: s.student_id_card_number,
        full_name: s.full_name,
        student_status: s.student_status,
        enrollments: s.enrollments,
      })),
    [data],
  );

  const {
    sortedRows: sortedStudents,
    toggleSort: toggleStuSort,
    SortIcon: StuSortIcon,
  } = useTableSort(studentRows, STU_SORT);

  const setActive = useMutation({
    mutationFn: ({ id, isActive }) =>
      apiClient.patch(`/students/${id}/active`, { is_active: isActive }),
    onSuccess: () => {
      toast.success('Cập nhật trạng thái TK học sinh');
      qc.invalidateQueries({ queryKey: ['students-acc'] });
    },
  });

  // Change PH password to a custom value (id = account_id)
  const changePw = useMutation({
    mutationFn: ({ id, password }) => apiClient.patch(`/accounts/${id}/password`, { password }),
    onSuccess: () => {
      toast.success('Đã đổi mật khẩu PH');
      setResetting(null);
    },
  });

  const resetForm = useForm({
    resolver: zodResolver(resetPwSchema),
    defaultValues: { password: '' },
  });

  // Pre-fill default password = student card number
  const openReset = (item) => {
    setResetting(item);
    resetForm.reset({ password: item.student_id_card_number ?? '' });
  };

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
              placeholder="Tìm tên / mã thẻ"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <Button type="submit" variant="secondary">
            Tìm
          </Button>
        </form>

        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v === 'all' ? '' : v);
            setPage(1);
          }}
        >
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
          columns={STUDENT_ACC_COLS}
          hidden={sHidden}
          onHiddenChange={setSHidden}
          order={sOrder}
          onOrderChange={setSOrder}
        />
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
                  {c.label}
                  <StuSortIcon colKey={c.key} />
                </TableHead>
              ))}
              {isBGH && <TableHead className="text-right">Thao tác</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell
                  colSpan={visibleStudentCols.length + (isBGH ? 1 : 0)}
                  className="text-center py-8 text-muted-foreground"
                >
                  Đang tải...
                </TableCell>
              </TableRow>
            )}
            {sortedStudents.map((s) => {
              const sc = s.enrollments?.[0];
              const statusLabel =
                STUDENT_STATUS_LABELS[s.student_status] ?? s.student_status ?? 'Đang học';
              return (
                <TableRow key={s.student_id}>
                  {visibleStudentCols.map((c) => {
                    if (c.key === 'student_id_card_number')
                      return (
                        <TableCell key="card" className="font-mono text-sm">
                          {s.student_id_card_number}
                        </TableCell>
                      );
                    if (c.key === 'full_name')
                      return (
                        <TableCell key="name" className="font-medium">
                          {s.full_name}
                        </TableCell>
                      );
                    if (c.key === 'class')
                      return <TableCell key="class">{sc?.class?.class_name ?? '—'}</TableCell>;
                    if (c.key === 'student_status')
                      return (
                        <TableCell key="status">
                          <span
                            className={`text-sm ${statusLabel === 'Đang học' ? 'text-green-700' : statusLabel === 'Chuyển trường' ? 'text-amber-700' : 'text-muted-foreground'}`}
                          >
                            {statusLabel}
                          </span>
                        </TableCell>
                      );
                    if (c.key === 'is_active')
                      return (
                        <TableCell key="active">
                          {s.is_active ? (
                            <span className="text-sm text-green-700 font-medium">Active</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">Inactive</span>
                          )}
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
                          <DropdownMenuItem onClick={() => openReset(s)}>
                            <KeyRound className="h-4 w-4 mr-2 text-amber-600" />
                            Đổi mật khẩu PH
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() =>
                              setActive.mutate({ id: s.student_id, isActive: !s.is_active })
                            }
                          >
                            <Power
                              className={`h-4 w-4 mr-2 ${s.is_active ? 'text-amber-600' : 'text-green-600'}`}
                            />
                            {s.is_active ? 'Khóa tài khoản PH' : 'Mở khóa tài khoản PH'}
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
          page={data.meta.page}
          pageSize={data.meta.pageSize}
          total={data.meta.total}
          totalPages={data.meta.totalPages}
          onPageChange={setPage}
        />
      )}

      {/* Change PH password dialog */}
      <Dialog open={!!resetting} onOpenChange={(v) => !v && setResetting(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Đổi mật khẩu PH</DialogTitle>
          </DialogHeader>
          <p className="text-sm font-medium">{resetting?.full_name}</p>
          <p className="text-xs text-muted-foreground">
            Mã thẻ: {resetting?.student_id_card_number}
          </p>
          <form
            onSubmit={resetForm.handleSubmit((v) =>
              changePw.mutate({ id: resetting.account_id, password: v.password }),
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
              <p className="text-xs text-muted-foreground mt-1">Mặc định = mã thẻ học sinh</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setResetting(null)}>
                Hủy
              </Button>
              <Button type="submit" disabled={changePw.isPending}>
                Lưu
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
