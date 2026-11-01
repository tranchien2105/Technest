import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../database/schema/index.js";
import { storeSettings } from "../../database/schema/index.js";
import { AppError } from "../../shared/errors.js";

type Database = NodePgDatabase<typeof schema>;
type SettingsInput = { storeName: string; supportEmail: string; supportPhone: string; standardShippingFee: string; freeShippingThreshold: string; codEnabled: boolean };

const serialize = (settings: typeof storeSettings.$inferSelect) => ({
  storeName: settings.storeName,
  supportEmail: settings.supportEmail,
  supportPhone: settings.supportPhone,
  standardShippingFee: settings.standardShippingFee.toString(),
  freeShippingThreshold: settings.freeShippingThreshold.toString(),
  codEnabled: settings.codEnabled,
  updatedAt: settings.updatedAt.toISOString(),
});

export function createAdminSettingsService(db: Database) {
  async function get() {
    const [settings] = await db.select().from(storeSettings).where(eq(storeSettings.id, 1)).limit(1);
    if (!settings) throw new AppError(500, "STORE_SETTINGS_MISSING", "Store settings migration has not been applied");
    return serialize(settings);
  }
  async function update(input: SettingsInput, userId: number) {
    if (BigInt(input.freeShippingThreshold) < 0n || BigInt(input.standardShippingFee) < 0n) throw new AppError(400, "INVALID_SHIPPING_SETTINGS", "Shipping amounts must not be negative");
    const [settings] = await db.update(storeSettings).set({ ...input, standardShippingFee: BigInt(input.standardShippingFee),
      freeShippingThreshold: BigInt(input.freeShippingThreshold), updatedBy: BigInt(userId), updatedAt: new Date() })
      .where(eq(storeSettings.id, 1)).returning();
    if (!settings) throw new AppError(500, "STORE_SETTINGS_MISSING", "Store settings migration has not been applied");
    return serialize(settings);
  }
  return { get, update };
}
