import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";
import type { Writable } from "node:stream";
import { contentServer, textProfile } from "./services/content.server.ts";
import type { Page } from "./services/page-decoder.ts";

/** Contract every built `dist/<framework>.mjs` lane bundle exports. */
interface Adapter {
  renderPage(page: Page, options: { signal: AbortSignal; articleHtml: string }, sink: Writable): Promise<void>;
  close?: () => void;
}
interface BuildArtifact {
  framework: string;
  version: string;
  implementation: string;
  outputMode: string;
}

// Runs from source (`server.ts`) or as the build's plain-JS bundle (`dist/server.mjs`, used by the
// containers: Node's type stripping costs ~24 MB of resident memory per process).
const dist = new URL(import.meta.url.endsWith("/dist/server.mjs") ? "./" : "./dist/", import.meta.url);
const framework = process.env.FRAMEWORK ?? "rivet";
if (!["rivet", "solid", "qwik", "solid-stable", "qwik-stable", "solid-stable-string", "solid-stable-static", "solid-stable-interactive", "rivet-compiled", "rivet-for", "react-static", "react-interactive"].includes(framework)) throw new Error("Invalid framework");
const { renderPage, close: closeAdapter } = (await import(new URL(`${framework}.mjs`, dist).href)) as Adapter;
const service = contentServer(process.env.GRPC_URL ?? "127.0.0.1:18100");
const metadata = (
  JSON.parse(await readFile(new URL("builds.json", dist), "utf8")) as { artifacts: BuildArtifact[] }
).artifacts.find((a) => a.framework === framework)!;
// Host runtime (Node, or Bun / Deno running this same bundle — compose `*-bun` / `*-deno` lanes).
const runtime = (process.versions as Record<string, string | undefined>).bun
  ? `bun ${(process.versions as Record<string, string>).bun}`
  : (globalThis as { Deno?: { version: { deno: string } } }).Deno
    ? `deno ${(globalThis as unknown as { Deno: { version: { deno: string } } }).Deno.version.deno}`
    : `node ${process.version}`;
const counters = { completed: 0, failed: 0, cancelled: 0, rpcMs: 0, parseMs: 0, renderMs: 0 };
const clientRoot = fileURLToPath(new URL(framework === "qwik-stable" ? "client-stable/" : "client/", dist));
const server = createServer(async (req, res) => {
  const controller = new AbortController();
  const abort = () => {
    if (!res.writableFinished) controller.abort();
  };
  req.once("aborted", abort);
  res.once("close", abort);
  res.once("error", abort);
  const url = new URL(req.url!, "http://localhost");
  try {
    if ((framework === "qwik" || framework === "qwik-stable") && (url.pathname.startsWith("/build/") || url.pathname.startsWith("/assets/"))) {
      const path = resolve(clientRoot, "." + url.pathname);
      if (!path.startsWith(clientRoot)) {
        res.writeHead(404);
        res.end();
        return;
      }
      try {
        const bytes = await readFile(path);
        res.setHeader("Content-Type", path.endsWith(".js") ? "text/javascript" : "application/json");
        res.end(bytes);
      } catch {
        res.writeHead(404);
        res.end();
      }
      return;
    }
    if (url.pathname === "/health" || url.pathname === "/metrics") {
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify(
          url.pathname === "/health"
            ? { status: "ready", framework, version: metadata.version, runtime, variant: process.env.RIVET_VARIANT ?? (framework === "solid-stable-string" || framework === "solid-stable-static" ? "string" : "stream"), implementation: metadata.implementation, outputMode: framework === "rivet" && process.env.RIVET_VARIANT === "string" ? "buffered-string" : metadata.outputMode }
            : { ...counters, ...process.memoryUsage() },
        ),
      );
      return;
    }
    if (url.pathname.startsWith("/api/articles/")) {
      if (url.pathname !== "/api/articles/performance") {
        res.writeHead(404);
        res.end();
        return;
      }
      const page = await service.getPage(
        { rows: 0, token: "", article: true, delayMs: 0 },
        { signal: controller.signal },
      );
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ id: "performance", markdown: page.markdown }));
      return;
    }
    if (url.pathname !== "/page") {
      res.writeHead(404);
      res.end();
      return;
    }
    const rows = Number(url.searchParams.get("rows") ?? 100);
    const delayMs = Number(url.searchParams.get("delay_ms") ?? 0);
    const token = url.searchParams.get("token") ?? "";
    if (
      !Number.isInteger(rows) ||
      rows < 0 ||
      rows > 5000 ||
      !Number.isInteger(delayMs) ||
      delayMs < 0 ||
      delayMs > 5000 ||
      token.length > 512
    ) {
      res.writeHead(400);
      res.end();
      return;
    }
    let start = performance.now();
    const page = await service.getPage(
      { rows, token, article: url.searchParams.get("article") === "1", delayMs, strings: textProfile(url.searchParams.get("strings")) },
      { signal: controller.signal },
    );
    counters.rpcMs += performance.now() - start;
    start = performance.now();
    const articleHtml = page.markdown ? marked.parse(page.markdown, { async: false }) : "";
    counters.parseMs += performance.now() - start;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    start = performance.now();
    await renderPage(page, { signal: controller.signal, articleHtml }, res);
    counters.renderMs += performance.now() - start;
    await new Promise<void>((resolve, reject) => {
      const complete = () => {
        cleanup();
        resolve();
      };
      const failed = () => {
        cleanup();
        reject(new Error("Response closed before completion"));
      };
      const cleanup = () => {
        res.off("finish", complete);
        res.off("close", failed);
      };
      res.once("finish", complete);
      res.once("close", failed);
      res.end("<!--complete-->");
    });
    counters.completed++;
  } catch (error) {
    if (controller.signal.aborted) {
      counters.cancelled++;
      res.destroy();
    } else {
      counters.failed++;
      if (res.headersSent) res.destroy(error as Error);
      else {
        res.writeHead(502);
        res.end("SSR/backend failure");
      }
    }
  } finally {
    req.off("aborted", abort);
    res.off("close", abort);
    res.off("error", abort);
  }
});
server.listen(Number(process.env.PORT ?? 8080), "0.0.0.0", () => console.log(`SSR ${framework} listening`));
for (const name of ["SIGINT", "SIGTERM"] as const)
  process.on(name, () => {
    closeAdapter?.();
    server.close(() => {
      service.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 3000).unref();
  });
