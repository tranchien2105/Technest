import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

interface SeedProduct {
  sourceId: number;
  category: string;
  name: string;
  price: string;
  image: string;
}

const products = JSON.parse(
  readFileSync(new URL("../src/database/seeds/products.json", import.meta.url), "utf8"),
) as SeedProduct[];

describe("development catalog seed", () => {
  it("has ten products for every catalog category", () => {
    const counts = new Map<string, number>();
    for (const product of products) {
      counts.set(product.category, (counts.get(product.category) ?? 0) + 1);
    }

    expect([...counts.keys()].sort()).toEqual([
      "accessories",
      "audio",
      "keyboards",
      "mice",
      "monitors",
    ]);
    for (const count of counts.values()) expect(count).toBe(10);
  });

  it("keeps product slugs unique and seed fields usable", () => {
    const slugs = products.map((product) =>
      product.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
    );

    expect(new Set(slugs).size).toBe(products.length);
    for (const product of products) {
      expect(product.price).toMatch(/^\d+$/);
      expect(product.image).toMatch(/^https:\/\//);
    }
  });

  it("gives the added products distinct images that do not reuse existing product images", () => {
    const existingImages = new Set(
      products.filter((product) => product.sourceId < 29).map((product) => product.image),
    );
    const added = products.filter((product) => product.sourceId >= 29);
    const addedImages = added.map((product) => product.image);

    expect(added).toHaveLength(22);
    expect(new Set(addedImages).size).toBe(added.length);
    expect(addedImages.some((image) => existingImages.has(image))).toBe(false);
  });
});
