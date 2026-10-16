---
title: Docker
description: Package a server-rendered Rivet app in a small Docker image with a two-stage Dockerfile, and run it with health checks and clean shutdown.
template: guide
status: experimental
related: [guides/deploy/node, guides/deploy/static-hosts]
---

A Docker image holds your built app, Node.js and the production dependencies in one file that runs the same everywhere. The server starter includes a Dockerfile. This page explains it, so you can adapt it.

After reading this page you can build an image, run it, and connect it to your host's health checks.

::starter{template=starter-server}

## The Dockerfile

```dockerfile title="Dockerfile"
# Build, then run the production server with only what it needs.
FROM node:24-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY serve.js ./
EXPOSE 3000
CMD ["node", "serve.js"]
```

It has two stages:

1. **build** installs all dependencies, including Vite and the compiler, and runs `npm run build` (browser build and server build).
2. The **final image** installs only production dependencies and copies the `dist` folder and `serve.js`. Your source files, the compiler and Vite are not in it.

`HOST=0.0.0.0` matters: the server listens on `127.0.0.1` by default, which is not reachable from outside the container.

The server script reads these variables:

```js title="serve.js"
import { closeOnSignals, start } from "@rivetjs/router/node";

const serving = await start({ dist: "dist", port: Number(process.env.PORT ?? 3000), host: process.env.HOST ?? "127.0.0.1" });
closeOnSignals(serving);
console.log(`Listening on ${serving.url}`);
```

See [Node](node.md) for what `start()` and `closeOnSignals()` do.

## Build and run

```bash
docker build -t my-app .
docker run -p 3000:3000 my-app
```

Open `http://localhost:3000`.

Add a `.dockerignore` file, so the build does not copy local folders into the image:

```txt title=".dockerignore"
node_modules
dist
.rivet
```

## Secrets and settings

Pass secrets as environment variables when the container starts, not in the Dockerfile:

```bash
docker run -p 3000:3000 -e DATABASE_URL="postgres://…" my-app
```

Read them in `*.server.ts` files with `process.env`. See [Server-only code](../security/server-only-code.md).

## Health checks

The server answers two paths without touching your app:

- `/healthz`: `200 ok` while the process runs. Use it for "is it alive?" checks.
- `/readyz`: `200 ready`, or `503 draining` during shutdown. Use it for "may it receive traffic?" checks.

A Docker health check needs a command inside the container. The slim Node image has no `curl`, so use Node itself:

```dockerfile
HEALTHCHECK CMD node -e "fetch('http://127.0.0.1:3000/healthz').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
```

Orchestrators like Kubernetes call the paths over HTTP directly: point the liveness probe at `/healthz` and the readiness probe at `/readyz`.

## Clean shutdown

`docker stop` sends `SIGTERM`. `closeOnSignals` then stops new connections, lets running requests finish for up to 10 seconds, and exits. Docker also waits 10 seconds by default before it kills the container. Give Docker a little more time than `grace`, for example `docker stop -t 15`, and raise both together.

`CMD ["node", "serve.js"]` runs Node as the main process, so it receives the signal. Starting it through `npm start` or a shell script can swallow the signal.

## Common mistakes

- **Connection refused.** `HOST` is not `0.0.0.0`, or the port is not published with `-p`.
- **Build fails with `npm ci`.** `npm ci` needs a `package-lock.json`. Run `npm install` once locally and commit the lock file.

## See also

- [Node](node.md)
- [Static hosts](static-hosts.md) if your site needs no server
