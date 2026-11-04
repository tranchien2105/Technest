const lineKey = (item) => `${String(item.variantId)}:${item.flashSaleItemId == null ? "standard" : String(item.flashSaleItemId)}`;

/** A quote belongs to these exact cart lines, quantities and catalog snapshots. */
export function checkoutQuoteKey(items) {
  return JSON.stringify(items.map((item) => [lineKey(item), item.quantity, String(item.price)]));
}

/** Never apply a sale quote to a regular line for the same variant. */
export function quotedCheckoutItems(items, quote) {
  if (!Array.isArray(quote?.items)) return items;
  const byKey = new Map(quote.items.map((item) => [lineKey(item), item]));
  return items.map((item) => {
    const confirmed = byKey.get(lineKey(item));
    return confirmed && confirmed.quantity === item.quantity
      ? { ...item, price: confirmed.unitPrice }
      : item;
  });
}
