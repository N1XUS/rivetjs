// Site-wide settings. The project name lives here only: a rename is one edit.

/** Values every page, tool and example share. Env vars override origins at build time. */
export const site = {
  /** Project name shown in the title bar, headings and page titles. */
  name: "rivetjs",
  /** One-line pitch (home hero, default meta description). */
  tagline: "Pages render on the server and keep working in the browser without re-running your components.",
  /** Public origin of the docs (canonical URLs). */
  origin: process.env.DOCS_ORIGIN ?? "http://127.0.0.1:4321",
  /** Sibling docs sites for `site:<name>/<path>` content links (production: set the env origins). */
  sites: { cdk: process.env.CDK_DOCS_ORIGIN ?? "http://127.0.0.1:4323", ui: process.env.UI_DOCS_ORIGIN ?? "http://127.0.0.1:4327" },
  /** Source repository (edit links, issues, API source links). */
  repo: "https://github.com/N1XUS/rivetjs",
  /** Branch or tag the source links point at. */
  repoRef: "main",
  /** npm version or dist-tag that starters install. */
  packageVersion: "experimental",
  /** Version label in the top bar. */
  version: "0.0.0-experimental",
  /** Pages that run no code before the first interaction (docs-kit `leanPages`): the home page is the proof. */
  leanPages: ["/"],
} as const;
export type Site = typeof site;
