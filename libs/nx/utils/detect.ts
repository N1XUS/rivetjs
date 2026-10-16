// What kind of Rivet project a folder holds, read from its config files' text (no config is executed: inference
// must stay fast and side-effect free). Used by the inference plugin, the executors and the generators.

/** Vite config file names Vite itself looks for, in its order. */
export const VITE_CONFIGS = ["vite.config.ts", "vite.config.mts", "vite.config.js", "vite.config.mjs"] as const;
/** Vitest config file names. */
export const VITEST_CONFIGS = ["vitest.config.ts", "vitest.config.mts", "vitest.config.js", "vitest.config.mjs"] as const;

export interface ProjectFacts {
  /** `app`: file-routed (`rivetRouter`); `spa`: `rivet()` compiler plugin without the router; `lib`: Rivet test setup only. */
  kind: "app" | "spa" | "lib";
  /** `rivetRouter({ mode: "static" })`: pages are prerendered at build time. */
  static: boolean;
  /** `rivetRouter({ mode: "csr" })`: browser-rendered app, no server build. */
  csr: boolean;
  /** A vitest config (or a vite config `test` block) with `rivetTest()`. */
  test: boolean;
  /** The project has a `tsconfig.json`. */
  tsconfig: boolean;
  /** Locales of `@rivetjs/i18n` (`i18n.config.ts` `locales: [...]`): one client build each. */
  locales?: string[];
  /** Platform target of `rivetRouter({ adapter: "vercel" | { name: "vercel", … } })` (create-rivet `--deploy`). */
  adapter?: string;
  /** The project's own preview server (`serve.js`). */
  serveScript: boolean;
  /** The project's own prerender step (`prerender.js`). */
  prerenderScript: boolean;
}

export interface ConfigTexts {
  vite?: string;
  vitest?: string;
  i18n?: string;
  files: { tsconfig: boolean; serveScript: boolean; prerenderScript: boolean };
}

const ROUTER = /@rivetjs\/router\/vite|\brivetRouter\s*\(/;
const COMPILER = /@rivetjs\/compiler\/vite/;
const TESTING = /@rivetjs\/testing\/vite|\brivetTest\s*\(/;
const I18N = /@rivetjs\/i18n\/vite/;

/** `rivetRouter({ … mode: "static" … })` (the router's `mode` option; the first `rivetRouter(` call). */
export function routerMode(vite: string): string | undefined {
  const at = vite.search(/\brivetRouter\s*\(/);
  if (at < 0) return undefined;
  const call = vite.slice(at, at + 2000);
  return /\bmode\s*:\s*["'`](\w+)["'`]/.exec(call)?.[1];
}

/** `rivetRouter({ adapter: "x" })` or `rivetRouter({ adapter: { name: "x", … } })`: the platform target name. */
export function routerAdapter(vite: string): string | undefined {
  const at = vite.search(/\brivetRouter\s*\(/);
  if (at < 0) return undefined;
  const call = vite.slice(at, at + 2000);
  return /\badapter\s*:\s*(?:\{[^}]*?\bname\s*:\s*)?["'`]([\w-]+)["'`]/.exec(call)?.[1];
}

/** `locales: ["en", "de"]` of an i18n config. */
export function i18nLocales(config: string): string[] | undefined {
  const list = /\blocales\s*:\s*\[([^\]]*)\]/.exec(config)?.[1];
  if (list === undefined) return undefined;
  const locales = [...list.matchAll(/["'`]([^"'`]+)["'`]/g)].map((match) => match[1]!);
  return locales.length ? locales : undefined;
}

/** The facts of a project from its config texts; `undefined` when it is not a Rivet project. */
export function detectProject(texts: ConfigTexts): ProjectFacts | undefined {
  const vite = texts.vite ?? "";
  const router = ROUTER.test(vite);
  const compiler = COMPILER.test(vite);
  const test = TESTING.test(texts.vitest ?? "") || (TESTING.test(vite) && /\btest\s*:/.test(vite));
  if (!router && !compiler && !test) return undefined;
  const mode = router ? routerMode(vite) : undefined;
  const facts: ProjectFacts = {
    kind: router ? "app" : compiler ? "spa" : "lib",
    static: mode === "static",
    csr: mode === "csr",
    test,
    tsconfig: texts.files.tsconfig,
    serveScript: texts.files.serveScript,
    prerenderScript: texts.files.prerenderScript,
  };
  const adapter = router ? routerAdapter(vite) : undefined;
  if (adapter) facts.adapter = adapter;
  const locales = I18N.test(vite) && texts.i18n ? i18nLocales(texts.i18n) : undefined;
  if (locales) facts.locales = locales;
  return facts;
}
