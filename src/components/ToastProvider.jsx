import { useEffect, useState } from "react";
import { subscribeToast } from "./toastStore";
import "./Toast.css";

const DEFAULT_DURATION = 4500;
let toastCounter = 0;

const buildId = () => {
  toastCounter += 1;
  return `toast-${Date.now()}-${toastCounter}`;
};

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const unsubscribe = subscribeToast((payload) => {
      const id = payload.id || buildId();
      const duration =
        Number.isFinite(payload.duration) && payload.duration > 0
          ? payload.duration
          : DEFAULT_DURATION;

      setToasts((prev) => [...prev, { ...payload, id }]);

      if (payload.duration !== Infinity) {
        window.setTimeout(() => {
          setToasts((prev) => prev.filter((toast) => toast.id !== id));
        }, duration);
      }
    });

    return unsubscribe;
  }, []);

  const dismiss = (id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  return (
    <>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type || "info"}`}>
            <div className="toast-body">
              <div className="toast-title">{toast.message}</div>
              {toast.description && (
                <div className="toast-description">{toast.description}</div>
              )}
            </div>
            <button
              type="button"
              className="toast-close"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
