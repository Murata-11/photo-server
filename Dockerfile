# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN --mount=type=secret,id=proxy_ca \
    NODE_EXTRA_CA_CERTS=${NODE_EXTRA_CA_CERTS:-/run/secrets/proxy_ca} npm install --global pnpm@10.34.9
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
RUN --mount=type=secret,id=proxy_ca \
    NODE_EXTRA_CA_CERTS=${NODE_EXTRA_CA_CERTS:-/run/secrets/proxy_ca} pnpm install --frozen-lockfile
COPY tsconfig.base.json ./
COPY apps/backend apps/backend
COPY apps/frontend apps/frontend
RUN pnpm --filter @photo-server/frontend build \
    && pnpm --filter @photo-server/backend build
RUN --mount=type=secret,id=proxy_ca \
    NODE_EXTRA_CA_CERTS=${NODE_EXTRA_CA_CERTS:-/run/secrets/proxy_ca} pnpm --filter @photo-server/backend --prod deploy --legacy /runtime

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 PHOTO_DATA_DIR=/data/photos
WORKDIR /app/apps/backend
COPY --from=build --chown=node:node /runtime/ ./
COPY --from=build --chown=node:node /app/apps/frontend/dist/ /app/apps/frontend/dist/
RUN rm -rf /usr/local/lib/node_modules/npm /opt/yarn-* \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/yarn /usr/local/bin/yarnpkg \
    && mkdir -p /data/photos && chown node:node /data/photos
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
