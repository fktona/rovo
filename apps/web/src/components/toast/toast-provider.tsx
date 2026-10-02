"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { formatWalletMessage } from "@/lib/wallet-message";

type ToastTone = "success" | "error" | "info";

type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
  duration?: number;
};

type ToastRecord = {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
  duration: number;
};

type ToastApi = {
  show: (input: ToastInput) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  walletError: (cause: unknown, fallback?: string) => void;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const toneBar: Record<ToastTone, string> = {
  success: "bg-action",
  error: "bg-danger",
  info: "bg-surface-raised",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const nextId = useRef(1);
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback((input: ToastInput) => {
    const title = input.title.trim();
    if (!title) return;
    const tone = input.tone ?? "info";
    const description = input.description?.trim();
    const record: ToastRecord = {
      id: nextId.current++,
      title,
      tone,
      duration: input.duration ?? (tone === "error" ? 7000 : 4500),
      ...(description ? { description } : {}),
    };
    setToasts((current) => {
      const rest = current.filter((toast) => toast.tone !== tone || toast.title !== title);
      return [...rest, record].slice(-3);
    });
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      dismiss,
      success: (title, description) =>
        show(description ? { tone: "success", title, description } : { tone: "success", title }),
      error: (title, description) =>
        show(description ? { tone: "error", title, description } : { tone: "error", title }),
      walletError: (cause, fallback) => show({ tone: "error", title: formatWalletMessage(cause, fallback) }),
    }),
    [dismiss, show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-relevant="additions"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-[80] flex justify-center px-3 md:bottom-[4.5rem] md:justify-end md:px-6"
      >
        <div className="flex w-full max-w-sm flex-col gap-2">
          {toasts.map((toast) => (
            <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error("useToast must be used within ToastProvider");
  return toast;
}

function ToastCard({ toast, onDismiss }: { toast: ToastRecord; onDismiss: (id: number) => void }) {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const controls = useRef({ pause: () => {}, resume: () => {} });

  useEffect(() => {
    let remaining = toast.duration;
    let timer: number | null = null;
    let started = 0;
    const clear = () => {
      if (timer != null) window.clearTimeout(timer);
      timer = null;
    };
    const arm = () => {
      clear();
      started = Date.now();
      timer = window.setTimeout(() => onDismissRef.current(toast.id), remaining);
    };
    controls.current = {
      pause: () => {
        remaining -= Date.now() - started;
        clear();
      },
      resume: () => {
        if (remaining < 800) remaining = 800;
        arm();
      },
    };
    arm();
    return clear;
  }, [toast.duration, toast.id]);

  return (
    <div
      role={toast.tone === "error" ? "alert" : "status"}
      onMouseEnter={() => controls.current.pause()}
      onMouseLeave={() => controls.current.resume()}
      className="toast-in pointer-events-auto relative overflow-hidden rounded-2xl border border-line bg-surface py-3 pl-4 pr-2 shadow-[0_16px_40px_rgba(0,0,0,0.55)]"
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${toneBar[toast.tone]}`} aria-hidden="true" />
      <div className="flex items-start gap-3">
        <p className="min-w-0 flex-1 pt-0.5 text-sm font-medium leading-5 text-foreground">{toast.title}</p>
        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={() => onDismiss(toast.id)}
          className="grid size-7 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-raised hover:text-foreground"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2 2l8 8M10 2L2 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {toast.description && <p className="mt-1 pr-8 text-xs leading-5 text-muted">{toast.description}</p>}
    </div>
  );
}
