export interface RouteGeneratorSchema {
  /** Route path under `src/routes` (`about`, `blog/[slug]`, `docs/[[lang]]/[...path]`, `(marketing)/pricing`, `blog/index`). */
  path: string;
  /** The Rivet app. */
  project: string;
  /** `serverLoad` + typed `data` prop. */
  loader?: boolean;
  /** `serverActions` + a progressive-enhancement form (node adapter only). */
  action?: boolean;
  /** `serverGuard`. */
  guard?: boolean;
  /** Also create a `_layout.tsx` in the route's folder (when it has none). */
  layout?: boolean;
  skipFormat?: boolean;
}
