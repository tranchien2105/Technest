import { useState } from "react";
import { ArrowRight, Check, ShieldCheck, Sparkles } from "lucide-react";
import { forgotPassword, resetPassword, getMe, login, register } from "../api/authClient";
import { tx } from "../utils/translate";
import { PageTitle } from "../components/store/PageElements";
import "./AuthPage.css";
import PasswordInput from "../components/common/PasswordInput";

function authErrorMessage(error, lang) {
  if (!lang) return error.message;
  const messages = {
    INVALID_RESET_TOKEN: "Liên kết không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu liên kết mới.",
    EMAIL_ALREADY_EXISTS: "Email này đã được đăng ký.",
    INVALID_CREDENTIALS: "Email hoặc mật khẩu không chính xác.",
    ACCOUNT_BLOCKED: "Tài khoản này hiện đang bị khóa.",
    RATE_LIMITED: "Bạn thử quá nhiều lần. Vui lòng chờ một chút rồi thử lại.",
    VALIDATION_ERROR: "Vui lòng kiểm tra lại thông tin đã nhập. Mật khẩu cần ít nhất 12 ký tự.",
    NETWORK_ERROR: "Không thể kết nối đến máy chủ. Hãy kiểm tra backend đang chạy.",
    PASSWORD_MISMATCH: "Mật khẩu xác nhận chưa khớp.",
  };
  return messages[error.code] || error.message;
}

