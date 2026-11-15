import React, { useEffect } from "react";
import { CheckCircleIcon, XCircleIcon, InfoIcon, CloseIcon } from "./Icons";

export function ToastContainer({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }) {
  useEffect(() => {
    if (toast.duration !== 0) {
      const timer = setTimeout(() => {
        onDismiss(toast.id);
      }, toast.duration || 5000);
      return () => clearTimeout(timer);
    }
  }, [toast, onDismiss]);

  const icons = {
    success: <CheckCircleIcon size={20} className="text-emerald-500" />,
    error: <XCircleIcon size={20} className="text-rose-500" />,
    info: <InfoIcon size={20} className="text-blue-500" />,
  };

  const icon = icons[toast.type] || icons.info;

  return (
    <div className={`toast-card toast-${toast.type || "info"}`}>
      <div className="toast-icon">{icon}</div>
      <div className="toast-content">
        {toast.title && <h4 className="toast-title">{toast.title}</h4>}
        <p className="toast-message">{toast.message}</p>
      </div>
      <button
        className="toast-close"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss toast"
      >
        <CloseIcon size={16} />
      </button>
    </div>
  );
}
