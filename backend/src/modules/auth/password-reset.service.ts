import { createHash, randomBytes } from "node:crypto";
import argon2 from "argon2";
import type { PasswordResetRepository } from "./password-reset.repository.js";
import type { createPasswordResetMail } from "../email/password-reset-email.js";
import { AppError } from "../../shared/errors.js";
const deliveryCode = (error: unknown) => {
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  return typeof code === "string" &&
    ["ECONNECTION", "ETIMEDOUT", "EAUTH", "ETLS", "EENVELOPE", "EMESSAGE", "ESOCKET"].includes(code)
    ? code
    : "SMTP_DELIVERY_FAILED";
};
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export function createPasswordResetService(
  repository: PasswordResetRepository,
  mail: ReturnType<typeof createPasswordResetMail>,
  reportFailure: (code: string) => void,
) {
  return {
    async forgot(email: string) {
      const token = randomBytes(32).toString("base64url");
      const user = await repository.issue(email, hash(token), new Date(Date.now() + 15 * 60_000));
      if (user) {
        // Delivery failures must not disclose whether an email is registered.
        try {
          await mail.sendReset(user.email, token);
        } catch (error) {
          reportFailure(deliveryCode(error));
        }
      }
      return { message: "Nếu email đã được đăng ký, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu." };
    },
    async reset(token: string, password: string) {
      const passwordHash = await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
      });
      const user = await repository.consume(hash(token), passwordHash);
      if (!user)
        throw new AppError(
          400,
          "INVALID_RESET_TOKEN",
          "Liên kết không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu liên kết mới.",
        );
      try {
        await mail.sendChanged(user.email);
      } catch (error) {
        reportFailure(deliveryCode(error));
      }
      return { message: "Mật khẩu đã được cập nhật. Vui lòng đăng nhập lại." };
    },
  };
}
export type PasswordResetService = ReturnType<typeof createPasswordResetService>;
