# syntax=docker/dockerfile:1
# THROWAWAY SPIKE image: native Rust SSR lane (context = this directory). Toolchain only inside Docker.
FROM rust:1.85.1-bookworm@sha256:e51d0265072d2d9d5d320f6a44dde6b9ef13653b035098febd68cce8fa7c0bc4 AS build
WORKDIR /src
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN --mount=type=cache,target=/usr/local/cargo/registry --mount=type=cache,target=/target \
    CARGO_TARGET_DIR=/target cargo build --release --locked && cp /target/release/rust-ceiling /rust-ceiling
FROM debian:bookworm-slim@sha256:7c7b2c966bc9ee8cedfeef67e0e279108992c77681fa595db4a9d65c06ccc587
COPY --from=build /rust-ceiling /usr/local/bin/rust-ceiling
# benchmark.py reads every non-dotnet lane's build metadata from this path.
RUN mkdir -p /workspace/apps/ssr-bench/dist && printf '%s' '{"artifacts":[{"framework":"rust-ceiling","version":"0.0.0","implementation":"hand-written native Rust spike (hyper 1, tokio, tonic 0.12, prost 0.13)","outputMode":"stream"}]}' > /workspace/apps/ssr-bench/dist/builds.json
ENV PORT=8080
EXPOSE 8080
CMD ["rust-ceiling"]
