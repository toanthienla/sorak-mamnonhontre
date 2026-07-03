import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

/**
 * useTableSort — client-side sort for a page of rows.
 *
 * @param {Array}  rows        — current page data array
 * @param {Object} fieldMap    — { colKey: 'actualDataField', ... }
 * @returns {{ sortedRows, sort, toggleSort, SortIcon }}
 */
export function useTableSort(rows, fieldMap) {
  const [sort, setSort] = useState({ key: null, dir: 'asc' });

  const toggleSort = (colKey) => {
    if (!fieldMap[colKey]) return;
    setSort((prev) =>
      prev.key === colKey
        ? { key: colKey, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key: colKey, dir: 'asc' },
    );
  };

  const sortedRows = useMemo(() => {
    if (!sort.key || !fieldMap[sort.key]) return rows ?? [];
    const field = fieldMap[sort.key];
    return [...(rows ?? [])].sort((a, b) => {
      const av = a[field] ?? '';
      const bv = b[field] ?? '';
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sort, fieldMap]);

  function SortIcon({ colKey }) {
    if (!fieldMap[colKey]) return null;
    if (sort.key !== colKey)
      return <ChevronsUpDown className="h-3.5 w-3.5 ml-1 text-muted-foreground/50 inline" />;
    return sort.dir === 'asc' ? (
      <ChevronUp className="h-3.5 w-3.5 ml-1 inline" />
    ) : (
      <ChevronDown className="h-3.5 w-3.5 ml-1 inline" />
    );
  }

  return { sortedRows, sort, toggleSort, SortIcon };
}
