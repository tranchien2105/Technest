import { MulterError } from "multer";
import { ZodError } from "zod";
import type { ErrorRequestHandler } from "express";
import type { Logger } from "pino";
import { AppError } from "../shared/errors.js";

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, request, response, next) => {
    if (response.headersSent) {
      next(error);
      return;
    }
    let databaseCode: string | undefined;
    let cause: unknown = error;
    for (let depth = 0; depth < 3 && cause && typeof cause === "object"; depth++) {
      if ("code" in cause && typeof cause.code === "string") databaseCode = cause.code;
      cause = "cause" in cause ? cause.cause : undefined;
    }
    const malformedJson =
      error instanceof SyntaxError && "type" in error && error.type === "entity.parse.failed";
    const tooLarge = error instanceof Error && "type" in error && error.type === "entity.too.large";
    const known =
      error instanceof AppError
        ? error
        : error instanceof MulterError ? new AppError(400, "UPLOAD_LIMIT", "Tệp tải lên vượt giới hạn kích thước hoặc số lượng.")
        : error instanceof ZodError ? new AppError(400, "VALIDATION_ERROR", "Dữ liệu không hợp lệ.", error.issues)
        : databaseCode === "23505" ? new AppError(409, "DUPLICATE_RECORD", "Mã hoặc email đã tồn tại. Vui lòng kiểm tra lại.")
        : databaseCode === "23503" ? new AppError(409, "REFERENCE_CONFLICT", "Bản ghi đang được sử dụng hoặc liên kết không còn tồn tại.")
        : malformedJson
          ? new AppError(400, "INVALID_JSON", "Malformed JSON body")
          : tooLarge
            ? new AppError(413, "PAYLOAD_TOO_LARGE", "Request body exceeds size limit")
            : new AppError(500, "INTERNAL_ERROR", "An unexpected error occurred");
    if (known.statusCode >= 500) {
      // Avoid logging arbitrary exception messages that could contain connection URLs or secrets.
      logger.error(
        { requestId: request.id, method: request.method, path: request.path, statusCode: known.statusCode,
          errorType: error instanceof Error ? error.name : "UnknownError",
          ...(databaseCode && /^[0-9A-Z]{5}$/.test(databaseCode) ? { databaseCode } : {}) },
        "Request failed",
      );
    }
    response.status(known.statusCode).json({
      success: false,
      error: {
        code: known.code,
        message: known.message,
        ...(known.details === undefined ? {} : { details: known.details }),
      },
      requestId: request.id,
    });
  };
}
