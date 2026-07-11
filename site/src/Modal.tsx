import { useEffect, useRef } from "react";

let lastDialogTrigger: HTMLElement | null = null;

if (typeof document !== "undefined") {
  document.addEventListener(
    "click",
    (event) => {
      const trigger = event.target instanceof Element ? event.target.closest<HTMLElement>("button, [role='button']") : null;
      if (trigger) lastDialogTrigger = trigger;
    },
    true,
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const modalRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previousFocus = lastDialogTrigger?.isConnected
      ? lastDialogTrigger
      : document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const modal = modalRef.current;
    const focusable = () => [...(modal?.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])') || [])];
    focusable()[0]?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    addEventListener("keydown", handleKey);
    return () => { removeEventListener("keydown", handleKey); if (previousFocus?.isConnected) previousFocus.focus(); };
  }, []);
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section ref={modalRef} className="modal" role="dialog" aria-modal="true" aria-label={title}><header><strong>{title}</strong><button aria-label="Close" onClick={onClose}>×</button></header><div className="modal-body">{children}</div></section></div>;
}
