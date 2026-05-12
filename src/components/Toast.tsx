import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
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
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = crypto.randomUUID();

    setToasts((prev) => {
      const next = [...prev, { id, message, type }];
      // Max 3 visible toasts at once
      if (next.length > 3) {
        return next.slice(next.length - 3);
      }
      return next;
    });

    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
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
                'cursor-pointer rounded-lg border px-4 py-3 shadow-lg',
                'bg-clinical-surface border-clinical-line text-clinical-ink',
                'min-w-[260px] max-w-[360px]'
              )}
            >
              <p
                className={cn(
                  'text-sm font-medium',
                  toast.type === 'success' && 'text-clinical-green',
                  toast.type === 'info' && 'text-clinical-blue',
                  toast.type === 'warning' && 'text-clinical-amber',
                  toast.type === 'error' && 'text-clinical-red'
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
