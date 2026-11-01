import { useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { getMe, login } from "../api/authClient";
import "./admin-login.css";

export default function AdminLogin({ path, navigate, onAuthenticate }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await login({
        email: String(form.get("email") || "").trim(),
        password: String(form.get("password") || ""),
      });
      const user = await getMe();
      onAuthenticate(user);
      navigate(path, true);
    } catch (requestError) {
      setError(requestError.message || "Không thể đăng nhập.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-login-page">
      <a className="admin-login-brand" href="/admin" onClick={(event) => { event.preventDefault(); navigate("/admin"); }}>
        <span className="admin-brand-mark">TN</span>
        <strong>Technest<span>.</span></strong>
        <small>ADMIN</small>
      </a>
      <section className="admin-login-card">
        <span className="admin-login-icon"><ShieldCheck size={25} /></span>
        <span className="admin-eyebrow">KHU VỰC QUẢN TRỊ</span>
        <h1>Đăng nhập quản trị</h1>
        <p className="admin-login-description">Đăng nhập bằng tài khoản quản trị hoặc nhân viên đã được cấp quyền.</p>
        <form onSubmit={submit}>
          <label>Email<input name="email" type="email" autoComplete="username" required /></label>
          <label>Mật khẩu<input name="password" type="password" autoComplete="current-password" required /></label>
          {error && <p className="admin-login-error" role="alert">{error}</p>}
          <button type="submit" disabled={busy}>{busy ? "Đang xác minh…" : "Đăng nhập"}<ArrowRight size={17} /></button>
        </form>
        <button className="admin-login-home" type="button" onClick={() => navigate("/")}>Quay lại cửa hàng</button>
      </section>
    </main>
  );
}
