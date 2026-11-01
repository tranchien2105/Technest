# Technest Backend Foundation

Node.js 22+, Express 5, TypeScript strict, PostgreSQL 16, Drizzle ORM/Kit, Redis 7, Zod, Pino, Vitest và Supertest. Backend là package độc lập, không thay đổi Frontend React.

## Khởi chạy trong WSL2

Từ root repository:

```sh
# Chỉ thực hiện nếu chưa có .env; không ghi đè credentials hiện có.
cp -n .env.example .env
# Sửa các password placeholder và password tương ứng trong DATABASE_URL/REDIS_URL.
# Password có ký tự đặc biệt phải được URL-encode trong connection URL.
docker compose config --quiet
docker compose up -d --wait
cd backend
npm ci
npm run db:migrate
npm run db:seed
npm run dev
```

Trong lần khởi tạo này, `.env` local được tạo với password ngẫu nhiên và permission 0600. Không cần copy lại. `.env` bị Git ignore; `.env.example` chỉ chứa placeholder. Biến môi trường do shell/deployment cung cấp được ưu tiên hơn file. Các lệnh Backend đều đọc `.env` ở root Technest, không phụ thuộc cwd.

Mặc định:

- API: `http://127.0.0.1:3000/api/v1`
- Health: `GET http://127.0.0.1:3000/api/v1/health`
- PostgreSQL: `127.0.0.1:5433`, container port 5432
- Redis: `127.0.0.1:6380`, container port 6379
- CORS: `http://localhost:5173`; thay `CORS_ORIGIN` nếu dùng origin khác.

Trước khi chạy, kiểm tra `ss -ltn` và `docker compose ps`. Không tự dừng service đang chiếm port. `docker compose down` giữ volumes; `docker compose down -v` xóa dữ liệu. Không dùng `-v` nếu cần giữ dữ liệu. Đổi password `.env` không tự đổi mật khẩu PostgreSQL trong volume đã khởi tạo.

## Cấu trúc

```text
backend/
├── src/
│   ├── app.ts                   # Express app factory, không listen/connect lúc import
│   ├── server.ts                # Kết nối, HTTP lifecycle, graceful shutdown
│   ├── config/                  # env, database, redis, logger
│   ├── middlewares/             # error-handler, not-found, validate-request
│   ├── modules/health/          # routes, controller, service
│   ├── database/
│   │   ├── schema/              # Drizzle schema cho auth và catalog
│   │   ├── migrations/          # SQL + Drizzle metadata, đưa vào Git
│   │   ├── migrate.ts
│   │   └── seeds/               # Seed development idempotent
│   ├── modules/catalog/          # categories, brands, products, variants, images
│   └── shared/                  # AppError, response helper
├── tests/
├── drizzle.config.ts
├── tsconfig.json
├── tsconfig.build.json
├── eslint.config.mjs
├── vitest.config.ts
├── Dockerfile
└── .dockerignore
```

Module nghiệp vụ tiếp theo có thể thêm trực tiếp tại `src/modules/<feature>/`; không có base repository/service hoặc generic CRUD framework.

## API và xử lý lỗi

Health thực hiện `SELECT 1` và Redis `PING` mỗi request, song song, deadline 3 giây mỗi probe. Trả HTTP 200 khi cả hai up; HTTP 503 nếu một trong hai down. Không trả connection string hoặc stack trace.

Catalog API dùng prefix `/api/v1`:

- `GET /categories`, `GET /brands`
- `GET /products` hỗ trợ `q`, `category`, `brand`, `minPrice`, `maxPrice`, `sort`, `sale`, `featured`, `trending`, `ids`, `page`, `limit`.
- `GET /products/:id` trả thông tin sản phẩm, ảnh và variants đang hoạt động.

BIGINT ID được serialize thành chuỗi. Giá VND được trả dạng số nguyên JSON nếu an toàn, hoặc chuỗi thập phân khi vượt giới hạn an toàn của JavaScript. `featured`/`trending` lấy từ rank rõ ràng trong product record; `sale` lọc `compareAtPrice > price` ở PostgreSQL. Seed development có ít nhất 5 sản phẩm cho mỗi danh mục (28 sản phẩm hiện tại), kèm ảnh demo và một variant tiêu chuẩn. Dữ liệu này là demo, không phải danh mục production.

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2026-10-31T00:00:00.000Z",
    "uptime": 10,
    "dependencies": {
      "postgres": { "status": "up", "latencyMs": 1 },
      "redis": { "status": "up", "latencyMs": 1 }
    }
  }
}
```

Lỗi dùng `{ success: false, error: { code, message, details? }, requestId }`. Mỗi request có `X-Request-Id`. Express 5 chuyển lỗi async tới error handler. JSON body giới hạn 1 MB. Validation bằng Zod cho body/query/params, dữ liệu parse nằm ở `res.locals.validated` vì `request.query` của Express 5 là getter.

Pino ghi log JSON ra stdout; không ghi body, query string hoặc credentials. API không bật trust proxy mặc định. Khi deploy sau reverse proxy, cấu hình theo topology thực tế.

Server kiểm tra PostgreSQL và Redis trước khi listen; startup thất bại thì thoát khác 0. SIGINT/SIGTERM ngừng nhận request, đợi request đang chạy rồi đóng pool/client; deadline shutdown 10 giây. Redis retry kết nối có giới hạn; mất kết nối kéo dài có thể cần restart process, health sẽ trả 503.

## Scripts và kiểm tra

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm start

npm run db:generate  # tạo SQL migration sau khi sửa schema
npm run db:migrate  # áp dụng migration đã có
npm run db:seed     # seed danh mục và catalog demo, chạy lại không tạo trùng
```

Tests HTTP dùng dependency giả, không yêu cầu PostgreSQL/Redis thật. Supertest cần quyền mở socket local. Kết nối và migrations thực tế kiểm chứng riêng bằng Compose + health. Seed demo bị từ chối khi `NODE_ENV=production`.

`updated_at` chưa có trigger tự cập nhật; module cập nhật sau này phải set trường này. Chưa có Inventory API, vì vậy catalog không khẳng định số lượng tồn kho.

## Container deployment

```sh
# Từ root repository:
docker build -f backend/Dockerfile -t technest-api:local backend
```

Dockerfile multi-stage, Node 22 Alpine, runtime chỉ cài dependencies production và chạy bằng user `node`. `.env` không được copy vào image. Runtime nhận `DATABASE_URL`, `REDIS_URL`, `CORS_ORIGIN` và các biến khác qua môi trường hoặc secret manager. HOST trong image là `0.0.0.0` để container nhận kết nối.

Khi API chạy container trên cùng Compose network, dùng `postgres:5432` và `redis:6379` trong URL, thay vì host loopback. Compose hiện chỉ chứa database/cache theo mô hình Backend chạy trực tiếp trong WSL2. Có thể áp dụng migration trong image bằng `node dist/database/migrate.js` trước khi khởi chạy phiên bản mới.

## Công việc tiếp theo

- Nối Inventory API và giá/tồn kho xác thực vào cart/checkout; hiện checkout vẫn là luồng frontend local/demo.
- Hoàn thiện quản trị catalog, media upload và dữ liệu production.
- Thêm xác thực, authorization, rate limit, idempotency và kiểm tra giá/tồn kho phía server khi triển khai nghiệp vụ.
- Thêm integration tests database, CI và migration deployment workflow.
- Cấu hình TLS, secret management, backup và giám sát cho môi trường production.
