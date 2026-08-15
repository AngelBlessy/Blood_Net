# syntax = docker/dockerfile:1

# Combined server + ML image for Fly.io. The client (React/Vite app in
# client/) is deployed separately on Vercel and is deliberately NOT built or
# copied here.
#
# Dependencies live in the repo-root package.json (server/ has no package.json
# of its own), so this Dockerfile must be built with the repo root as its
# build context, e.g.:
#   fly deploy   (run from the repo root, using fly.toml's default context)
#
# Base images are Debian-slim, not Alpine: the ML stage installs xgboost /
# pandas / numpy / scikit-learn via pip, and those only ship prebuilt
# manylinux (glibc) wheels -- on musl-based Alpine, pip would fall back to
# compiling them from source (slow, and xgboost's C++ build isn't reliable
# without extra toolchain packages).

ARG NODE_VERSION=22.21.1

FROM node:${NODE_VERSION}-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# --ignore-scripts skips the root "postinstall" script, which otherwise runs
# `npm install --prefix client` — unwanted and unavailable in this image
# since client/ isn't copied in.
RUN npm ci --omit=dev --ignore-scripts

# Trains the ML model at build time. generate_training_data.py is seeded
# (SEED = 42), so this is fully deterministic -- baking the model into the
# image avoids needing scikit-learn/pandas at runtime and keeps container
# startup fast. The venv built here is reused (not rebuilt) in the runner
# stage below.
FROM node:${NODE_VERSION}-slim AS ml-build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv python3-pip \
  && rm -rf /var/lib/apt/lists/*
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
COPY ml/requirements.txt ./ml/requirements.txt
RUN pip install --no-cache-dir -r ml/requirements.txt
COPY ml ./ml
RUN python3 ml/generate_training_data.py && python3 ml/train_model.py

FROM node:${NODE_VERSION}-slim AS runner

LABEL fly_launch_runtime="Node.js"

ENV NODE_ENV=production
WORKDIR /app

# tini reaps zombies and forwards signals properly to start.sh's two child
# processes; python3 runs the ML service using the venv copied in below.
RUN apt-get update && apt-get install -y --no-install-recommends python3 tini \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system nodejs && useradd --system --gid nodejs nodejs

COPY --from=ml-build /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY server ./server
COPY ml ./ml
# Overlay the trained model (ml-build's COPY ml ./ml above already brought in
# the scripts; this replaces/adds the model/ dir produced by training).
COPY --from=ml-build /app/ml/model ./ml/model
COPY docker/start.sh ./start.sh
RUN chmod +x ./start.sh && chown -R nodejs:nodejs /app

USER nodejs

# fly.toml's [env] block sets the real PORT (matching internal_port),
# overriding this default — it's only used for `docker run` outside of Fly.
EXPOSE 3000
ENV PORT=3000
# Same-container default: the ML service binds to 127.0.0.1 (see ml/app.py),
# so the Node process reaches it over loopback with no network hop.
ENV ML_SERVICE_URL=http://127.0.0.1:5001

ENTRYPOINT ["tini", "--"]
CMD ["./start.sh"]
