import process from "node:process";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { renderSeoDocument } from "./backend/src/modules/seo/seo.render.ts";
import { readFile } from "node:fs/promises";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const api = (env.VITE_API_BASE_URL || "http://localhost:3000/api/v1").replace(/\/$/, "");
  return {
    server: {
      proxy: {
        "/images/uploads": "http://localhost:3000",
        "/robots.txt": "http://localhost:3000",
        "/sitemap.xml": "http://localhost:3000",
        "/sitemaps": "http://localhost:3000",
      },
    },
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "technest-public-seo",
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (
              req.method !== "GET" ||
              !req.headers.accept?.includes("text/html") ||
              !req.url ||
              req.url.startsWith("/@") ||
              req.url.startsWith("/src/") ||
              /\.[a-z0-9]+(?:\?|$)/i.test(req.url)
            )
              return next();
            try {
              const response = await fetch(`${api}/seo/page?path=${encodeURIComponent(req.url)}`, {
                signal: AbortSignal.timeout(10000),
              });
              if (!response.ok) throw new Error("SEO API unavailable");
              const { data: page } = await response.json();
              if (page.redirect) {
                res.writeHead(page.status, { Location: page.redirect });
                res.end();
                return;
              }
              const template = await readFile(new URL("./index.html", import.meta.url), "utf8");
              const html = await server.transformIndexHtml(
                req.url,
                renderSeoDocument(template, page),
              );
              res.statusCode = page.status;
              res.setHeader("Content-Type", "text/html");
              res.setHeader("Cache-Control", "no-store");
              res.setHeader("X-Robots-Tag", page.robots);
              res.end(html);
            } catch (error) {
              server.config.logger.error(`Public HTML rendering failed: ${error.message}`);
              res.statusCode = 503;
              res.setHeader("X-Robots-Tag", "noindex");
              res.end("Storefront temporarily unavailable. Please retry.");
            }
          });
        },
      },
    ],
  };
});
