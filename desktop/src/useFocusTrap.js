import { useEffect, useRef } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useFocusTrap(active) {
  const ref = useRef(null);

  useEffect(() => {
    if (!active || !ref.current) return;

    const el = ref.current;
    const previouslyFocused = document.activeElement;

    const focusables = () => Array.from(el.querySelectorAll(FOCUSABLE)).filter(e => e.offsetParent !== null);
    const first = () => focusables()[0]?.focus();

    first();

    const onKeyDown = e => {
      if (e.key !== 'Tab') return;
      const all = focusables();
      if (!all.length) return;
      const firstEl = all[0];
      const lastEl = all[all.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    el.addEventListener('keydown', onKeyDown);

    return () => {
      el.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
    };
  }, [active]);

  return ref;
}
