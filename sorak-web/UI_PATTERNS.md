# UI_PATTERNS.md — Sorak Frontend Design System

> Read with [`../AGENTS.md`](../AGENTS.md). This file makes **every page look the same** no matter who (or which AI) builds it.
> Rule: **copy the page skeleton below verbatim**, then fill in the feature-specific columns/fields. Do not invent new layouts, spacings, or colors.

---

## 1. Design tokens (never hard-code colors)

Use Tailwind semantic classes that map to the theme in `src/index.css`. **Never** write hex colors or arbitrary values like `text-[#333]`.

| Token                     | Tailwind class                               | Use for                                       |
| ------------------------- | -------------------------------------------- | --------------------------------------------- |
| Primary (amber `#f5a623`) | `bg-primary` `text-primary`                  | main action buttons, active state, focus ring |
| Ink (`#1A2845`)           | `text-foreground`                            | primary text                                  |
| Secondary text            | `text-muted-foreground`                      | descriptions, meta, placeholders, empty `—`   |
| Card surface              | `bg-card`                                    | table/card containers                         |
| Border                    | `border` / `border-border`                   | dividers, table/card borders                  |
| Destructive               | `text-destructive` / `variant="destructive"` | delete actions                                |
| Radius                    | `rounded-md` (`--radius: .5rem`)             | cards, inputs, buttons                        |

Spacing scale used everywhere: `gap-1.5` (button rows), `gap-2`/`gap-3` (filters, form grids), `mb-4`/`mb-6` (section spacing). Stick to these.

---

## 2. Standard list page — copy this skeleton

Every management page (students, classes, teachers, transfers, …) follows the **same 5 blocks**:
`PageHeader` → filter bar → table card → pagination → dialogs.

```jsx
import { useState } from 'react';
import { Plus, Search, Pencil, Trash2, MoreHorizontal } from 'lucide-react';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageHeader } from '@/shared/components/page-header';
import { DataPagination } from '@/shared/components/data-pagination';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { useList, useCreate, useUpdate, useDelete } from '@/shared/hooks/use-crud';
import { useAuthStore } from '@/shared/stores/auth.store';

export default function ThingsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const isPrincipal = role === 'PRINCIPAL';

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const { data } = useList('things', '/things', {
    page,
    pageSize: 20,
    search,
    ...(statusFilter !== 'all' && { is_active: statusFilter }),
  });
  const rows = data?.data ?? [];
  const meta = data?.meta ?? { page: 1, pageSize: 20, total: 0, totalPages: 1 };

  const del = useDelete('things', '/things');

  return (
    <div>
      {/* 1. Page header — title + primary action on the right */}
      <PageHeader
        title="Quản lý ..."
        description="Mô tả ngắn chức năng."
        actions={
          isPrincipal && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Thêm mới
            </Button>
          )
        }
      />

      {/* 2. Filter bar — search (left) + filters (right) */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
          }}
          className="flex gap-2 flex-1 min-w-[240px]"
        >
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Tìm kiếm..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button type="submit" variant="secondary">
            Tìm
          </Button>
        </form>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            <SelectItem value="true">Đang hoạt động</SelectItem>
            <SelectItem value="false">Đã khóa</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 3. Table card — always wrapped in bg-card rounded-md border */}
      <div className="bg-card rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tên</TableHead>
              <TableHead>Trạng thái</TableHead>
              {isPrincipal && <TableHead className="text-right">Thao tác</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                  Không có dữ liệu
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.thing_id} className={row.deleted_at ? 'opacity-50' : ''}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>{row.is_active ? 'Hoạt động' : 'Khóa'}</TableCell>
                  {isPrincipal && (
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditing(row)}>
                            <Pencil className="h-4 w-4 mr-2" /> Sửa
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleting(row)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Xóa
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 4. Pagination — always directly under the table card */}
      <DataPagination
        page={meta.page}
        pageSize={meta.pageSize}
        total={meta.total}
        totalPages={meta.totalPages}
        onPageChange={setPage}
      />

      {/* 5. Dialogs — create/edit form + delete confirm */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Thêm mới</DialogTitle>
          </DialogHeader>
          {/* form grid: grid grid-cols-2 gap-3 (3 cols for short fields) */}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Hủy
            </Button>
            <Button type="submit">Lưu</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Xóa mục này?"
        description="Hành động này sẽ ẩn mục khỏi danh sách."
        onConfirm={() => del.mutate(deleting.thing_id, { onSuccess: () => setDeleting(null) })}
      />
    </div>
  );
}
```

