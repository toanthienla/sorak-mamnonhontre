import { useState, useMemo } from 'react';
import { SlidersHorizontal, ChevronUp, ChevronDown, ChevronRight, ChevronLeft, ChevronsRight, ChevronsLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/shared/lib/utils';

export function ColumnToggle({ columns, hidden, onHiddenChange, order, onOrderChange }) {
  const [open, setOpen] = useState(false);

  // local state inside dialog — only applied on confirm
  const [localHidden, setLocalHidden] = useState(hidden);
  const [localOrder, setLocalOrder] = useState(order);
  const [selHidden, setSelHidden] = useState(new Set());   // selected in left panel
  const [selVisible, setSelVisible] = useState(new Set()); // selected in right panel
  const [searchHidden, setSearchHidden] = useState('');
  const [searchVisible, setSearchVisible] = useState('');

  const openDialog = () => {
    setLocalHidden(new Set(hidden));
    setLocalOrder([...order]);
    setSelHidden(new Set());
    setSelVisible(new Set());
    setSearchHidden('');
    setSearchVisible('');
    setOpen(true);
  };

  const confirm = () => {
    onHiddenChange(localHidden);
    onOrderChange(localOrder);
    setOpen(false);
  };

  // ordered visible columns (in order, not hidden)
  const visibleCols = useMemo(
    () => localOrder.map((k) => columns.find((c) => c.key === k)).filter((c) => c && !localHidden.has(c.key)),
    [localOrder, localHidden, columns],
  );
  // hidden columns (original order)
  const hiddenCols = useMemo(
    () => columns.filter((c) => localHidden.has(c.key)),
    [localHidden, columns],
  );

  const filteredHidden = hiddenCols.filter((c) =>
    c.label.toLowerCase().includes(searchHidden.toLowerCase()),
  );
  const filteredVisible = visibleCols.filter((c) =>
    c.label.toLowerCase().includes(searchVisible.toLowerCase()),
  );

  const toggleSel = (set, setFn, key, e) => {
    const next = new Set(set);
    if (e.ctrlKey || e.metaKey) {
      next.has(key) ? next.delete(key) : next.add(key);
    } else {
      if (next.size === 1 && next.has(key)) next.clear();
      else { next.clear(); next.add(key); }
    }
    setFn(next);
  };

  // move hidden → visible
  const moveToVisible = (keys) => {
    if (!keys.size) return;
    const next = new Set(localHidden);
    keys.forEach((k) => next.delete(k));
    setLocalHidden(next);
    setSelHidden(new Set());
  };

  // move visible → hidden
  const moveToHidden = (keys) => {
    if (!keys.size) return;
    const next = new Set(localHidden);
    keys.forEach((k) => next.add(k));
    setLocalHidden(next);
    setSelVisible(new Set());
  };

  const moveAllToVisible = () => {
    setLocalHidden(new Set());
    setSelHidden(new Set());
  };

  const moveAllToHidden = () => {
    setLocalHidden(new Set(columns.map((c) => c.key)));
    setSelVisible(new Set());
  };

  const moveUp = () => {
    if (!selVisible.size) return;
    const keys = visibleCols.map((c) => c.key);
    const selected = [...selVisible];
    selected.forEach((k) => {
      const i = keys.indexOf(k);
      if (i > 0) { [keys[i - 1], keys[i]] = [keys[i], keys[i - 1]]; }
    });
    // rebuild full order: hidden keys stay in their position, visible reordered
    const hiddenKeys = localOrder.filter((k) => localHidden.has(k));
    setLocalOrder([...hiddenKeys, ...keys]);
  };

  const moveDown = () => {
    if (!selVisible.size) return;
    const keys = visibleCols.map((c) => c.key);
    const selected = [...selVisible].reverse();
    selected.forEach((k) => {
      const i = keys.indexOf(k);
      if (i < keys.length - 1) { [keys[i + 1], keys[i]] = [keys[i], keys[i + 1]]; }
    });
    const hiddenKeys = localOrder.filter((k) => localHidden.has(k));
    setLocalOrder([...hiddenKeys, ...keys]);
  };

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={openDialog}>
        <SlidersHorizontal className="h-4 w-4" />
        Cột
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Cấu hình hiển thị cột</DialogTitle>
          </DialogHeader>

          <div className="flex gap-3 items-stretch min-h-[340px]">
            {/* Left — hidden */}
            <div className="flex-1 flex flex-col gap-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Cột chưa hiển thị
              </div>
              <Input
                placeholder="Tìm kiếm..."
                value={searchHidden}
                onChange={(e) => setSearchHidden(e.target.value)}
                className="h-8 text-sm"
              />
              <div className="flex-1 border rounded-md overflow-y-auto bg-background">
                {filteredHidden.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-sm text-muted-foreground py-6">
                    Trống
                  </div>
                ) : (
                  filteredHidden.map((col) => (
                    <div
                      key={col.key}
                      onClick={(e) => toggleSel(selHidden, setSelHidden, col.key, e)}
                      onDoubleClick={() => moveToVisible(new Set([col.key]))}
                      className={cn(
                        'px-3 py-2 text-sm cursor-pointer select-none border-b last:border-b-0',
                        selHidden.has(col.key)
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted/60',
                      )}
                    >
                      {col.label}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Middle buttons */}
            <div className="flex flex-col items-center justify-center gap-1.5 py-8">
              <Button variant="outline" size="icon" className="h-8 w-8" title="Thêm chọn" onClick={() => moveToVisible(selHidden)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" title="Bỏ chọn" onClick={() => moveToHidden(selVisible)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="h-2" />
              <Button variant="outline" size="icon" className="h-8 w-8" title="Thêm tất cả" onClick={moveAllToVisible}>
                <ChevronsRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" title="Bỏ tất cả" onClick={moveAllToHidden}>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
            </div>

            {/* Right — visible */}
            <div className="flex-1 flex flex-col gap-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Cột hiển thị
              </div>
              <Input
                placeholder="Tìm kiếm..."
                value={searchVisible}
                onChange={(e) => setSearchVisible(e.target.value)}
                className="h-8 text-sm"
              />
              <div className="flex gap-1.5 flex-1 min-h-0">
                <div className="flex-1 border rounded-md overflow-y-auto bg-background">
                  {filteredVisible.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-sm text-muted-foreground py-6">
                      Trống
                    </div>
                  ) : (
                    filteredVisible.map((col) => (
                      <div
                        key={col.key}
                        onClick={(e) => toggleSel(selVisible, setSelVisible, col.key, e)}
                        onDoubleClick={() => moveToHidden(new Set([col.key]))}
                        className={cn(
                          'px-3 py-2 text-sm cursor-pointer select-none border-b last:border-b-0',
                          selVisible.has(col.key)
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-muted/60',
                        )}
                      >
                        {col.label}
                      </div>
                    ))
                  )}
                </div>
                {/* Up/down */}
                <div className="flex flex-col items-center justify-center gap-1.5">
                  <Button variant="outline" size="icon" className="h-8 w-8" title="Lên" onClick={moveUp}>
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" title="Xuống" onClick={moveDown}>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Hủy</Button>
            <Button onClick={confirm}>Áp dụng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
