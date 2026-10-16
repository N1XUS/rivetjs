// Vite plugin: generate content routes and the example frames before the router scans `src/routes`, and regenerate
// them on the dev server when Markdown, the nav or an example changes (new/removed pages: the router reloads the
// page; edited pages: the route module hot-updates). On the dev server problems of a single page or example are
// logged, not thrown (`lenient`): a lane's half-written page must not stop `serve --dev`.
import { resolve, sep } from "node:path";
import type { Plugin, ViteDevServer } from "vite";
import { generateExamples } from "../examples.ts";
import { generateContent } from "./generate.ts";

export function docsContent(): Plugin {
  let root = process.cwd();
  let dev = false;
  let logger: { warn(message: string): void } = { warn: (message) => console.warn(message) };
  const seen = new Set<string>();
  // Each problem once per process (regeneration runs on every content change).
  const lenient = (message: string) => {
    if (seen.has(message)) return;
    seen.add(message);
    logger.warn(`docs: ${message}`);
  };
  return {
    name: "rivet-docs-content",
    enforce: "pre",
    async config(config, env) {
      root = resolve(config.root ?? process.cwd());
      dev = env.command === "serve";
      // A docs build's server-bundle child (`tools/vite-build.ts`): the client child generated them just before.
      if (process.env.DOCS_KIT_GENERATED) return;
      // Examples first: content validates `::example{id}` against them.
      await generateExamples(root, dev ? { lenient } : {});
      await generateContent(root, dev ? { lenient } : {});
    },
    configResolved(config) {
      logger = config.logger;
    },
    configureServer(server: ViteDevServer) {
      const content = resolve(root, "content") + sep;
      const examples = resolve(root, "examples") + sep;
      let queue = Promise.resolve();
      const run = (what: () => Promise<{ written: string[] }>) => {
        queue = queue
          .then(what)
          .then(({ written }) => {
            if (written.length) server.config.logger.info(`docs: regenerated ${written.length} file(s)`, { timestamp: true });
          })
          .catch((error: unknown) => {
            server.config.logger.error(String((error as Error)?.message ?? error));
            server.ws.send({ type: "error", err: { message: String((error as Error)?.message ?? error), stack: "" } });
          });
      };
      const regenerate = (file: string) => {
        if (file.startsWith(content) && /\.(md|ts)$/.test(file)) run(() => generateContent(root, dev ? { lenient } : {}));
        // Examples: their list, configs, route files and stylesheets shape the generated frames (code edits inside an
        // example module hot-update through Vite itself; regenerating is cheap and writes only what changed).
        else if (file.startsWith(examples) && /\.(tsx?|jsx?|css|json)$/.test(file))
          run(async () => {
            const generated = await generateExamples(root, { lenient });
            const pages = await generateContent(root, { lenient });
            return { written: [...generated.written, ...pages.written] };
          });
      };
      server.watcher.add([content, examples]);
      server.watcher.on("change", regenerate);
      server.watcher.on("add", regenerate);
      server.watcher.on("unlink", regenerate);
    },
  };
}
