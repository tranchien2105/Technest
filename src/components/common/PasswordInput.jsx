import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import "./formatted-inputs.css";

export default function PasswordInput({
  showLabel = "Hiện mật khẩu",
  hideLabel = "Ẩn mật khẩu",
  ...props
}) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="password-input-wrap">
      <input {...props} type={visible ? "text" : "password"} />
      <button
        className="password-input-toggle"
        type="button"
        aria-label={visible ? hideLabel : showLabel}
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </button>
    </span>
  );
}
