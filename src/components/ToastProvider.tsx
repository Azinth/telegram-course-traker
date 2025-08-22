"use client";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type ToastType = "success" | "error" | "info";
type Toast = {
  id: string;
  type: ToastType;
  message: string;
  duration?: number; // ms
};

type ToastContextType = {
  show: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  showNextPage: (message: string, type?: ToastType, duration?: number) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const show = useCallback(
    (message: string, type: ToastType = "info", duration = 3000) => {
      const t: Toast = { id: uid(), type, message, duration };
      setToasts((prev) => [...prev, t]);
      if (duration && duration > 0) {
        window.setTimeout(() => remove(t.id), duration);
      }
    },
    [remove],
  );

  const success = useCallback(
    (message: string, duration?: number) => show(message, "success", duration),
    [show],
  );
  const error = useCallback(
    (message: string, duration?: number) => show(message, "error", duration),
    [show],
  );
  const info = useCallback(
    (message: string, duration?: number) => show(message, "info", duration),
    [show],
  );

  const showNextPage = useCallback(
    (message: string, type: ToastType = "info", duration = 3000) => {
      try {
        sessionStorage.setItem(
          "deferred_toast",
          JSON.stringify({ message, type, duration }),
        );
      } catch {}
    },
    [],
  );

  // Exibir toast adiado (pós navegação)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("deferred_toast");
      if (raw) {
        const { message, type, duration } = JSON.parse(raw);
        sessionStorage.removeItem("deferred_toast");
        show(message, type, duration);
      }
    } catch {}
  }, [show]);

  const value = useMemo<ToastContextType>(
    () => ({ show, success, error, info, showNextPage }),
    [show, success, error, info, showNextPage],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Container dos toasts */}
      <div className="fixed bottom-4 right-4 z-[1000] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={
              `min-w-[240px] max-w-[360px] px-4 py-3 rounded shadow-md border text-sm ` +
              (t.type === "success"
                ? "bg-green-600/90 border-green-400 text-white"
                : t.type === "error"
                  ? "bg-red-600/90 border-red-400 text-white"
                  : "bg-gray-800/90 border-gray-600 text-gray-100")
            }
            role="status"
          >
            <div className="flex items-start gap-2">
              <span className="mt-0.5">
                {t.type === "success" ? "✓" : t.type === "error" ? "⚠" : "ℹ"}
              </span>
              <div className="flex-1 whitespace-pre-wrap">{t.message}</div>
              <button
                onClick={() => remove(t.id)}
                className="ml-2 opacity-80 hover:opacity-100"
                aria-label="Fechar"
                title="Fechar"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx)
    throw new Error("useToast deve ser usado dentro de <ToastProvider/>");
  return ctx;
}
