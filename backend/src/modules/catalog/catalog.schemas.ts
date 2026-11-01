import { z } from "zod";

const money = z.string().regex(/^\d+$/).optional();
const page = z.coerce.number().int().min(1).default(1);
const limit = z.coerce.number().int().min(1).max(100).default(24);

export const listProductsSchema = z
  .object({
    q: z.string().trim().max(160).optional(),
    category: z.string().trim().max(100).optional(),
    brand: z.string().trim().max(140).optional(),
    minPrice: money,
    maxPrice: money,
    sort: z.enum(["newest", "priceLow", "priceHigh", "recommended"]).default("recommended"),
    sale: z.enum(["0", "1"]).optional(),
    featured: z.enum(["0", "1"]).optional(),
    trending: z.enum(["0", "1"]).optional(),
    ids: z
      .string()
      .regex(/^\d+(,\d+)*$/)
      .optional(),
    page,
    limit,
  })
  .superRefine((query, context) => {
    if (query.minPrice && query.maxPrice && BigInt(query.minPrice) > BigInt(query.maxPrice)) {
      context.addIssue({
        code: "custom",
        path: ["maxPrice"],
        message: "maxPrice must be greater than or equal to minPrice",
      });
    }
  });

export const productIdSchema = z.object({ id: z.string().regex(/^\d+$/) });

export type ListProductsQuery = z.infer<typeof listProductsSchema>;
