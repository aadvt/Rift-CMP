# Rift-CMP, as three images built from one workspace.
#
# The product is three processes and pretending otherwise hides a real failure
# mode, so each one gets its own target here rather than being crammed into a
# single container with a process manager:
#
#   api        the platform — /api/v1, the SDK bundle, the database
#   worker     performs queued scans; without it a scan sits at "queued" forever
#   dashboard  the product UI, which reads the platform over HTTP like any
#              other integrator
#
# ## Why the worker cannot be serverless
#
# It launches a real Chromium and may spend ten minutes on one crawl. That rules
# out every function-style host, which is the whole reason this file exists: the
# API and the dashboard would deploy happily to Vercel, and scans would queue
# forever with nothing on screen to say why.
#
# ## One install, three images
#
# `deps` installs the workspace once and every target copies from it. Installing
# separately per image would be three resolutions of the same lockfile and three
# chances for them to disagree.

# ── Shared dependency layer ──────────────────────────────────────────────────
# Pinned to the Playwright image so the browser and the library that drives it
# are versioned together. A mismatch between them fails at launch, inside a
# container, which is a bad place to discover it.
FROM mcr.microsoft.com/playwright:v1.62.1-noble AS deps
WORKDIR /app

# Manifests first: this layer is rebuilt only when a dependency actually
# changes, rather than on every source edit.
COPY package.json package-lock.json ./
COPY api/package.json                api/package.json
COPY sdk/package.json                sdk/package.json
COPY crawler/package.json            crawler/package.json
COPY database/package.json           database/package.json
COPY shared/package.json             shared/package.json
COPY policy/package.json             policy/package.json
COPY secure-transfer/package.json    secure-transfer/package.json

# `--ignore-scripts` because `database`'s postinstall runs `prisma generate`,
# which needs the schema — and the schema is not copied yet. Generation happens
# explicitly below, where the inputs exist.
RUN npm ci --ignore-scripts

# ── Source and Prisma client ─────────────────────────────────────────────────
FROM deps AS source
WORKDIR /app
COPY . .

# Generated here, once, so every image carries an identical client built for
# this container's platform rather than whatever the developer's laptop is.
RUN npm -w database run generate

# ── The platform ─────────────────────────────────────────────────────────────
FROM source AS api-build
WORKDIR /app
# The SDK bundle is copied into api/public by api's own predev/prebuild hook,
# so it has to exist before the Next build runs.
RUN npm -w sdk run build && npm -w api run build

FROM source AS api
WORKDIR /app
COPY --from=api-build /app/api/.next        ./api/.next
COPY --from=api-build /app/api/public       ./api/public
COPY --from=api-build /app/sdk/dist         ./sdk/dist
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["npm", "-w", "api", "run", "start"]

# ── The scanner ──────────────────────────────────────────────────────────────
# Runs as the image's own non-root `pwuser`. A process that renders arbitrary
# websites is the one process here that should never be root, and the Playwright
# image already provides a user with the browser sandbox configured.
FROM source AS worker
WORKDIR /app
ENV NODE_ENV=production
USER pwuser
CMD ["npm", "-w", "@rift-cmp/crawler", "run", "worker"]

# ── The product UI ───────────────────────────────────────────────────────────
# A separate npm workspace root, so it installs separately.
FROM node:24-slim AS dashboard-deps
WORKDIR /web
COPY rift-frontend-main/package.json rift-frontend-main/package-lock.json* ./
COPY rift-frontend-main/apps/dashboard/package.json   apps/dashboard/package.json
COPY rift-frontend-main/apps/marketing/package.json   apps/marketing/package.json
COPY rift-frontend-main/packages/ui/package.json      packages/ui/package.json
COPY rift-frontend-main/packages/tokens/package.json  packages/tokens/package.json
COPY rift-frontend-main/packages/consent-ui/package.json packages/consent-ui/package.json
RUN npm install --no-audit --no-fund

FROM dashboard-deps AS dashboard-build
WORKDIR /web
COPY rift-frontend-main/ ./
# Baked in rather than passed at run time: `allowedOrigins` is read when the
# config is evaluated during the build, so setting it only on the container
# would have no effect and the failure it prevents is invisible.
ARG RIFT_PUBLIC_HOST=""
ENV RIFT_PUBLIC_HOST=$RIFT_PUBLIC_HOST
RUN npm run build -w @rift/dashboard

FROM dashboard-build AS dashboard
WORKDIR /web
ENV NODE_ENV=production
ENV PORT=3100
EXPOSE 3100
CMD ["npm", "run", "start", "-w", "@rift/dashboard"]
