# Debian-based slim image. @napi-rs/canvas ships prebuilt native binaries; the
# default prebuilt targets are glibc-based, so node:20-slim (Debian) is the
# reliable choice. (node:20-alpine uses musl and would need the musl prebuild +
# extra care, so we avoid it here.) No system canvas libs are required.
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY assets ./assets
COPY robot_twerk_up.gif ./
CMD ["node", "dist/index.js"]
