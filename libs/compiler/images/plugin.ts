import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { Plugin, ResolvedConfig } from "vite";
import { parseImageId, validateConfig, type ImagesConfig } from "./options.ts";
import { sharpProcessor } from "./processor.ts";
import { createPipeline, MIME_BY_EXT, type PlannedAsset } from "./pipeline.ts";
import { compile } from "../index.ts";

const RUNTIME = "@rivetjs/runtime/image";
/** Descriptor module source: deep-frozen data, branded `Symbol.for("rivet.image")` on top (no getters, never
 * mutated), so the runtime's `pictureHtml` may cache its encoded markup per descriptor. Every call is
 * `@__PURE__` (and the brand key a hoisted pure const) so an unused import tree-shakes to 0 B (zero-cost). */
const PURE = "/* @__PURE__ */ ";
const BRAND = `const brand = ${PURE}Symbol.for("rivet.image");\n`;
/** Largest descriptor (JSON chars) a build inlines into its importer instead of leaving a module (one request per
 * image on the client); bigger ones (long blur placeholders) keep their module so importers share one copy. */
export const IMAGE_INLINE_LIMIT = 1024;
/** `import name from "<file>?…image"` lines (default import only) in project modules. */
const IMAGE_IMPORT = /^import[ \t]+([A-Za-z_$][\w$]*)[ \t]+from[ \t]*(["'])([^"'\n]*[?&]image(?:[&=][^"'\n]*)?)\2[ \t]*;?[ \t]*$/gm;
const frozen = (value: unknown, top = false, brand = "brand"): string =>
  Array.isArray(value)
    ? `${PURE}Object.freeze([${value.map((item) => frozen(item)).join(",")}])`
    : value !== null && typeof value === "object"
      ? `${PURE}Object.freeze({${Object.entries(value)
          .filter(([, item]) => item !== undefined)
          .map(([key, item]) => JSON.stringify(key) + ":" + frozen(item))
          .join(",")}${top ? `,[${brand}]:true` : ""}})`
      : JSON.stringify(value);
const SERVER_ONLY_WARNING =
  "image variants referenced from server code may be missing from the client build; build with createBuilder().buildApp() (vite build --app)";
