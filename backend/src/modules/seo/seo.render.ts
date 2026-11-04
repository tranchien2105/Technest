import type { SeoPage } from "./seo.types.js";
export const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
export const jsonScript = (value: unknown) =>
  JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
export function seoHead(page: SeoPage, verification?: string) {
  const e = escapeHtml;
  return `<title data-seo>${e(page.title)}</title>
<meta data-seo name="description" content="${e(page.description)}">
<meta data-seo name="robots" content="${e(page.robots)}">
${page.canonical ? `<link data-seo rel="canonical" href="${e(page.canonical)}">` : ""}
<meta data-seo property="og:title" content="${e(page.title)}">
<meta data-seo property="og:description" content="${e(page.description)}">
<meta data-seo property="og:type" content="${e(page.type)}">
<meta data-seo property="og:site_name" content="Technest">
${page.canonical ? `<meta data-seo property="og:url" content="${e(page.canonical)}">` : ""}
${page.image ? `<meta data-seo property="og:image" content="${e(page.image)}">` : ""}
<meta data-seo name="twitter:card" content="summary_large_image">
<meta data-seo name="twitter:title" content="${e(page.title)}">
<meta data-seo name="twitter:description" content="${e(page.description)}">
${page.image ? `<meta data-seo name="twitter:image" content="${e(page.image)}">` : ""}
${verification ? `<meta data-seo name="google-site-verification" content="${e(verification)}">` : ""}
<script data-seo type="application/ld+json">${jsonScript({ "@context": "https://schema.org", "@graph": page.schemas })}</script>`;
}
export function renderSeoDocument(template: string, page: SeoPage, verification?: string) {
  const cleaned = template
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, "")
    .replace(/<meta\b[^>]*name=["'](?:description|robots)["'][^>]*>/gi, "");
  return cleaned
    .replace("</head>", `${seoHead(page, verification)}</head>`)
    .replace(
      '<div id="root"></div>',
      `<div id="root">${page.content}</div><script id="technest-seo-state" type="application/json">${jsonScript({ ...page, content: undefined })}</script>`,
    );
}
