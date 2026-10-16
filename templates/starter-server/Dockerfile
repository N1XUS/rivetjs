# Build, then run the production server with only what it needs.
# `npm ci` when the project has a lockfile (commit it after your first `npm install`), else `npm install`.
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .
RUN npm run build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY --from=build /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY serve.js ./
EXPOSE 3000
CMD ["node", "serve.js"]
