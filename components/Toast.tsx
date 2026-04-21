"use client";

import { useToast } from "@/lib/use-toast";

const BORDER_COLOR = {
  success: "border-l-green-500",
  error: "border-l-arc-red",
  info: "border-l-arc-gray-500",
} as const;

const ICON = {
  success: (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" className="text-green-500 shrink-0">
      <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0Zm3.78 4.97a.75.75 0 0 0-1.06 0L7 8.69 5.28 6.97a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.06 0l4.25-4.25a.75.75 0 0 0 0-1.06Z" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" className="text-arc-red shrink-0">
      <path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575ZM8 5a.75.75 0 0 0-.75.75v2.5a.75.75 0 0 0 1.5 0v-2.5A.75.75 0 0 0 8 5Zm1 6a1 1 0 1 0-2 0 1 1 0 0 0 2 0Z" />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" className="text-arc-gray-500 shrink-0">
      <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-3a.75.75 0 0 0 0 1.5h.01a.75.75 0 0 0 0-1.5H8ZM6.25 8a.75.75 0 0 1 .75-.75h1a.75.75 0 0 1 .75.75v2.25h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25V8.75H7a.75.75 0 0 1-.75-.75Z" />
    </svg>
  ),
};

export default function ToastContainer() {
  const { toasts } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-2 px-3 py-2 bg-arc-gray-900 text-arc-cream text-xs font-data rounded shadow-lg border-l-[3px] ${BORDER_COLOR[t.type]} animate-slide-in`}
        >
          {ICON[t.type]}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