/** `?image` / `?jsx` / `?svg` imports. Shared across environments: every environment registers variants, the client emits them. */
export function imagesPlugin(input: ImagesConfig | true): Plugin {
  const config = input === true ? {} : input;
  validateConfig(config);
  const processor = config.processor ?? sharpProcessor();
  const registry = new Map<string, PlannedAsset>(); // `${key}.${ext}` → asset
  let pipeline: ReturnType<typeof createPipeline>;
  let resolved: ResolvedConfig;
  let appBuild = false;
  // i18n per-locale client builds (`@rivetjs/i18n/vite`: base `<base><locale>/`, outDir `<outDir>/<locale>/`): images are
  // locale-free — URLs under the app base, files once in the parent client directory — so the server build's markup (base
  // `<base>`) and every locale's client code name the same files.
  let localeDir: string | null = null;
  const isClient = (ctx: { environment?: { config: { consumer: string } } }, ssr?: boolean) =>
    ctx.environment ? ctx.environment.config.consumer === "client" : !ssr;
  return {
    name: "vite-plugin-rivet-images",
    enforce: "pre",
    sharedDuringBuild: true,
    configResolved(config_) {
      resolved = config_;
      const i18n = config_.plugins.find((plugin) => plugin.name === "vite-plugin-rivet-i18n") as { api?: { locale?: string | null } } | undefined;
      const locale = config_.command === "build" && !config_.build.ssr ? (i18n?.api?.locale ?? null) : null;
      const suffix = locale ? locale + "/" : "";
      const base = suffix && config_.base.endsWith("/" + suffix) ? config_.base.slice(0, -suffix.length) : config_.base;
      localeDir = base !== config_.base ? resolve(config_.root, config_.build.outDir, "..") : null;
      pipeline = createPipeline({
        config,
        processor,
        base,
        assetsDir: config_.build.assetsDir,
        dev: config_.command === "serve",
        cacheDir: resolve(config_.root, config.cacheDir ?? "node_modules/.rivet/images"),
      });
    },
    // Server-only images register during the ssr build, so it must run before the client emits.
    buildApp: {
      order: "pre",
      async handler(builder) {
        appBuild = true;
        const { ssr, client } = builder.environments;
        if (ssr && !ssr.isBuilt) await builder.build(ssr);
        if (client && !client.isBuilt) await builder.build(client);
      },
    },
    async resolveId(id, importer, options) {
      if (id === RUNTIME && isClient(this, options?.ssr)) return this.resolve(RUNTIME + "/dom", importer, { skipSelf: true });
      return null;
    },
    // Builds: a small `?image` descriptor is pure data, so it is inlined into each importing project module
    // (`const name = <frozen descriptor>` on the import's line) instead of becoming its own client chunk (B4'(a)).
    transform: {
      order: "pre",
      async handler(code, id) {
        if (resolved.command !== "build" || id.includes("/node_modules/") || id.includes("\0") || !/\.[cm]?[jt]sx?$/.test(id.split("?")[0]!)) return null;
        if (!code.includes("image")) return null;
        const found = [...code.matchAll(IMAGE_IMPORT)];
        if (!found.length) return null;
        let out = code;
        for (const match of found.reverse()) {
          const [line, name, , spec] = match as unknown as [string, string, string, string];
          const target = await this.resolve(spec, id);
          const request = target && !target.external ? parseImageId(target.id) : null;
          if (!request || request.kind !== "image") continue;
          if (request.warning) this.warn(request.warning);
          this.addWatchFile(request.file);
          let described;
          try {
            described = await pipeline.describe(request.file, request.directives);
          } catch (error) {
            this.error({ message: (error as Error).message, id: request.file });
          }
          const { descriptor, assets, warnings } = described;
          if (JSON.stringify(descriptor).length > IMAGE_INLINE_LIMIT) continue;
          for (const warning of warnings) this.warn(warning);
          for (const asset of assets) registry.set(`${asset.key}.${asset.ext}`, asset);
          const value = `const ${name} = ${frozen(descriptor, true, `${PURE}Symbol.for("rivet.image")`)};`;
          out = out.slice(0, match.index) + value + out.slice(match.index! + line.length);
        }
        return out === code ? null : { code: out, map: null };
      },
    },
    async load(id, options) {
      let request;
      try {
        request = parseImageId(id);
        if (!request) return null;
        if (request.warning) this.warn(request.warning);
        this.addWatchFile(request.file);
        if (request.kind === "svg") {
          // Inline component: sanitised SVG as TSX, compiled for this environment like a project module (static template).
          const { tsx, warnings } = await pipeline.inline(request.file, request.directives);
          for (const warning of warnings) this.warn(warning);
          const server = !isClient(this, options?.ssr);
          const result = compile(tsx, {
            target: server ? "server" : "dom",
            filename: request.file + ".tsx",
          });
          if (result.diagnostics.length) throw new Error(result.diagnostics.map((d) => d.message).join("\n"));
          return result.code;
        }
        const { descriptor, assets, warnings } = await pipeline.describe(request.file, request.directives);
        for (const warning of warnings) this.warn(warning);
        for (const asset of assets) registry.set(`${asset.key}.${asset.ext}`, asset);
        const json = frozen(descriptor, true);
        return request.kind === "image"
          ? `${BRAND}export default ${json};\n`
          : `import { Picture } from "${RUNTIME}";\n${BRAND}const image = ${json};\nexport default (props) => Picture({ ...props, image });\n`;
      } catch (error) {
        this.error({ message: (error as Error).message, id: request?.file ?? id });
      }
    },
    async generateBundle() {
      if (resolved.command !== "build" || !registry.size) return;
      if (!isClient(this)) {
        if (!appBuild) this.warn(SERVER_ONLY_WARNING);
        return;
      }
      const emitted = new Set<string>();
      await Promise.all(
        [...registry.values()].map(async (asset) => {
          if (emitted.has(asset.fileName)) return;
          emitted.add(asset.fileName);
          if (!localeDir) return void this.emitFile({ type: "asset", fileName: asset.fileName, source: await pipeline.encode(asset) });
          // Per-locale build: one copy beside the locale directories (content-addressed names: another locale's build
          // wrote the same bytes already).
          const out = resolve(localeDir, asset.fileName);
          if (
            await access(out).then(
              () => true,
              () => false,
            )
          )
            return;
          await mkdir(dirname(out), { recursive: true });
          await writeFile(out, await pipeline.encode(asset));
        }),
      );
    },
    configureServer(server) {
      const prefix = resolved.base + "@rivet/image/";
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split("?")[0];
        if (!path?.startsWith(prefix)) return next();
        const asset = registry.get(path.slice(prefix.length));
        if (!asset) {
          res.statusCode = 404;
          return res.end();
        }
        const etag = `"${asset.key}"`;
        if (req.headers["if-none-match"] === etag) {
          res.statusCode = 304;
          return res.end();
        }
        try {
          const body = await pipeline.encode(asset);
          res.setHeader("Content-Type", MIME_BY_EXT[asset.ext]!);
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("ETag", etag);
          res.end(body);
        } catch (error) {
          next(error);
        }
      });
    },
  };
}
