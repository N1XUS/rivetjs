// i18n Vite plugin: catalogs → compiler table, generated declarations, one client build per locale.
// The server build (and dev SSR) carries every locale as a variant; a client build inlines one
// locale (`RIVET_LOCALE`) into `<outDir>/<locale>/` under base `<base><locale>/`.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, isAbsolute } from "node:path";
import type { Plugin, ViteDevServer } from "vite";
import { registerTable, type CompileOptions } from "@rivetjs/compiler";
import { buildTable, loadCatalogs, type I18nConfig } from "./catalog.ts";
import { declarations } from "./types.ts";

/** API the `i18n()` Vite plugin exposes to the Rivet and router plugins. */
export interface I18nPluginApi {
  rivetCompileOptions(server: boolean, id?: string): Partial<CompileOptions>;
  readonly config: I18nConfig;
  /** The client build's locale (`RIVET_LOCALE`), null for server builds and dev. */
  readonly locale: string | null;
  /**
   * Client build: RegExp source (flag `i`) matching the app paths (below the app base) this build's
   * locale serves; null when every path does (server builds, dev, `prefix: "never"`). Read by
   * `@rivetjs/router/vite`: other locales' URLs load the document (switch = navigation).
   */
  readonly clientPaths: string | null;
  /**
   * Dev: `clientPathPattern` of every locale, in `locales` order (null with `prefix: "never"`). Read by
   * `@rivetjs/router/vite`: the dev client routes only paths of the page's own locale, so a switch
   * loads the other locale's document as in a build.
   */
  readonly devPaths: readonly string[] | null;
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** `clientPaths` for `locale` (prefix rules as in resolve.ts `localeFromPath` / router.ts `prefixOf`). */
export function clientPathPattern(locale: string, config: Pick<I18nConfig, "locales" | "defaultLocale" | "routing">): string | null {
  const prefix = config.routing?.prefix ?? "as-needed";
  if (prefix === "never") return null;
  const segment = (l: string) => (typeof prefix === "object" ? (prefix[l] ?? l).replace(/^\/|\/$/g, "").toLowerCase() : l.toLowerCase());
  if (prefix !== "as-needed" || locale !== config.defaultLocale) return "^/" + escapeRegExp(segment(locale)) + "(?:/|$)";
  const others = config.locales.filter((l) => l !== locale).map((l) => escapeRegExp(segment(l)));
  return others.length ? "^(?!/(?:" + others.join("|") + ")(?:/|$))" : null;
}

const TABLE = "rivet-i18n";
/** Dev: client module URLs of a non-default locale carry `?rivet-locale=<locale>`. */
export const DEV_LOCALE_PARAM = "rivet-locale";
const localeOfId = (id: string | undefined): string | null => {
  const query = id?.split("?", 2)[1];
  return query ? new URLSearchParams(query).get(DEV_LOCALE_PARAM) : null;
};

/**
 * `t()` from `@rivetjs/i18n` compiles against `catalogs`. `dts` (default `src/rivet-i18n.d.ts`) is
 * rewritten with the message keys and params. Dev serves every locale from SSR; dev client modules
 * compile for the locale in their `?rivet-locale=` query (default `defaultLocale`), and app modules
 * they import keep that query, so one page loads one locale's module graph (the router adds it to
 * the dev entry). Builds are unchanged. Catalog edits re-register the table and reload the page.
 */
export function i18n(options: I18nConfig & { dts?: string }): Plugin & { api: I18nPluginApi } {
  const { dts = "src/rivet-i18n.d.ts", ...config } = options;
  if (!config.locales.includes(config.defaultLocale)) throw new Error(`i18n: defaultLocale "${config.defaultLocale}" is not in locales`);
  let root = process.cwd(),
    files: string[] = [],
    serve = false;
  const locale = process.env.RIVET_LOCALE || null;
  const users = new Set<string>();
  // Dev state for DevTools (`<base>__rivet/i18n.json`): catalogs and the fallbacks the table uses.
  let devState: { catalogs: { locale: string; file?: string; keys: number }[]; fallbacks: string[]; keys: number } = { catalogs: [], fallbacks: [], keys: 0 };
  const refresh = async () => {
    const loaded = await loadCatalogs(config, root);
    files = loaded.files;
    const { table, warnings } = buildTable(serve && !config.missing ? { ...config, missing: "warn" } : config, loaded.raw);
    for (const warning of warnings) {
      // `key: missing in "de", using "en"`: name the catalog to add it to (dev default `missing: "warn"`).
      const m = /^(.*): missing in "([^"]+)", using "([^"]+)"$/.exec(warning);
      const file = m ? files[config.locales.indexOf(m[2]!)] : undefined;
      console.warn(
        "[rivet:i18n] " +
          warning +
          (m
            ? `\n  fix: add "${m[1]}" to the ${m[2]} catalog${file ? ` (${relative(root, file)})` : ""}; builds fail on it unless \`missing: "warn"\` or a \`fallback\` covers ${m[2]}`
            : ""),
      );
    }
    if (serve) {
      const count = (tree: unknown): number =>
        tree && typeof tree === "object"
          ? Object.values(tree as Record<string, unknown>).reduce<number>((n, v) => n + (typeof v === "string" ? 1 : count(v)), 0)
          : 0;
      devState = {
        catalogs: config.locales.map((l, i) => ({ locale: l, ...(files[i] ? { file: relative(root, files[i]!) } : {}), keys: count(loaded.raw[l]) })),
        fallbacks: warnings,
        keys: Object.keys(table).length,
      };
    }
    registerTable(TABLE, table);
    const file = resolve(root, dts);
    const text = declarations(table, config.locales);
    // Unchanged declarations are not rewritten (no watcher churn).
    if ((await readFile(file, "utf8").catch(() => null)) === text) return;
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, text);
  };
  const api: I18nPluginApi = {
    config,
    locale,
    clientPaths: locale ? clientPathPattern(locale, config) : null,
    devPaths:
      (config.routing?.prefix ?? "as-needed") === "never" || config.locales.length < 2 ? null : config.locales.map((l) => clientPathPattern(l, config)!),
    rivetCompileOptions(server, id) {
      const base: Partial<CompileOptions> = {
        staticCalls: [{ id: TABLE, module: "@rivetjs/i18n", export: "t", prefixLookup: true }],
        variants: [...config.locales],
        ...(config.timeZone ? { timeZone: config.timeZone } : {}),
      };
      if (server) return base;
      const dev = serve ? localeOfId(id) : null;
      const chosen = dev && config.locales.includes(dev) ? dev : (locale ?? config.defaultLocale);
      return { ...base, variant: config.locales.indexOf(chosen) };
    },
  };
  return {
    name: "vite-plugin-rivet-i18n",
    enforce: "pre",
    api,
    config(user, env) {
      serve = env.command === "serve";
      if (serve || user.build?.ssr || env.isSsrBuild) return;
      if (!locale) throw new Error("i18n: client builds need RIVET_LOCALE (one build per locale)");
      if (!config.locales.includes(locale)) throw new Error(`i18n: RIVET_LOCALE "${locale}" is not in locales`);
      const outDir = user.build?.outDir ?? "dist/client";
      return { base: (user.base ?? "/") + locale + "/", build: { outDir: join(outDir, locale) } };
    },
    async configResolved(resolved) {
      root = resolved.root;
      if (new Intl.DateTimeFormat("es", { month: "long" }).format(new Date(2026, 0, 1)) !== "enero")
        console.warn(
          "[rivet:i18n] Node lacks full ICU: dates and numbers will format in English\n  fix: run Node with full ICU (the official builds have it; distro packages may use small-icu)",
        );
      await refresh();
    },
    // DevTools (dev only): locales, catalogs, fallbacks; the panel adds the page's locale and missing keys.
    configureServer(server: ViteDevServer) {
      const path = server.config.base + "__rivet/i18n.json";
      server.middlewares.use((req, res, next) => {
        if ((req.url ?? "").split("?", 1)[0] !== path) return next();
        res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-cache" });
        res.end(JSON.stringify({ locales: config.locales, defaultLocale: config.defaultLocale, param: DEV_LOCALE_PARAM, ...devState }));
      });
    },
    // Dev client: app modules imported by a locale's module keep its `?rivet-locale=` query.
    async resolveId(source, importer, options) {
      if (!serve || !importer || options?.ssr || this.environment?.config?.consumer === "server") return null;
      const wanted = localeOfId(importer);
      if (!wanted) return null;
      const hit = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (!hit || hit.external || hit.id.startsWith("\0")) return hit;
      const [file = "", query = ""] = hit.id.split("?", 2);
      const inside = relative(root, file);
      if (!inside || inside.startsWith("..") || isAbsolute(inside) || /[/\\]node_modules[/\\]/.test(file) || !/\.[cm]?[jt]sx?$/.test(file)) return hit;
      const params = new URLSearchParams(query);
      if (params.has(DEV_LOCALE_PARAM)) return hit;
      params.set(DEV_LOCALE_PARAM, wanted);
      return { ...hit, id: file + "?" + params.toString() };
    },
    transform(code, id) {
      if (code.includes("@rivetjs/i18n")) users.add(id);
      return null;
    },
    async handleHotUpdate({ file, server }) {
      if (!files.includes(file)) return;
      await refresh();
      for (const id of users) {
        const mod = server.moduleGraph.getModuleById(id);
        if (mod) server.moduleGraph.invalidateModule(mod);
      }
      server.ws.send({ type: "full-reload" });
      return [];
    },
  };
}
