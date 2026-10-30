ARG BASE_IMAGE=node:24.14.1-bookworm-slim@sha256:b506e7321f176aae77317f99d67a24b272c1f09f1d10f1761f2773447d8da26c
FROM ${BASE_IMAGE}
USER root
ENV NODE_OPTIONS=--max-old-space-size=2048 PLAYWRIGHT_BROWSERS_PATH=/opt/playwright NPM_CONFIG_FETCH_RETRIES=1 NPM_CONFIG_FETCH_TIMEOUT=30000
WORKDIR /consumer
RUN printf '{"name":"rivet-package-security-consumer","private":true,"type":"module"}\n' > package.json \
 && npm install --ignore-scripts --legacy-peer-deps --no-audit --no-fund vite@8.3.2 playwright@1.63.0 --loglevel=info
RUN npx playwright install --with-deps chromium
COPY tarballs /tarballs
RUN npm install --ignore-scripts --legacy-peer-deps --no-audit --no-fund /tarballs/*.tgz
COPY audit-manifest.json /audit-manifest.json
COPY fixture /consumer
CMD ["node", "audit.mjs"]
