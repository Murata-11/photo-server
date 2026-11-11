# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS native
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential cmake meson ninja-build pkg-config curl ca-certificates \
    libglib2.0-dev libexpat1-dev libjpeg62-turbo-dev libpng-dev libwebp-dev \
    libtiff-dev liblcms2-dev libexif-dev liborc-0.4-dev \
    && rm -rf /var/lib/apt/lists/*
COPY native/build.sh /src/native/build.sh
RUN --mount=type=secret,id=proxy_ca \
    NATIVE_CA=${NATIVE_CA:-/run/secrets/proxy_ca} sh /src/native/build.sh

ENV LD_LIBRARY_PATH=/opt/native/lib
COPY native/heif-inspect.cc /src/native/heif-inspect.cc
RUN PKG_CONFIG_PATH=/opt/native/lib/pkgconfig c++ -std=c++17 -O2 \
    /src/native/heif-inspect.cc -o /opt/native/bin/photo-heif-inspect \
    $(PKG_CONFIG_PATH=/opt/native/lib/pkgconfig pkg-config --cflags --libs libheif)

FROM native AS build
ENV PKG_CONFIG_PATH=/opt/native/lib/pkgconfig LD_LIBRARY_PATH=/opt/native/lib SHARP_FORCE_GLOBAL_LIBVIPS=1
WORKDIR /app
RUN --mount=type=secret,id=proxy_ca \
    NODE_EXTRA_CA_CERTS=${NODE_EXTRA_CA_CERTS:-/run/secrets/proxy_ca} npm install --global pnpm@10.34.9
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
RUN --mount=type=secret,id=proxy_ca \
    NODE_EXTRA_CA_CERTS=${NODE_EXTRA_CA_CERTS:-/run/secrets/proxy_ca} pnpm install --frozen-lockfile
COPY apps/backend/scripts/build-native-sharp.mjs apps/backend/scripts/build-native-sharp.mjs
RUN --mount=type=secret,id=proxy_ca \
    NODE_EXTRA_CA_CERTS=${NODE_EXTRA_CA_CERTS:-/run/secrets/proxy_ca} pnpm --filter @photo-server/backend run build:native-sharp
COPY tsconfig.base.json ./
COPY apps/backend apps/backend
COPY apps/frontend apps/frontend
RUN pnpm --filter @photo-server/frontend build \
    && pnpm --filter @photo-server/backend build
RUN --mount=type=secret,id=proxy_ca \
    NODE_EXTRA_CA_CERTS=${NODE_EXTRA_CA_CERTS:-/run/secrets/proxy_ca} pnpm --filter @photo-server/backend --prod deploy --legacy /runtime
RUN node apps/backend/scripts/build-native-sharp.mjs /runtime

FROM node:24-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 libexpat1 libjpeg62-turbo libpng16-16 libwebp7 libwebpdemux2 \
    libwebpmux3 libtiff6 liblcms2-2 libexif12 liborc-0.4-0 \
    && rm -rf /var/lib/apt/lists/* /usr/local/lib/node_modules/npm /opt/yarn-* \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/yarn /usr/local/bin/yarnpkg
COPY --from=native /opt/native /opt/native
ENV LD_LIBRARY_PATH=/opt/native/lib HEIF_INSPECTOR=/opt/native/bin/photo-heif-inspect
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 PHOTO_DATA_DIR=/data/photos
WORKDIR /app/apps/backend
COPY --from=build --chown=node:node /runtime/ ./
COPY --from=build --chown=node:node /app/apps/frontend/dist/ /app/apps/frontend/dist/
COPY --chmod=0644 apps/backend/test-fixtures/heic/tiny.heic /opt/native/share/photo/smoke.heic
RUN node --input-type=module -e "import sharp from 'sharp'; import {execFileSync} from 'node:child_process'; if(sharp.versions.heif !== undefined || sharp.versions.vips !== '8.18.7') throw Error('HEVC linkage missing'); execFileSync(process.env.HEIF_INSPECTOR, ['/opt/native/share/photo/smoke.heic']); await sharp('/opt/native/share/photo/smoke.heic').resize(16).jpeg().toBuffer();" \
    && mkdir -p /data/photos && chown node:node /data/photos
COPY --from=build /app/node_modules/node-addon-api/LICENSE.md /opt/native/share/licenses/node-addon-api-LICENSE.md
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