---

## 3. Fixed layout rules (do not deviate)

| Element          | Exact pattern                                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Page wrapper     | plain `<div>` — page padding comes from `AppLayout`, don't add your own                                                             |
| Header           | `<PageHeader title description actions />`; primary action button on the right                                                      |
| Filter bar       | `flex gap-2 mb-4 flex-wrap items-center`; search left (with `Search` icon `absolute left-2.5 top-2.5`, input `pl-8`), filters right |
| Table container  | `bg-card rounded-md border` wrapping `<Table>` — **always**                                                                         |
| Action column    | header `text-right`, body `text-right`, trigger = `Button variant="outline" size="icon" className="h-8 w-8"` + `MoreHorizontal`     |
| Soft-deleted row | add `className="opacity-50"` on the `<TableRow>`                                                                                    |
| Null/empty cell  | render `—` (em dash), not blank or `null`                                                                                           |
| Empty table      | one row, `colSpan` = column count, `text-center text-muted-foreground py-8`, text `Không có dữ liệu`                                |
| Pagination       | `<DataPagination>` immediately after the table card                                                                                 |
| Create/Edit      | `<Dialog>` + `DialogContent className="sm:max-w-2xl"`; form fields in `grid grid-cols-2 gap-3` (or `grid-cols-3` for short fields)  |
| Delete/confirm   | `<ConfirmDialog>` — never a custom window.confirm                                                                                   |
| Detail view      | `<DetailSheet>` (`@/shared/components/detail-sheet`) with `InfoRow` / `DetailSection`                                               |
| Icons            | `lucide-react`, size `h-4 w-4`; in buttons `mr-1`/`mr-2` before text                                                                |
| Toasts           | `sonner` — handled by `use-crud` hooks; add custom only for special cases                                                           |

---

## 4. Component catalog — what to use for each need

| Need              | Use                                           | Never                   |
| ----------------- | --------------------------------------------- | ----------------------- |
| Page title block  | `PageHeader`                                  | a hand-made `<h1>` row  |
| Table             | `@/components/ui/table` parts                 | raw `<table>`           |
| Pagination        | `DataPagination`                              | custom buttons          |
| Create/edit modal | `Dialog` + react-hook-form + zod              | custom modal/portal     |
| Confirm delete    | `ConfirmDialog`                               | `window.confirm`        |
| Detail panel      | `DetailSheet` + `InfoRow`                     | inline ad-hoc layout    |
| Import preview    | `ImportPreviewDialog`                         | custom table            |
| Show/hide columns | `ColumnToggle` + `useColumnSettings`          | manual state            |
| Dropdown actions  | `DropdownMenu`                                | a row of inline buttons |
| Select / filter   | `Select` parts                                | native `<select>`       |
| Tabs page         | `Tabs` (e.g. Health = assessment + nutrition) | manual tab state        |
| Class/year picker | `useHealthClasses` / `year-selector`          | refetching ad-hoc       |

---

## 5. Forms (inside dialogs)

- `react-hook-form` + `zodResolver`. Each field: `<Label>` + control, wrapped per column in the grid.
- Layout: `grid grid-cols-2 gap-3` (use `grid-cols-3` for date/select/short fields).
- `form.reset({...})` when the dialog opens (and when `editing` changes).
- Save button disabled until dirty: `disabled={!form.formState.isDirty}`.
- Submit calls a `use-crud` mutation (`useCreate`/`useUpdate`); success toast + invalidation are automatic.

---

## 6. For AI assistants

- **Start from the skeleton in §2.** Replace only the columns, filters, and form fields.
- Keep the 5-block order and the exact class strings in §3. Reviewers will reject layouts that differ.
- Only Tailwind semantic tokens (§1) — no hex, no arbitrary values, no inline styles.
- Reuse the components in §4 — do not build new equivalents.
- Vietnamese for all visible text; English for code.
- If a screen genuinely needs a new pattern, propose it to the team and add it here first.
