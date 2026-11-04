import { compareMoney } from "./cart.js";
import { productUrl } from "../routing/productUrl.js";

// Use the API clock for offer eligibility; a customer's device clock may be wrong.
export function flashCampaignStatus(campaign, now) {
  if (!Number.isFinite(now)) return "ENDED";
  if (["DRAFT", "PAUSED", "CANCELLED", "ENDED"].includes(campaign.status)) return campaign.status;
  const startsAt = Date.parse(campaign.startsAt);
  const endsAt = Date.parse(campaign.endsAt);
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || endsAt <= startsAt) return "ENDED";
  if (now < startsAt) return "UPCOMING";
  return now >= endsAt ? "ENDED" : "ACTIVE";
}

export function findVariantFlashDeal(campaigns, variantId, now, regularPrice) {
  for (const campaign of campaigns || []) {
    if (flashCampaignStatus(campaign, now) !== "ACTIVE") continue;
    const item = campaign.items?.find((candidate) => String(candidate.variantId) === String(variantId)
      && candidate.availableQuantity > 0 && candidate.stockAvailable > 0);
    if (!item) continue;
    // The backend rejects an offer that no longer beats the regular variant price.
    if (regularPrice != null && compareMoney(item.flashPrice, regularPrice) >= 0) continue;
    return { ...item, campaignName: campaign.name, endsAt: campaign.endsAt };
  }
  return null;
}

export function flashSaleProductUrl(item) {
  // Campaign items are variant-specific; opening the default variant can show a different price.
  return `${productUrl(item)}?variant=${encodeURIComponent(item.variantId)}`;
}
