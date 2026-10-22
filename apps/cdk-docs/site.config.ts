// Site-wide settings of the @rivetjs/cdk docs (a second site on @rivetjs/docs-kit).

/** Values every page, tool and example share. Env vars override origins at build time. */
export const site = {
  /** Project name shown in the title bar, headings and page titles. */
  name: "rivetjs cdk",
  /** One-line pitch (home hero, default meta description). */
  tagline: "Headless, accessible components and the building blocks under them: React Aria and Angular CDK, ported to Rivet, resumable.",
  /** Public origin of the docs (canonical URLs). */
  origin: process.env.CDK_DOCS_ORIGIN ?? "http://127.0.0.1:4323",
  /** Sibling docs sites for `site:<name>/<path>` content links (production: set the env origins). */
  sites: { docs: process.env.DOCS_ORIGIN ?? "http://127.0.0.1:4321", ui: process.env.UI_DOCS_ORIGIN ?? "http://127.0.0.1:4327" },
  /** Source repository (edit links, issues, API source links). */
  repo: "https://github.com/N1XUS/rivetjs",
  /** Branch or tag the source links point at. */
  repoRef: "main",
  /** npm version or dist-tag that starters install. */
  packageVersion: "0.1.0-alpha.1",
  /** Version label in the top bar. */
  version: "0.1.0-alpha.1",
} as const;
export type Site = typeof site;
