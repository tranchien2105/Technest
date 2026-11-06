FROM node:22-alpine AS frontend
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ENV VITE_API_BASE_URL=/api/v1
RUN npm run build

FROM node:22-alpine AS backend
WORKDIR /build
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY backend/tsconfig*.json ./
COPY backend/src ./src
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 STOREFRONT_DIST=/app/storefront
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=backend /build/dist ./dist
COPY --from=backend /build/src/database/migrations ./dist/database/migrations
COPY --from=frontend /build/dist ./storefront
RUN apk add --no-cache fontconfig font-dejavu \
    && mkdir -p /public/images/uploads && chown -R node:node /public
VOLUME ["/public/images/uploads"]
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e 'fetch("http://127.0.0.1:"+process.env.PORT+"/api/v1/health/ready").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))'
CMD ["node","dist/server.js"]
