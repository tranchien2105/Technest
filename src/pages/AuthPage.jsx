import { useState } from "react";
import { ArrowRight, Check, ShieldCheck, Sparkles } from "lucide-react";
import { getMe, login, register } from "../api/authClient";
import { tx } from "../utils/translate";
import { PageTitle } from "../components/store/PageElements";
import "./AuthPage.css";
import PasswordInput from "../components/common/PasswordInput";

function authErrorMessage(error, lang) {
  if (!lang) return error.message;
  const messages = {
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

  const formPage = (title, action, fields, extra, onSuccess) => (
    <section className="store-page auth-page">
      <div className="auth-shell">
        <aside className="auth-welcome-panel">
          <div className="auth-brand-mark"><span className="auth-brand-icon">T</span><span>TECHNEST</span></div>
          <div className="auth-welcome-copy">
            <span className="auth-panel-kicker"><Sparkles size={14} /> {tx("Your tech, your way", "Công nghệ theo cách của bạn", lang)}</span>
            <h2>{tx("Everything you love, in one place.", "Mọi điều bạn cần, trong một tài khoản.", lang)}</h2>
            <p>{tx("Sign in to keep track of your orders, discover member offers and get more from your next upgrade.", "Đăng nhập để theo dõi đơn hàng, khám phá ưu đãi thành viên và chọn món công nghệ tiếp theo.", lang)}</p>
            <ul>
              <li><Check size={16} />{tx("Easy order tracking", "Theo dõi đơn hàng dễ dàng", lang)}</li>
              <li><Check size={16} />{tx("Offers picked for you", "Ưu đãi dành riêng cho bạn", lang)}</li>
              <li><Check size={16} />{tx("A smoother checkout", "Thanh toán thuận tiện hơn", lang)}</li>
            </ul>
          </div>
          <div className="auth-panel-foot"><ShieldCheck size={17} />{tx("Your account is protected", "Tài khoản của bạn được bảo vệ", lang)}</div>
        </aside>
        <div className="auth-form-panel">
          <div className="auth-mobile-brand"><span className="auth-brand-icon">T</span> TECHNEST</div>
          <PageTitle title={title} desc={path === "/register" ? tx("Join TechNest and make your next upgrade count.", "Tạo tài khoản TechNest để tận hưởng trải nghiệm mua sắm tốt hơn.", lang) : tx("Sign in to continue to your TechNest account.", "Đăng nhập để tiếp tục với tài khoản TechNest của bạn.", lang)} />
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
        <button className="primary-button auth-submit" type="submit" disabled={busy}>
          {busy
            ? tx("Please wait…", "Đang xử lý…", lang)
            : tx("Continue", "Tiếp tục", lang)}{" "}
          {!busy && <ArrowRight size={16} />}
        </button>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {notice && <p className="form-success" role="status">{notice}</p>}
      </form>
          <p className="auth-security-note"><ShieldCheck size={15} />{tx("Secure sign-in. Your details stay private.", "Đăng nhập an toàn. Thông tin của bạn luôn được bảo mật.", lang)}</p>
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
        <a href="/login">{tx("Already have an account? Sign in", "Đã có tài khoản? Đăng nhập", lang)}</a>
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

  return formPage(
    tx("Reset your password", "Đặt lại mật khẩu", lang),
    tx(
      "Password reset is not available yet.",
      "Chức năng đặt lại mật khẩu chưa được triển khai.",
      lang,
    ),
    <label>
      {tx("Email", "Email", lang)}
      <input type="email" required autoComplete="email" />
    </label>,
    <p className="form-links">
      <a href="/login">{tx("Back to sign in", "Quay lại đăng nhập", lang)}</a>
    </p>,
  );
}
