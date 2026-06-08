'use client';

import { useEffect, useState } from 'react';

export default function usePersistedPanelState(storageKey, defaultOpen = false) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedValue = window.localStorage.getItem(storageKey);
    if (storedValue === 'open') setOpen(true);
    if (storedValue === 'closed') setOpen(false);
  }, [storageKey]);

  const toggleOpen = () => {
    setOpen((current) => {
      const next = !current;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(storageKey, next ? 'open' : 'closed');
      }
      return next;
    });
  };

  return [open, toggleOpen];
}
