// Site-wide settings of the @rivetjs/ui docs (third site on @rivetjs/docs-kit, next to apps/docs and apps/cdk-docs).

/** Values every page, tool and example share. Env vars override origins at build time. */
export const site = {
  /** Project name shown in the title bar, headings and page titles. */
  name: "rivetjs ui",
  /** One-line pitch (home hero, default meta description). */
  tagline: "Styled compound components for Rivet on accessible cdk behaviour: themeable, server-rendered and resumable.",
  /** Public origin of the docs (canonical URLs). */
  origin: process.env.UI_DOCS_ORIGIN ?? "http://127.0.0.1:4327",
  /** Sibling docs sites for `site:<name>/<path>` content links (production: set the env origins). */
  sites: { docs: process.env.DOCS_ORIGIN ?? "http://127.0.0.1:4321", cdk: process.env.CDK_DOCS_ORIGIN ?? "http://127.0.0.1:4323" },
  /** Source repository (edit links, issues, API source links). */
  repo: "https://github.com/N1XUS/rivetjs",
  /** Branch or tag the source links point at. */
  repoRef: "main",
  /** npm version or dist-tag that starters install. */
  packageVersion: "experimental",
  /** Version label in the top bar. */
  version: "0.0.0-experimental",
} as const;
export type Site = typeof site;
