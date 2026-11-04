# Technest — Technical SEO implementation

**Ngày:** 02/11/2026. Không deploy production, không gửi URL development tới Google.

## Architecture và rendering

Technest vẫn dùng React + Vite và Express. Trước thay đổi, HTML đầu vào có metadata cố định, root trống và không có sitemap/JSON-LD. Module backend `seo` hiện đọc public catalog PostgreSQL, render metadata và public HTML trước JavaScript; React tiếp tục xử lý toàn bộ storefront/admin interactions. Cùng response được phục vụ cho browser và crawler; không nhận diện Googlebot để thay nội dung.

Đây là progressive server-rendered public snapshot + client rendering, không phải hydration toàn bộ App. Public snapshot phục vụ nội dung/links cơ bản; toàn bộ bố cục và tương tác React hiện hữu xuất hiện khi client khởi động. Cần browser QA/CWV để đánh giá quá trình chuyển tiếp trước production. Cấu hình/published workflow của CMS không bị sửa.

Vite dev middleware gọi service SEO và chèn cùng metadata/content. Production Express phục vụ build frontend cùng origin với API. Không dùng static hosting fallback `index.html` cho mọi URL: cách đó sẽ bỏ qua status, sitemap và SEO rendering mới.

Tham chiếu thiết kế: [Google JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics), [structured data được render từ server](https://developers.google.com/search/docs/appearance/structured-data/generate-structured-data-with-javascript), [canonical riêng cho pagination](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading).

## Metadata và structured data

- Homepage: title/description, canonical khi có domain, OG/Twitter, Organization + WebSite trong production có origin.
- Product: unique title/description, brand, image, canonical slug, Product + Offer cho dữ liệu đủ điều kiện, BreadcrumbList.
- Category/Brand: /categories/:slug và /brands/:slug dùng Product Listing hiện có, metadata riêng, CollectionPage + BreadcrumbList khi có domain.
- Flash Sale: landing page metadata riêng; noindex do nội dung ngắn hạn. Không tạo URL campaign giả khi UI chưa có campaign detail route. Promotions hiện là bộ lọc sale của catalog và noindex.
- Private/auth/search/faceted URLs: noindex trong metadata; HTML private không chứa user data. Backend authentication/RBAC hiện hữu tiếp tục bảo vệ dữ liệu.
- Không tạo rating/review giả. Product seed/demo bị noindex, không xuất Offer hoặc sitemap. Availability chỉ thêm khi backend biết stock của variant.
- Giá lấy theo variant đã chọn; Flash Sale chỉ dùng khi campaign có hiệu lực theo thời gian DB, đủ quota và tồn khả dụng. Không cache HTML giá. Client bỏ Offer cũ tại boundary, refresh khi sale bắt đầu/kết thúc và polling product metadata mỗi 30 giây.
- Custom social image hoặc ảnh catalog được dùng khi có URL hợp lệ; fallback production là /seo-social.png 1200×630.
- JSON-LD/attribute HTML được serialize/escape để dữ liệu không chèn script. Client thay metadata khi SPA navigation và cleanup request/timer.

## Canonical, redirect và status

- Product chuẩn: /products/:slug. /products/:id và slug cũ có mapping redirect 308; lịch sử slug được ghi trong transaction Admin save từ khi triển khai migration 0020.
- /products?category=... và /products?brand=... redirect sang category/brand route tương ứng nếu chỉ có một facet nguồn; các query còn lại được giữ.
- Trailing slash và /index.html redirect 308.
- Tracking/variant query không tạo canonical mới. Pagination giữ canonical riêng với ?page=N; không ép trang 2 về trang 1.
- Sort/search/filter tổ hợp noindex, giữ nguyên khả năng thao tác.
- Product không có/không ACTIVE và route không tồn tại: HTTP 404, noindex. Pagination vượt tổng trang: 404. Unexpected errors theo error handler backend, không trả HTML homepage 200.
- HTTPS và host chuẩn có chế độ enforce tùy chọn sau khi cấu hình proxy tin cậy; không hardcode domain hoặc sử dụng Host header để dựng canonical.
- Lịch sử URL trước thời điểm triển khai không thể phục hồi nếu trước đó không có mapping. Category/brand cũ sau khi đổi slug chưa có history redirect riêng.

## Sitemap và robots

Production configured:

- /sitemap.xml — sitemap index.
- /sitemaps/pages.xml.
- /sitemaps/products-N.xml.
- /sitemaps/categories-N.xml.
- /sitemaps/brands-N.xml.
- /robots.txt chứa sitemap absolute URL.

Mỗi shard tối đa 1.000 URL, query giới hạn trên PostgreSQL; không load toàn bộ catalog vào frontend/build. Sitemap response cache tối đa 60 giây. HTML/metadata giá no-store, nên không cần chờ cache hết để cập nhật giá/stock. Lastmod chỉ lấy updated_at sản phẩm và không xuất timestamp tương lai.

Không có admin, auth, account, checkout, search/filter, draft/archived, demo seed trong sitemap. Category/brand cần có sản phẩm ACTIVE đủ điều kiện. Noindex/canonical override cũng loại khỏi sitemap, kể cả override của trang chủ/danh sách sản phẩm.

Snapshot development hiện có 5.060 products / 51 brands; policy kỹ thuật cho 50 product URLs, 5 category URLs, 19 brand URLs. Đã loại 5.010 sản phẩm có marker/slug/ảnh seed/demo hoặc thiếu điều kiện. Không sửa/xóa catalog để làm SEO. Cần xác minh nguồn hàng, giá và nội dung của 50 sản phẩm còn lại trước khi công khai production indexing.

Development local: noindex + robots Disallow /; sitemap trả 503 disabled. Staging chạy NODE_ENV=production với indexing=false trả noindex cho mọi HTML và cho crawl HTML để Google đọc được noindex; cần password/access gate tại deployment nếu staging không được phép public. Không sinh localhost URLs hoặc tự bịa domain. Production private HTML shells được crawl để đọc noindex, còn API bị robots disallow và vẫn yêu cầu authentication. [Google yêu cầu crawler đọc được noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing); robots không phải cơ chế authorization.

## Admin

`SEO — tiêu đề, mô tả và chia sẻ` có trong editor Product/Category/Brand đã lưu. Settings có SEO cho Home, Products và Flash Sale. Dùng nút `Lưu SEO` riêng, không cần thay đổi dữ liệu sản phẩm khi chỉ sửa metadata.

Fields: title, description, social image, same-site canonical override, noindex. Bỏ trống sẽ fallback nội dung thực. Canonical override đánh dấu URL nguồn noindex và loại khỏi sitemap để giảm xung đột. Seed/demo policy không thể bị vô tình bỏ qua chỉ bằng custom metadata.

API GET/PATCH nằm dưới /api/v1/admin/products/:id/seo, categories/:uuid/seo, brands/:id/seo và settings/seo/:page. Existing products/catalog/settings permissions được enforce ở backend; Customer không sửa được, STAFF chỉ đọc không ghi được. API mutations đi qua admin audit hiện hữu.

## Deployment và Search Console

1. Build frontend và backend; chạy additive migrations 0019/0020 trước khi khởi động code mới.
2. Dùng Dockerfile ở root repository để đóng gói cả frontend/backend. Hoặc chạy backend build với STOREFRONT_DIST trỏ absolute path tới frontend dist. backend/Dockerfile cũ chỉ build API, cần mount/provide frontend dist nếu dùng riêng.
3. Production frontend build dùng VITE_API_BASE_URL=/api/v1 khi phục vụ cùng origin. Upload, auth và API vẫn dùng routes hiện hữu.
4. Chọn domain thật, DNS/HTTPS hợp lệ. Đặt NODE_ENV=production, SEO_SITE_URL=https://domain-thật, SEO_INDEXING_ENABLED=true chỉ sau khi catalog được duyệt. Không ghi placeholder domain này vào env thực.
5. Nếu có reverse proxy: đặt đúng Host, X-Forwarded-Proto; SEO_TRUST_PROXY_HOPS theo số proxy thật; bật SEO_ENFORCE_ORIGIN=true sau khi proxy đã đúng. Đặt sai số hop có thể tạo redirect loop hoặc tin nhầm forwarded headers.
6. GOOGLE verification dùng SEO_GOOGLE_VERIFICATION cho URL-prefix property, hoặc DNS TXT verification cho Domain property. Các biến SMTP/auth/database production vẫn cần cấu hình như trước.
7. Truy cập trực tiếp HTML source, kiểm tra 200/404/308, canonical, JSON-LD, robots và sitemap trên domain thật. Chạy Google Rich Results Test và URL Inspection trên URL đã duyệt; submit /sitemap.xml trong Search Console.
8. Theo dõi Page indexing, canonical selection, sitemap processing, Product enhancements và CWV sau khi có traffic. Chưa xác minh hoặc thao tác Search Console trong lượt này.

## Performance

- Customer routes tách lazy chunks; Admin giữ chunk riêng. SSR module load trong tests không thay đổi cơ chế lazy client production.
- Product links dùng anchors có slug, giữ modified click/new tab. Ảnh đầu listing và hero được ưu tiên; ảnh dưới fold lazy; ảnh card có dimensions, typography hiện hữu giữ nguyên.
- Font CSS chuyển từ @import sang stylesheet link + preconnect, display=swap giữ nguyên.
- Variant URL cập nhật giá/metadata mà không refetch catalog hoặc làm cả trang detail trở về loading.
- Vite hashed assets qua Express có cache immutable 1 năm; HTML không cache.

| Entry asset | Trước lượt SEO | Sau |
|---|---:|---:|
| JS | 786.88 kB (gzip 212.82) | 566.59 kB (gzip 163.09) |
| CSS | 241.01 kB (gzip 43.18) | 201.42 kB (gzip 35.76) |
| Admin JS riêng | 254.48 kB | 259.02 kB |

Các chunk route tải thêm khi cần; đây là kích thước entry, không phải tổng toàn bộ asset hoặc thời gian tải. Vite vẫn cảnh báo chunk entry >500 kB. Chưa đo Lighthouse/LCP/INP/CLS hoặc field CWV, không tuyên bố đạt CWV.

## Tests và evidence

- Frontend lint, 6 test files và production build: PASS.
- Backend typecheck, lint, build: PASS sau policy robots cuối.
- Backend full regression: 87 passed, 17 skipped trong lần chạy đầy đủ. SEO focused suite: 19/19 PASS, bao gồm stock unavailable, future sale, variant, RBAC và same HTML cho Googlebot/browser.
- PostgreSQL SEO fixtures chạy transaction rollback trên technest_dev, không mock toàn bộ DB. Authentication identity trong RBAC test là fixture; test này không thay thế auth integration suite.
- HTTP source thực tế trên localhost:5173 đã xác nhận route metadata, Product JSON-LD, 404, ID redirect 308, private noindex, robots và sitemap dev disabled. Đây không phải browser E2E.
- Source snapshot: technest-seo-http-verification.json; counts: technest-seo-catalog-verification.json. Express localhost:3000 phục vụ frontend build đã được kiểm chứng bằng HTTP; báo cáo technest-seo-express-http-verification.json. Parse XML bằng Python ElementTree: 5 documents, 4 sitemap shards, 76 public URLs, 0 duplicate; xem technest-seo-xml-verification.json.
- Express asset verification: HTTP 200, JavaScript Content-Type đúng, Cache-Control public max-age=31536000 immutable; xem technest-seo-assets-verification.json.
- Trong một sweep local Express, các public HTML 200 được quan sát ở khoảng 281–375 ms. Đây là mẫu đơn lẻ ở development, không phải p95 hoặc phép đo CWV/before-after speed.
- Browser E2E/manual mobile QA, Google Rich Results Test, Search Console và CWV: NOT TESTED.
- Dockerfile đã tạo nhưng chưa build/run image; build frontend/backend trực tiếp đã chạy.

## Files chính

- backend/src/modules/seo/{seo.types,seo.repository,seo.service,seo.render,seo.routes}.ts.
- backend/src/database/schema/seo.ts; migrations/0019_seo_metadata.sql, 0020_seo_product_redirects.sql, meta/_journal.json.
- backend/src/{app,server}.ts, config/env.ts; modules/admin/admin.catalog.service.ts.
- src/hooks/useSeo.js, useCatalog.js; App.jsx; routing/navigation.js, StoreRoutes.jsx.
- src/admin/AdminSeoEditor.jsx, AdminCatalogPanel.jsx, AdminSettingsPanel.jsx.
- src/pages/ProductDetailPage.jsx, ProductsPage.jsx; components/home/ProductCard.jsx, HeroSection.jsx; components/store/ProductGrid.jsx.
- Category/brand links trong Footer, HomeSidePromos, HomeCampaignBanners, TrustedBrandsSection.
- src/api/apiClient.js; index.html; src/index.css; vite.config.js; public/seo-social.png.
- Dockerfile, .dockerignore, .env.example; tests/seo.test.ts, seo-db.integration.test.ts; scripts/verify-seo.mjs.

Workspace có nhiều thay đổi từ các lượt trước; chỉ mở rộng các điểm cần cho SEO, không reset/commit/push hoặc ghi đè catalog.
