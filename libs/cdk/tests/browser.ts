// Chromium harness for cdk DOM tests: serves the repository's TypeScript sources with types
// stripped (node:module `stripTypeScriptTypes`) and an import map for `@rivetjs/*`, so a test page
// can `import("/libs/cdk/overlay/position.ts")` without a build. One server + browser per test file.
import { createServer, type Server } from "node:http";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright";
import { resolveCdkSubpath } from "./resolve-subpath.ts";

const root = fileURLToPath(new URL("../../../", import.meta.url));

type Target = string | null | { [condition: string]: Target };

/** Node conditional target → one path (`browser`, then `default`; no `development`: tests run production code). */
const pick = (target: Target): string | undefined => {
  if (target === null) return undefined;
  if (typeof target === "string") return target;
  return pick(target.browser ?? target.default ?? null);
};

/**
 * Package-private `#…` specifiers (package.json `imports`, e.g. runtime `#dev`) of every `libs/*` package
 * as import-map scopes, so modules under `/libs/<pkg>/` resolve them like Node does. Generated from the
 * package.json files so the map cannot drift. `#x/*` patterns become `#x/` prefixes.
 */
export const packageImportScopes = (): Record<string, Record<string, string>> => {
  const scopes: Record<string, Record<string, string>> = {};
  for (const dir of readdirSync(root + "libs")) {
    const file = root + "libs/" + dir + "/package.json";
    if (!existsSync(file)) continue;
    const imports = (JSON.parse(readFileSync(file, "utf8")) as { imports?: Record<string, Target> }).imports;
    if (!imports) continue;
    const base = "/libs/" + dir + "/";
    const scope: Record<string, string> = {};
    for (const [key, value] of Object.entries(imports)) {
      const target = pick(value);
      if (!target) continue;
      const path = base + target.replace(/^\.\//, "");
      if (key.endsWith("/*") && path.endsWith("/*")) scope[key.slice(0, -1)] = path.slice(0, -1);
      else if (!key.includes("*")) scope[key] = path;
    }
    scopes[base] = scope;
  }
  return scopes;
};

const importMap = {
  imports: {
    "@rivetjs/reactivity": "/libs/reactivity/index.ts",
    "@rivetjs/runtime/dom": "/libs/runtime/dom.ts",
    "@rivetjs/runtime/slot": "/libs/runtime/slot.ts",
    "@rivetjs/cdk/": "/libs/cdk/",
  },
  scopes: packageImportScopes(),
};

/** `/libs/cdk/<subpath>` (import-map result of `@rivetjs/cdk/<subpath>`) → the exported source file. */
const cdkSubpath = (pathname: string): string => {
  const match = /^\/libs\/cdk\/(.+)$/.exec(pathname);
  if (!match || /\.(ts|tsx|js|css)$/.test(pathname)) return pathname;
  const file = resolveCdkSubpath(match[1]!);
  return file ? "/libs/cdk/" + file : pathname;
};

export interface Harness {
  origin: string;
  browser: Browser;
  /** A fresh page with `body` HTML (and optional `<style>`), modules importable by URL. */
  page(body?: string, options?: { css?: string; viewport?: { width: number; height: number } }): Promise<Page>;
  close(): Promise<void>;
}

const cache = new Map<string, string>();

export async function harness(): Promise<Harness> {
  const server: Server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://x");
    if (url.pathname === "/") {
      response.setHeader("content-type", "text/html");
      response.end("<!doctype html><html><head></head><body></body></html>");
      return;
    }
    try {
      const path = root + cdkSubpath(decodeURIComponent(url.pathname)).replace(/^\/+/, "");
      if (!path.startsWith(root) || !/\.(ts|js)$/.test(path)) throw new Error("forbidden");
      let code = cache.get(path);
      if (code === undefined) {
        const source = await readFile(path, "utf8");
        code = path.endsWith(".ts") ? stripTypeScriptTypes(source, { mode: "strip" }) : source;
        cache.set(path, code);
      }
      response.setHeader("content-type", "text/javascript");
      response.end(code);
    } catch {
      response.statusCode = 404;
      response.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  const origin = `http://127.0.0.1:${address.port}`;
  const browser = await chromium.launch({ headless: true });
  return {
    origin,
    browser,
    async page(body = "", options = {}) {
      const page = await browser.newPage({ viewport: options.viewport ?? { width: 800, height: 600 } });
      page.on("pageerror", (error) => console.error("pageerror:", error.message));
      await page.goto(origin + "/");
      await page.setContent(
        `<!doctype html><html><head><script type="importmap">${JSON.stringify(importMap)}</script>` +
          `<style>html,body{margin:0;padding:0}${options.css ?? ""}</style></head><body>${body}</body></html>`,
      );
      return page;
    },
    async close() {
      await browser.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
