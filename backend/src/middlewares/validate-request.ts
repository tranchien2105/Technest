import type { RequestHandler } from "express";
import { z } from "zod";
import { AppError } from "../shared/errors.js";

type RequestPart = "body" | "query" | "params";

// Parsed values live in res.locals.validated: Express 5 request.query is read-only.
export function validateRequest(schemas: Partial<Record<RequestPart, z.ZodType>>): RequestHandler {
  return (request, response, next) => {
    const validated: Partial<Record<RequestPart, unknown>> = {};
    for (const part of ["body", "query", "params"] as const) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(request[part]);
      if (!result.success) {
        next(
          new AppError(
            400,
            "VALIDATION_ERROR",
            "Dữ liệu chưa hợp lệ. Vui lòng kiểm tra các trường và giá trị đã nhập.",
            result.error.issues.map((issue) => ({
              path: [part, ...issue.path].join("."),
              message: issue.message,
            })),
          ),
        );
        return;
      }
      validated[part] = result.data;
    }
    response.locals.validated = validated;
    next();
  };
}
