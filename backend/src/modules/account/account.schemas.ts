import { z } from "zod";

const phone = z.string().trim().min(7).max(30).regex(/^\+?[0-9 ()-]+$/);
export const profilePatchSchema = z.object({
  fullName: z.string().trim().min(1).max(200).nullable().optional(),
  phone: phone.nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, "At least one profile field is required");

export const addressIdSchema = z.object({ id: z.string().regex(/^\d+$/) });
export const addressBodySchema = z.object({
  recipientName: z.string().trim().min(1).max(200),
  phone,
  addressLine: z.string().trim().min(3).max(1000),
  city: z.string().trim().min(1).max(120),
  district: z.string().trim().max(120).nullable().optional(),
  ward: z.string().trim().max(120).nullable().optional(),
  label: z.string().trim().max(60).nullable().optional(),
  isDefault: z.boolean().optional(),
});
export const addressPatchSchema = addressBodySchema.partial().refine((value) => Object.keys(value).length > 0);
export const passwordBodySchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(12).max(128).regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/),
}).refine((value) => value.currentPassword !== value.newPassword, {
  path: ["newPassword"], message: "New password must differ from current password",
});
export const sessionIdSchema = z.object({ id: z.string().regex(/^\d+$/) });
