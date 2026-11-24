import { useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCheck,
  Circle,
  Clock3,
  KeyRound,
  LoaderCircle,
  LogOut,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";
import PasswordInput from "../common/PasswordInput";
import { accountApi } from "../../api/accountClient";
import "./AccountSecurity.css";

export default function AccountSecurity({
  sessions,
  setSessions,
  language,
  loading,
  initialLoading,
  notice,
  error,
  runAction,
  onLogout,
}) {
  const vi = language === "vi";
  const text = (vn, en) => (vi ? vn : en);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [formError, setFormError] = useState("");
  const [confirmRevoke, setConfirmRevoke] = useState(null);
  const submitting = useRef(false);
  const busy = loading || initialLoading;
  const activeCount = sessions.filter(
    (session) => !session.revokedAt && new Date(session.expiresAt) > new Date(),
  ).length;
  const requirements = [
    [password.length >= 12, text("Từ 12 đến 128 ký tự", "12 to 128 characters")],
    [
      /[A-Z]/.test(password) && /[a-z]/.test(password),
      text("Có chữ hoa và chữ thường", "Uppercase and lowercase letters"),
    ],
    [/[0-9]/.test(password), text("Có ít nhất một chữ số", "At least one number")],
  ];
  const date = (value) =>
    new Intl.DateTimeFormat(vi ? "vi-VN" : "en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  const submit = async (event) => {
    event.preventDefault();
    if (busy || submitting.current) return;
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    if (data.newPassword !== data.confirmPassword) {
      setFormError(
        text(
          "Mật khẩu xác nhận chưa khớp. Vui lòng kiểm tra lại.",
          "The confirmation does not match your new password.",
        ),
      );
      form.elements.namedItem("confirmPassword").focus();
      return;
    }
    if (data.currentPassword === data.newPassword) {
      setFormError(
        text(
          "Hãy chọn mật khẩu khác với mật khẩu hiện tại.",
          "Choose a password different from your current password.",
        ),
      );
      return;
    }
    setFormError("");
    submitting.current = true;
    try {
      await runAction(
        async () => {
          await accountApi.changePassword({
            currentPassword: data.currentPassword,
            newPassword: data.newPassword,
          });
          form.reset();
          setPassword("");
          setConfirmation("");
          await onLogout();
        },
        text("Đã đổi mật khẩu. Vui lòng đăng nhập lại.", "Password updated. Please sign in again."),
      );
    } finally {
      submitting.current = false;
    }
  };

  return (
    <div className="account-security">
      <header className="security-heading">
        <span className="security-heading-icon" aria-hidden="true">
          <ShieldCheck size={25} />
        </span>
        <div>
          <span className="security-eyebrow">ACCOUNT SECURITY</span>
          <h2>{text("Bảo mật tài khoản", "Account security")}</h2>
          <p>
            {text(
              "Quản lý mật khẩu và các phiên đăng nhập của bạn.",
              "Manage your password and signed-in sessions.",
            )}
          </p>
        </div>
      </header>
      {notice && (
        <div className="security-notice" role="status">
          <CheckCheck size={18} />
          {notice}
        </div>
      )}

      <section className="security-card" aria-labelledby="security-password-title">
        <div className="security-card-heading">
          <span className="security-section-icon" aria-hidden="true">
            <KeyRound size={20} />
          </span>
          <div>
            <h3 id="security-password-title">{text("Đổi mật khẩu", "Change password")}</h3>
            <p>
              {text(
                "Sử dụng mật khẩu riêng cho tài khoản TechNest.",
                "Use a unique password for your TechNest account.",
              )}
            </p>
          </div>
        </div>
        <div className="security-password-layout">
          <form className="security-password-form" onSubmit={submit} aria-busy={loading}>
            <label htmlFor="security-current-password">
              {text("Mật khẩu hiện tại", "Current password")}
              <PasswordInput
                id="security-current-password"
                name="currentPassword"
                autoComplete="current-password"
                placeholder={text("Nhập mật khẩu hiện tại", "Enter your current password")}
                required
                maxLength={128}
                disabled={busy}
                showLabel={text("Hiện mật khẩu hiện tại", "Show current password")}
                hideLabel={text("Ẩn mật khẩu hiện tại", "Hide current password")}
              />
            </label>
            <label htmlFor="security-new-password">
              {text("Mật khẩu mới", "New password")}
              <PasswordInput
                id="security-new-password"
                name="newPassword"
                autoComplete="new-password"
                placeholder={text("Nhập mật khẩu mới", "Enter your new password")}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setFormError("");
                }}
                required
                minLength={12}
                maxLength={128}
                pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{12,128}"
                title={text(
                  "Ít nhất 12 ký tự, có chữ hoa, chữ thường và số",
                  "At least 12 characters, with uppercase and lowercase letters and a number",
                )}
                aria-describedby="security-password-requirements"
                disabled={busy}
                showLabel={text("Hiện mật khẩu mới", "Show new password")}
                hideLabel={text("Ẩn mật khẩu mới", "Hide new password")}
              />
            </label>
            <label htmlFor="security-confirm-password">
              {text("Xác nhận mật khẩu mới", "Confirm new password")}
              <PasswordInput
                id="security-confirm-password"
                name="confirmPassword"
                autoComplete="new-password"
                placeholder={text("Nhập lại mật khẩu mới", "Re-enter your new password")}
                value={confirmation}
                onChange={(event) => {
                  setConfirmation(event.target.value);
                  setFormError("");
                }}
                required
                maxLength={128}
                disabled={busy}
                aria-invalid={Boolean(formError)}
                aria-describedby={formError ? "security-password-error" : undefined}
                showLabel={text("Hiện mật khẩu xác nhận", "Show password confirmation")}
                hideLabel={text("Ẩn mật khẩu xác nhận", "Hide password confirmation")}
              />
            </label>
            {formError && (
              <p id="security-password-error" className="security-form-error" role="alert">
                {formError}
              </p>
            )}
            <button className="security-save" type="submit" disabled={busy}>
              {loading ? (
                <LoaderCircle className="security-spinner" size={17} />
              ) : (
                <KeyRound size={17} />
              )}
              {text(
                loading ? "Đang cập nhật…" : "Cập nhật mật khẩu",
                loading ? "Updating…" : "Update password",
              )}
              <ArrowRight size={16} />
            </button>
          </form>
          <aside className="security-password-guide">
            <span className="security-guide-icon" aria-hidden="true">
              <ShieldCheck size={21} />
            </span>
            <h4>{text("Một mật khẩu an toàn", "A secure password")}</h4>
            <ul id="security-password-requirements">
              {requirements.map(([met, label]) => (
                <li key={label} className={met ? "is-met" : ""}>
                  {met ? (
                    <Check size={15} aria-hidden="true" />
                  ) : (
                    <Circle size={12} aria-hidden="true" />
                  )}
                  <span>{label}</span>
                </li>
              ))}
            </ul>
            <p>
              {text(
                "Sau khi đổi mật khẩu, tất cả phiên đăng nhập sẽ kết thúc. Bạn cần đăng nhập lại bằng mật khẩu mới.",
                "Changing your password ends all signed-in sessions. Sign in again with your new password.",
              )}
            </p>
          </aside>
        </div>
      </section>

      <section
        className="security-card"
        aria-labelledby="security-sessions-title"
        aria-busy={initialLoading}
      >
        <div className="security-card-heading security-sessions-heading">
          <span className="security-section-icon" aria-hidden="true">
            <Clock3 size={20} />
          </span>
          <div>
            <h3 id="security-sessions-title">{text("Phiên đăng nhập", "Signed-in sessions")}</h3>
            <p>
              {text(
                "Thu hồi các phiên bạn không còn sử dụng hoặc không nhận ra.",
                "Revoke sessions you no longer use or do not recognize.",
              )}
            </p>
          </div>
          {!initialLoading && !error && (
            <span className="security-session-count">
              {activeCount} {text("đang hoạt động", "active")}
            </span>
          )}
        </div>
        {initialLoading ? (
          <div className="security-sessions-loading" role="status">
            <LoaderCircle className="security-spinner" size={20} />
            {text("Đang tải phiên đăng nhập…", "Loading sessions…")}
          </div>
        ) : sessions.length ? (
          <ul
            className="security-session-list"
            tabIndex={0}
            aria-label={text("Danh sách phiên đăng nhập", "Signed-in sessions list")}
          >
            {sessions.map((session) => {
              const revoked = Boolean(session.revokedAt);
              const expired = new Date(session.expiresAt) <= new Date();
              const inactive = revoked || expired;
              return (
                <li
                  className={`security-session${inactive ? " is-inactive" : ""}`}
                  key={session.id}
                >
                  <span className="security-session-icon" aria-hidden="true">
                    {inactive ? <ShieldOff size={20} /> : <ShieldCheck size={20} />}
                  </span>
                  <div className="security-session-body">
                    <div className="security-session-title">
                      <h4>
                        {text("Phiên đăng nhập", "Session")} <span>#{session.id}</span>
                      </h4>
                      <span className={`security-session-status${inactive ? " is-inactive" : ""}`}>
                        <i />
                        {revoked
                          ? text("Đã thu hồi", "Revoked")
                          : expired
                            ? text("Đã hết hạn", "Expired")
                            : text("Đang hoạt động", "Active")}
                      </span>
                    </div>
                    <dl>
                      <div>
                        <dt>{text("Đăng nhập", "Signed in")}</dt>
                        <dd>{date(session.createdAt)}</dd>
                      </div>
                      <div>
                        <dt>{text("Hết hạn", "Expires")}</dt>
                        <dd>{date(session.expiresAt)}</dd>
                      </div>
                    </dl>
                  </div>
                  {!inactive && (
                    <button
                      type="button"
                      className="security-revoke"
                      disabled={busy}
                      onClick={() => setConfirmRevoke(session.id)}
                      aria-expanded={confirmRevoke === session.id}
                    >
                      <LogOut size={15} />
                      {text("Thu hồi", "Revoke")}
                    </button>
                  )}
                  {confirmRevoke === session.id && !inactive && (
                    <div className="security-session-confirm">
                      <p>
                        {text(
                          "Thu hồi sẽ đăng xuất phiên này. Bạn muốn tiếp tục?",
                          "This will sign out this session. Continue?",
                        )}
                      </p>
                      <div>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setConfirmRevoke(null)}
                        >
                          {text("Hủy", "Cancel")}
                        </button>
                        <button
                          type="button"
                          className="security-confirm-revoke"
                          disabled={busy}
                          onClick={() =>
                            void runAction(
                              async () => {
                                await accountApi.revokeSession(session.id);
                                setSessions(await accountApi.sessions());
                                setConfirmRevoke(null);
                              },
                              text("Đã thu hồi phiên đăng nhập.", "Session revoked."),
                            )
                          }
                        >
                          {text(
                            loading ? "Đang thu hồi…" : "Thu hồi phiên",
                            loading ? "Revoking…" : "Revoke session",
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="security-session-empty">
            <Clock3 size={28} />
            <strong>
              {error
                ? text("Chưa thể tải phiên đăng nhập", "Sessions are unavailable")
                : text("Chưa có phiên đăng nhập để hiển thị", "No sessions to display")}
            </strong>
            <p>
              {text(
                "Các phiên đăng nhập của tài khoản sẽ xuất hiện tại đây.",
                "Your account sessions will appear here.",
              )}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
