export interface RouteGeneratorSchema {
  /** Route path under `src/routes` (`about`, `blog/[slug]`, `docs/[[lang]]/[...path]`, `(marketing)/pricing`, `blog/index`). */
  path: string;
  /** The Rivet app. */
  project: string;
  /** A `load(…)` export (`loader`) + typed `data` prop. */
  loader?: boolean;
  /** An `actions(…)` export (`forms`) + a progressive-enhancement form (node adapter only). */
  action?: boolean;
  /** A `guard(…)` export (`access`). */
  guard?: boolean;
  /** Also create a `_layout.tsx` in the route's folder (when it has none). */
  layout?: boolean;
  skipFormat?: boolean;
}
