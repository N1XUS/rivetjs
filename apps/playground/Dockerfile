# Deployable playground: `docker build -f apps/playground/Dockerfile -t rivet-playground .` (repo root),
# then `docker run -p 8080:8080 rivet-playground`.
FROM node:24.14.1-bookworm-slim@sha256:b506e7321f176aae77317f99d67a24b272c1f09f1d10f1761f2773447d8da26c AS build
WORKDIR /workspace
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/playground/package.json ./apps/playground/package.json
COPY libs/compiler/package.json ./libs/compiler/package.json
COPY libs/runtime/package.json ./libs/runtime/package.json
COPY libs/reactivity/package.json ./libs/reactivity/package.json
COPY libs/router/package.json ./libs/router/package.json
RUN npm ci --no-audit --no-fund --workspace=@rivetjs/playground
COPY libs/compiler ./libs/compiler
COPY libs/runtime ./libs/runtime
COPY libs/reactivity ./libs/reactivity
COPY libs/router ./libs/router
COPY apps/playground ./apps/playground
RUN node apps/playground/build.ts

# Runtime: the build output only (server bundle, client assets, plain-JS HTTP server); no node_modules.
FROM node:24.14.1-bookworm-slim@sha256:b506e7321f176aae77317f99d67a24b272c1f09f1d10f1761f2773447d8da26c
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080
COPY --from=build /workspace/apps/playground/dist ./dist
USER node
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s CMD node -e "fetch('http://127.0.0.1:8080/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "dist/serve.mjs"]
