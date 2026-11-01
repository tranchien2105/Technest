import type { Response } from "express";

export function sendData<T>(response: Response, data: T, statusCode = 200) {
  return response.status(statusCode).json({ success: statusCode < 400, data });
}
