import { describe, it, expect } from "vitest";
import { escapeHtml, jsonScript, renderSeoDocument } from "../src/modules/seo/seo.render.js";
import { publicOrigin } from "../src/modules/seo/seo.service.js";
import { seoInput } from "../src/modules/seo/seo.routes.js";
import type { SeoPage } from "../src/modules/seo/seo.types.js";
describe("SEO serialization and configuration", () => {
  it("escapes metadata and script payloads without duplicate title/description", () => {
    const page: SeoPage = {
      status: 200,
      title: 'Keyboard <script> & "A"',
      description: "Test <&>",
      canonical: "https://shop.example.test/products/keyboard",
      image: "https://shop.example.test/image.png",
      robots: "index, follow",
      type: "product",
      content: "<main><h1>Keyboard</h1></main>",
      schemas: [{ "@type": "Product", name: "</script><script>alert(1)</script>" }],
    };
    const html = renderSeoDocument(
      '<html><head><title>Old</title><meta name="description" content="Old"></head><body><div id="root"></div></body></html>',
      page,
    );
    expect(html.match(/<title/g)).toHaveLength(1);
    expect(html.match(/name="description"/g)).toHaveLength(1);
    expect(html).toContain("Keyboard &lt;script&gt; &amp; &quot;A&quot;");
    expect(html).not.toContain("</script><script>alert");
    expect(html).toContain("<main><h1>Keyboard</h1></main>");
    expect(JSON.parse(jsonScript({ name: "</script>" }))).toEqual({ name: "</script>" });
    expect(escapeHtml("'")).toBe("&#39;");
  });
  it("requires a configured HTTPS public origin and never invents a domain", () => {
    const config = { environment: "production", indexingEnabled: true };
    expect(publicOrigin(config)).toBeNull();
    for (const siteUrl of [
      "http://example.com",
      "https://localhost",
      "https://127.0.0.1",
      "https://example.com/path",
    ])
      expect(() => publicOrigin({ ...config, siteUrl })).toThrow();
    expect(publicOrigin({ ...config, siteUrl: "https://store.example.test" })).toBe(
      "https://store.example.test",
    );
  });
  it("rejects cross-origin canonical overrides and unsafe social protocols", () => {
    for (const canonicalPath of ["https://other.test/path", "//other.test", "/x\nLocation:other"])
      expect(seoInput.safeParse({ canonicalPath }).success).toBe(false);
    expect(seoInput.safeParse({ socialImage: "javascript:alert(1)" }).success).toBe(false);
    expect(
      seoInput.safeParse({
        canonicalPath: "/products/a",
        socialImage: "https://cdn.example.test/a.png",
      }).success,
    ).toBe(true);
  });
});