export default function AuthPage({ route, navigate, language, onAuthenticate }) {
  const { pathname: path } = new URL(route, "http://technest.local");
  const lang = language === "vi";
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  const [resetToken] = useState(() => {
    const url = new URL(route, "http://technest.local");
    return (
      new URLSearchParams(url.hash.slice(1)).get("token") || url.searchParams.get("token") || ""
    );
  });

  const formPage = (title, action, fields, extra, onSuccess) => (
    <section className="store-page auth-page">
      <div className="auth-shell">
        <aside className="auth-welcome-panel">
          <div className="auth-brand-mark">
            <span className="auth-brand-icon">T</span>
            <span>TECHNEST</span>
          </div>
          <div className="auth-welcome-copy">
            <span className="auth-panel-kicker">
              <Sparkles size={14} />{" "}
              {tx("Your tech, your way", "Công nghệ theo cách của bạn", lang)}
            </span>
            <h2>
              {tx(
                "Everything you love, in one place.",
                "Mọi điều bạn cần, trong một tài khoản.",
                lang,
              )}
            </h2>
            <p>
              {tx(
                "Sign in to keep track of your orders, discover member offers and get more from your next upgrade.",
                "Đăng nhập để theo dõi đơn hàng, khám phá ưu đãi thành viên và chọn món công nghệ tiếp theo.",
                lang,
              )}
            </p>
            <ul>
              <li>
                <Check size={16} />
                {tx("Easy order tracking", "Theo dõi đơn hàng dễ dàng", lang)}
              </li>
              <li>
                <Check size={16} />
                {tx("Offers picked for you", "Ưu đãi dành riêng cho bạn", lang)}
              </li>
              <li>
                <Check size={16} />
                {tx("A smoother checkout", "Thanh toán thuận tiện hơn", lang)}
              </li>
            </ul>
          </div>
          <div className="auth-panel-foot">
            <ShieldCheck size={17} />
            {tx("Your account is protected", "Tài khoản của bạn được bảo vệ", lang)}
          </div>
        </aside>
        <div className="auth-form-panel">
          <div className="auth-mobile-brand">
            <span className="auth-brand-icon">T</span> TECHNEST
          </div>
          <PageTitle
            title={title}
            desc={
              resetComplete
                ? tx(
                    "Your account is ready. Sign in to continue.",
                    "Tài khoản đã sẵn sàng. Đăng nhập để tiếp tục nhé.",
                    lang,
                  )
                : path === "/forgot-password" || path === "/reset-password"
                  ? tx(
                      "Recover access to your TechNest account.",
                      "Khôi phục quyền truy cập tài khoản TechNest.",
                      lang,
                    )
                  : path === "/register"
                    ? tx(
                        "Join TechNest and make your next upgrade count.",
                        "Tạo tài khoản TechNest để tận hưởng trải nghiệm mua sắm tốt hơn.",
                        lang,
                      )
                    : tx(
                        "Sign in to continue to your TechNest account.",
                        "Đăng nhập để tiếp tục với tài khoản TechNest của bạn.",
                        lang,
                      )
            }
          />
          {resetComplete ? (
            <section className="auth-reset-success">
              <div className="auth-reset-success-icon" aria-hidden="true">
                <Check size={32} strokeWidth={2.5} />
              </div>
              <p className="form-success" role="status">
                {notice}
              </p>
              <p className="auth-reset-success-note">
                {tx(
                  "Your previous sessions have been signed out. Use your new password to sign in again.",
                  "Các phiên đăng nhập cũ đã được đăng xuất. Hãy dùng mật khẩu mới để truy cập lại tài khoản.",
                  lang,
                )}
              </p>
              <a className="primary-button auth-submit" href="/login">
                {tx("Sign in with your new password", "Đăng nhập bằng mật khẩu mới", lang)}
                <ArrowRight size={17} />
              </a>
              <a className="auth-reset-home" href="/">
                {tx("Back to the store", "Về trang chủ", lang)}
              </a>
            </section>
          ) : (
            <form
              className="store-form auth-form"
              onSubmit={async (event) => {
                event.preventDefault();
                setError("");
                setNotice("");
                setBusy(true);
                try {
                  if (onSuccess) await onSuccess(event);
                  else setNotice(action);
                } catch (requestError) {
                  setError(authErrorMessage(requestError, lang));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {fields}
              {extra}
              <button
                className="primary-button auth-submit"
                type="submit"
                disabled={
                  busy ||
                  resetComplete ||
                  (path === "/reset-password" && !/^[A-Za-z0-9_-]{43}$/.test(resetToken))
                }
              >
                {busy ? tx("Please wait…", "Đang xử lý…", lang) : tx("Continue", "Tiếp tục", lang)}{" "}
                {!busy && <ArrowRight size={16} />}
              </button>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              {notice && (
                <p className="form-success" role="status">
                  {notice}
                </p>
              )}
            </form>
          )}
          <p className="auth-security-note">
            <ShieldCheck size={15} />
            {tx(
              "Secure sign-in. Your details stay private.",
              "Đăng nhập an toàn. Thông tin của bạn luôn được bảo mật.",
              lang,
            )}
          </p>
        </div>
      </div>
    </section>
  );

  const finishAuthentication = async (user) => {
    onAuthenticate(user);
    const next = new URL(route, "http://technest.local").searchParams.get("next");
    navigate(next || "/account", true);
  };

  if (path === "/login") {
    return formPage(
      tx("Welcome back", "Chào mừng bạn trở lại", lang),
      "",
      <>
        <label>
          {tx("Email", "Email", lang)}
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          {tx("Password", "Mật khẩu", lang)}
          <PasswordInput
            name="password"
            showLabel={tx("Show password", "Hiện mật khẩu", lang)}
            hideLabel={tx("Hide password", "Ẩn mật khẩu", lang)}
            minLength="1"
            maxLength="128"
            required
            autoComplete="current-password"
          />
        </label>
      </>,
      <p className="form-links">
        <a href="/forgot-password">{tx("Forgot password?", "Quên mật khẩu?", lang)}</a> ·{" "}
        <a href="/register">{tx("Create an account", "Tạo tài khoản", lang)}</a>
      </p>,
      async (event) => {
        const data = new FormData(event.currentTarget);
        await login({
          email: String(data.get("email") || "").trim(),
          password: String(data.get("password") || ""),
        });
        await finishAuthentication(await getMe());
      },
    );
  }

  if (path === "/register") {
    return formPage(
      tx("Create an account", "Tạo tài khoản", lang),
      "",
      <>
        <label>
          {tx("Name", "Họ tên", lang)}
          <input name="fullName" required autoComplete="name" maxLength="200" />
        </label>
        <label>
          {tx("Email", "Email", lang)}
          <input name="email" type="email" required autoComplete="email" maxLength="320" />
        </label>
        <label>
          {tx("Password", "Mật khẩu", lang)}
          <PasswordInput
            name="password"
            showLabel={tx("Show password", "Hiện mật khẩu", lang)}
            hideLabel={tx("Hide password", "Ẩn mật khẩu", lang)}
            minLength="12"
            maxLength="128"
            required
            autoComplete="new-password"
          />
        </label>
        <label>
          {tx("Confirm password", "Xác nhận mật khẩu", lang)}
          <PasswordInput
            name="confirmPassword"
            showLabel={tx("Show password", "Hiện mật khẩu", lang)}
            hideLabel={tx("Hide password", "Ẩn mật khẩu", lang)}
            minLength="12"
            maxLength="128"
            required
            autoComplete="new-password"
          />
        </label>
      </>,
      <p className="form-links">
        <a href="/login">
          {tx("Already have an account? Sign in", "Đã có tài khoản? Đăng nhập", lang)}
        </a>
      </p>,
      async (event) => {
        const data = new FormData(event.currentTarget);
        const password = String(data.get("password") || "");
        if (password !== data.get("confirmPassword")) {
          const mismatch = new Error(
            lang ? "Mật khẩu xác nhận chưa khớp." : "Passwords do not match.",
          );
          mismatch.code = "PASSWORD_MISMATCH";
          throw mismatch;
        }
        await register({
          fullName: String(data.get("fullName") || "").trim(),
          email: String(data.get("email") || "").trim(),
          password,
        });
        await finishAuthentication(await getMe());
      },
    );
  }

  if (path === "/reset-password") {
    return formPage(
      resetComplete
        ? tx("Password reset complete", "Đổi mật khẩu thành công", lang)
        : tx("Choose a new password", "Đặt mật khẩu mới", lang),
      "",
      <>
        {!/^[A-Za-z0-9_-]{43}$/.test(resetToken) && (
          <p role="alert">
            {tx(
              "This link is invalid. Request a new one.",
              "Liên kết không hợp lệ. Vui lòng yêu cầu liên kết mới.",
              lang,
            )}
          </p>
        )}
        <label>
          {tx("New password (at least 12 characters)", "Mật khẩu mới (ít nhất 12 ký tự)", lang)}
          <PasswordInput
            name="password"
            minLength={12}
            maxLength={128}
            required
            autoComplete="new-password"
          />
        </label>
        <label>
          {tx("Confirm password", "Xác nhận mật khẩu", lang)}
          <PasswordInput
            name="confirmPassword"
            minLength={12}
            maxLength={128}
            required
            autoComplete="new-password"
          />
        </label>
      </>,
      <p className="form-links">
        <a href="/login">{tx("Sign in", "Đăng nhập", lang)}</a> ·{" "}
        <a href="/forgot-password">{tx("Request a new link", "Yêu cầu liên kết mới", lang)}</a>
      </p>,
      async (event) => {
        const data = new FormData(event.currentTarget);
        const password = String(data.get("password") || "");
        if (password !== data.get("confirmPassword"))
          throw Object.assign(new Error("Passwords do not match."), { code: "PASSWORD_MISMATCH" });
        const form = event.currentTarget;
        await resetPassword(resetToken, password);
        onAuthenticate?.(null);
        setResetComplete(true);
        setNotice(
          tx(
            "Password updated. Please sign in again.",
            "Mật khẩu đã được cập nhật. Vui lòng đăng nhập lại.",
            lang,
          ),
        );
        form.reset();
      },
    );
  }
  return formPage(
    tx("Forgot your password?", "Quên mật khẩu?", lang),
    "",
    <label>
      {tx("Registered email", "Email đã đăng ký", lang)}
      <input name="email" type="email" required maxLength={320} autoComplete="email" />
    </label>,
    <p className="form-links">
      <a href="/login">{tx("Back to sign in", "Quay lại đăng nhập", lang)}</a>
    </p>,
    async (event) => {
      const data = new FormData(event.currentTarget);
      await forgotPassword(String(data.get("email") || "").trim());
      setNotice(
        tx(
          "If this email is registered, you will receive a password reset link valid for 15 minutes. Check your inbox and spam folder.",
          "Nếu email đã được đăng ký, bạn sẽ nhận được liên kết đặt lại mật khẩu có hiệu lực 15 phút. Hãy kiểm tra cả thư rác.",
          lang,
        ),
      );
    },
  );
}
