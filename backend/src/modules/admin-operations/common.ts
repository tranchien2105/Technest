import { z } from "zod";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../database/schema/index.js";
export type Database = NodePgDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export const idString = z
  .string()
  .regex(/^[1-9]\d{0,18}$/)
  .refine((v) => /^[1-9]\d{0,18}$/.test(v) && BigInt(v) <= 9223372036854775807n);
export const money = z.string().regex(/^\d{1,18}$/);
export const listQuery = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  q: z.string().trim().max(160).optional(),
  status: z.string().max(30).optional(),
  type: z.string().max(40).optional(),
});
export type ListInput = z.infer<typeof listQuery>;
export function jsonValue<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? item.toString() : item)),
  ) as T;
}
export const pagination = (input: { page: number; limit: number }, total: number) => ({
  ...input,
  total,
  totalPages: Math.ceil(total / input.limit),
});
export function pageResult(input: ListInput, items: unknown[], total: number) {
  return jsonValue({
    items,
    pagination: pagination({ page: input.page, limit: input.limit }, total),
  });
}
export function dateRange(from?: string, to?: string) {
  const endDate =
    to ||
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  const end = new Date(new Date(`${endDate}T00:00:00+07:00`).getTime() + 86_400_000);
  const start = from
    ? new Date(`${from}T00:00:00+07:00`)
    : new Date(end.getTime() - 30 * 86_400_000);
  return { start, end };
}
