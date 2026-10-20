export interface LayoutGeneratorSchema {
  /** Folder under `src/routes` the layout wraps (`blog`, `(marketing)`); empty = the root layout. */
  directory?: string;
  /** The Rivet app. */
  project: string;
  /** A `guard(…)` export for the whole folder (redirects to /login without a `session` cookie). */
  guard?: boolean;
  skipFormat?: boolean;
}
