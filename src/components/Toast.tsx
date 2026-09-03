import { useEffect } from 'react';

export interface ToastMessage {
  id: string;
  type: 'loading' | 'success' | 'error' | 'info';
  message: string;
  duration?: number;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="mandrak-toast-container" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
  useEffect(() => {
    if (toast.type !== 'loading' && toast.duration !== 0) {
      const timer = setTimeout(() => {
        onDismiss();
      }, toast.duration || 3200);
      return () => clearTimeout(timer);
    }
  }, [toast, onDismiss]);

  return (
    <div className={`mandrak-toast-pill toast-${toast.type}`}>
      <span className="toast-icon">
        {toast.type === 'loading' && <span className="toast-spinner" />}
        {toast.type === 'success' && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="15" height="15" className="toast-svg-success">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        )}
        {toast.type === 'error' && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="15" height="15" className="toast-svg-error">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
        {toast.type === 'info' && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="15" height="15" className="toast-svg-info">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      </span>
      <span className="toast-message">{toast.message}</span>
      {toast.type !== 'loading' && (
        <button
          type="button"
          className="toast-close-btn"
          onClick={onDismiss}
          aria-label="Dismiss notification"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="13" height="13">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
