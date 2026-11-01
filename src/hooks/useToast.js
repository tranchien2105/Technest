import { useEffect, useRef, useState } from "react";

export function useToast() {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const dismissToast = () => {
    window.clearTimeout(timer.current);
    setToast(null);
  };
  const notify = (message, action = null) => {
    window.clearTimeout(timer.current);
    setToast({ message, action });
    timer.current = window.setTimeout(() => setToast(null), action ? 5000 : 3200);
  };
  return { toast, notify, dismissToast };
}
