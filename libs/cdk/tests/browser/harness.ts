// Browser harness for cdk tests: a Vite dev server rooted at libs/cdk (TS + Rivet TSX compiled
// for client rendering) and one headless Chromium per test file. Tests open `blank()` and import
// modules by root path inside `page.evaluate`: `await import("/layout/index.ts")`.
import { chromium, type Browser, type Page } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { rivet } from "@rivetjs/compiler/vite";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));

export interface Harness {
  origin: string;
  browser: Browser;
  /** New page on the blank fixture (`tests/browser/index.html`), fresh context. */
  blank(options?: { colorScheme?: "light" | "dark"; viewport?: { width: number; height: number }; reducedMotion?: "reduce" | "no-preference" }): Promise<Page>;
  close(): Promise<void>;
}

export async function harness(): Promise<Harness> {
  const server: ViteDevServer = await createServer({
    root,
    configFile: false,
    logLevel: "error",
    plugins: [rivet()],
    server: { port: 0, host: "127.0.0.1", hmr: false, fs: { allow: [fileURLToPath(new URL("../../../../", import.meta.url))] } },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  await server.listen();
  const address = server.httpServer!.address();
  const origin = typeof address === "object" && address ? `http://127.0.0.1:${address.port}` : "";
  const browser = await chromium.launch({ headless: true });
  return {
    origin,
    browser,
    async blank(options = {}) {
      const context = await browser.newContext({ ...options, permissions: ["clipboard-read", "clipboard-write"] });
      const page = await context.newPage();
      page.on("pageerror", (error) => console.error("[pageerror]", error.message));
      await page.goto(origin + "/tests/browser/index.html");
      return page;
    },
    async close() {
      await browser.close();
      await server.close();
    },
  };
}
