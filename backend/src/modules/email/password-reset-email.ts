import nodemailer from "nodemailer";
import { createElement } from "react";
import { render } from "@react-email/render";
import { PasswordResetEmail } from "./templates/password-reset-email.js";
import type { Env } from "../../config/env.js";

export function createPasswordResetMail(env: Env) {
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    ...(env.SMTP_USER && env.SMTP_PASSWORD
      ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } }
      : {}),
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    disableFileAccess: true,
    disableUrlAccess: true,
    logger: false,
    debug: false,
  });
  return {
    async sendReset(email: string, token: string) {
      const url = new URL("/reset-password", env.FRONTEND_URL);
      // A fragment keeps the secret out of HTTP URLs, access logs and referrers.
      url.hash = new URLSearchParams({ token }).toString();
      await transport.sendMail({
        from: env.EMAIL_FROM,
        to: email,
        subject: "TechNest — Đặt lại mật khẩu",
        html: await render(
          createElement(PasswordResetEmail, {
            kind: "reset",
            actionUrl: url.href,
            supportEmail: env.EMAIL_SUPPORT_EMAIL,
          }),
        ),
        text: `Bạn đã yêu cầu đặt lại mật khẩu TechNest. Mở liên kết dưới đây trong vòng 15 phút:

${url.href}

Liên kết chỉ dùng một lần. Nếu bạn không yêu cầu, hãy bỏ qua email này.`,
      });
    },
    async sendChanged(email: string) {
      await transport.sendMail({
        from: env.EMAIL_FROM,
        to: email,
        subject: "TechNest — Mật khẩu đã được thay đổi",
        html: await render(
          createElement(PasswordResetEmail, {
            kind: "changed",
            actionUrl: new URL("/login", env.FRONTEND_URL).href,
            supportEmail: env.EMAIL_SUPPORT_EMAIL,
          }),
        ),
        text: `Mật khẩu TechNest của bạn vừa được đặt lại. Các phiên đăng nhập cũ đã bị thu hồi. Nếu không phải bạn thực hiện, hãy liên hệ ${env.EMAIL_SUPPORT_EMAIL}.`,
      });
    },
  };
}
