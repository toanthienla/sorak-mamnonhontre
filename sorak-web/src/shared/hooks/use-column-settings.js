import { useState, useEffect } from 'react';

export function useColumnSettings(storageKey, defaultKeys) {
  const [hidden, setHidden] = useState(() => {
    try {
      const s = localStorage.getItem(storageKey + ':hidden');
      return s ? new Set(JSON.parse(s)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [order, setOrder] = useState(() => {
    try {
      const s = localStorage.getItem(storageKey + ':order');
      if (s) {
        const saved = JSON.parse(s);
        const valid = saved.filter((k) => defaultKeys.includes(k));
        const added = defaultKeys.filter((k) => !saved.includes(k));
        return [...valid, ...added];
      }
    } catch {
      /* ignore */
    }
    return defaultKeys;
  });

  useEffect(() => {
    localStorage.setItem(storageKey + ':hidden', JSON.stringify([...hidden]));
  }, [hidden, storageKey]);

  useEffect(() => {
    localStorage.setItem(storageKey + ':order', JSON.stringify(order));
  }, [order, storageKey]);

  return { hidden, setHidden, order, setOrder };
}
