import { create } from 'zustand';
import { useEffect } from 'react';
import styles from './Toast.module.css';

interface ToastAction {
  label: string;
  run: () => void;
}
interface ToastState {
  message: string | null;
  action?: ToastAction;
  show: (message: string, action?: ToastAction) => void;
  hide: () => void;
}

let timer: ReturnType<typeof setTimeout> | undefined;

export const useToast = create<ToastState>((set) => ({
  message: null,
  show: (message, action) => {
    clearTimeout(timer);
    set({ message, action });
    timer = setTimeout(() => set({ message: null, action: undefined }), 5000);
  },
  hide: () => {
    clearTimeout(timer);
    set({ message: null, action: undefined });
  },
}));

export function ToastHost() {
  const { message, action, hide } = useToast();
  useEffect(() => () => clearTimeout(timer), []);
  if (!message) return null;
  return (
    <div className={styles.toast} role="status" aria-live="polite">
      <span>{message}</span>
      {action && (
        <button
          type="button"
          className={styles.act}
          onClick={() => {
            action.run();
            hide();
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
