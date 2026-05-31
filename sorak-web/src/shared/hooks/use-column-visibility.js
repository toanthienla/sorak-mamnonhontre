import { useState, useEffect } from 'react';

export function useColumnVisibility(storageKey) {
  const [hiddenCols, setHiddenCols] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify([...hiddenCols]));
  }, [hiddenCols, storageKey]);

  return [hiddenCols, setHiddenCols];
}
