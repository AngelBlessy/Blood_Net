# syntax = docker/dockerfile:1

# Server-only image for Fly.io. The client (React/Vite app in client/) is
# deployed separately on Vercel and is deliberately NOT built or copied here.
#
# Dependencies live in the repo-root package.json (server/ has no package.json
# of its own), so this Dockerfile must be built with the repo root as its
# build context, e.g.:
#   fly deploy   (run from the repo root, using fly.toml's default context)

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=22.21.1

FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# --ignore-scripts skips the root "postinstall" script, which otherwise runs
# `npm install --prefix client` — unwanted and unavailable in this image
# since client/ isn't copied in.
RUN npm ci --omit=dev --ignore-scripts

FROM node:${NODE_VERSION}-alpine AS runner

LABEL fly_launch_runtime="Node.js"

ENV NODE_ENV=production
WORKDIR /app

RUN addgroup -S nodejs && adduser -S nodejs -G nodejs

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY server ./server

USER nodejs

# fly.toml's [env] block sets the real PORT (matching internal_port),
# overriding this default — it's only used for `docker run` outside of Fly.
EXPOSE 3000
ENV PORT=3000

CMD ["node", "server/index.js"]
