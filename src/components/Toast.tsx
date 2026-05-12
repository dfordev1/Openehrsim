import { createContext, useCallback, useContext, useState, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '../lib/utils';

type ToastType = 'success' | 'info' | 'warning' | 'error';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  addToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
}

// Deduplicate window — if the same message fires within this ms, ignore the repeat
const DEDUP_MS = 1500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Track recently shown messages to prevent duplicates
  const recentMessages = useRef<Map<string, number>>(new Map());

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const now = Date.now();
    const key = `${type}:${message}`;

    // Deduplicate: skip if the identical toast was shown within DEDUP_MS
    const lastShown = recentMessages.current.get(key);
    if (lastShown && now - lastShown < DEDUP_MS) return;
    recentMessages.current.set(key, now);

    // Clean up stale dedup entries (>5 s old) to avoid memory growth
    recentMessages.current.forEach((ts, k) => {
      if (now - ts > 5000) recentMessages.current.delete(k);
    });

    const id = crypto.randomUUID();

    setToasts((prev) => {
      const next = [...prev, { id, message, type }];
      // Max 3 visible toasts
      return next.length > 3 ? next.slice(next.length - 3) : next;
    });

    // Auto-dismiss
    const timeout = type === 'error' ? 5000 : 3000;
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, timeout);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.95 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={() => removeToast(toast.id)}
              className={cn(
                'cursor-pointer rounded-lg border px-4 py-3 shadow-lg pointer-events-auto',
                'bg-clinical-surface border-clinical-line text-clinical-ink',
                'min-w-[260px] max-w-[360px]',
                // Left accent bar by type
                toast.type === 'success' && 'border-l-2 border-l-clinical-green',
                toast.type === 'info'    && 'border-l-2 border-l-clinical-blue',
                toast.type === 'warning' && 'border-l-2 border-l-clinical-amber',
                toast.type === 'error'   && 'border-l-2 border-l-clinical-red',
              )}
            >
              <p
                className={cn(
                  'text-sm font-medium',
                  toast.type === 'success' && 'text-clinical-green',
                  toast.type === 'info'    && 'text-clinical-blue',
                  toast.type === 'warning' && 'text-clinical-amber',
                  toast.type === 'error'   && 'text-clinical-red'
                )}
              >
                {toast.message}
              </p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
