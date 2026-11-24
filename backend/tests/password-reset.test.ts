import { describe, expect, it, vi } from "vitest";
import { createPasswordResetService } from "../src/modules/auth/password-reset.service.js";
import { forgotPasswordSchema, resetPasswordSchema } from "../src/modules/auth/auth.schemas.js";
import { createPasswordResetMail } from "../src/modules/email/password-reset-email.js";
import { envSchema } from "../src/config/env.js";

const sendMail = vi.hoisted(() => vi.fn().mockResolvedValue({}));
vi.mock("nodemailer", () => ({ default: { createTransport: () => ({ sendMail }) } }));

describe("Password reset", () => {
  it("returns the same response for unknown, known and delivery-failure accounts and never stores the secret", async () => {
    const repository = { issue: vi.fn(), consume: vi.fn() };
    const mail = { sendReset: vi.fn(), sendChanged: vi.fn() };
    const report = vi.fn();
    const service = createPasswordResetService(repository, mail, report);
    repository.issue.mockResolvedValue(null);
    const unknown = await service.forgot("unknown@example.test");
    expect(mail.sendReset).not.toHaveBeenCalled();
    repository.issue.mockResolvedValue({ email: "known@example.test" });
    expect(await service.forgot("known@example.test")).toEqual(unknown);
    const token = mail.sendReset.mock.calls[0]![1] as string;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(repository.issue.mock.calls[1]![1]).toMatch(/^[a-f0-9]{64}$/);
    expect(repository.issue.mock.calls[1]![1]).not.toBe(token);
    expect((repository.issue.mock.calls[1]![2] as Date).getTime() - Date.now()).toBeGreaterThan(
      14 * 60_000,
    );
    mail.sendReset.mockRejectedValue(new Error("SMTP failed"));
    expect(await service.forgot("known@example.test")).toEqual(unknown);
    expect(report).toHaveBeenCalledOnce();
  });

  it("normalizes emails, rejects invalid tokens and enforces the existing password policy", () => {
    expect(forgotPasswordSchema.parse({ email: "  TEST@example.test " }).email).toBe(
      "test@example.test",
    );
    expect(
      resetPasswordSchema.safeParse({ token: "invalid", password: "long-password-123" }).success,
    ).toBe(false);
    expect(
      resetPasswordSchema.safeParse({ token: "a".repeat(43), password: "short" }).success,
    ).toBe(false);
  });

  it("does not report success for invalid tokens; confirmation delivery failure does not roll back a changed password", async () => {
    const repository = { issue: vi.fn(), consume: vi.fn().mockResolvedValue(null) };
    const mail = { sendReset: vi.fn(), sendChanged: vi.fn().mockRejectedValue(new Error("SMTP")) };
    const report = vi.fn();
    const service = createPasswordResetService(repository, mail, report);
    await expect(service.reset("a".repeat(43), "new-password-123")).rejects.toMatchObject({
      code: "INVALID_RESET_TOKEN",
    });
    expect(mail.sendChanged).not.toHaveBeenCalled();
    repository.consume.mockResolvedValue({ email: "person@example.test" });
    await expect(service.reset("b".repeat(43), "new-password-123")).resolves.toHaveProperty(
      "message",
    );
    expect(repository.consume.mock.calls[1]![1]).toMatch(/^\$argon2id\$/);
    expect(report).toHaveBeenCalledOnce();
  });

  it("uses the configured frontend for email links and keeps tokens out of the query string", async () => {
    const env = envSchema.parse({
      AUTH_JWT_SECRET: "test-secret".repeat(5),
      DATABASE_URL: "postgres://localhost/test",
      REDIS_URL: "redis://localhost",
      FRONTEND_URL: "https://shop.example.test",
    });
    const mail = createPasswordResetMail(env);
    await mail.sendReset("person@example.test", "a".repeat(43));
    const message = sendMail.mock.calls.at(-1)![0];
    expect(message.text).toContain(
      "https://shop.example.test/reset-password#token=" + "a".repeat(43),
    );
    expect(message.text).not.toContain("?token=");
    expect(message.html).toContain("Đặt lại mật khẩu");
    expect(message.html).toContain(
      "https://shop.example.test/reset-password#token=" + "a".repeat(43),
    );
    expect(message.html).toContain("15 phút");
    expect(message.html).toContain("mailto:support@technest.local");
    await mail.sendChanged("person@example.test");
    const confirmation = sendMail.mock.calls.at(-1)![0];
    expect(confirmation.html).toContain("Mật khẩu đã được cập nhật");
    expect(confirmation.html).toContain("https://shop.example.test/login");
    expect(confirmation.html).not.toContain("#token=");
  });
});
