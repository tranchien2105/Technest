import { describe, expect, it } from "vitest";
import { isOwnedLegacyIllustration, validateCuratedIdentity, validVndAmount, type QualityProduct } from "../src/database/seeds/catalog-quality.js";
import { storefrontFixture } from "../src/database/seeds/storefront-demo-data.js";

const legacy: QualityProduct = { id: "123", name: "KEYCHRON Gasket Mechanical Keyboard 100 Graphite", slug: "catalog-old-mechanical", price: "590000", status: "ACTIVE", category_slug: "mechanical", brand_slug: "keychron", brand_name: "KEYCHRON", attributes: { dataset: "development-illustration", seedKey: "mechanical:0", seedOrdinal: 0 } };
describe("catalog quality and safe provenance", () => {
  it("requires marker, stable key, valid ordinal, category, brand and generator name together", () => {
    expect(isOwnedLegacyIllustration(legacy)).toBe(true);
    for (const attributes of [{}, { ...legacy.attributes, seedKey: "mice:0" }, { ...legacy.attributes, seedOrdinal: 90 }, { ...legacy.attributes, dataset: "real" }]) expect(isOwnedLegacyIllustration({ ...legacy, attributes })).toBe(false);
    expect(isOwnedLegacyIllustration({ ...legacy, category_slug: "mice" })).toBe(false);
    expect(isOwnedLegacyIllustration({ ...legacy, name: "Demo product" })).toBe(false);
    expect(isOwnedLegacyIllustration({ ...legacy, brand_name: "OTHER" })).toBe(false);
    expect(isOwnedLegacyIllustration({ ...legacy, slug: "real-product" })).toBe(false);
  });
  it("validates curated names, category, brand and illustration type against stable fixture IDs", () => {
    const fixture = storefrontFixture(0);
    const product = { ...legacy, name: fixture.name, attributes: fixture.attributes, brand_slug: fixture.brandSlug, category_slug: fixture.categorySlug };
    expect(validateCuratedIdentity(product)).toEqual([]);
    expect(validateCuratedIdentity({ ...product, brand_slug: "sony" })).toContain("curated_brand_mismatch");
    expect(validateCuratedIdentity({ ...product, category_slug: "mice" })).toContain("curated_category_mismatch");
    expect(validateCuratedIdentity({ ...product, attributes: { ...fixture.attributes, imageType: "mouse" } })).toContain("curated_image_type_mismatch");
  });
  it("rejects non-integer/negative/zero VND without unsafe number coercion", () => {
    for (const amount of ["0", "-1", "NaN", "1.5", "1e6", "", "500.000"]) expect(validVndAmount(amount)).toBe(false);
    expect(validVndAmount("500000")).toBe(true);
    expect(validVndAmount("9007199254740993")).toBe(true);
  });
});
