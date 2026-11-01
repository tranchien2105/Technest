import { z } from "zod";

export const registerSchema = z.object({
  body: z
    .object({
      email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
      password: z.string().min(12).max(128),
      fullName: z.string().trim().min(1).max(200).optional(),
    })
    .strict(),
});
export const loginSchema = z.object({
  body: z
    .object({
      email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
      password: z.string().min(1).max(128),
    })
    .strict(),
});
