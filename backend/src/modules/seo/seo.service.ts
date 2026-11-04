import type { createCatalogService } from "../catalog/catalog.service.js";
import { listProductsSchema } from "../catalog/catalog.schemas.js";
import type { SeoConfig, SeoPage } from "./seo.types.js";
import type { SeoRepository } from "./seo.repository.js";
import { escapeHtml as e } from "./seo.render.js";

type Catalog = ReturnType<typeof createCatalogService>;
const DEFAULT_DESCRIPTION =
  "Technest — bàn phím, chuột, màn hình, tai nghe và phụ kiện công nghệ cho góc làm việc của bạn.";
export function publicOrigin(config: SeoConfig) {
  if (!config.siteUrl) return null;
  const url = new URL(config.siteUrl);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    /(^localhost$|\.local$|^127\.|^0\.|^\[::1\]$)/i.test(url.hostname)
  )
    throw new Error("SEO_SITE_URL must be an HTTPS public origin");
  return url.origin;
}
export function createSeoService(repository: SeoRepository, catalog: Catalog, config: SeoConfig) {
  const origin = publicOrigin(config);
  if (config.environment === "production" && config.indexingEnabled && !origin)
    throw new Error("SEO_SITE_URL is required to enable production indexing");
  const indexing = config.environment === "production" && config.indexingEnabled && Boolean(origin);
  const absolute = (path: string) => {
    try {
      const url = new URL(path, origin || undefined);
      return ["https:", "http:"].includes(url.protocol) ? url.href : null;
    } catch {
      return null;
    }
  };
  const breadcrumb = (items: { name: string; path: string }[]) => ({
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absolute(item.path),
    })),
  });
  function base(title: string, path: string, noindex = false): SeoPage {
    return {
      status: 200,
      title,
      description: DEFAULT_DESCRIPTION,
      canonical: origin ? origin + path : null,
      image: absolute("/seo-social.png"),
      robots: indexing && !noindex ? "index, follow, max-image-preview:large" : "noindex, follow",
      type: "website",
      schemas: [],
      content: "",
    };
  }
  const missing = () => ({
    ...base("Không tìm thấy trang | Technest", "/", true),
    status: 404,
    canonical: null,
    content:
      '<main class="store-page"><h1>Không tìm thấy trang</h1><p>Nội dung không còn tồn tại hoặc chưa được công khai.</p><a href="/">Về trang chủ</a></main>',
  });
  async function apply(page: SeoPage, kind: string, key: string) {
    const override = await repository.override(kind, key);
    if (!override) return page;
    if (override.title) page.title = override.title;
    if (override.description) page.description = override.description;
    if (override.socialImage) page.image = absolute(override.socialImage);
    if (override.canonicalPath && origin) {
      page.canonical = origin + override.canonicalPath;
      page.robots = "noindex, follow";
    }
    if (override.noindex) page.robots = "noindex, follow";
    return page;
  }
  async function page(rawPath: string): Promise<SeoPage> {
    if (!rawPath.startsWith("/") || rawPath.startsWith("//") || rawPath.length > 2000)
      return missing();
    const url = new URL(rawPath, "https://internal.invalid");
    const path = url.pathname;
    if (path.length > 1 && path.endsWith("/"))
      return {
        ...base("Technest", path),
        status: 308,
        redirect: path.replace(/\/+$/, "") + url.search,
      };
    const productMatch = /^\/products\/([a-z0-9-]+)$/.exec(path);
    if (productMatch) {
      let product = await catalog.productById(productMatch[1]!);
      if (!product && !/^\d+$/.test(productMatch[1]!)) {
        const id = await repository.redirectSlug(productMatch[1]!);
        if (id) product = await catalog.productById(id);
      }
      if (!product) return missing();
      if (product.slug !== productMatch[1])
        return {
          ...base(product.name, `/products/${product.slug}`),
          status: 308,
          redirect: `/products/${product.slug}${url.search}`,
        };
      const eligible = await repository.eligible(product.id);
      const result = await apply(
        base(`${product.name} | Technest`, path, !eligible),
        "products",
        product.id,
      );
      result.description =
        !result.description || result.description === DEFAULT_DESCRIPTION
          ? product.description.replace(/\s+/g, " ").trim().slice(0, 170) ||
            `${product.name} từ ${product.brand.name}. Xem thông tin và phiên bản tại Technest.`
          : result.description;
      const variant =
        product.variants.find((v) => v.id === url.searchParams.get("variant")) ||
        product.variants[0];
      const selectedImage = product.images.find((item) => item.variantId === variant?.id)
        || product.images.find((item) => !item.variantId)
        || product.images[0];
      const image = selectedImage?.url;
      if (image && result.image === absolute("/seo-social.png")) result.image = absolute(image);
      result.type = "product";
      const sale = variant ? await repository.sale(variant.id) : undefined;
      const price = sale?.price || variant?.price || product.price;
      const available = variant?.availableQuantity;
      const stockKnown = available !== null && available !== undefined;
      const schema: Record<string, unknown> = {
        "@type": "Product",
        name: product.name,
        description: result.description,
        ...(result.canonical ? { url: result.canonical } : {}),
        brand: { "@type": "Brand", name: product.brand.name },
        ...(variant ? { sku: variant.sku } : {}),
        ...(result.image ? { image: [result.image] } : {}),
      };
      if (eligible && variant && /^\d+$/.test(String(price)) && BigInt(String(price)) > 0n)
        schema.offers = {
          "@type": "Offer",
          ...(result.canonical ? { url: result.canonical } : {}),
          priceCurrency: "VND",
          price: String(price),
          ...(stockKnown
            ? {
                availability:
                  Number(available) > 0
                    ? "https://schema.org/InStock"
                    : "https://schema.org/OutOfStock",
              }
            : {}),
          ...(sale ? { priceValidUntil: sale.endsAt.toISOString() } : {}),
        };
      if (sale) result.expiresAt = sale.endsAt.toISOString();
      else if (variant) {
        const nextStart = await repository.nextSaleStart(variant.id);
        if (nextStart) result.expiresAt = nextStart.toISOString();
      }
      result.schemas = [
        schema,
        ...(origin
          ? [
              breadcrumb([
                { name: "Trang chủ", path: "/" },
                { name: product.category.name, path: `/categories/${product.category.slug}` },
                { name: product.name, path },
              ]),
            ]
          : []),
      ];
      result.content = `<main class="store-page"><nav aria-label="Đường dẫn"><a href="/">Trang chủ</a> / <a href="/categories/${e(product.category.slug)}">${e(product.category.name)}</a></nav><article><h1>${e(product.name)}</h1>${image ? `<img src="${e(image)}" alt="${e(selectedImage?.altText || product.name)}" width="600" height="420" fetchpriority="high" style="object-fit:contain">` : ""}<p>${e(product.description)}</p><p>Thương hiệu: <a href="/brands/${e(product.brand.slug)}">${e(product.brand.name)}</a></p><p>Giá: ${e(price)} ₫</p>${stockKnown ? `<p>${Number(available) > 0 ? "Còn hàng" : "Hết hàng"}</p>` : ""}</article></main>`;
      return result;
    }
    const categoryMatch = /^\/categories\/([a-z0-9-]+)$/.exec(path);
    const brandMatch = /^\/brands\/([a-z0-9-]+)$/.exec(path);
    const isSearch = path === "/search";
    const isListing = path === "/products" || Boolean(categoryMatch || brandMatch) || isSearch;
    if (
      path === "/products" &&
      !url.searchParams.has("q") &&
      !(url.searchParams.has("category") && url.searchParams.has("brand"))
    ) {
      const key = url.searchParams.has("category")
        ? "category"
        : url.searchParams.has("brand")
          ? "brand"
          : null;
      if (key && /^[a-z0-9-]+$/.test(url.searchParams.get(key) || "")) {
        const slug = url.searchParams.get(key)!;
        url.searchParams.delete(key);
        return {
          ...base("Technest", "/products"),
          status: 308,
          redirect: `/${key === "category" ? "categories" : "brands"}/${slug}${url.searchParams.size ? "?" + url.searchParams : ""}`,
        };
      }
    }
    if (path === "/" || isListing || path === "/flash-sale") {
      const category = categoryMatch
        ? await repository.entity("categories", categoryMatch[1]!)
        : undefined;
      const brand = brandMatch ? await repository.entity("brands", brandMatch[1]!) : undefined;
      if ((categoryMatch && !category) || (brandMatch && !brand)) return missing();
      const parsed = listProductsSchema.safeParse({
        ...Object.fromEntries(url.searchParams),
        ...(category ? { category: category.slug } : {}),
        ...(brand ? { brand: brand.slug } : {}),
        limit: 24,
      });
      if (!parsed.success) return { ...missing(), status: 400 };
      const query = parsed.data;
      const pageNum = query.page;
      if (path === "/" && pageNum > 1) return missing();
      const canonicalParams = new URLSearchParams();
      // Pages are self-canonical. Sort/filter/search URLs are noindex; tracking
      // and variant parameters do not create independent canonical URLs.
      if (pageNum > 1) canonicalParams.set("page", String(pageNum));
      const canonicalPath = path + (canonicalParams.size ? "?" + canonicalParams : "");
      const facetKeys = [
        "q",
        "sort",
        "brand",
        "category",
        "minPrice",
        "maxPrice",
        "sale",
        "featured",
        "trending",
        "ids",
      ];
      const facet = isSearch || facetKeys.some((key) => url.searchParams.has(key));
      const flash = path === "/flash-sale";
      let result = base(
        path === "/"
          ? "Technest | Công nghệ cho góc làm việc của bạn"
          : `${category?.name || brand?.name || (flash ? "Flash Sale" : "Sản phẩm")}${pageNum > 1 ? ` — Trang ${pageNum}` : ""} | Technest`,
        canonicalPath,
        facet || flash,
      );
      result.description =
        path === "/"
          ? DEFAULT_DESCRIPTION
          : category
            ? `Khám phá ${category.name.toLowerCase()} tại Technest. Lựa chọn thương hiệu, so sánh giá và tìm sản phẩm phù hợp.`
            : brand
              ? `Khám phá sản phẩm ${brand.name} tại Technest. Thông tin sản phẩm, phiên bản và giá bán cập nhật.`
              : flash
                ? "Các chương trình Flash Sale đang diễn ra tại Technest. Giá và số lượng được xác nhận khi thanh toán."
                : DEFAULT_DESCRIPTION;
      result = await apply(
        result,
        category ? "categories" : brand ? "brands" : "pages",
        category?.id || brand?.id || (path === "/" ? "home" : flash ? "flash-sale" : "products"),
      );
      if (flash) {
        result.content =
          '<main class="store-page"><h1>Flash Sale Technest</h1><p>Các ưu đãi có thời hạn. Giá và số lượng được xác nhận khi thanh toán.</p><a href="/products">Khám phá sản phẩm</a></main>';
        return result;
      }
      if (category && !(await repository.entityEligible("categories", category.id)))
        result.robots = "noindex, follow";
      if (brand && !(await repository.entityEligible("brands", brand.id)))
        result.robots = "noindex, follow";
      const list = await catalog.productsList(query);
      if (pageNum > Math.max(1, list.pagination.totalPages)) return missing();
      const heading =
        category?.name ||
        brand?.name ||
        (path === "/"
          ? "Technest — Công nghệ cho góc làm việc của bạn"
          : isSearch
            ? "Kết quả tìm kiếm"
            : "Sản phẩm");
      result.content = `<main class="store-page"><nav aria-label="Đường dẫn"><a href="/">Trang chủ</a>${path !== "/" ? " / " + e(heading) : ""}</nav><h1>${e(heading)}</h1><p>${e(result.description)}</p><div class="product-grid">${list.items.map((item) => `<article class="product-card"><a href="/products/${e(item.slug)}">${item.images[0] ? `<img src="${e(item.images[0].url)}" alt="${e(item.images[0].altText || item.name)}" width="300" height="220" loading="lazy" style="object-fit:contain">` : ""}<h2>${e(item.name)}</h2></a><p>${e(item.brand.name)}</p><p>${e(item.price)} ₫</p></article>`).join("")}</div>${pageNum < list.pagination.totalPages ? `<a href="${e(path + "?" + new URLSearchParams({ ...Object.fromEntries(url.searchParams), page: String(pageNum + 1) }))}">Trang tiếp theo</a>` : ""}</main>`;
      if (origin)
        result.schemas =
          path === "/"
            ? [
                {
                  "@type": "Organization",
                  "@id": origin + "/#organization",
                  name: "Technest",
                  url: origin,
                  logo: origin + "/technest-logo.svg",
                },
                {
                  "@type": "WebSite",
                  "@id": origin + "/#website",
                  name: "Technest",
                  url: origin,
                  inLanguage: "vi-VN",
                },
              ]
            : [
                { "@type": "CollectionPage", name: heading, url: result.canonical },
                breadcrumb([
                  { name: "Trang chủ", path: "/" },
                  { name: heading, path: canonicalPath },
                ]),
              ];
      return result;
    }
    const privateRoute =
      /^\/(admin|account|cart|checkout|login|register|forgot-password|order-success|favorites|compare|setup)(\/|$)/.test(
        path,
      );
    if (privateRoute) return { ...base("Technest", path, true), content: "", schemas: [] };
    return missing();
  }
  function robots() {
    if (!indexing && config.environment !== "production") return "User-agent: *\nDisallow: /\n";
    // Public HTML shells must stay crawlable so Google can read noindex.
    // Private data remains protected by authentication on the API.
    const policy = "User-agent: *\nAllow: /\nDisallow: /api/\n";
    return indexing ? policy + `\nSitemap: ${origin}/sitemap.xml\n` : policy;
  }
  async function sitemap(kind?: string, pageNum = 1) {
    if (!indexing) return null;
    if (!kind) {
      const counts = await repository.sitemapCounts();
      const files = [
        "pages",
        ...Object.entries(counts).flatMap(([key, count]) =>
          Array.from({ length: Math.ceil(count / 1000) }, (_, i) => `${key}-${i + 1}`),
        ),
      ];
      return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${files.map((file) => `<sitemap><loc>${e(origin + "/sitemaps/" + file + ".xml")}</loc></sitemap>`).join("")}</sitemapindex>`;
    }
    const rows =
      kind === "pages"
        ? (
            await Promise.all(
              ["/", "/products"].map(async (path) => {
                const override = await repository.override(
                  "pages",
                  path === "/" ? "home" : "products",
                );
                return override?.noindex || override?.canonicalPath
                  ? null
                  : { path, modified: undefined as Date | undefined };
              }),
            )
          ).filter((row): row is { path: string; modified: Date | undefined } => row !== null)
        : await repository.sitemap(kind, pageNum);
    if (!rows.length && kind !== "pages") return null;
    return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${rows.map((row) => `<url><loc>${e(origin + row.path)}</loc>${row.modified && row.modified.getTime() <= Date.now() ? `<lastmod>${row.modified.toISOString()}</lastmod>` : ""}</url>`).join("")}</urlset>`;
  }
  return {
    page: async (path: string) => ({ ...(await page(path)), requestPath: path }),
    robots,
    sitemap,
    indexing,
    repository,
    config,
  };
}
export type SeoService = ReturnType<typeof createSeoService>;
