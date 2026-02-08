const listeners = new Set();

export const subscribeToast = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const emitToast = (payload) => {
  listeners.forEach((listener) => listener(payload));
};

export const toast = {
  info: (message, options = {}) => emitToast({ type: "info", message, ...options }),
  success: (message, options = {}) => emitToast({ type: "success", message, ...options }),
  warning: (message, options = {}) => emitToast({ type: "warning", message, ...options }),
  error: (message, options = {}) => emitToast({ type: "error", message, ...options }),
};
